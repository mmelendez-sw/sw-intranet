import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Landscape TV / kiosk screens (1080p and up). */
const TV_MEDIA_QUERY = '(min-width: 1600px) and (min-height: 900px)';

export function useTvLayout(): boolean {
  const [searchParams] = useSearchParams();
  const forceTv =
    searchParams.get('tv') === '1' ||
    searchParams.get('mode') === 'tv';

  const [matchesMedia, setMatchesMedia] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(TV_MEDIA_QUERY).matches
  );

  useEffect(() => {
    if (forceTv) return;

    const mq = window.matchMedia(TV_MEDIA_QUERY);
    const onChange = () => setMatchesMedia(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [forceTv]);

  return forceTv || matchesMedia;
}
