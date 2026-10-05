import { describe, it, expect } from 'vitest';
import type { GraphUser } from '../services/directoryService';
import {
  acquisitionsManagers,
  buildLeaderboardPeople,
  canViewTermSheetLeaderboard,
  isAcquisitionsManagerTitle,
} from './termSheetLeaderboard';

const user = (displayName: string, mail: string | null, jobTitle: string | null): GraphUser => ({
  id: displayName,
  displayName,
  mail,
  jobTitle,
  department: null,
});

// Mirrors Entra as of Oct 2026 (8 managers), plus advisors / directors who must not qualify.
const DIRECTORY: GraphUser[] = [
  user('Steve Schamberg', 'SSchamberg@symphonyinfra.com', 'Acquisitions Manager'),
  user('Nick Bocchi', 'nbocchi@symphonyinfra.com', 'Acquisitions Manager'),
  user('Brandon Seidenberg', 'BSeidenberg@symphonyinfra.com', 'Acquisitions Manager'),
  user('Michael Kossak', 'mkossak@symphonyinfra.com', 'Acquisitions Manager'),
  user('Dylan King', 'DKing@symphonyinfra.com', 'Acquisitions Manager'),
  user('Ethan Sanandaji', 'esanandaji@symphonyinfra.com', 'Acquisitions Manager'),
  user('Shawn Casey', 'SCasey@symphonyinfra.com', 'Acquisitions Manager'),
  user('Chris Polidoro', 'CPolidoro@symphonyinfra.com', 'Acquisitions Manager'),
  user('Jeremy Scott', 'JScott@symphonyinfra.com', 'Acquisitions Advisor'),
  user('Anthony Tabbacchino', 'atabbacchino@symphonyinfra.com', 'Director, Acquisitions'),
  user('Brad Steinthal', 'bsteinthal@symphonyinfra.com', 'Director, Acquisitions Advisor'),
  user('Shirley Huang', 'shuang@symphonyinfra.com', 'Software Engineer'),
];

describe('isAcquisitionsManagerTitle', () => {
  it.each([
    'Acquisitions Manager',
    'Acquisition Manager',
    'acquisitions manager',
    '  Acquisitions   Manager ',
  ])('accepts %j', (title) => {
    expect(isAcquisitionsManagerTitle(title)).toBe(true);
  });

  it.each([
    'Acquisitions Advisor',
    'Director, Acquisitions',
    'Senior Acquisitions Manager',
    'Acquisitions Manager (Consultant)',
    'Manager',
    '',
    null,
    undefined,
  ])('rejects %j', (title) => {
    expect(isAcquisitionsManagerTitle(title)).toBe(false);
  });
});

describe('acquisitionsManagers', () => {
  it('returns the 8 titled managers sorted by name', () => {
    expect(acquisitionsManagers(DIRECTORY).map((u) => u.displayName)).toEqual([
      'Brandon Seidenberg',
      'Chris Polidoro',
      'Dylan King',
      'Ethan Sanandaji',
      'Michael Kossak',
      'Nick Bocchi',
      'Shawn Casey',
      'Steve Schamberg',
    ]);
  });

  it('handles a directory that is loading (undefined) or unavailable (null)', () => {
    expect(acquisitionsManagers(undefined)).toEqual([]);
    expect(acquisitionsManagers(null)).toEqual([]);
  });

  it('does not mutate the directory list', () => {
    const copy = [...DIRECTORY];
    acquisitionsManagers(DIRECTORY);
    expect(DIRECTORY).toEqual(copy);
  });
});

describe('canViewTermSheetLeaderboard', () => {
  it('allows Acquisitions Managers by Entra title (case-insensitive email)', () => {
    expect(canViewTermSheetLeaderboard('nbocchi@symphonyinfra.com', DIRECTORY)).toBe(true);
    expect(canViewTermSheetLeaderboard('sschamberg@SYMPHONYINFRA.com', DIRECTORY)).toBe(true);
  });

  it('matches legacy symphonywireless.com sign-ins to the directory mail', () => {
    expect(canViewTermSheetLeaderboard('DKing@symphonywireless.com', DIRECTORY)).toBe(true);
  });

  it('allows the named viewers even before the directory loads', () => {
    for (const email of [
      'mmelendez@symphonyinfra.com',
      'arivera@symphonyinfra.com',
      'bsteinthal@symphonyinfra.com',
      'atabbacchino@symphonyinfra.com',
      'htolani@symphonyinfra.com',
    ]) {
      expect(canViewTermSheetLeaderboard(email, undefined)).toBe(true);
    }
  });

  it('hides it from managers until the directory loads, and when it fails', () => {
    expect(canViewTermSheetLeaderboard('nbocchi@symphonyinfra.com', undefined)).toBe(false);
    expect(canViewTermSheetLeaderboard('nbocchi@symphonyinfra.com', null)).toBe(false);
  });

  it('rejects advisors, other staff, unknown emails, and no email', () => {
    expect(canViewTermSheetLeaderboard('JScott@symphonyinfra.com', DIRECTORY)).toBe(false);
    expect(canViewTermSheetLeaderboard('shuang@symphonyinfra.com', DIRECTORY)).toBe(false);
    expect(canViewTermSheetLeaderboard('nobody@symphonyinfra.com', DIRECTORY)).toBe(false);
    expect(canViewTermSheetLeaderboard(undefined, DIRECTORY)).toBe(false);
  });

  it('picks up a new manager as soon as Entra has the title (no code change)', () => {
    const withNewHire = [...DIRECTORY, user('New Hire', 'nhire@symphonyinfra.com', 'Acquisitions Manager')];
    expect(canViewTermSheetLeaderboard('nhire@symphonyinfra.com', DIRECTORY)).toBe(false);
    expect(canViewTermSheetLeaderboard('nhire@symphonyinfra.com', withNewHire)).toBe(true);
  });

  it('ignores directory users with no mail', () => {
    const noMail = [user('No Mail', null, 'Acquisitions Manager')];
    expect(canViewTermSheetLeaderboard('nomail@symphonyinfra.com', noMail)).toBe(false);
  });
});

describe('buildLeaderboardPeople', () => {
  const managers = acquisitionsManagers(DIRECTORY);

  it('lists every manager, with 0 for those without counts', () => {
    const people = buildLeaderboardPeople(managers, [{ name: 'Nick Bocchi', count: 3 }]);
    expect(people).toHaveLength(8);
    expect(people.find((p) => p.displayName === 'Nick Bocchi')).toEqual({
      email: 'nbocchi@symphonyinfra.com',
      displayName: 'Nick Bocchi',
      matchKey: 'Nick Bocchi',
      count: 3,
    });
    expect(people.filter((p) => p.count === 0)).toHaveLength(7);
  });

  it('matches count names case- and space-insensitively', () => {
    const people = buildLeaderboardPeople(managers, [{ name: '  dylan   KING ', count: 2 }]);
    expect(people.find((p) => p.displayName === 'Dylan King')!.count).toBe(2);
    expect(people).toHaveLength(8);
  });

  it('adds people with counts who are not titled managers, instead of dropping them', () => {
    const people = buildLeaderboardPeople(managers, [{ name: 'Jeremy Scott', count: 1 }]);
    expect(people).toHaveLength(9);
    expect(people[8]).toEqual({ email: '', displayName: 'Jeremy Scott', matchKey: 'Jeremy Scott', count: 1 });
  });

  it('sums duplicate count rows for the same person', () => {
    const people = buildLeaderboardPeople(managers, [
      { name: 'Shawn Casey', count: 1 },
      { name: 'shawn casey', count: 2 },
      { name: 'Outside Person', count: 1 },
      { name: 'outside  person', count: 1 },
    ]);
    expect(people.find((p) => p.displayName === 'Shawn Casey')!.count).toBe(3);
    expect(people.find((p) => p.displayName === 'Outside Person')!.count).toBe(2);
  });

  it('shows only people with counts while the directory is unavailable', () => {
    expect(buildLeaderboardPeople([], [{ name: 'Nick Bocchi', count: 1 }])).toEqual([
      { email: '', displayName: 'Nick Bocchi', matchKey: 'Nick Bocchi', count: 1 },
    ]);
  });

  it('lists a manager once even if Entra has two accounts with the same name', () => {
    const dupes = [...managers, user('Nick Bocchi', 'nbocchi2@symphonyinfra.com', 'Acquisitions Manager')];
    const people = buildLeaderboardPeople(dupes, [{ name: 'Nick Bocchi', count: 1 }]);
    expect(people.filter((p) => p.displayName === 'Nick Bocchi')).toHaveLength(1);
  });
});
