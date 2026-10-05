import { describe, it, expect } from 'vitest';
import { escapeHtmlAttr, escapeHtmlText, DEFAULT_LINK_LABEL, buildHtmlLink } from './html';

describe('escapeHtmlAttr', () => {
  it('escapes &, " and <', () => {
    expect(escapeHtmlAttr('a&b"c<d')).toBe('a&amp;b&quot;c&lt;d');
  });

  it('escapes & first so existing entities are double-escaped', () => {
    expect(escapeHtmlAttr('&quot;')).toBe('&amp;quot;');
  });

  it('leaves > and single quotes untouched (current behavior)', () => {
    expect(escapeHtmlAttr("a>b'c")).toBe("a>b'c");
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtmlAttr('')).toBe('');
  });
});

describe('escapeHtmlText', () => {
  it('escapes &, < and >', () => {
    expect(escapeHtmlText('<b>Tom & Jerry</b>')).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });

  it('leaves quotes untouched', () => {
    expect(escapeHtmlText(`"x" 'y'`)).toBe(`"x" 'y'`);
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtmlText('')).toBe('');
  });
});

describe('DEFAULT_LINK_LABEL', () => {
  it('is CLICK HERE', () => {
    expect(DEFAULT_LINK_LABEL).toBe('CLICK HERE');
  });
});

describe('buildHtmlLink', () => {
  const anchor = (href: string, text: string) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

  it('builds an anchor with the given label', () => {
    expect(buildHtmlLink('https://example.com', 'Docs')).toBe(anchor('https://example.com', 'Docs'));
  });

  it('falls back to the default label when label is empty', () => {
    expect(buildHtmlLink('https://example.com', '')).toBe(anchor('https://example.com', 'CLICK HERE'));
  });

  it('falls back to the default label when label is whitespace only', () => {
    expect(buildHtmlLink('https://example.com', '   \t ')).toBe(anchor('https://example.com', 'CLICK HERE'));
  });

  it('trims the label, url and suffix', () => {
    expect(buildHtmlLink('  https://example.com  ', '  Docs  ', '  for details  ')).toBe(
      `${anchor('https://example.com', 'Docs')} for details`
    );
  });

  it('omits the suffix when it is empty or whitespace', () => {
    expect(buildHtmlLink('https://x.test', 'X', '')).toBe(anchor('https://x.test', 'X'));
    expect(buildHtmlLink('https://x.test', 'X', '   ')).toBe(anchor('https://x.test', 'X'));
  });

  it('defaults suffix to empty', () => {
    expect(buildHtmlLink('https://x.test', 'X')).toBe(anchor('https://x.test', 'X'));
  });

  it('escapes the url as an attribute and the label as text', () => {
    expect(buildHtmlLink('https://x.test/?a=1&b="2"<', '<i>A & B</i>')).toBe(
      anchor('https://x.test/?a=1&amp;b=&quot;2&quot;&lt;', '&lt;i&gt;A &amp; B&lt;/i&gt;')
    );
  });

  it('does not escape the suffix (current behavior)', () => {
    expect(buildHtmlLink('https://x.test', 'X', '<b>now</b>')).toBe(`${anchor('https://x.test', 'X')} <b>now</b>`);
  });

  it('does not validate the url scheme (current behavior)', () => {
    expect(buildHtmlLink('javascript:alert(1)', 'X')).toBe(anchor('javascript:alert(1)', 'X'));
  });
});
