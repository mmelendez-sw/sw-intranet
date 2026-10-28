import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('./intranetApi', () => ({
  intranetApiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { resetAnalyticsForTests, trackEvent } from './analytics';
import { ANALYTICS_EVENT_URL } from '../authConfig';
import { linkClickLabel } from '../utils/linkClickLabel';
import { pageViewLabel } from '../components/PageViewTracker';

const signedIn = { getAllAccounts: () => [{ username: 'viewer@symphonyinfra.com' }] };
const signedOut = { getAllAccounts: () => [] };

const sentBody = (call = 0) => JSON.parse((apiFetch.mock.calls[call][2] as RequestInit).body as string);

beforeEach(() => {
  resetAnalyticsForTests();
  apiFetch.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('trackEvent', () => {
  it('POSTs { kind, label } with keepalive', () => {
    trackEvent(signedIn, 'report', '  Portfolio   Overview ');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [instance, url, init] = apiFetch.mock.calls[0];
    expect(instance).toBe(signedIn);
    expect(url).toBe(ANALYTICS_EVENT_URL);
    expect(init).toMatchObject({ method: 'POST', keepalive: true });
    expect(sentBody()).toEqual({ kind: 'report', label: 'Portfolio Overview' });
  });

  it('skips signed-out users and empty labels', () => {
    trackEvent(signedOut, 'report', 'Portfolio Overview');
    trackEvent(signedIn, 'page', null);
    trackEvent(signedIn, 'page', '   ');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('counts a repeat of the same event within 2 s once', () => {
    vi.useFakeTimers();
    trackEvent(signedIn, 'quick-link', 'Benefits');
    trackEvent(signedIn, 'quick-link', 'Benefits');
    trackEvent(signedIn, 'report', 'Benefits');
    expect(apiFetch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2500);
    trackEvent(signedIn, 'report', 'Benefits');
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it('swallows network failures', async () => {
    apiFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(() => trackEvent(signedIn, 'page', '/')).not.toThrow();
    await Promise.resolve();
  });
});

describe('linkClickLabel', () => {
  const container = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  };

  it('labels a click on a link (or inside one) with its context', () => {
    const el = container('<p>See <a href="https://example.com/hr"><strong>HR  portal</strong></a></p>');
    expect(linkClickLabel(el.querySelector('strong'), 'People')).toBe('People → HR portal');
  });

  it('ignores clicks that are not on a link', () => {
    const el = container('<p>Plain text <a href="https://x.test">x</a></p>');
    expect(linkClickLabel(el.querySelector('p'), 'People')).toBeNull();
    expect(linkClickLabel(null, 'People')).toBeNull();
  });

  it('falls back to the host for links without text', () => {
    const el = container('<a href="https://portal.example.com/a"><img alt="" /></a>');
    expect(linkClickLabel(el.querySelector('img'), '')).toBe('Untitled → portal.example.com');
  });
});

describe('pageViewLabel', () => {
  it('normalises known pages and drops the rest', () => {
    expect(pageViewLabel('/')).toBe('/');
    expect(pageViewLabel('/Reports/')).toBe('/reports');
    expect(pageViewLabel('/usage')).toBe('/usage');
    expect(pageViewLabel('/old-bookmark')).toBeNull();
  });
});
