import { getGraphToken, getHomepageCardsRaw, parseHomepageCardsContent, HomepageCard } from './tvHomepageCards';
import {
  listDefaultImageFiles,
  isSharePointWebUrl,
  resolveDriveItemIdFromWebUrl,
  toPublicImageProxyUrl,
  toPublicImageByUrlProxy,
} from './tvImages';

/**
 * Load cards and fill empty imageUrl from Default Images via /api/images/{id}.
 * Raw SharePoint imageUrls are rewritten to the TV image proxy (app credentials)
 * so unsigned /tv can render them.
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

  return Promise.all(
    cards.map(async (card, idx) => {
      const imageUrl = (card.imageUrl || '').trim();

      if (imageUrl && isSharePointWebUrl(imageUrl)) {
        const itemId = await resolveDriveItemIdFromWebUrl(imageUrl, token);
        if (itemId) {
          return { ...card, imageUrl: toPublicImageProxyUrl(itemId) };
        }
        // Fallback: on-demand proxy by webUrl (still uses app token)
        return { ...card, imageUrl: toPublicImageByUrlProxy(imageUrl) };
      }

      if (imageUrl) return card;
      if (!files.length) return card;

      const imageIndex = card.imageIndex ?? idx + 1;
      const zeroBased =
        Number.isFinite(imageIndex) && imageIndex >= 1
          ? (Math.floor(imageIndex) - 1) % files.length
          : idx % files.length;
      const target = files[zeroBased];
      if (!target) return card;

      return {
        ...card,
        imageUrl: toPublicImageProxyUrl(target.id),
      };
    })
  );
}
