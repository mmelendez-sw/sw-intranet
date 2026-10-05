import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const msal = { instance: { id: 'msal' }, authenticated: true };
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: msal.instance }),
  useIsAuthenticated: () => msal.authenticated,
}));

const getCachedSharePointImageUrl = vi.fn();
const getSharePointImageBlobUrl = vi.fn();
vi.mock('../services/contentService', () => ({
  isSharePointImageUrl: (url: string) => /sharepoint/i.test(url),
  getCachedSharePointImageUrl: (url: string) => getCachedSharePointImageUrl(url),
  getSharePointImageBlobUrl: (...args: unknown[]) => getSharePointImageBlobUrl(...args),
  resolveTvMediaUrl: (path: string, base: string) => `${base}|${path}`,
}));

import SharePointImage from './SharePointImage';

const SP = 'https://x.sharepoint.com/Shared%20Documents/a.png';

describe('<SharePointImage />', () => {
  beforeEach(() => {
    msal.authenticated = true;
    getCachedSharePointImageUrl.mockReset().mockReturnValue(null);
    getSharePointImageBlobUrl.mockReset();
  });
  afterEach(cleanup);

  it('renders non-SharePoint src directly with lazy/async defaults', () => {
    render(<SharePointImage src="/local.png" alt="Local" className="c" />);
    const img = screen.getByAltText('Local') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/local.png');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.className).toBe('c');
    expect(getSharePointImageBlobUrl).not.toHaveBeenCalled();
  });

  it('renders nothing for an empty src without a placeholder', () => {
    const { container } = render(<SharePointImage src="" />);
    expect(container.innerHTML).toBe('');
  });

  it('uses the placeholder for an empty src', () => {
    render(<SharePointImage src="" placeholderSrc="/ph.png" alt="" />);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/ph.png');
  });

  it('uses the in-memory cached object URL synchronously', () => {
    getCachedSharePointImageUrl.mockReturnValue('blob:cached');
    render(<SharePointImage src={SP} alt="Pic" />);
    expect(screen.getByAltText('Pic').getAttribute('src')).toBe('blob:cached');
    expect(getSharePointImageBlobUrl).not.toHaveBeenCalled();
  });

  it('shows the placeholder then swaps in the fetched blob URL when signed in', async () => {
    getSharePointImageBlobUrl.mockResolvedValue('blob:fetched');
    render(<SharePointImage src={SP} placeholderSrc="/ph.png" alt="Pic" />);
    expect(screen.getByAltText('Pic').getAttribute('src')).toBe('/ph.png');
    await waitFor(() => expect(screen.getByAltText('Pic').getAttribute('src')).toBe('blob:fetched'));
    expect(getSharePointImageBlobUrl).toHaveBeenCalledWith(msal.instance, SP);
  });

  it('keeps the placeholder when the fetch returns null', async () => {
    getSharePointImageBlobUrl.mockResolvedValue(null);
    render(<SharePointImage src={SP} placeholderSrc="/ph.png" alt="Pic" />);
    await waitFor(() => expect(getSharePointImageBlobUrl).toHaveBeenCalled());
    expect(screen.getByAltText('Pic').getAttribute('src')).toBe('/ph.png');
  });

  it('uses the TV API image proxy instead of Graph when signed out', () => {
    msal.authenticated = false;
    render(<SharePointImage src={SP} placeholderSrc="/ph.png" alt="Pic" />);
    const src = screen.getByAltText('Pic').getAttribute('src');
    expect(getSharePointImageBlobUrl).not.toHaveBeenCalled();
    // jsdom runs on localhost, so TV_CARDS_API_URL is the local TV API and the proxy is used.
    expect(src).toBe(
      `http://localhost:3001/api/tv-cards|/api/images/by-url?url=${encodeURIComponent(SP)}`
    );
  });

  it('passes extra img attributes through', () => {
    render(<SharePointImage src="/a.png" alt="A" width={10} data-testid="img" loading="eager" />);
    const img = screen.getByTestId('img');
    expect(img.getAttribute('width')).toBe('10');
    expect(img.getAttribute('loading')).toBe('eager');
  });
});
