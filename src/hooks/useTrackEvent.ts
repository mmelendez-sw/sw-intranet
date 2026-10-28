import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { AnalyticsKind, trackEvent } from '../services/analytics';

/** trackEvent bound to the signed-in MSAL instance. */
export function useTrackEvent(): (kind: AnalyticsKind, label: string | null | undefined) => void {
  const { instance } = useMsal();
  return useCallback((kind, label) => trackEvent(instance, kind, label), [instance]);
}
