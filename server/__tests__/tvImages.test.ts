import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as tv from '../tvImages';
import { TV_SHAREPOINT_DRIVE_ID as DRIVE } from '../tvHomepageCards';

const ENV = ['TV_API_PUBLIC_BASE', 'TV_API_PORT'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  // Fresh module-level caches (folderIdCache / filesCache) per test.
  tv.clearDefaultImagesCache();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const folderOk = (id = 'FOLDER') => Response.json({ id });
const listing = (items: Array<{ id?: string; name?: string; file?: unknown }>) => Response.json({ value: items });

describe('isSharePointWebUrl', () => {
  it.each([
    ['https://symphony.sharepoint.com/sites/x/Shared%20Documents/a.png', true],
    ['https://SYMPHONY.SharePoint.com/a', true],
    ['https://graph.microsoft.com/v1.0/drives/x', true],
    ['https://example.com/a.png', false],
    ['/api/images/abc', false],
    ['data:image/png;base64,AAAA', false],
    ['', false],
  ])('%s → %s', (url, expected) => {
    expect(tv.isSharePointWebUrl(url)).toBe(expected);
  });
});

describe('public proxy URLs', () => {
  it('are relative by default', () => {
    expect(tv.getTvApiPublicBase()).toBe('');
    expect(tv.toPublicImageProxyUrl('a/b c')).toBe('/api/images/a%2Fb%20c');
    expect(tv.toPublicImageByUrlProxy('https://x.sharepoint.com/a b?c=1')).toBe(
      '/api/images/by-url?url=https%3A%2F%2Fx.sharepoint.com%2Fa%20b%3Fc%3D1'
    );
  });

  it('use TV_API_PORT for localhost', () => {
    process.env.TV_API_PORT = '3001';
    expect(tv.toPublicImageProxyUrl('id1')).toBe('http://localhost:3001/api/images/id1');
  });

  it('prefer TV_API_PUBLIC_BASE and strip a trailing slash', () => {
    process.env.TV_API_PORT = '3001';
    process.env.TV_API_PUBLIC_BASE = 'https://api.example.com/';
    expect(tv.getTvApiPublicBase()).toBe('https://api.example.com');
    expect(tv.toPublicImageByUrlProxy('u')).toBe('https://api.example.com/api/images/by-url?url=u');
  });
});

describe('getDefaultImagesFolderId', () => {
  it('looks up the encoded folder path and caches the id', async () => {
    const fetchMock = mockFetch(folderOk('F1'));
    await expect(tv.getDefaultImagesFolderId('tok')).resolves.toBe('F1');
    await expect(tv.getDefaultImagesFolderId('tok')).resolves.toBe('F1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://graph.microsoft.com/v1.0/drives/${DRIVE}/root:/General/intranet/Default%20Images?$select=id`
    );
    expect(fetchMock.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer tok' } });
  });

  it('refetches after clearDefaultImagesCache', async () => {
    const fetchMock = mockFetch(folderOk('F1'), folderOk('F2'));
    await tv.getDefaultImagesFolderId('tok');
    tv.clearDefaultImagesCache();
    await expect(tv.getDefaultImagesFolderId('tok')).resolves.toBe('F2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on HTTP error and on missing id', async () => {
    mockFetch(new Response('denied', { status: 403 }));
    await expect(tv.getDefaultImagesFolderId('tok')).rejects.toThrow(
      'Default Images folder lookup failed: 403 denied'
    );
    mockFetch(Response.json({}));
    await expect(tv.getDefaultImagesFolderId('tok')).rejects.toThrow(
      'Default Images folder id missing from Graph response'
    );
  });
});

describe('listDefaultImageFiles', () => {
  const items = [
    { id: '3', name: 'zeta.PNG', file: {} },
    { id: '1', name: 'Alpha.jpg', file: {} },
    { id: '2', name: 'beta.jpeg', file: {} },
    { id: 'f', name: 'subfolder' },
    { id: 'd', name: 'doc.pdf', file: {} },
    { name: 'noid.png', file: {} },
    { id: '4', name: 'gamma.webp', file: {} },
  ];

  it('filters to image files and sorts case-insensitively by name', async () => {
    const fetchMock = mockFetch(folderOk('FOLDER'), listing(items));
    const files = await tv.listDefaultImageFiles('tok');
    expect(files).toEqual([
      { id: '1', name: 'Alpha.jpg' },
      { id: '2', name: 'beta.jpeg' },
      { id: '4', name: 'gamma.webp' },
      { id: '3', name: 'zeta.PNG' },
    ]);
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://graph.microsoft.com/v1.0/drives/${DRIVE}/items/FOLDER/children?$select=id,name,file&$top=200`
    );
  });

  it('caches the listing for 60s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T00:00:00Z'));
    const fetchMock = mockFetch(folderOk(), listing(items), listing([{ id: 'n', name: 'new.png', file: {} }]));
    await tv.listDefaultImageFiles('tok');
    vi.setSystemTime(new Date('2026-10-05T00:00:59Z'));
    expect(await tv.listDefaultImageFiles('tok')).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date('2026-10-05T00:01:01Z'));
    // Folder id remains cached; only the children listing is refetched.
    expect(await tv.listDefaultImageFiles('tok')).toEqual([{ id: 'n', name: 'new.png' }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws on list failure', async () => {
    mockFetch(folderOk(), new Response('boom', { status: 500 }));
    await expect(tv.listDefaultImageFiles('tok')).rejects.toThrow('Default Images list failed: 500 boom');
  });
});

describe('resolveCardImage', () => {
  beforeEach(() => {
    mockFetch(
      folderOk(),
      listing([
        { id: 'a', name: '1.png', file: {} },
        { id: 'b', name: '2.png', file: {} },
        { id: 'c/d', name: '3.png', file: {} },
      ])
    );
  });

  it.each([
    [1, '/api/images/a'],
    [2, '/api/images/b'],
    [3, '/api/images/c%2Fd'],
    [4, '/api/images/a'],
    [5.9, '/api/images/b'],
    [0, '/api/images/a'],
    [-3, '/api/images/a'],
    [NaN, '/api/images/a'],
  ])('imageIndex %s → %s', async (idx, expected) => {
    await expect(tv.resolveCardImage(idx, 'tok')).resolves.toBe(expected);
  });

  it('returns null when the folder has no images', async () => {
    tv.clearDefaultImagesCache();
    mockFetch(folderOk(), listing([]));
    await expect(tv.resolveCardImage(1, 'tok')).resolves.toBeNull();
  });
});

describe('resolveDriveItemIdFromWebUrl', () => {
  const docUrl = 'https://symphony.sharepoint.com/sites/Intranet/Shared%20Documents/General/My%20Pic.png';

  it('resolves by drive path when the URL is under Shared Documents', async () => {
    const fetchMock = mockFetch(Response.json({ id: 'ITEM' }));
    await expect(tv.resolveDriveItemIdFromWebUrl(docUrl, 'tok')).resolves.toBe('ITEM');
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://graph.microsoft.com/v1.0/drives/${DRIVE}/root:/General/My%20Pic.png?$select=id`
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the shares API with a u! base64url id', async () => {
    const fetchMock = mockFetch(new Response('nf', { status: 404 }), Response.json({ id: 'SHARED' }));
    await expect(tv.resolveDriveItemIdFromWebUrl(docUrl, 'tok')).resolves.toBe('SHARED');
    const shareUrl = String(fetchMock.mock.calls[1][0]);
    const expectedId =
      'u!' + Buffer.from(docUrl, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(shareUrl).toBe(`https://graph.microsoft.com/v1.0/shares/${expectedId}/driveItem?$select=id`);
    expect(expectedId.slice(2)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('uses the shares API directly for non-Shared-Documents URLs', async () => {
    const fetchMock = mockFetch(Response.json({ id: 'S' }));
    await expect(
      tv.resolveDriveItemIdFromWebUrl('https://symphony.sharepoint.com/:i:/g/abc', 'tok')
    ).resolves.toBe('S');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/shares/u!');
  });

  it('returns null when both lookups fail', async () => {
    mockFetch(new Response('', { status: 404 }), new Response('denied', { status: 403 }));
    await expect(tv.resolveDriveItemIdFromWebUrl(docUrl, 'tok')).resolves.toBeNull();
  });

  it('falls through to shares when by-path returns 200 without an id', async () => {
    const fetchMock = mockFetch(Response.json({}), Response.json({}));
    await expect(tv.resolveDriveItemIdFromWebUrl(docUrl, 'tok')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('getDriveImageContentByWebUrl', () => {
  const docUrl = 'https://symphony.sharepoint.com/sites/Intranet/Shared%20Documents/a.png';

  it('returns bytes + content-type from the drive path', async () => {
    const fetchMock = mockFetch(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }));
    const out = await tv.getDriveImageContentByWebUrl(docUrl, 'tok');
    expect(out?.contentType).toBe('image/png');
    expect([...new Uint8Array(out!.body)]).toEqual([1, 2, 3]);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://graph.microsoft.com/v1.0/drives/${DRIVE}/root:/a.png:/content`);
  });

  it('falls back to shares content and defaults content-type', async () => {
    const fetchMock = mockFetch(new Response('', { status: 404 }), new Response(new Uint8Array([9])));
    const out = await tv.getDriveImageContentByWebUrl(docUrl, 'tok');
    // Response with a Uint8Array body has no default content-type header.
    expect(out?.contentType).toBe('application/octet-stream');
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/shares\/u![A-Za-z0-9_-]+\/driveItem\/content$/);
  });

  it('returns null when both fail', async () => {
    mockFetch(new Response('', { status: 404 }), new Response('', { status: 404 }));
    await expect(tv.getDriveImageContentByWebUrl(docUrl, 'tok')).resolves.toBeNull();
  });
});

describe('getDriveImageContent', () => {
  it('fetches item content with an encoded id', async () => {
    const fetchMock = mockFetch(new Response(new Uint8Array([7]), { headers: { 'Content-Type': 'image/jpeg' } }));
    const out = await tv.getDriveImageContent('a/b', 'tok');
    expect(out.contentType).toBe('image/jpeg');
    expect(fetchMock.mock.calls[0][0]).toBe(`https://graph.microsoft.com/v1.0/drives/${DRIVE}/items/a%2Fb/content`);
  });

  it('throws on failure', async () => {
    mockFetch(new Response('gone', { status: 404 }));
    await expect(tv.getDriveImageContent('x', 'tok')).rejects.toThrow('Image content fetch failed: 404 gone');
  });
});
