/**
 * jsdom has no IndexedDB and fake-indexeddb is not installed, so only the
 * "indexedDB unavailable" degradation path and the legacy-cache cleanup are tested here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearLegacyLocalStorageImageCache,
  idbGetImageBlob,
  idbSetImageBlob,
} from './sharePointImageIdb';

describe('sharePointImageIdb without IndexedDB', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('idbGetImageBlob resolves null', async () => {
    expect(await idbGetImageBlob('https://x.sharepoint.com/a.png')).toBeNull();
  });

  it('idbSetImageBlob resolves without throwing and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(idbSetImageBlob('u', new Blob(['x']))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});

describe('clearLegacyLocalStorageImageCache', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes only intranet-sp-img: keys from local and session storage', () => {
    localStorage.setItem('intranet-sp-img:a', '1');
    localStorage.setItem('intranet-sp-img:b', '2');
    localStorage.setItem('keep-me', '3');
    sessionStorage.setItem('intranet-sp-img:c', '4');
    sessionStorage.setItem('keep-session', '5');

    clearLegacyLocalStorageImageCache();

    expect(localStorage.getItem('intranet-sp-img:a')).toBeNull();
    expect(localStorage.getItem('intranet-sp-img:b')).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('3');
    expect(sessionStorage.getItem('intranet-sp-img:c')).toBeNull();
    expect(sessionStorage.getItem('keep-session')).toBe('5');
  });
});
