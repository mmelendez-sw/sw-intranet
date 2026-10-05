import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const instance = { id: 'msal' };
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance }),
}));

const getDirectoryUsersCached = vi.fn();
vi.mock('../services/directoryService', () => ({
  getDirectoryUsersCached: (...args: unknown[]) => getDirectoryUsersCached(...args),
}));

import { useDirectoryUsers } from './useDirectoryUsers';

describe('useDirectoryUsers', () => {
  beforeEach(() => getDirectoryUsersCached.mockReset());

  it('stays undefined and does not fetch when disabled', () => {
    const { result } = renderHook(() => useDirectoryUsers(false));
    expect(result.current).toBeUndefined();
    expect(getDirectoryUsersCached).not.toHaveBeenCalled();
  });

  it('is undefined while loading, then the users', async () => {
    const users = [{ id: '1', displayName: 'A B', jobTitle: null, department: null, mail: null }];
    getDirectoryUsersCached.mockResolvedValue(users);
    const { result } = renderHook(() => useDirectoryUsers(true));
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toBe(users));
    expect(getDirectoryUsersCached).toHaveBeenCalledWith(instance);
  });

  it('becomes null when the directory cannot be read', async () => {
    getDirectoryUsersCached.mockResolvedValue(null);
    const { result } = renderHook(() => useDirectoryUsers(true));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('fetches once it becomes enabled', async () => {
    getDirectoryUsersCached.mockResolvedValue([]);
    const { result, rerender } = renderHook(({ on }) => useDirectoryUsers(on), {
      initialProps: { on: false },
    });
    expect(getDirectoryUsersCached).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('ignores a result that arrives after unmount', async () => {
    let resolve!: (v: unknown) => void;
    getDirectoryUsersCached.mockReturnValue(new Promise((r) => { resolve = r; }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useDirectoryUsers(true));
    unmount();
    resolve([]);
    await Promise.resolve();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
