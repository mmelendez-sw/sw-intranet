/**
 * Who sees and who appears on the Monthly Term Sheet Leaderboard, driven by Entra:
 *   - Appears: every directory user titled "Acquisitions Manager" (zeros included), plus
 *     anyone the counts API returns, so nobody's term sheets are hidden by a title or
 *     name mismatch.
 *   - Can view: the same managers, plus TERM_SHEET_LEADERBOARD_VIEWERS in authConfig.
 * No hardcoded roster: a new manager appears once IT sets their Entra job title.
 */
import { isTermSheetRankingsAllowlisted } from '../authConfig';
import type { GraphUser } from '../services/directoryService';

export type LeaderboardPerson = {
  email: string;
  displayName: string;
  matchKey: string;
  count: number;
};

export type ManagerCount = { name: string; count: number };

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeEmail = (email: string) =>
  email.trim().toLowerCase().replace(/@symphonywireless\.com$/, '@symphonyinfra.com');

/** "Acquisitions Manager" (also accepts the singular "Acquisition Manager"), any case/spacing. */
export function isAcquisitionsManagerTitle(jobTitle?: string | null): boolean {
  return /^acquisitions? manager$/i.test((jobTitle ?? '').trim().replace(/\s+/g, ' '));
}

/** Directory users titled Acquisitions Manager, sorted by name. */
export function acquisitionsManagers(users: GraphUser[] | null | undefined): GraphUser[] {
  return (users ?? [])
    .filter((u) => isAcquisitionsManagerTitle(u.jobTitle))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Named viewers always; Acquisitions Managers once the directory has loaded.
 * While the directory is loading or unavailable, only named viewers see the leaderboard.
 */
export function canViewTermSheetLeaderboard(
  email: string | undefined,
  users: GraphUser[] | null | undefined
): boolean {
  if (!email) return false;
  if (isTermSheetRankingsAllowlisted(email)) return true;
  const target = normalizeEmail(email);
  return (users ?? []).some(
    (u) => !!u.mail && normalizeEmail(u.mail) === target && isAcquisitionsManagerTitle(u.jobTitle)
  );
}

/**
 * Everyone who appears on the leaderboard: each manager with their count (0 if none),
 * plus anyone in `counts` who isn't a titled manager. Names match case/space-insensitively.
 */
export function buildLeaderboardPeople(
  managers: GraphUser[],
  counts: ManagerCount[]
): LeaderboardPerson[] {
  const countByName = new Map<string, ManagerCount>();
  for (const row of counts) {
    const key = normalizeName(row.name);
    const prev = countByName.get(key);
    countByName.set(key, { name: prev?.name ?? row.name, count: (prev?.count ?? 0) + row.count });
  }

  const people: LeaderboardPerson[] = [];
  for (const manager of managers) {
    const key = normalizeName(manager.displayName);
    if (people.some((p) => normalizeName(p.displayName) === key)) continue;
    people.push({
      email: manager.mail ?? '',
      displayName: manager.displayName,
      matchKey: manager.displayName,
      count: countByName.get(key)?.count ?? 0,
    });
    countByName.delete(key);
  }

  for (const extra of countByName.values()) {
    people.push({ email: '', displayName: extra.name, matchKey: extra.name, count: extra.count });
  }
  return people;
}
