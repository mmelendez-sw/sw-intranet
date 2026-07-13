import { getGraphToken, getHomepageCardsRaw, parseHomepageCardsContent, HomepageCard } from './tvHomepageCards';
import { listDefaultImageFiles } from './tvImages';

/**
 * Load cards and fill empty imageUrl from Default Images via /api/images/{id}.
 * Uses card.imageIndex (1-based) when set, otherwise display order (idx + 1).
 */
export async function getHomepageCardsWithImages(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<HomepageCard[]> {
  const token = await getGraphToken(tenantId, clientId, clientSecret);
  const raw = await getHomepageCardsRaw(token);
  const cards = parseHomepageCardsContent(raw);
  const files = await listDefaultImageFiles(token);

  return cards.map((card, idx) => {
    if (card.imageUrl) return card;
    if (!files.length) return card;

    const imageIndex = card.imageIndex ?? idx + 1;
    const zeroBased =
      Number.isFinite(imageIndex) && imageIndex >= 1
        ? (Math.floor(imageIndex) - 1) % files.length
        : idx % files.length;
    const target = files[zeroBased];
    if (!target) return card;

    const publicBase = (process.env.TV_API_PUBLIC_BASE || '').replace(/\/$/, '');
    const path = `/api/images/${encodeURIComponent(target.id)}`;

    return {
      ...card,
      imageUrl: publicBase ? `${publicBase}${path}` : path,
    };
  });
}
