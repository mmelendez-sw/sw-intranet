import { describe, it, expect, vi, afterEach } from 'vitest';
import { preloadBundledHomepageImages } from './homepageImageWarmup';

describe('preloadBundledHomepageImages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates an async-decoded Image for each bundled asset', () => {
    const created: Array<{ decoding: string; src: string }> = [];
    class FakeImage {
      decoding = '';
      src = '';
      constructor() {
        created.push(this);
      }
    }
    vi.stubGlobal('Image', FakeImage);
    preloadBundledHomepageImages();
    expect(created).toHaveLength(1);
    expect(created[0].decoding).toBe('async');
    expect(created[0].src).toMatch(/H\.O\.W\.-banner\.png$/);
  });
});
