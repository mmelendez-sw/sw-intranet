import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseHomepageCardsContent,
  getGraphToken,
  getHomepageCardsRaw,
  getHomepageCardsMeta,
  homepageCardsMetaFingerprint,
  getHomepageCards,
  TV_SHAREPOINT_DRIVE_ID,
  TV_HOMEPAGE_CARDS_ITEM_ID,
} from '../tvHomepageCards';

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const card = { order: 1, title: 'Hello', bullets: ['a'], imageUrl: '' };

describe('parseHomepageCardsContent', () => {
  it('accepts an array or a { cards } wrapper', () => {
    expect(parseHomepageCardsContent([card])).toEqual([card]);
    expect(parseHomepageCardsContent({ cards: [card] })).toEqual([card]);
  });

  it('returns [] for anything else', () => {
    expect(parseHomepageCardsContent(null)).toEqual([]);
    expect(parseHomepageCardsContent(undefined)).toEqual([]);
    expect(parseHomepageCardsContent('')).toEqual([]);
    expect(parseHomepageCardsContent({})).toEqual([]);
    expect(parseHomepageCardsContent({ cards: 'nope' })).toEqual([]);
    expect(parseHomepageCardsContent(42)).toEqual([]);
  });
});

describe('getGraphToken', () => {
  it('posts client credentials and returns access_token', async () => {
    const fetchMock = mockFetch(Response.json({ access_token: 'G', expires_in: 3600, token_type: 'Bearer' }));
    await expect(getGraphToken('t', 'c', 's')).resolves.toBe('G');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/t/oauth2/v2.0/token');
    expect(init.method).toBe('POST');
    const form = init.body as URLSearchParams;
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'client_credentials',
      client_id: 'c',
      client_secret: 's',
      scope: 'https://graph.microsoft.com/.default',
    });
  });

  it('throws with status and body on failure', async () => {
    mockFetch(new Response('bad secret', { status: 401 }));
    await expect(getGraphToken('t-fail', 'c', 's')).rejects.toThrow('Token request failed: 401 bad secret');
  });

  it('throws when the token response has no access_token', async () => {
    mockFetch(Response.json({ expires_in: 3600 }));
    await expect(getGraphToken('t-missing', 'c', 's')).rejects.toThrow('Token response missing access_token');
  });

  it('reuses a cached token until shortly before expiry', async () => {
    const fetchMock = mockFetch(Response.json({ access_token: 'C1', expires_in: 3600 }));
    await expect(getGraphToken('t-cache', 'c', 's')).resolves.toBe('C1');
    await expect(getGraphToken('t-cache', 'c', 's')).resolves.toBe('C1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const fetchMock = mockFetch(Response.json({ access_token: 'F1', expires_in: 3600 }));
    const [a, b] = await Promise.all([getGraphToken('t-flight', 'c', 's'), getGraphToken('t-flight', 'c', 's')]);
    expect([a, b]).toEqual(['F1', 'F1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches when the token is already inside the expiry margin', async () => {
    const fetchMock = mockFetch(
      Response.json({ access_token: 'S1', expires_in: 60 }),
      Response.json({ access_token: 'S2', expires_in: 3600 })
    );
    await expect(getGraphToken('t-short', 'c', 's')).resolves.toBe('S1');
    await expect(getGraphToken('t-short', 'c', 's')).resolves.toBe('S2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('getHomepageCardsRaw', () => {
  it('fetches the cards file content with Bearer token', async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify([card])));
    await expect(getHomepageCardsRaw('tok')).resolves.toEqual([card]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}/items/${TV_HOMEPAGE_CARDS_ITEM_ID}/content`
    );
    expect(fetchMock.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer tok' }, signal: expect.any(AbortSignal) });
  });

  it('returns [] for an empty / whitespace file', async () => {
    mockFetch(new Response('  \n'));
    await expect(getHomepageCardsRaw('tok')).resolves.toEqual([]);
  });

  it('throws on Graph errors and invalid JSON', async () => {
    mockFetch(new Response('nope', { status: 404 }));
    await expect(getHomepageCardsRaw('tok')).rejects.toThrow('Graph request failed: 404 nope');
    mockFetch(new Response('{not json'));
    await expect(getHomepageCardsRaw('tok')).rejects.toThrow(SyntaxError);
  });
});

describe('getHomepageCardsMeta / fingerprint', () => {
  it('selects eTag/cTag/lastModified and nulls missing fields', async () => {
    const fetchMock = mockFetch(Response.json({ eTag: '"e1"', lastModifiedDateTime: '2026-10-01T00:00:00Z' }));
    await expect(getHomepageCardsMeta('tok')).resolves.toEqual({
      eTag: '"e1"',
      cTag: null,
      lastModifiedDateTime: '2026-10-01T00:00:00Z',
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('?$select=eTag,cTag,lastModifiedDateTime');
  });

  it('throws on failure', async () => {
    mockFetch(new Response('throttled', { status: 429 }));
    await expect(getHomepageCardsMeta('tok')).rejects.toThrow('Graph meta request failed: 429 throttled');
  });

  it('fingerprint prefers eTag, then cTag, plus lastModified', () => {
    expect(homepageCardsMetaFingerprint({ eTag: 'e', cTag: 'c', lastModifiedDateTime: 'd' })).toBe('e|d');
    expect(homepageCardsMetaFingerprint({ eTag: null, cTag: 'c', lastModifiedDateTime: null })).toBe('c|');
    expect(homepageCardsMetaFingerprint({ eTag: null, cTag: null, lastModifiedDateTime: null })).toBe('|');
  });
});

describe('getHomepageCards', () => {
  it('chains token → raw → parse', async () => {
    const fetchMock = mockFetch(
      Response.json({ access_token: 'G', expires_in: 3600 }),
      new Response(JSON.stringify({ cards: [card] }))
    );
    await expect(getHomepageCards('t-chain', 'c', 's')).resolves.toEqual([card]);
    expect(fetchMock.mock.calls[1][1]).toEqual({ headers: { Authorization: 'Bearer G' }, signal: expect.any(AbortSignal) });
  });
});
