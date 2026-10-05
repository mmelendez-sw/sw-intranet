import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GROUP_STATUS_TTL_MS,
  readCachedEditorStatus,
  readCachedEliteStatus,
  writeCachedEditorStatus,
  writeCachedEliteStatus,
} from './groupStatusCache';

const email = 'a@symphonyinfra.com';

describe('groupStatusCache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports nothing present when no value is cached', () => {
    expect(readCachedEliteStatus(email)).toEqual({ value: null, fresh: false, present: false });
    expect(readCachedEditorStatus(email)).toEqual({ value: null, fresh: false, present: false });
  });

  it('round-trips elite and editor flags independently', () => {
    writeCachedEliteStatus(email, true);
    writeCachedEditorStatus(email, false);
    expect(readCachedEliteStatus(email)).toEqual({ value: true, fresh: true, present: true });
    expect(readCachedEditorStatus(email)).toEqual({ value: false, fresh: true, present: true });
    expect(localStorage.getItem(`elite_status_${email}`)).toBe('true');
    expect(localStorage.getItem(`editor_status_${email}`)).toBe('false');
  });

  it('keys are per email', () => {
    writeCachedEliteStatus(email, true);
    expect(readCachedEliteStatus('other@x.com').present).toBe(false);
  });

  it('marks values stale after the TTL but keeps them present', () => {
    writeCachedEliteStatus(email, true);
    vi.setSystemTime(Date.now() + GROUP_STATUS_TTL_MS - 1);
    expect(readCachedEliteStatus(email).fresh).toBe(true);
    vi.setSystemTime(Date.now() + 1);
    expect(readCachedEliteStatus(email)).toEqual({ value: true, fresh: false, present: true });
  });

  it('treats a missing/garbled timestamp as stale', () => {
    localStorage.setItem(`editor_status_${email}`, 'true');
    localStorage.setItem(`editor_status_timestamp_${email}`, 'nope');
    expect(readCachedEditorStatus(email)).toEqual({ value: true, fresh: false, present: true });
  });

  it('ignores values other than "true"/"false"', () => {
    localStorage.setItem(`elite_status_${email}`, '1');
    expect(readCachedEliteStatus(email).present).toBe(false);
  });

  it('swallows storage errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeCachedEliteStatus(email, true)).not.toThrow();
    expect(() => writeCachedEditorStatus(email, true)).not.toThrow();
    expect(readCachedEliteStatus(email)).toEqual({ value: null, fresh: false, present: false });
  });
});
