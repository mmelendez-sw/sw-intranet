import howBanner from '../../images/H.O.W.-banner.png';

const BUNDLED_HOMEPAGE_IMAGE_URLS = [howBanner];

/** Decode bundled homepage images into the browser cache during app boot. */
export function preloadBundledHomepageImages(): void {
  BUNDLED_HOMEPAGE_IMAGE_URLS.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}
