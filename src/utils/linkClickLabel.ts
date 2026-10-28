/**
 * For a click inside rich text (card bullets, sidebar sections): "<context> → <link text>" when
 * the click landed on a link, otherwise null. Falls back to the link's host when it has no text.
 */
export function linkClickLabel(target: EventTarget | null, context: string | undefined): string | null {
  if (!(target instanceof Element)) return null;
  const link = target.closest('a[href]');
  if (!link) return null;
  let text = (link.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    try {
      text = new URL(link.getAttribute('href') || '', window.location.href).hostname;
    } catch {
      text = 'link';
    }
  }
  return `${(context || '').trim() || 'Untitled'} → ${text}`;
}
