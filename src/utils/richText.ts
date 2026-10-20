/**
 * HTML helpers for editor-authored content (card bullets, sidebar sections, announcements).
 * Everything rendered with dangerouslySetInnerHTML goes through sanitizeHtml first.
 */
import DOMPurify from 'dompurify';

// Links open in a new tab, as the old "Insert link" helper made them.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Strip scripts, event handlers, and javascript: URLs; keep ordinary formatting. */
export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HAS_TAG = /<[a-z][\s\S]*>/i;
const HAS_BLOCK = /<(p|ul|ol|li|h[1-6]|div|blockquote)\b/i;

/** Plain text (older announcements) → paragraphs, keeping line breaks. */
const plainTextToHtml = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtmlText(para).replace(/\n/g, '<br>')}</p>`)
    .join('');

/**
 * Normalise stored content for display or editing: plain text becomes paragraphs and inline
 * HTML (older sidebar sections) is wrapped in one paragraph, so block styling applies.
 */
export const toBlockHtml = (content: string): string => {
  const value = content.trim();
  if (!value) return '';
  if (!HAS_TAG.test(value)) return plainTextToHtml(value);
  return HAS_BLOCK.test(value) ? value : `<p>${value}</p>`;
};

/** Sanitised block HTML for dangerouslySetInnerHTML. */
export const renderRichText = (content: string): string => sanitizeHtml(toBlockHtml(content));

/** True when the editor holds nothing but empty paragraphs/whitespace. */
export const isRichTextEmpty = (html: string): boolean =>
  !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

// ── Card bullets (stored as one HTML string per <li>) ──

export const bulletsToHtml = (bullets: string[]): string => {
  const items = bullets.filter((b) => b.trim());
  return `<ul>${(items.length ? items : ['']).map((b) => `<li><p>${b}</p></li>`).join('')}</ul>`;
};

/** Editor HTML → bullet strings. Top-level paragraphs and nested list items become bullets too. */
export const htmlToBullets = (html: string): string[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const bullets: string[] = [];
  const fromListItem = (li: Element) => {
    const inline: string[] = [];
    for (const child of Array.from(li.children)) {
      if (child.tagName === 'UL' || child.tagName === 'OL') continue;
      inline.push(child.tagName === 'P' ? child.innerHTML : child.outerHTML);
    }
    if (!li.children.length) inline.push(li.innerHTML);
    bullets.push(inline.join('<br>'));
    li.querySelectorAll(':scope > ul > li, :scope > ol > li').forEach(fromListItem);
  };
  for (const node of Array.from(doc.body.children)) {
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      node.querySelectorAll(':scope > li').forEach(fromListItem);
    } else {
      bullets.push(node.tagName === 'P' ? node.innerHTML : node.outerHTML);
    }
  }
  return bullets.map((b) => b.trim()).filter((b) => b && !isRichTextEmpty(b));
};
