/**
 * AM roster for the Monthly Term Sheet Leaderboard (counts + view access on `/`).
 */

export type TermSheetRosterEntry = {
  email: string;
  matchKey: string;
  displayName: string;
};

export const TERM_SHEET_RANKING_ROSTER: TermSheetRosterEntry[] = [
  { email: 'BSeidenberg@symphonyinfra.com', matchKey: 'Seidenberg', displayName: 'Brandon Seidenberg' },
  { email: 'CPolidoro@symphonyinfra.com', matchKey: 'Polidoro', displayName: 'Chris Polidoro' },
  { email: 'DKing@symphonyinfra.com', matchKey: 'King', displayName: 'Dylan King' },
  { email: 'esanandaji@symphonyinfra.com', matchKey: 'Sanandaji', displayName: 'Ethan Sanandaji' },
  { email: 'mkossak@symphonyinfra.com', matchKey: 'Kossak', displayName: 'Michael Kossak' },
  { email: 'NBocchi@symphonyinfra.com', matchKey: 'Bocchi', displayName: 'Nick Bocchi' },
  { email: 'scasey@symphonyinfra.com', matchKey: 'Casey', displayName: 'Shawn Casey' },
  { email: 'SSchamberg@symphonyinfra.com', matchKey: 'Schamberg', displayName: 'Steve Schamberg' },
];

/** Non-AM viewers of the leaderboard (leadership + intranet admins). */
const TERM_SHEET_RANKINGS_EXTRA_VIEWERS = [
  'mmelendez@symphonyinfra.com',
  'atabbacchino@symphonyinfra.com',
  'bsteinthal@symphonyinfra.com',
  'arivera@symphonyinfra.com',
  'htolani@symphonyinfra.com',
];

/** Lowercased emails allowed to see the leaderboard on the main homepage. */
export const TERM_SHEET_RANKINGS_ALLOWLIST = new Set(
  [
    ...TERM_SHEET_RANKING_ROSTER.map((entry) => entry.email),
    ...TERM_SHEET_RANKINGS_EXTRA_VIEWERS,
  ].map((email) => email.toLowerCase())
);
