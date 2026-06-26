import React, { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { getSharePointImageBlobUrl, isSharePointImageUrl } from '../services/contentService';

interface SharePointImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

/**
 * Renders images stored in SharePoint using a Graph-authenticated fetch so they
 * load for signed-in users even without SharePoint browser cookies (e.g. incognito).
 */
const SharePointImage: React.FC<SharePointImageProps> = ({ src, alt, className, ...rest }) => {
  const { instance } = useMsal();
  const [resolvedSrc, setResolvedSrc] = useState(() => (isSharePointImageUrl(src) ? '' : src));

  useEffect(() => {
    if (!src) {
      setResolvedSrc('');
      return;
    }
    if (!isSharePointImageUrl(src)) {
      setResolvedSrc(src);
      return;
    }

    let cancelled = false;
    void (async () => {
      const blobUrl = await getSharePointImageBlobUrl(instance, src);
      if (!cancelled) setResolvedSrc(blobUrl || '');
    })();

    return () => {
      cancelled = true;
    };
  }, [src, instance]);

  if (!resolvedSrc) {
    return <div className={className} aria-label={alt} role="img" />;
  }

  return <img src={resolvedSrc} alt={alt ?? ''} className={className} {...rest} />;
};

export default SharePointImage;
