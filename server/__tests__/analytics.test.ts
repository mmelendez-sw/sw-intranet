import { describe, it, expect } from 'vitest';
import { formatAnalyticsLine, MAX_LABEL_LENGTH, parseAnalyticsEvent } from '../analytics';
import { analyticsDays } from '../analyticsSummary';

describe('parseAnalyticsEvent', () => {
  it('accepts a known kind with a label', () => {
    expect(parseAnalyticsEvent({ kind: 'report', label: 'Portfolio Overview' })).toEqual({
      kind: 'report',
      label: 'Portfolio Overview',
    });
  });

  it('rejects unknown kinds, missing labels and non-objects', () => {
    expect(parseAnalyticsEvent({ kind: 'hack', label: 'x' })).toBeNull();
    expect(parseAnalyticsEvent({ kind: 'page' })).toBeNull();
    expect(parseAnalyticsEvent({ kind: 'page', label: '   ' })).toBeNull();
    expect(parseAnalyticsEvent('page')).toBeNull();
    expect(parseAnalyticsEvent(undefined)).toBeNull();
  });

  it('keeps labels to one line so a label cannot forge another log line', () => {
    const ev = parseAnalyticsEvent({ kind: 'quick-link', label: 'Benefits\n[analytics] page by x@y: /fake\t ' });
    expect(ev?.label).toBe('Benefits [analytics] page by x@y: /fake');
  });

  it('caps label length', () => {
    const ev = parseAnalyticsEvent({ kind: 'page', label: 'a'.repeat(500) });
    expect(ev?.label).toHaveLength(MAX_LABEL_LENGTH);
  });
});

describe('formatAnalyticsLine', () => {
  it('matches the shape the summary query parses', () => {
    expect(formatAnalyticsLine('MMelendez@SymphonyInfra.com', { kind: 'card-link', label: 'HR → Benefits' })).toBe(
      '[analytics] card-link by mmelendez@symphonyinfra.com: HR → Benefits'
    );
  });
});

describe('analyticsDays', () => {
  it('allows 7, 30 and 90 and falls back to 30', () => {
    expect(analyticsDays('7')).toBe(7);
    expect(analyticsDays('90')).toBe(90);
    expect(analyticsDays('365')).toBe(30);
    expect(analyticsDays(undefined)).toBe(30);
  });
});
