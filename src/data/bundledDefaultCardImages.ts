/**
 * Static card fallbacks for /tv (and homepage) when SharePoint Default Images
 * cannot be fetched — no login and no TV API required.
 *
 * Keep in sync with General/intranet/Default Images when those change.
 */
import site1 from '../../images/site_1.jpg';
import site2 from '../../images/site_2.jpg';
import site3 from '../../images/site_3.jpg';
import site4 from '../../images/site_4.jpg';
import site5 from '../../images/site_5.jpg';
import widerApp from '../../images/wider_app.png';

/** Ordered list — cycled by card display position (same rule as SharePoint folder). */
export const BUNDLED_DEFAULT_CARD_IMAGES: string[] = [
  site1,
  site2,
  site3,
  site4,
  site5,
  widerApp,
];
