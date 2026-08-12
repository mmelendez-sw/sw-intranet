/**
 * Minimal client for homepage cards via the SharePoint-backed TV API
 * (GET /api/tv-cards). Does not require user login — secrets stay on the server.
 */

import { BUNDLED_DEFAULT_CARD_IMAGES } from '../data/bundledDefaultCardImages';

export interface CardContent {
  order: number;
  title: string;
  /** Each string renders as one <li>. HTML is allowed (e.g. <a> tags). */
  bullets: string[];
  /** Public image URL. Empty → bundled/default cycle by position. */
  imageUrl: string;
  imageIndex?: number;
}

export function parseHomepageCardsContent(raw: unknown): CardContent[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as CardContent[];
  if (typeof raw === 'object' && Array.isArray((raw as { cards?: CardContent[] }).cards)) {
    return (raw as { cards: CardContent[] }).cards;
  }
  return [];
}

/** Turn relative `/api/...` image paths into absolute URLs against the cards API origin. */
export function resolveTvMediaUrl(url: string, cardsApiUrl: string = ''): string {
  const trimmed = (url || '').trim();
  if (!trimmed.startsWith('/api/')) return trimmed;
  const base = (cardsApiUrl || '').trim();
  if (!base || base.startsWith('/')) return trimmed;
  try {
    return new URL(trimmed, new URL(base).origin).href;
  } catch {
    return trimmed;
  }
}

export function isSharePointImageUrl(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return false;
  return /sharepoint\.com/i.test(url) || /graph\.microsoft\.com/i.test(url);
}

export async function fetchTvHomepageCardsFromApi(apiUrl: string): Promise<unknown | null> {
  if (!apiUrl) return null;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[tvCardsClient] fetch failed: ${res.status} ${err}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[tvCardsClient] fetch error:', err);
    return null;
  }
}

export function getBundledDefaultFallbackImageUrl(cardPosition: number): string | null {
  if (!BUNDLED_DEFAULT_CARD_IMAGES.length) return null;
  const i = ((cardPosition % BUNDLED_DEFAULT_CARD_IMAGES.length) + BUNDLED_DEFAULT_CARD_IMAGES.length)
    % BUNDLED_DEFAULT_CARD_IMAGES.length;
  return BUNDLED_DEFAULT_CARD_IMAGES[i] || null;
}

export function getDefaultFallbackImageDisplaySrc(cardPosition: number): string | null {
  return getBundledDefaultFallbackImageUrl(cardPosition);
}
