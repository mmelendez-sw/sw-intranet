import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MONTH_NAMES,
  birthdayDirectoryStatus,
  birthdaysInMonth,
  filterActiveBirthdays,
  findBirthdayCoverageGaps,
  matchBirthdayToDirectory,
  mergeBirthdayImport,
  parseBirthdaySpreadsheet,
  toDisplayName,
} from './birthdays';
import type { BirthdayPerson } from '../services/contentService';
import type { GraphUser } from '../services/directoryService';

const user = (overrides: Partial<GraphUser> & { id: string; displayName: string }): GraphUser => ({
  jobTitle: 'Analyst',
  department: 'Ops',
  mail: null,
  ...overrides,
});

const person = (overrides: Partial<BirthdayPerson> & { name: string }): BirthdayPerson => ({
  id: `p-${overrides.name}`,
  month: 1,
  day: 1,
  ...overrides,
});

describe('MONTH_NAMES', () => {
  it('lists 12 months starting with January', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });
});

describe('matchBirthdayToDirectory', () => {
  const users: GraphUser[] = [
    user({ id: '1', displayName: 'Nicholas Bocchi', givenName: 'Nicholas', surname: 'Bocchi', mail: 'NBocchi@symphonyinfra.com' }),
    user({ id: '2', displayName: 'Juliana de Andrade Santos', givenName: 'Juliana', surname: 'de Andrade Santos' }),
    user({ id: '3', displayName: 'Mary Rosales-Hart' }),
    user({ id: '4', displayName: 'Steven Smith', givenName: 'Steven', surname: 'Smith' }),
    user({ id: '5', displayName: 'Sarah Smith', givenName: 'Sarah', surname: 'Smith' }),
    user({ id: '6', displayName: 'José Núñez', givenName: 'José', surname: 'Núñez' }),
  ];

  it('matches by email first, case-insensitively', () => {
    const match = matchBirthdayToDirectory({ name: 'Totally Different', email: ' nbocchi@SymphonyInfra.com ' }, users);
    expect(match?.id).toBe('1');
  });

  it('falls back to name when the email is not in the directory', () => {
    const match = matchBirthdayToDirectory({ name: 'Nicholas Bocchi', email: 'old@example.com' }, users);
    expect(match?.id).toBe('1');
  });

  it('matches exact first + last name', () => {
    expect(matchBirthdayToDirectory({ name: 'Steven Smith' }, users)?.id).toBe('4');
  });

  it('matches multi-word surnames regardless of spacing/case', () => {
    expect(matchBirthdayToDirectory({ name: 'juliana De Andrade Santos' }, users)?.id).toBe('2');
  });

  it('matches hyphenated surnames from displayName when given/surname are missing', () => {
    expect(matchBirthdayToDirectory({ name: 'Mary Rosales Hart' }, users)?.id).toBe('3');
  });

  it('strips diacritics when comparing', () => {
    expect(matchBirthdayToDirectory({ name: 'Jose Nunez' }, users)?.id).toBe('6');
  });

  it('matches a nickname by unique last name + first initial (Nick → Nicholas)', () => {
    expect(matchBirthdayToDirectory({ name: 'Nick Bocchi' }, users)?.id).toBe('1');
  });

  it('refuses an ambiguous initial match (two S. Smiths)', () => {
    expect(matchBirthdayToDirectory({ name: 'Steve Smith' }, users)).toBeNull();
  });

  it('returns null for single-word names with no email', () => {
    expect(matchBirthdayToDirectory({ name: 'Cher' }, users)).toBeNull();
  });

  it('returns null when nobody shares the last name', () => {
    expect(matchBirthdayToDirectory({ name: 'Nobody Here' }, users)).toBeNull();
  });
});

describe('birthdayDirectoryStatus / filterActiveBirthdays', () => {
  const users: GraphUser[] = [
    user({ id: '1', displayName: 'Alice Active' }),
    user({ id: '2', displayName: 'Carl Contract', jobTitle: 'Field Contractor' }),
    user({ id: '3', displayName: 'Connie Consult', jobTitle: 'Engineer (Consultant)' }),
  ];
  const people = [
    person({ name: 'Alice Active' }),
    person({ name: 'Carl Contract' }),
    person({ name: 'Connie Consult' }),
    person({ name: 'Gone Person' }),
  ];

  it('reports unknown when the directory is unavailable', () => {
    expect(birthdayDirectoryStatus(people[0], null)).toBe('unknown');
  });

  it('classifies active, contractor, consultant and not-found', () => {
    expect(people.map((p) => birthdayDirectoryStatus(p, users))).toEqual([
      'active',
      'contractor',
      'contractor',
      'not-found',
    ]);
  });

  it('shows everyone when the directory is unavailable', () => {
    expect(filterActiveBirthdays(people, null)).toBe(people);
  });

  it('keeps only active employees otherwise', () => {
    expect(filterActiveBirthdays(people, users).map((p) => p.name)).toEqual(['Alice Active']);
  });

  it('hides everyone when the directory is empty', () => {
    expect(filterActiveBirthdays(people, [])).toEqual([]);
  });
});

describe('findBirthdayCoverageGaps', () => {
  it('lists unmatched entries and missing employees, sorted', () => {
    const users = [
      user({ id: '1', displayName: 'Zed Zulu' }),
      user({ id: '2', displayName: 'Amy Alpha' }),
      user({ id: '3', displayName: 'Bob Bravo' }),
      user({ id: '4', displayName: 'Carl Contract', jobTitle: 'Contractor' }),
    ];
    const people = [
      person({ name: 'Bob Bravo' }),
      person({ name: 'Yolanda Ghost' }),
      person({ name: 'Xavier Ghost' }),
    ];
    const gaps = findBirthdayCoverageGaps(people, users);
    expect(gaps.unmatched.map((p) => p.name)).toEqual(['Xavier Ghost', 'Yolanda Ghost']);
    expect(gaps.missing.map((u) => u.displayName)).toEqual(['Amy Alpha', 'Zed Zulu']);
  });

  it('leaves ignored names off the missing list (displayName or given+surname)', () => {
    const users = [
      user({ id: '1', displayName: 'Ginu  Thomas' }),
      user({ id: '2', displayName: 'T. Terry', givenName: 'Teagan', surname: 'Terry' }),
      user({ id: '3', displayName: 'ANGELA FLOYD' }),
      user({ id: '4', displayName: 'Real Person' }),
    ];
    const gaps = findBirthdayCoverageGaps([], users);
    expect(gaps.missing.map((u) => u.id)).toEqual(['4']);
  });

  it('returns no gaps when everything lines up', () => {
    const users = [user({ id: '1', displayName: 'Amy Alpha', mail: 'amy@x.com' })];
    const gaps = findBirthdayCoverageGaps([person({ name: 'A. Alpha', email: 'AMY@x.com' })], users);
    expect(gaps).toEqual({ unmatched: [], missing: [] });
  });
});

describe('birthdaysInMonth', () => {
  it('filters to the month and sorts by day then name', () => {
    const people = [
      person({ name: 'Zoe', month: 3, day: 5 }),
      person({ name: 'Adam', month: 3, day: 5 }),
      person({ name: 'Early', month: 3, day: 1 }),
      person({ name: 'Other', month: 4, day: 1 }),
    ];
    expect(birthdaysInMonth(people, 3).map((p) => p.name)).toEqual(['Early', 'Adam', 'Zoe']);
    expect(birthdaysInMonth(people, 12)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const people = [person({ name: 'B', month: 1, day: 2 }), person({ name: 'A', month: 1, day: 1 })];
    birthdaysInMonth(people, 1);
    expect(people.map((p) => p.name)).toEqual(['B', 'A']);
  });
});

describe('toDisplayName', () => {
  it('turns "Last,First Middle" into "First Last"', () => {
    expect(toDisplayName('Smith,John Paul')).toBe('John Smith');
    expect(toDisplayName('  de Andrade Santos ,  Juliana ')).toBe('Juliana de Andrade Santos');
  });

  it('passes plain names through, collapsing whitespace', () => {
    expect(toDisplayName('  Jane   Doe ')).toBe('Jane Doe');
  });

  it('handles a trailing comma', () => {
    expect(toDisplayName('Doe,')).toBe('Doe');
  });
});

describe('parseBirthdaySpreadsheet', () => {
  it('returns empty for blank input', () => {
    expect(parseBirthdaySpreadsheet('  \n\n')).toEqual({ rows: [], skipped: [] });
  });

  it('uses header columns when present (tab-separated)', () => {
    const text = [
      'Month\tMonth Name\tBirth Date\tEmployee Name\tDepartment Name',
      '1\tJANUARY\t1/25\tSmith,John\tSales',
      '2\tFEBRUARY\t2/3/1990\tDoe,Jane Q\t',
      '13\tBAD\t13/40\tBad,Row\tX',
    ].join('\r\n');
    const result = parseBirthdaySpreadsheet(text);
    expect(result.rows).toEqual([
      { name: 'John Smith', month: 1, day: 25, department: 'Sales' },
      { name: 'Jane Doe', month: 2, day: 3, department: undefined },
    ]);
    expect(result.skipped).toEqual(['13\tBAD\t13/40\tBad,Row\tX']);
  });

  it('does not take "Month Name" as the name column', () => {
    const text = 'Month Name\tBirth Date\tName\nMARCH\t3/4\tLee,Ann';
    expect(parseBirthdaySpreadsheet(text).rows).toEqual([
      { name: 'Ann Lee', month: 3, day: 4, department: undefined },
    ]);
  });

  it('infers date and "Last,First" cells without a header', () => {
    const text = 'Sales\t7/4\tLiberty,Bell\nno date here\tFoo,Bar';
    const result = parseBirthdaySpreadsheet(text);
    expect(result.rows).toEqual([{ name: 'Bell Liberty', month: 7, day: 4, department: undefined }]);
    expect(result.skipped).toEqual(['no date here\tFoo,Bar']);
  });

  it('splits on 2+ spaces when there are no tabs', () => {
    const result = parseBirthdaySpreadsheet('12/31  Year,End');
    expect(result.rows).toEqual([{ name: 'End Year', month: 12, day: 31, department: undefined }]);
  });

  it('rejects day 0 and month 0', () => {
    const result = parseBirthdaySpreadsheet('0/5\tA,B\n5/0\tC,D');
    expect(result.rows).toEqual([]);
    expect(result.skipped).toHaveLength(2);
  });
});

describe('mergeBirthdayImport', () => {
  afterEach(() => vi.restoreAllMocks());

  const users: GraphUser[] = [
    user({ id: '1', displayName: 'Nicholas Bocchi', givenName: 'Nicholas', surname: 'Bocchi', mail: 'nb@x.com', department: 'Sales' }),
  ];

  it('uses directory name/email, updates an existing entry in place and keeps its id', () => {
    const existing: BirthdayPerson[] = [
      { id: 'keep-me', name: 'Nicholas Bocchi', month: 1, day: 1, email: 'NB@x.com' },
    ];
    const { people, notFound } = mergeBirthdayImport(
      existing,
      [{ name: 'Nick Bocchi', month: 5, day: 9 }],
      users
    );
    expect(notFound).toEqual([]);
    expect(people).toEqual([
      { id: 'keep-me', name: 'Nicholas Bocchi', month: 5, day: 9, email: 'nb@x.com', department: 'Sales' },
    ]);
    expect(existing[0].month).toBe(1);
  });

  it('adds unmatched rows and reports them as not found; sorts by month/day/name', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
    const { people, notFound } = mergeBirthdayImport(
      [{ id: 'a', name: 'Zed Zulu', month: 2, day: 1 }],
      [
        { name: 'Ghost Person', month: 1, day: 10, department: 'HR' },
        { name: 'Nick Bocchi', month: 2, day: 1 },
      ],
      users
    );
    expect(notFound).toEqual(['Ghost Person']);
    expect(people.map((p) => [p.name, p.id])).toEqual([
      ['Ghost Person', 'bday-42-0'],
      ['Nicholas Bocchi', 'bday-42-1'],
      ['Zed Zulu', 'a'],
    ]);
    expect(people[0].department).toBe('HR');
  });

  it('matches existing by name when the directory is unavailable', () => {
    const { people, notFound } = mergeBirthdayImport(
      [{ id: 'x', name: 'Jane Doe', month: 1, day: 1 }],
      [{ name: 'jane doe', month: 3, day: 3 }],
      null
    );
    expect(notFound).toEqual([]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ id: 'x', name: 'jane doe', month: 3, day: 3 });
    expect('email' in people[0]).toBe(false);
  });
});
