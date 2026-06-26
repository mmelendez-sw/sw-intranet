import React, { useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
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
  const isAuthenticated = useIsAuthenticated();
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    if (!src) {
      setResolvedSrc('');
      return;
    }
    if (!isSharePointImageUrl(src) || !isAuthenticated) {
      setResolvedSrc(src);
      return;
    }

    let cancelled = false;
    setResolvedSrc(src);
    void (async () => {
      const blobUrl = await getSharePointImageBlobUrl(instance, src);
      if (!cancelled && blobUrl) setResolvedSrc(blobUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [src, instance, isAuthenticated]);

  if (!resolvedSrc) {
    return null;
  }

  return <img src={resolvedSrc} alt={alt ?? ''} className={className} {...rest} />;
};

export default SharePointImage;
