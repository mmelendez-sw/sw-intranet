import React, { useEffect, useState } from 'react';
import { TV_CARDS_API_URL } from '../authConfig';
import { isSharePointImageUrl, resolveTvMediaUrl } from '../services/tvCardsClient';

interface SharePointImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** Bundled/local image shown when src is empty or still resolving. */
  placeholderSrc?: string;
}

/** Unsigned lobby: proxy SharePoint webUrls through the TV API (app credentials). */
function tvApiSharePointProxyUrl(sharePointUrl: string): string | null {
  if (!TV_CARDS_API_URL) return null;
  const path = `/api/images/by-url?url=${encodeURIComponent(sharePointUrl)}`;
  return resolveTvMediaUrl(path, TV_CARDS_API_URL);
}

/**
 * Renders card images. SharePoint webUrls go through /api/images when possible;
 * API-proxied `/api/images/...` URLs and bundled assets load as normal <img> src.
 */
const SharePointImage: React.FC<SharePointImageProps> = ({
  src,
  placeholderSrc,
  alt,
  className,
  ...rest
}) => {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    if (!src) return placeholderSrc || '';
    if (isSharePointImageUrl(src)) {
      return tvApiSharePointProxyUrl(src) || placeholderSrc || '';
    }
    return resolveTvMediaUrl(src, TV_CARDS_API_URL) || src;
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(placeholderSrc || '');
      return;
    }
    if (isSharePointImageUrl(src)) {
      setResolvedSrc(tvApiSharePointProxyUrl(src) || placeholderSrc || '');
      return;
    }
    setResolvedSrc(resolveTvMediaUrl(src, TV_CARDS_API_URL) || src);
  }, [src, placeholderSrc]);

  if (!resolvedSrc) return null;

  return <img src={resolvedSrc} alt={alt ?? ''} className={className} {...rest} />;
};

export default SharePointImage;
