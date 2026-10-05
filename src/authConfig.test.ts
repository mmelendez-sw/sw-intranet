import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isBirthdayGapNotifyAllowlisted,
  isDevHomepageAllowlisted,
  isEditAllowlisted,
  isIcemanAllowlisted,
  isNetSuiteAdminAllowlisted,
  isTermSheetRankingsAllowlisted,
  resolveIsEditor,
  BYPASS_AUTH,
} from './authConfig';

describe('allowlist helpers', () => {
  it('BYPASS_AUTH stays off in committed code', () => {
    expect(BYPASS_AUTH).toBe(false);
  });

  describe('isEditAllowlisted', () => {
    it('matches case-insensitively', () => {
      expect(isEditAllowlisted('MMelendez@SymphonyInfra.com')).toBe(true);
      expect(isEditAllowlisted('htolani@symphonyinfra.com')).toBe(true);
    });
    it('rejects undefined, empty and unknown emails', () => {
      expect(isEditAllowlisted(undefined)).toBe(false);
      expect(isEditAllowlisted('')).toBe(false);
      expect(isEditAllowlisted('nobody@symphonyinfra.com')).toBe(false);
    });
    it('does not normalize the legacy symphonywireless.com domain', () => {
      expect(isEditAllowlisted('mmelendez@symphonywireless.com')).toBe(false);
    });
  });

  describe('resolveIsEditor', () => {
    it('is true for group members regardless of email', () => {
      expect(resolveIsEditor(true)).toBe(true);
      expect(resolveIsEditor(true, 'nobody@x.com')).toBe(true);
    });
    it('falls back to the edit allowlist', () => {
      expect(resolveIsEditor(false, 'SHUANG@symphonyinfra.com')).toBe(true);
      expect(resolveIsEditor(false, 'nobody@x.com')).toBe(false);
      expect(resolveIsEditor(false)).toBe(false);
    });
  });

  describe('isNetSuiteAdminAllowlisted', () => {
    it('matches listed emails case-insensitively', () => {
      expect(isNetSuiteAdminAllowlisted('BGoyal@symphonyinfra.com')).toBe(true);
      expect(isNetSuiteAdminAllowlisted('izheng@symphonyinfra.com')).toBe(true);
    });
    it('rejects others', () => {
      expect(isNetSuiteAdminAllowlisted(undefined)).toBe(false);
      expect(isNetSuiteAdminAllowlisted('jpeterson@symphonyinfra.com')).toBe(false);
    });
  });

  describe('isIcemanAllowlisted', () => {
    it('only allows the listed email', () => {
      expect(isIcemanAllowlisted('MMELENDEZ@symphonyinfra.com')).toBe(true);
      expect(isIcemanAllowlisted('shuang@symphonyinfra.com')).toBe(false);
      expect(isIcemanAllowlisted(undefined)).toBe(false);
      expect(isIcemanAllowlisted('mmelendez@symphonywireless.com')).toBe(false);
    });
  });

  describe('isDevHomepageAllowlisted', () => {
    it('allows listed emails only', () => {
      expect(isDevHomepageAllowlisted('ATabbacchino@symphonyinfra.com')).toBe(true);
      expect(isDevHomepageAllowlisted('mmelendez@symphonyinfra.com')).toBe(true);
      expect(isDevHomepageAllowlisted('shuang@symphonyinfra.com')).toBe(false);
      expect(isDevHomepageAllowlisted(undefined)).toBe(false);
    });
  });

  describe('isBirthdayGapNotifyAllowlisted', () => {
    it('matches case-insensitively', () => {
      expect(isBirthdayGapNotifyAllowlisted('SRaffington@SymphonyInfra.com')).toBe(true);
    });
    it('normalizes legacy symphonywireless.com sign-ins', () => {
      expect(isBirthdayGapNotifyAllowlisted('MMelendez@SymphonyWireless.com')).toBe(true);
    });
    it('only normalizes the domain suffix', () => {
      expect(isBirthdayGapNotifyAllowlisted('mmelendez@symphonywireless.com.evil.com')).toBe(false);
    });
    it('rejects others', () => {
      expect(isBirthdayGapNotifyAllowlisted(undefined)).toBe(false);
      expect(isBirthdayGapNotifyAllowlisted('')).toBe(false);
      expect(isBirthdayGapNotifyAllowlisted('shuang@symphonyinfra.com')).toBe(false);
    });
  });

  describe('isTermSheetRankingsAllowlisted', () => {
    it('allows roster AMs with mixed-case roster emails', () => {
      expect(isTermSheetRankingsAllowlisted('bseidenberg@symphonyinfra.com')).toBe(true);
      expect(isTermSheetRankingsAllowlisted('NBOCCHI@SYMPHONYINFRA.COM')).toBe(true);
    });
    it('allows extra (non-AM) viewers', () => {
      expect(isTermSheetRankingsAllowlisted('htolani@symphonyinfra.com')).toBe(true);
      expect(isTermSheetRankingsAllowlisted('bsteinthal@symphonyinfra.com')).toBe(true);
    });
    it('normalizes legacy symphonywireless.com sign-ins', () => {
      expect(isTermSheetRankingsAllowlisted('DKing@symphonywireless.com')).toBe(true);
    });
    it('rejects others', () => {
      expect(isTermSheetRankingsAllowlisted(undefined)).toBe(false);
      expect(isTermSheetRankingsAllowlisted('shuang@symphonyinfra.com')).toBe(false);
      expect(isTermSheetRankingsAllowlisted('dking@symphonywireless.co')).toBe(false);
    });
  });
});

describe('API URL builders (evaluated at import)', () => {
  type Injected = { INTRANET_API_BASE_URL?: string; TV_CARDS_API_URL?: string };

  afterEach(() => {
    const w = window as Window & Injected;
    delete w.INTRANET_API_BASE_URL;
    delete w.TV_CARDS_API_URL;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const load = async (hostname: string, injected: Injected = {}) => {
    vi.resetModules();
    vi.stubGlobal('location', {
      hostname,
      origin: `https://${hostname}`,
      href: `https://${hostname}/`,
    });
    Object.assign(window, injected);
    return import('./authConfig');
  };

  it('uses the local API on localhost', async () => {
    const m = await load('localhost');
    expect(m.INTRANET_API_BASE_URL).toBe('http://localhost:3001');
    expect(m.TV_CARDS_API_URL).toBe('http://localhost:3001/api/tv-cards');
    expect(m.SALESFORCE_TERM_SHEET_RANKINGS_URL).toBe(
      'http://localhost:3001/api/salesforce/term-sheet-rankings'
    );
    expect(m.SALESFORCE_CURRENT_INVESTMENTS_URL).toBe(
      'http://localhost:3001/api/salesforce/current-investments'
    );
    expect(m.POWERBI_EMBED_TOKEN_URL).toBe('http://localhost:3001/api/powerbi/embed-token');
  });

  it('treats 127.0.0.1 like localhost', async () => {
    const m = await load('127.0.0.1');
    expect(m.INTRANET_API_BASE_URL).toBe('http://localhost:3001');
  });

  it('uses relative /api paths in production (Amplify rewrites)', async () => {
    const m = await load('intranet.symphonyinfra.com');
    expect(m.INTRANET_API_BASE_URL).toBe('');
    expect(m.TV_CARDS_API_URL).toBe('');
    expect(m.SALESFORCE_TERM_SHEET_RANKINGS_URL).toBe('/api/salesforce/term-sheet-rankings');
    expect(m.SALESFORCE_CURRENT_INVESTMENTS_URL).toBe('/api/salesforce/current-investments');
    expect(m.POWERBI_EMBED_TOKEN_URL).toBe('/api/powerbi/embed-token');
    expect(m.msalConfig.auth.redirectUri).toBe('https://intranet.symphonyinfra.com');
  });

  it('prefers an injected INTRANET_API_BASE_URL (trimmed, trailing slash removed)', async () => {
    const m = await load('localhost', {
      INTRANET_API_BASE_URL: '  https://abc.lambda-url.us-east-1.on.aws/  ',
    });
    expect(m.INTRANET_API_BASE_URL).toBe('https://abc.lambda-url.us-east-1.on.aws');
    expect(m.SALESFORCE_TERM_SHEET_RANKINGS_URL).toBe(
      'https://abc.lambda-url.us-east-1.on.aws/api/salesforce/term-sheet-rankings'
    );
    expect(m.TV_CARDS_API_URL).toBe('https://abc.lambda-url.us-east-1.on.aws/api/tv-cards');
  });

  it('ignores a whitespace-only injected base', async () => {
    const m = await load('intranet.symphonyinfra.com', { INTRANET_API_BASE_URL: '   ' });
    expect(m.INTRANET_API_BASE_URL).toBe('');
  });

  it('derives the base origin from a full legacy TV_CARDS_API_URL', async () => {
    const m = await load('intranet.symphonyinfra.com', {
      TV_CARDS_API_URL: 'https://tv.example.com/api/tv-cards/',
    });
    expect(m.INTRANET_API_BASE_URL).toBe('https://tv.example.com');
    expect(m.TV_CARDS_API_URL).toBe('https://tv.example.com/api/tv-cards');
    expect(m.POWERBI_EMBED_TOKEN_URL).toBe('https://tv.example.com/api/powerbi/embed-token');
  });

  it('keeps a relative TV_CARDS_API_URL ending in /api/tv-cards and falls through for the base', async () => {
    const m = await load('intranet.symphonyinfra.com', { TV_CARDS_API_URL: '/api/tv-cards' });
    expect(m.INTRANET_API_BASE_URL).toBe('');
    expect(m.TV_CARDS_API_URL).toBe('/api/tv-cards');
  });
});

describe('group membership checks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('./utils/msalToken');
    vi.resetModules();
  });

  const loadWithToken = async (token: string | null) => {
    vi.resetModules();
    vi.doMock('./utils/msalToken', () => ({
      GRAPH_GROUP_SCOPES: ['User.Read', 'GroupMember.Read.All'],
      acquireTokenSilentOnly: vi.fn(async () => token),
    }));
    return import('./authConfig');
  };
  const signedIn = { getAllAccounts: () => [{ username: 'me' }] };

  it('returns false with no accounts (no network)', async () => {
    const m = await loadWithToken('tok');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await m.isEliteGroupMember({ getAllAccounts: () => [] })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws (rather than caching false) when no token is available', async () => {
    const m = await loadWithToken(null);
    await expect(m.isEditorGroupMember(signedIn)).rejects.toThrow('Graph token unavailable');
  });

  it('uses checkMemberGroups when it succeeds', async () => {
    const m = await loadWithToken('tok');
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const ids = JSON.parse(String(init.body)).groupIds;
      return new Response(JSON.stringify({ value: ids }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await m.isEliteGroupMember(signedIn)).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.microsoft.com/v1.0/me/checkMemberGroups');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      groupIds: [m.INTRANET_EXECS_GROUP_ID],
    });
  });

  it('falls back to paged memberOf when checkMemberGroups fails', async () => {
    const m = await loadWithToken('tok');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('checkMemberGroups')) return new Response('', { status: 403 });
      if (url.endsWith('/me/memberOf')) {
        return new Response(
          JSON.stringify({ value: [{ id: 'other' }], '@odata.nextLink': 'https://graph/page2' })
        );
      }
      return new Response(JSON.stringify({ value: [{ id: m.INTRANET_EDITORS_GROUP_ID }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await m.isEditorGroupMember(signedIn)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns false after exhausting memberOf pages', async () => {
    const m = await loadWithToken('tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('checkMemberGroups')
          ? new Response('', { status: 500 })
          : new Response(JSON.stringify({ value: [{ id: 'nope' }] }))
      )
    );
    expect(await m.isEliteGroupMember(signedIn)).toBe(false);
  });

  it('throws when memberOf fails', async () => {
    const m = await loadWithToken('tok');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(m.isEliteGroupMember(signedIn)).rejects.toThrow('Graph memberOf failed (500)');
  });

  it('maps AbortError to a timeout error', async () => {
    const m = await loadWithToken('tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      })
    );
    await expect(m.isEliteGroupMember(signedIn)).rejects.toThrow('timed out');
  });
});
