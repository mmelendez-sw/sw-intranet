/**
 * Homepage cards from SharePoint via the TV API (Lambda / npm run api).
 * Mirrors the main-branch CardContent shape used by TvDisplay / CMS.
 */

import seedCards from '../data/homepage-cards.seed.json';
import { TV_CARDS_API_URL } from '../authConfig';

export interface CardContent {
  order: number;
  title: string;
  /** Each string renders as one <li>. HTML is allowed (e.g. <a> tags). */
  bullets: string[];
  /** Public or proxied image URL. Empty → use bundled fallback by position. */
  imageUrl: string;
  imageIndex?: number;
}

export interface TvHomepageCardsMeta {
  eTag: string | null;
  cTag: string | null;
  lastModifiedDateTime: string | null;
}

export const DEFAULT_CARDS: CardContent[] = Array.isArray(seedCards)
  ? (seedCards as CardContent[])
  : [];

export function parseHomepageCardsContent(raw: unknown): CardContent[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as CardContent[];
  if (typeof raw === 'object' && Array.isArray((raw as { cards?: CardContent[] }).cards)) {
    return (raw as { cards: CardContent[] }).cards;
  }
  return [];
}

/** Turn relative /api/images/... into absolute URLs when the API is on another origin. */
export function resolveTvMediaUrl(url: string, cardsApiUrl: string = TV_CARDS_API_URL): string {
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

export function normalizeTvCards(raw: unknown, cardsApiUrl: string = TV_CARDS_API_URL): CardContent[] {
  return parseHomepageCardsContent(raw)
    .map((card) => ({
      ...card,
      title: card.title || '',
      bullets: Array.isArray(card.bullets) ? card.bullets : [],
      imageUrl: resolveTvMediaUrl(card.imageUrl || '', cardsApiUrl),
    }))
    .sort((a, b) => a.order - b.order);
}

export async function fetchTvHomepageCardsFromApi(
  apiUrl: string = TV_CARDS_API_URL
): Promise<unknown | null> {
  if (!apiUrl) return null;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[tvCards] fetch failed: ${res.status} ${err}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[tvCards] fetch error:', err);
    return null;
  }
}

export function tvHomepageCardsMetaFingerprint(meta: TvHomepageCardsMeta): string {
  return `${meta.eTag || meta.cTag || ''}|${meta.lastModifiedDateTime || ''}`;
}

export async function fetchTvHomepageCardsMetaFromApi(
  cardsApiUrl: string = TV_CARDS_API_URL
): Promise<TvHomepageCardsMeta | null> {
  if (!cardsApiUrl) return null;
  const metaUrl = cardsApiUrl.replace(/\/?$/, '') + '/meta';
  try {
    const res = await fetch(metaUrl);
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[tvCards] meta fetch failed: ${res.status} ${err}`);
      return null;
    }
    return (await res.json()) as TvHomepageCardsMeta;
  } catch (err) {
    console.warn('[tvCards] meta fetch error:', err);
    return null;
  }
}
