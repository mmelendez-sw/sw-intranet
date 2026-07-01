import React, { useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import {
  getCachedSharePointImageUrl,
  getSharePointImageBlobUrl,
  isSharePointImageUrl,
} from '../services/contentService';

interface SharePointImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** Bundled/local image shown until the authenticated SharePoint fetch completes. */
  placeholderSrc?: string;
}

function resolveDisplaySrc(src: string, placeholderSrc?: string): string {
  if (!src) return placeholderSrc || '';
  if (!isSharePointImageUrl(src)) return src;
  return getCachedSharePointImageUrl(src) || placeholderSrc || '';
}

/**
 * Renders images stored in SharePoint using a Graph-authenticated fetch so they
 * load for signed-in users even without SharePoint browser cookies (e.g. incognito).
 */
const SharePointImage: React.FC<SharePointImageProps> = ({
  src,
  placeholderSrc,
  alt,
  className,
  ...rest
}) => {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [resolvedSrc, setResolvedSrc] = useState(() => resolveDisplaySrc(src, placeholderSrc));

  useEffect(() => {
    if (!src) {
      setResolvedSrc(placeholderSrc || '');
      return;
    }
    if (!isSharePointImageUrl(src)) {
      setResolvedSrc(src);
      return;
    }

    const cached = getCachedSharePointImageUrl(src);
    if (cached) {
      setResolvedSrc(cached);
      return;
    }

    setResolvedSrc(placeholderSrc || '');

    if (!isAuthenticated) return;

    let cancelled = false;
    void (async () => {
      const dataUrl = await getSharePointImageBlobUrl(instance, src);
      if (!cancelled && dataUrl) setResolvedSrc(dataUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [src, placeholderSrc, instance, isAuthenticated]);

  if (!resolvedSrc) {
    return null;
  }

  return <img src={resolvedSrc} alt={alt ?? ''} className={className} {...rest} />;
};

export default SharePointImage;
