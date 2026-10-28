/**
 * Work anniversaries and new-hire welcomes from Entra `employeeHireDate`. Only people with a
 * hire date set in Entra appear; HR fills it in for new starters.
 */
import { GraphUser, isContractorOrConsultant } from '../services/directoryService';

/** New starters are welcomed on the home page for this many days, start day included. */
export const NEW_HIRE_WELCOME_DAYS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Entra stores the hire date as midnight in the editor's timezone, converted to UTC
 * (e.g. 2026-10-18T18:30:00Z for 19 October entered from UTC+5:30). Rounding to the nearest
 * UTC day recovers the calendar date for any offset within ±12 h.
 */
export function hireCalendarDate(employeeHireDate?: string | null): { y: number; m: number; d: number } | null {
  const t = Date.parse(employeeHireDate ?? '');
  if (!Number.isFinite(t)) return null;
  const rounded = new Date(t + DAY_MS / 2);
  return { y: rounded.getUTCFullYear(), m: rounded.getUTCMonth() + 1, d: rounded.getUTCDate() };
}

const localDayNumber = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / DAY_MS);

const eligible = (u: GraphUser) => !isContractorOrConsultant(u);

export type WorkAnniversary = { user: GraphUser; years: number };

/** People whose hire month/day is today (local), one year or more ago. 29 Feb counts on 28 Feb. */
export function todaysWorkAnniversaries(users: GraphUser[] | null, now = new Date()): WorkAnniversary[] {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const isLeap = (year: number) => new Date(year, 1, 29).getDate() === 29;
  const out: WorkAnniversary[] = [];
  for (const user of users ?? []) {
    const hire = hireCalendarDate(user.employeeHireDate);
    if (!hire || hire.y >= y || !eligible(user)) continue;
    const onFeb28 = hire.m === 2 && hire.d === 29 && !isLeap(y) && m === 2 && d === 28;
    if ((hire.m === m && hire.d === d) || onFeb28) out.push({ user, years: y - hire.y });
  }
  return out.sort((a, b) => b.years - a.years || a.user.displayName.localeCompare(b.user.displayName));
}

export type NewHire = { user: GraphUser; startedOn: Date };

/** People who started in the last NEW_HIRE_WELCOME_DAYS days (not future start dates). */
export function recentNewHires(users: GraphUser[] | null, now = new Date()): NewHire[] {
  const today = localDayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const out: NewHire[] = [];
  for (const user of users ?? []) {
    const hire = hireCalendarDate(user.employeeHireDate);
    if (!hire || !eligible(user)) continue;
    const age = today - localDayNumber(hire.y, hire.m, hire.d);
    if (age >= 0 && age < NEW_HIRE_WELCOME_DAYS) {
      out.push({ user, startedOn: new Date(hire.y, hire.m - 1, hire.d) });
    }
  }
  return out.sort((a, b) => b.startedOn.getTime() - a.startedOn.getTime() || a.user.displayName.localeCompare(b.user.displayName));
}
