import img3 from '../../images/site_3.jpg';
import img3Md from '../../images/site_3_md.jpg';
import img3Sm from '../../images/site_3_sm.jpg';
import img4 from '../../images/coat.jpg';
import img4Md from '../../images/coat_md.jpg';
import img4Sm from '../../images/coat_sm.jpg';
import img7 from '../../images/mm2.jpg';
import img9 from '../../images/vol.jpg';
import img10 from '../../images/emp.jpg';
import img10Md from '../../images/emp_md.jpg';
import img10Sm from '../../images/emp_sm.jpg';
import img11 from '../../images/wider_app.png';
import howBanner from '../../images/H.O.W.-banner.png';

const BUNDLED_HOMEPAGE_IMAGE_URLS = [
  img9,
  img11,
  img7,
  img4,
  img4Sm,
  img4Md,
  img3,
  img3Sm,
  img3Md,
  img10,
  img10Sm,
  img10Md,
  howBanner,
];

/** Decode bundled homepage images into the browser cache during app boot. */
export function preloadBundledHomepageImages(): void {
  BUNDLED_HOMEPAGE_IMAGE_URLS.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}
