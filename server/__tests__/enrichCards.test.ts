import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../tvHomepageCards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tvHomepageCards')>();
  return {
    ...actual,
    getGraphToken: vi.fn(async () => 'TOKEN'),
    getHomepageCardsRaw: vi.fn(),
  };
});
vi.mock('../tvImages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tvImages')>();
  return {
    ...actual,
    listDefaultImageFiles: vi.fn(),
    resolveDriveItemIdFromWebUrl: vi.fn(),
  };
});

import { getHomepageCardsWithImages } from '../enrichCards';
import { getHomepageCardsRaw } from '../tvHomepageCards';
import { listDefaultImageFiles, resolveDriveItemIdFromWebUrl } from '../tvImages';

const base = { title: 't', bullets: [] as string[] };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TV_API_PUBLIC_BASE;
  delete process.env.TV_API_PORT;
  vi.mocked(listDefaultImageFiles).mockResolvedValue([
    { id: 'A', name: 'a.png' },
    { id: 'B', name: 'b.png' },
  ]);
});

describe('getHomepageCardsWithImages', () => {
  it('fills empty imageUrl by imageIndex or display order, cycling', async () => {
    vi.mocked(getHomepageCardsRaw).mockResolvedValue([
      { ...base, order: 1, imageUrl: '' },
      { ...base, order: 2, imageUrl: '  ' },
      { ...base, order: 3, imageUrl: '' },
      { ...base, order: 4, imageUrl: '', imageIndex: 2 },
      { ...base, order: 5, imageUrl: '', imageIndex: 0 },
    ]);
    const cards = await getHomepageCardsWithImages('t', 'c', 's');
    expect(cards.map((c) => c.imageUrl)).toEqual([
      '/api/images/A',
      '/api/images/B',
      '/api/images/A',
      '/api/images/B',
      // imageIndex 0 is invalid → falls back to idx % length (4 % 2 = 0)
      '/api/images/A',
    ]);
  });

  it('keeps non-SharePoint image URLs untouched', async () => {
    vi.mocked(getHomepageCardsRaw).mockResolvedValue([
      { ...base, order: 1, imageUrl: 'https://cdn.example.com/x.png' },
      { ...base, order: 2, imageUrl: '/api/images/already' },
    ]);
    const cards = await getHomepageCardsWithImages('t', 'c', 's');
    expect(cards.map((c) => c.imageUrl)).toEqual(['https://cdn.example.com/x.png', '/api/images/already']);
  });

  it('rewrites SharePoint URLs to the id proxy, or by-url proxy when unresolved', async () => {
    const sp = 'https://symphony.sharepoint.com/sites/x/Shared%20Documents/a.png';
    vi.mocked(getHomepageCardsRaw).mockResolvedValue({
      cards: [
        { ...base, order: 1, imageUrl: sp },
        { ...base, order: 2, imageUrl: ` ${sp} ` },
      ],
    });
    vi.mocked(resolveDriveItemIdFromWebUrl).mockResolvedValueOnce('ITEM').mockResolvedValueOnce(null);
    const cards = await getHomepageCardsWithImages('t', 'c', 's');
    expect(cards[0].imageUrl).toBe('/api/images/ITEM');
    expect(cards[1].imageUrl).toBe(`/api/images/by-url?url=${encodeURIComponent(sp)}`);
  });

  it('leaves empty imageUrl when the Default Images folder is empty', async () => {
    vi.mocked(listDefaultImageFiles).mockResolvedValue([]);
    vi.mocked(getHomepageCardsRaw).mockResolvedValue([{ ...base, order: 1, imageUrl: '' }]);
    const cards = await getHomepageCardsWithImages('t', 'c', 's');
    expect(cards[0].imageUrl).toBe('');
  });
});
