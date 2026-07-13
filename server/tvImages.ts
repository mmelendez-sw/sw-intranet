/**
 * Default Images folder listing + content proxy for /tv (client credentials).
 *
 * resolveCardImage(imageIndex) → `/api/images/{driveItemId}`
 * GET /api/images/:id streams the file bytes from Graph.
 */

import { TV_SHAREPOINT_DRIVE_ID } from './tvHomepageCards';

const DEFAULT_IMAGES_FOLDER_PATH = 'General/intranet/Default Images';
const IMAGE_FILE_RE = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

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
  const resp = await fetch(url, {
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

/** List image files in Default Images, sorted by name (cached briefly). */
export async function listDefaultImageFiles(token: string): Promise<DriveImageFile[]> {
  if (filesCache && Date.now() - filesCache.at < FILES_CACHE_MS) {
    return filesCache.files;
  }

  const folderId = await getDefaultImagesFolderId(token);
  const listUrl =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/items/${folderId}/children?$select=id,name,file&$top=200`;

  const resp = await fetch(listUrl, {
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

/** Fetch raw image bytes from Graph for a drive item id. */
export async function getDriveImageContent(
  itemId: string,
  token: string
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const url =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/items/${encodeURIComponent(itemId)}/content`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Image content fetch failed: ${resp.status} ${await resp.text()}`);
  }

  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  const body = await resp.arrayBuffer();
  return { body, contentType };
}

export function clearDefaultImagesCache(): void {
  folderIdCache = null;
  filesCache = null;
}
