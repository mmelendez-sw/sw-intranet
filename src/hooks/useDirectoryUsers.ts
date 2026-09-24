import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { GraphUser, getDirectoryUsersCached } from '../services/directoryService';

/**
 * Active directory users for cross-referencing (shared, fetched once per page load).
 * `undefined` while loading, `null` when the directory can't be read.
 */
export function useDirectoryUsers(enabled: boolean): GraphUser[] | null | undefined {
  const { instance } = useMsal();
  const [users, setUsers] = useState<GraphUser[] | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getDirectoryUsersCached(instance).then((result) => {
      if (!cancelled) setUsers(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, instance]);

  return users;
}
