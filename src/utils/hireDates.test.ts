import { describe, it, expect } from 'vitest';
import { GraphUser } from '../services/directoryService';
import { hireCalendarDate, recentNewHires, todaysWorkAnniversaries } from './hireDates';

const user = (displayName: string, employeeHireDate: string | null, jobTitle = 'Analyst'): GraphUser => ({
  id: displayName,
  displayName,
  jobTitle,
  department: null,
  mail: null,
  employeeHireDate,
});

const now = new Date(2026, 9, 27, 9); // 27 Oct 2026, local

describe('hireCalendarDate', () => {
  it('recovers the calendar date Entra stored as midnight in the editor timezone', () => {
    expect(hireCalendarDate('2026-10-18T18:30:00Z')).toEqual({ y: 2026, m: 10, d: 19 }); // UTC+5:30
    expect(hireCalendarDate('2025-06-01T04:00:00Z')).toEqual({ y: 2025, m: 6, d: 1 }); // US Eastern
    expect(hireCalendarDate('2025-06-01T00:00:00Z')).toEqual({ y: 2025, m: 6, d: 1 });
  });

  it('returns null for missing or invalid dates', () => {
    expect(hireCalendarDate(null)).toBeNull();
    expect(hireCalendarDate(undefined)).toBeNull();
    expect(hireCalendarDate('not a date')).toBeNull();
  });
});

describe('recentNewHires', () => {
  it('welcomes starters from the last 8 days, newest first, skipping future dates and consultants', () => {
    const hires = recentNewHires(
      [
        user('Day Zero', '2026-10-27T04:00:00Z'),
        user('Three Days', '2026-10-23T18:30:00Z'),
        user('Seven Days', '2026-10-20T04:00:00Z'),
        user('Eight Days', '2026-10-19T04:00:00Z'),
        user('Future', '2026-11-02T04:00:00Z'),
        user('Consultant', '2026-10-20T04:00:00Z', 'Consultant'),
        user('No Date', null),
      ],
      now
    );
    expect(hires.map((h) => h.user.displayName)).toEqual(['Day Zero', 'Three Days', 'Seven Days']);
    expect(hires[1].startedOn).toEqual(new Date(2026, 9, 24));
  });

  it('handles a null directory', () => {
    expect(recentNewHires(null, now)).toEqual([]);
  });
});

describe('todaysWorkAnniversaries', () => {
  it('lists people hired on this day in earlier years, longest-serving first', () => {
    const anniversaries = todaysWorkAnniversaries(
      [
        user('One Year', '2025-10-26T18:30:00Z'),
        user('Three Years', '2023-10-27T04:00:00Z'),
        user('Started Today', '2026-10-27T04:00:00Z'),
        user('Other Day', '2024-10-28T04:00:00Z'),
        user('Contractor', '2024-10-27T04:00:00Z', 'Contractor'),
      ],
      now
    );
    expect(anniversaries.map((a) => [a.user.displayName, a.years])).toEqual([
      ['Three Years', 3],
      ['One Year', 1],
    ]);
  });

  it('celebrates 29 February hires on 28 February in non-leap years', () => {
    const leapHire = [user('Leap', '2024-02-29T04:00:00Z')];
    expect(todaysWorkAnniversaries(leapHire, new Date(2027, 1, 28, 9)).map((a) => a.years)).toEqual([3]);
    expect(todaysWorkAnniversaries(leapHire, new Date(2028, 1, 28, 9))).toEqual([]);
    expect(todaysWorkAnniversaries(leapHire, new Date(2028, 1, 29, 9)).map((a) => a.years)).toEqual([4]);
  });
});
