import React, { useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { TV_CARDS_API_URL } from '../authConfig';
import {
  getCachedSharePointImageUrl,
  getSharePointImageBlobUrl,
  isSharePointImageUrl,
  resolveTvMediaUrl,
} from '../services/contentService';

interface SharePointImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** Bundled/local image shown until the authenticated SharePoint fetch completes. */
  placeholderSrc?: string;
}

/** Unsigned /tv: proxy SharePoint webUrls through the TV API (app credentials). */
function tvApiSharePointProxyUrl(sharePointUrl: string): string | null {
  if (!TV_CARDS_API_URL) return null;
  const path = `/api/images/by-url?url=${encodeURIComponent(sharePointUrl)}`;
  return resolveTvMediaUrl(path, TV_CARDS_API_URL);
}

function resolveDisplaySrc(src: string, placeholderSrc?: string): string {
  if (!src) return placeholderSrc || '';
  if (!isSharePointImageUrl(src)) return src;
  return getCachedSharePointImageUrl(src) || placeholderSrc || '';
}

/**
 * Renders images stored in SharePoint using a Graph-authenticated fetch so they
 * load for signed-in users even without SharePoint browser cookies (e.g. incognito).
 * When unsigned but TV_CARDS_API_URL is set, uses the TV API image proxy instead.
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

    const tvProxy = !isAuthenticated ? tvApiSharePointProxyUrl(src) : null;
    if (tvProxy) {
      setResolvedSrc(tvProxy);
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
