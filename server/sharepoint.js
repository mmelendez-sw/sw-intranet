/**
 * SharePoint homepage cards via ROPC (MICROSOFT_USERNAME / MICROSOFT_PASSWORD).
 * Secrets stay on the server — the browser only calls /api/tv-cards.
 */

const TV_SHAREPOINT_DRIVE_ID =
  'b!PRZFjpqB2U6dHC5-1xRK-ckNeOcC0b9OuYzaxCUuqlF98qlI6Tz8RYjJa1ViXSq_';
const TV_HOMEPAGE_CARDS_ITEM_ID = '01UIS5FCXU77HFE7F73JAI4TKRF5NURVFT';
const DEFAULT_IMAGES_FOLDER_PATH = 'General/intranet/Default Images';
const IMAGE_FILE_RE = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

function requireEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing required env var (tried: ${names.join(', ')})`);
}

function getTvApiPublicBase() {
  return (
    process.env.TV_API_PUBLIC_BASE ||
    `http://localhost:${process.env.API_PORT || process.env.TV_API_PORT || 3001}`
  ).replace(/\/$/, '');
}

function toPublicImageProxyUrl(driveItemId) {
  return `${getTvApiPublicBase()}/api/images/${encodeURIComponent(driveItemId)}`;
}

function toPublicImageByUrlProxy(webUrl) {
  return `${getTvApiPublicBase()}/api/images/by-url?url=${encodeURIComponent(webUrl)}`;
}

function encodeDrivePath(path) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isSharePointWebUrl(url) {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return false;
  return /sharepoint\.com/i.test(url) || /graph\.microsoft\.com/i.test(url);
}

function webUrlToDrivePath(webUrl) {
  try {
    const pathname = decodeURIComponent(new URL(webUrl).pathname);
    const match = pathname.match(/\/Shared Documents\/(.+)$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function encodeSharePointUrlForGraph(webUrl) {
  const base64 = Buffer.from(webUrl, 'utf8').toString('base64');
  return `u!${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/**
 * Sign in as MICROSOFT_USERNAME (falls back to POWERBI_USERNAME) via ROPC.
 * Needs a public client app with "Allow public client flows" and Graph delegated
 * Files.Read.All + Sites.Read.All (admin consent).
 */
async function getGraphAccessToken() {
  const tenantId = requireEnv('MICROSOFT_TENANT_ID', 'POWERBI_TENANT_ID', 'TENANT_ID');
  const clientId = requireEnv('MICROSOFT_CLIENT_ID', 'CLIENT_ID', 'POWERBI_CLIENT_ID');
  const username = requireEnv('MICROSOFT_USERNAME', 'POWERBI_USERNAME');
  const password = requireEnv('MICROSOFT_PASSWORD', 'POWERBI_PASSWORD');

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password,
    scope: [
      'https://graph.microsoft.com/Files.Read.All',
      'https://graph.microsoft.com/Sites.Read.All',
      'offline_access',
    ].join(' '),
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Graph ROPC token failed (${response.status})`
    );
  }
  return data.access_token;
}

function parseHomepageCardsContent(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object' && Array.isArray(raw.cards)) return raw.cards;
  return [];
}

async function getHomepageCardsRaw(token) {
  const url = `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}/items/${TV_HOMEPAGE_CARDS_ITEM_ID}/content`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`SharePoint cards fetch failed: ${resp.status} ${await resp.text()}`);
  }
  const text = await resp.text();
  if (!text.trim()) return [];
  return JSON.parse(text);
}

let folderIdCache = null;
let filesCache = null;
const FILES_CACHE_MS = 60_000;

async function getDefaultImagesFolderId(token) {
  if (folderIdCache) return folderIdCache;
  const path = encodeDrivePath(DEFAULT_IMAGES_FOLDER_PATH);
  const url = `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}/root:/${path}?$select=id`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Default Images folder lookup failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  if (!data.id) throw new Error('Default Images folder id missing');
  folderIdCache = data.id;
  return folderIdCache;
}

async function listDefaultImageFiles(token) {
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
  const data = await resp.json();
  const files = (data.value || [])
    .filter((item) => item.file && IMAGE_FILE_RE.test(item.name || ''))
    .map((item) => ({ id: item.id, name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  filesCache = { at: Date.now(), files };
  return files;
}

async function resolveDriveItemIdFromWebUrl(webUrl, token) {
  const drivePath = webUrlToDrivePath(webUrl);
  if (drivePath) {
    const encodedPath = encodeDrivePath(drivePath);
    const byPathUrl =
      `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
      `/root:/${encodedPath}?$select=id`;
    const byPath = await fetch(byPathUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (byPath.ok) {
      const data = await byPath.json();
      if (data.id) return data.id;
    }
  }

  const shareId = encodeSharePointUrlForGraph(webUrl);
  const shareRes = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem?$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!shareRes.ok) return null;
  const data = await shareRes.json();
  return data.id || null;
}

async function getHomepageCardsWithImages() {
  const token = await getGraphAccessToken();
  const raw = await getHomepageCardsRaw(token);
  const cards = parseHomepageCardsContent(raw);
  let files = [];
  try {
    files = await listDefaultImageFiles(token);
  } catch (err) {
    console.warn('[sharepoint] Default Images unavailable:', err.message || err);
  }

  return Promise.all(
    cards.map(async (card, idx) => {
      const imageUrl = (card.imageUrl || '').trim();

      if (imageUrl && isSharePointWebUrl(imageUrl)) {
        const itemId = await resolveDriveItemIdFromWebUrl(imageUrl, token);
        if (itemId) return { ...card, imageUrl: toPublicImageProxyUrl(itemId) };
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
      return { ...card, imageUrl: toPublicImageProxyUrl(target.id) };
    })
  );
}

async function getHomepageCardsMeta() {
  const token = await getGraphAccessToken();
  const url =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/items/${TV_HOMEPAGE_CARDS_ITEM_ID}?$select=eTag,cTag,lastModifiedDateTime`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`SharePoint cards meta failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return {
    eTag: data.eTag ?? null,
    cTag: data.cTag ?? null,
    lastModifiedDateTime: data.lastModifiedDateTime ?? null,
  };
}

async function getDriveImageContent(itemId) {
  const token = await getGraphAccessToken();
  const url =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/items/${encodeURIComponent(itemId)}/content`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Image fetch failed: ${resp.status} ${await resp.text()}`);
  }
  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  const body = Buffer.from(await resp.arrayBuffer());
  return { body, contentType };
}

async function getDriveImageContentByWebUrl(webUrl) {
  const token = await getGraphAccessToken();
  const itemId = await resolveDriveItemIdFromWebUrl(webUrl, token);
  if (!itemId) return null;
  return getDriveImageContent(itemId);
}

module.exports = {
  getHomepageCardsWithImages,
  getHomepageCardsMeta,
  getDriveImageContent,
  getDriveImageContentByWebUrl,
  isSharePointWebUrl,
};
