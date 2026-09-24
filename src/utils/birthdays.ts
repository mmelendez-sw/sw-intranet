/**
 * Birthday helpers: spreadsheet import, directory cross-reference, and month lists.
 *
 * Birthdays live in SharePoint (birthdays.json) as month/day only. Entra has no birthday
 * field, so at display time each entry is matched against the live Graph directory and only
 * active, non-contractor employees are shown — people who leave drop off automatically.
 */
import type { BirthdayPerson } from '../services/contentService';
import { GraphUser, isContractorOrConsultant } from '../services/directoryService';

/** Fired on window after birthdays.json is saved so other widgets (sidebar) refresh. */
export const BIRTHDAYS_UPDATED_EVENT = 'intranet-birthdays-updated';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, '')
    .trim();

/** Surname key: lowercase letters only, so "Rosales-Hart" / "de Andrade Santos" compare cleanly. */
const lastKey = (value: string): string => normalize(value).replace(/[\s-]/g, '');
const firstToken = (value: string): string => normalize(value).split(/\s+/)[0] ?? '';

interface NameParts {
  first: string;
  last: string;
}

/** "First Middle Last" → first token + everything after it. */
function splitDisplayName(name: string): NameParts {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { first: firstToken(name), last: '' };
  return { first: firstToken(parts[0]), last: lastKey(parts.slice(1).join(' ')) };
}

function userNameParts(user: GraphUser): NameParts {
  if (user.givenName?.trim() && user.surname?.trim()) {
    return { first: firstToken(user.givenName), last: lastKey(user.surname) };
  }
  return splitDisplayName(user.displayName);
}

/**
 * Find the directory user for a birthday entry: email first, then exact first + last name,
 * then same last name + first initial when that is unique (covers Nick/Nicholas, Steve/Steven).
 */
export function matchBirthdayToDirectory(
  person: Pick<BirthdayPerson, 'name' | 'email'>,
  users: GraphUser[]
): GraphUser | null {
  const email = person.email?.trim().toLowerCase();
  if (email) {
    const byEmail = users.find((u) => u.mail?.toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  const target = splitDisplayName(person.name);
  if (!target.first || !target.last) return null;

  const sameLast = users.filter((u) => {
    const parts = userNameParts(u);
    return parts.last === target.last || lastKey(u.displayName).endsWith(target.last);
  });

  const exact = sameLast.find((u) => userNameParts(u).first === target.first);
  if (exact) return exact;

  const sameInitial = sameLast.filter((u) => userNameParts(u).first[0] === target.first[0]);
  return sameInitial.length === 1 ? sameInitial[0] : null;
}

export type BirthdayDirectoryStatus = 'active' | 'contractor' | 'not-found' | 'unknown';

export function birthdayDirectoryStatus(
  person: BirthdayPerson,
  users: GraphUser[] | null
): BirthdayDirectoryStatus {
  if (!users) return 'unknown';
  const match = matchBirthdayToDirectory(person, users);
  if (!match) return 'not-found';
  return isContractorOrConsultant(match) ? 'contractor' : 'active';
}

/**
 * Entries that should be celebrated: matched to an active, non-contractor employee.
 * When the directory can't be read (users === null) everything is shown rather than nothing.
 */
export function filterActiveBirthdays(people: BirthdayPerson[], users: GraphUser[] | null): BirthdayPerson[] {
  if (!users) return people;
  return people.filter((p) => birthdayDirectoryStatus(p, users) === 'active');
}

export function birthdaysInMonth(people: BirthdayPerson[], month: number): BirthdayPerson[] {
  return people
    .filter((p) => p.month === month)
    .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

// ── Spreadsheet import ──────────────────────────────────────────────────────

export interface BirthdayImportRow {
  name: string;
  month: number;
  day: number;
  department?: string;
}

export interface BirthdayImportResult {
  rows: BirthdayImportRow[];
  skipped: string[];
}

const DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/;

/** "Last,First Middle" → "First Last"; plain "First Last" passes through. */
export function toDisplayName(raw: string): string {
  const value = raw.trim().replace(/\s+/g, ' ');
  const comma = value.indexOf(',');
  if (comma === -1) return value;
  const last = value.slice(0, comma).trim();
  const given = value.slice(comma + 1).trim().split(' ')[0] ?? '';
  return `${given} ${last}`.trim();
}

/**
 * Parse rows pasted from Excel (tab-separated). Uses the header row when present
 * ("Birth Date", "Employee Name", "Department…"); otherwise finds the M/D cell and the
 * "Last,First" cell in each row.
 */
export function parseBirthdaySpreadsheet(text: string): BirthdayImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: BirthdayImportRow[] = [];
  const skipped: string[] = [];
  if (!lines.length) return { rows, skipped };

  const split = (line: string) =>
    (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/)).map((c) => c.trim());

  let dateCol = -1;
  let nameCol = -1;
  let deptCol = -1;
  const header = split(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = header.some((c) => c.includes('birth')) && header.some((c) => c.includes('name'));
  if (hasHeader) {
    dateCol = header.findIndex((c) => c.includes('birth'));
    nameCol = header.findIndex((c) => c.includes('employee') || c === 'name');
    if (nameCol === -1) nameCol = header.findIndex((c) => c.includes('name') && !c.includes('month') && !c.includes('company'));
    deptCol = header.findIndex((c) => c.includes('department') || c === 'team');
  }

  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = split(line);
    const dateCell = dateCol >= 0 ? cells[dateCol] : cells.find((c) => DATE_RE.test(c));
    const nameCell = nameCol >= 0 ? cells[nameCol] : cells.find((c) => /^[^\d,]+,[^\d,]+$/.test(c));
    const match = dateCell?.match(DATE_RE);
    const month = match ? Number(match[1]) : NaN;
    const day = match ? Number(match[2]) : NaN;
    if (!nameCell || !match || month < 1 || month > 12 || day < 1 || day > 31) {
      skipped.push(line);
      continue;
    }
    rows.push({
      name: toDisplayName(nameCell),
      month,
      day,
      department: deptCol >= 0 ? cells[deptCol] || undefined : undefined,
    });
  }
  return { rows, skipped };
}

/**
 * Merge imported rows into the current list. Rows matched to a directory user take that
 * user's display name and email; an existing entry for the same person is updated in place.
 */
export function mergeBirthdayImport(
  existing: BirthdayPerson[],
  rows: BirthdayImportRow[],
  users: GraphUser[] | null
): { people: BirthdayPerson[]; notFound: string[] } {
  const people = existing.map((p) => ({ ...p }));
  const notFound: string[] = [];
  const keyOf = (p: { name: string; email?: string }) =>
    p.email?.toLowerCase() || `${splitDisplayName(p.name).first}|${splitDisplayName(p.name).last}`;

  rows.forEach((row, i) => {
    const user = users ? matchBirthdayToDirectory({ name: row.name }, users) : null;
    if (users && !user) notFound.push(row.name);
    const next: BirthdayPerson = {
      id: `bday-${Date.now()}-${i}`,
      name: user?.displayName || row.name,
      month: row.month,
      day: row.day,
      ...(user?.mail ? { email: user.mail } : {}),
      ...(row.department || user?.department ? { department: row.department || user?.department || undefined } : {}),
    };
    const idx = people.findIndex((p) => keyOf(p) === keyOf(next));
    if (idx >= 0) people[idx] = { ...next, id: people[idx].id };
    else people.push(next);
  });

  people.sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name));
  return { people, notFound };
}
