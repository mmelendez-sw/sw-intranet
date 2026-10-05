import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GraphUser } from './directoryService';

const acquireTokenSilentOnly = vi.fn();
vi.mock('../utils/msalToken', () => ({
  acquireTokenSilentOnly: (...args: unknown[]) => acquireTokenSilentOnly(...args),
  DIRECTORY_SCOPES: ['User.Read.All'],
  GRAPH_GROUP_SCOPES: [],
  SHAREPOINT_SCOPES: [],
}));

const load = async () => {
  vi.resetModules();
  return import('./directoryService');
};

const u = (overrides: Partial<GraphUser> & { displayName: string }): GraphUser => ({
  id: overrides.displayName,
  jobTitle: 'Analyst',
  department: 'Ops',
  companyName: 'Symphony',
  mail: null,
  accountEnabled: true,
  ...overrides,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('directoryService', () => {
  beforeEach(() => {
    acquireTokenSilentOnly.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('isContractorOrConsultant', () => {
    it('detects contractors and consultants in the job title', async () => {
      const { isContractorOrConsultant } = await load();
      expect(isContractorOrConsultant(u({ displayName: 'A B', jobTitle: 'Engineer (Consultant)' }))).toBe(true);
      expect(isContractorOrConsultant(u({ displayName: 'A B', jobTitle: 'CONTRACTOR' }))).toBe(true);
      expect(isContractorOrConsultant(u({ displayName: 'A B', jobTitle: 'Senior Consultant' }))).toBe(true);
      expect(isContractorOrConsultant(u({ displayName: 'A B', jobTitle: 'Analyst' }))).toBe(false);
      expect(isContractorOrConsultant(u({ displayName: 'A B', jobTitle: null }))).toBe(false);
    });
  });

  describe('fetchDirectoryUsers', () => {
    it('follows nextLink pages, filters non-employees and sorts by name', async () => {
      const { fetchDirectoryUsers } = await load();
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('page2')) {
          return json({
            value: [
              u({ displayName: 'Amy Alpha' }),
              u({ displayName: 'Room - Board Room' }),
              u({ displayName: 'Other Co', companyName: 'Acme' }),
              u({ displayName: 'Dis Abled', accountEnabled: false }),
            ],
          });
        }
        return json({
          value: [
            u({ displayName: 'Zed Zulu' }),
            u({ displayName: 'Mononym', givenName: null, surname: null }),
            u({ displayName: 'Solo', givenName: 'Solo', surname: 'Person' }),
            u({ displayName: 'No Title', jobTitle: '  ' }),
            u({ displayName: 'Con Sultant', jobTitle: 'PM (Consultant)' }),
            u({ displayName: 'Con Tractor', jobTitle: 'Contractor' }),
            u({ displayName: 'Lower Case', companyName: ' symphony ' }),
          ],
          '@odata.nextLink': 'https://graph/page2',
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const users = await fetchDirectoryUsers('tok');
      expect(users.map((x) => x.displayName)).toEqual([
        'Amy Alpha',
        'Con Tractor',
        'Lower Case',
        'Solo',
        'Zed Zulu',
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain('https://graph.microsoft.com/v1.0/users?$filter=accountEnabled%20eq%20true');
      expect(init.headers).toEqual({ Authorization: 'Bearer tok', ConsistencyLevel: 'eventual' });
    });

    it('throws with status and a truncated body on failure', async () => {
      const { fetchDirectoryUsers } = await load();
      vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(500), { status: 403 })));
      await expect(fetchDirectoryUsers('tok')).rejects.toThrow(/^\/users failed: 403 — x{240}$/);
    });
  });

  describe('getDirectoryUsersCached', () => {
    it('returns null without a token', async () => {
      const { getDirectoryUsersCached } = await load();
      acquireTokenSilentOnly.mockResolvedValue(null);
      expect(await getDirectoryUsersCached({})).toBeNull();
      expect(acquireTokenSilentOnly).toHaveBeenCalledWith({}, ['User.Read.All']);
    });

    it('fetches once and shares the result (concurrent + later callers)', async () => {
      const { getDirectoryUsersCached } = await load();
      acquireTokenSilentOnly.mockResolvedValue('tok');
      const fetchMock = vi.fn(async () => json({ value: [u({ displayName: 'Amy Alpha' })] }));
      vi.stubGlobal('fetch', fetchMock);
      const [a, b] = await Promise.all([getDirectoryUsersCached({}), getDirectoryUsersCached({})]);
      expect(a).toBe(b);
      expect(a?.map((x) => x.displayName)).toEqual(['Amy Alpha']);
      expect(await getDirectoryUsersCached({})).toBe(a);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null on failure and retries on the next call', async () => {
      const { getDirectoryUsersCached } = await load();
      acquireTokenSilentOnly.mockResolvedValue('tok');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 500 }))
        .mockResolvedValueOnce(json({ value: [u({ displayName: 'Amy Alpha' })] }));
      vi.stubGlobal('fetch', fetchMock);
      expect(await getDirectoryUsersCached({})).toBeNull();
      expect(await getDirectoryUsersCached({})).toHaveLength(1);
    });
  });
});
