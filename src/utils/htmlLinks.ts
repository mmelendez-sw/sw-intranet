/** HTML link helpers shared by the card, sidebar, and department editors. */

export const escapeHtmlAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const DEFAULT_LINK_LABEL = 'CLICK HERE';

export const buildClickHereBullet = (url: string, label: string, suffix = ''): string => {
  const linkText = label.trim() || DEFAULT_LINK_LABEL;
  const link = `<a href="${escapeHtmlAttr(url.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(linkText)}</a>`;
  const trimmedSuffix = suffix.trim();
  return trimmedSuffix ? `${link} ${trimmedSuffix}` : link;
};
