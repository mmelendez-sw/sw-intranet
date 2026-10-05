import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./msalToken', () => ({
  GRAPH_GROUP_SCOPES: ['User.Read', 'GroupMember.Read.All'],
  acquireTokenSilentOnly: vi.fn(),
}));

import { acquireTokenSilentOnly } from './msalToken';
import { getGroupIds } from './getGroupId';

const acquire = vi.mocked(acquireTokenSilentOnly);
const instance = (accounts: unknown[] = [{ username: 'me@x.com' }]) => ({
  getAllAccounts: () => accounts,
});

describe('getGroupIds', () => {
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    acquire.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const logged = () => log.mock.calls.map((c) => c.join(' ')).join('\n');

  it('bails out when no accounts are signed in', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await getGroupIds(instance([]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged()).toContain('No accounts found');
  });

  it('bails out when no token is available', async () => {
    acquire.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await getGroupIds(instance());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged()).toContain('Could not acquire token');
  });

  it('logs the IntranetExecs group id when found', async () => {
    acquire.mockResolvedValue('tok');
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          value: [
            { displayName: 'All Staff', id: 'g1' },
            { displayName: 'Intranet Executives', id: 'g2' },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    await getGroupIds(instance());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/memberOf');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(logged()).toContain("export const INTRANET_EXECS_GROUP_ID = 'g2';");
  });

  it('reports when the execs group is missing', async () => {
    acquire.mockResolvedValue('tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ value: [{ displayName: 'Other', id: 'g1' }] })))
    );
    await getGroupIds(instance());
    expect(logged()).toContain('IntranetExecs group not found');
  });

  it('logs an error on a non-OK response', async () => {
    acquire.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403, statusText: 'Forbidden' })));
    await getGroupIds(instance());
    expect(error).toHaveBeenCalledWith('Failed to fetch group membership:', 403, 'Forbidden');
  });

  it('catches thrown errors', async () => {
    acquire.mockRejectedValue(new Error('boom'));
    await expect(getGroupIds(instance())).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
