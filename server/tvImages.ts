/**
 * Default Images folder listing + content proxy for /tv (client credentials).
 *
 * resolveCardImage(imageIndex) → `/api/images/{driveItemId}`
 * GET /api/images/:id streams the file bytes from Graph.
 */

import { TV_SHAREPOINT_DRIVE_ID } from './tvHomepageCards';
import { fetchWithTimeout } from './fetchWithTimeout';

const DEFAULT_IMAGES_FOLDER_PATH = 'General/intranet/Default Images';
const IMAGE_FILE_RE = /\.(jpe?g|png|gif|webp|bmp)$/i;
/** The proxies are unauthenticated, so only serve image files from the intranet content folder. */
const ALLOWED_IMAGE_ROOT = 'general/intranet/';

function isAllowedImagePath(drivePath: string): boolean {
  const normalized = drivePath.replace(/^\/+/, '').toLowerCase();
  return (
    normalized.startsWith(ALLOWED_IMAGE_ROOT) &&
    !normalized.split('/').includes('..') &&
    IMAGE_FILE_RE.test(normalized)
  );
}

function isImageContentType(contentType: string): boolean {
  return /^image\/(jpeg|png|gif|webp|bmp)(;|$)/i.test(contentType.trim());
}

export interface DriveImageFile {
  id: string;
  name: string;
}

let folderIdCache: string | null = null;
let filesCache: { at: number; files: DriveImageFile[] } | null = null;
const FILES_CACHE_MS = 60_000;

function encodeDrivePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** Resolve SharePoint folder item id for Default Images (cached). */
export async function getDefaultImagesFolderId(token: string): Promise<string> {
  if (folderIdCache) return folderIdCache;

  const path = encodeDrivePath(DEFAULT_IMAGES_FOLDER_PATH);
  const url = `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}/root:/${path}?$select=id`;
  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(
      `Default Images folder lookup failed: ${resp.status} ${await resp.text()}`
    );
  }
  const data = (await resp.json()) as { id?: string };
  if (!data.id) throw new Error('Default Images folder id missing from Graph response');
  folderIdCache = data.id;
  return folderIdCache;
}

function encodeSharePointUrlForGraph(webUrl: string): string {
  const base64 = Buffer.from(webUrl, 'utf8').toString('base64');
  return `u!${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function webUrlToDrivePath(webUrl: string): string | null {
  try {
    const pathname = decodeURIComponent(new URL(webUrl).pathname);
    const match = pathname.match(/\/Shared Documents\/(.+)$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isSharePointWebUrl(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return false;
  return /sharepoint\.com/i.test(url) || /graph\.microsoft\.com/i.test(url);
}

/** Resolve a SharePoint file webUrl → drive item id (app token). */
export async function resolveDriveItemIdFromWebUrl(
  webUrl: string,
  token: string
): Promise<string | null> {
  const drivePath = webUrlToDrivePath(webUrl);
  if (drivePath) {
    const encodedPath = encodeDrivePath(drivePath);
    const byPathUrl =
      `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
      `/root:/${encodedPath}?$select=id`;
    const byPath = await fetchWithTimeout(byPathUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (byPath.ok) {
      const data = (await byPath.json()) as { id?: string };
      if (data.id) return data.id;
    }
  }

  const shareId = encodeSharePointUrlForGraph(webUrl);
  const shareRes = await fetchWithTimeout(
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem?$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!shareRes.ok) {
    const err = await shareRes.text().catch(() => '');
    console.warn(
      `[tvImages] resolveDriveItemIdFromWebUrl failed (${shareRes.status}):`,
      webUrl,
      err
    );
    return null;
  }
  const data = (await shareRes.json()) as { id?: string };
  return data.id ?? null;
}

/** Fetch image bytes for a SharePoint webUrl via Graph (app token); intranet images only. */
export async function getDriveImageContentByWebUrl(
  webUrl: string,
  token: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const drivePath = webUrlToDrivePath(webUrl);
  if (!drivePath || !isAllowedImagePath(drivePath)) return null;

  const byPathUrl =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/root:/${encodeDrivePath(drivePath)}:/content`;
  const byPath = await fetchWithTimeout(byPathUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const contentType = byPath.headers.get('content-type') || '';
  if (!byPath.ok || !isImageContentType(contentType)) {
    console.warn(`[tvImages] getDriveImageContentByWebUrl failed (${byPath.status}):`, webUrl);
    return null;
  }
  return { body: await byPath.arrayBuffer(), contentType };
}

/** Public origin for `/api/images/...` links (SPA may be on another port). */
export function getTvApiPublicBase(): string {
  return (
    process.env.TV_API_PUBLIC_BASE ||
    (process.env.TV_API_PORT ? `http://localhost:${process.env.TV_API_PORT}` : '')
  ).replace(/\/$/, '');
}

export function toPublicImageProxyUrl(driveItemId: string): string {
  const path = `/api/images/${encodeURIComponent(driveItemId)}`;
  const publicBase = getTvApiPublicBase();
  return publicBase ? `${publicBase}${path}` : path;
}

export function toPublicImageByUrlProxy(webUrl: string): string {
  const path = `/api/images/by-url?url=${encodeURIComponent(webUrl)}`;
  const publicBase = getTvApiPublicBase();
  return publicBase ? `${publicBase}${path}` : path;
}

/** List image files in Default Images, sorted by name (cached briefly). */
export async function listDefaultImageFiles(token: string): Promise<DriveImageFile[]> {
  if (filesCache && Date.now() - filesCache.at < FILES_CACHE_MS) {
    return filesCache.files;
  }

  const folderId = await getDefaultImagesFolderId(token);
  const listUrl =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/items/${folderId}/children?$select=id,name,file&$top=200`;

  const resp = await fetchWithTimeout(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Default Images list failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    value?: Array<{ id?: string; name?: string; file?: unknown }>;
  };

  const files = (data.value || [])
    .filter((item) => !!item.file && !!item.id && IMAGE_FILE_RE.test(item.name || ''))
    .map((item) => ({ id: item.id as string, name: item.name || item.id as string }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  filesCache = { at: Date.now(), files };
  return files;
}

/**
 * Map 1-based imageIndex → public proxy URL `/api/images/{id}`.
 * Cycles when imageIndex exceeds folder size.
 */
export async function resolveCardImage(
  imageIndex: number,
  token: string
): Promise<string | null> {
  const sorted = await listDefaultImageFiles(token);
  if (!sorted.length) return null;

  const zeroBased =
    Number.isFinite(imageIndex) && imageIndex >= 1
      ? (Math.floor(imageIndex) - 1) % sorted.length
      : 0;
  const targetFile = sorted[zeroBased];
  if (!targetFile) return null;

  return `/api/images/${encodeURIComponent(targetFile.id)}`;
}

export class ImageNotAllowedError extends Error {
  constructor() {
    super('Image not found');
  }
}

/** Fetch raw image bytes from Graph for a drive item id (intranet images only). */
export async function getDriveImageContent(
  itemId: string,
  token: string
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const itemUrl =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/items/${encodeURIComponent(itemId)}`;
  const metaResp = await fetchWithTimeout(`${itemUrl}?$select=name,parentReference`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaResp.ok) {
    throw new Error(`Image lookup failed: ${metaResp.status}`);
  }
  const meta = (await metaResp.json()) as { name?: string; parentReference?: { path?: string } };
  // parentReference.path looks like "/drives/{id}/root:/General/intranet/Default Images".
  const parentPath = decodeURIComponent(meta.parentReference?.path?.split('root:')[1] ?? '');
  if (!isAllowedImagePath(`${parentPath}/${meta.name ?? ''}`)) {
    throw new ImageNotAllowedError();
  }
  const url = `${itemUrl}/content`;

  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Image content fetch failed: ${resp.status} ${await resp.text()}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  if (!isImageContentType(contentType)) throw new ImageNotAllowedError();
  const body = await resp.arrayBuffer();
  return { body, contentType };
}

export function clearDefaultImagesCache(): void {
  folderIdCache = null;
  filesCache = null;
}
