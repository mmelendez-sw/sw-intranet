import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTrackEvent } from '../hooks/useTrackEvent';

/** Known pages only, so typos and old bookmarks don't fill the usage page. */
const TRACKED_PAGES = new Set(['/', '/directory', '/reports', '/lead-generation', '/iceman', '/usage', '/dev']);

export const pageViewLabel = (pathname: string): string | null => {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return TRACKED_PAGES.has(path) ? path : null;
};

/** One 'page' event per route change for signed-in users. Renders nothing. */
const PageViewTracker: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { pathname } = useLocation();
  const track = useTrackEvent();
  useEffect(() => {
    if (enabled) track('page', pageViewLabel(pathname));
  }, [enabled, pathname, track]);
  return null;
};

export default PageViewTracker;
