import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  acquireSharePointToken,
  acquireTokenSilentOnly,
  DIRECTORY_SCOPES,
  GRAPH_GROUP_SCOPES,
  SHAREPOINT_SCOPES,
} from './msalToken';

const account = { username: 'a@symphonyinfra.com' };

const makeInstance = (acquire: (req: any) => Promise<any>, accounts: unknown[] = [account]) => ({
  getAllAccounts: vi.fn(() => accounts),
  acquireTokenSilent: vi.fn(acquire),
});

describe('msalToken', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('exports the expected scope sets', () => {
    expect(SHAREPOINT_SCOPES).toEqual(['Sites.ReadWrite.All', 'Files.ReadWrite.All']);
    expect(DIRECTORY_SCOPES).toEqual(['User.Read.All']);
    expect(GRAPH_GROUP_SCOPES).toEqual(['User.Read', 'GroupMember.Read.All']);
  });

  it('returns null without calling MSAL when there are no accounts', async () => {
    const inst = makeInstance(async () => ({ accessToken: 'x' }), []);
    expect(await acquireTokenSilentOnly(inst, ['User.Read'])).toBeNull();
    expect(inst.acquireTokenSilent).not.toHaveBeenCalled();
  });

  it('returns the silent token for the first account', async () => {
    const inst = makeInstance(async () => ({ accessToken: 'tok-1' }), [account, { username: 'b' }]);
    expect(await acquireTokenSilentOnly(inst, ['User.Read'])).toBe('tok-1');
    expect(inst.acquireTokenSilent).toHaveBeenCalledWith({ scopes: ['User.Read'], account });
  });

  it('retries with forceRefresh when the first silent call fails', async () => {
    const inst = makeInstance(async (req) => {
      if (!req.forceRefresh) throw new Error('expired');
      return { accessToken: 'refreshed' };
    });
    expect(await acquireTokenSilentOnly(inst, ['User.Read'])).toBe('refreshed');
    expect(inst.acquireTokenSilent).toHaveBeenCalledTimes(2);
    expect(inst.acquireTokenSilent.mock.calls[1][0]).toEqual({
      scopes: ['User.Read'],
      account,
      forceRefresh: true,
    });
  });

  it('returns null when both silent attempts fail (never interactive)', async () => {
    const inst = makeInstance(async () => {
      throw new Error('interaction_required');
    });
    expect(await acquireTokenSilentOnly(inst, ['User.Read'])).toBeNull();
    expect(inst.acquireTokenSilent).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent requests for the same scopes regardless of order', async () => {
    let resolve!: (v: { accessToken: string }) => void;
    const inst = makeInstance(() => new Promise((r) => { resolve = r; }));
    const a = acquireTokenSilentOnly(inst, ['A', 'B']);
    const b = acquireTokenSilentOnly(inst, ['B', 'A']);
    resolve({ accessToken: 'shared' });
    expect(await a).toBe('shared');
    expect(await b).toBe('shared');
    expect(inst.acquireTokenSilent).toHaveBeenCalledTimes(1);
  });

  it('issues a new request after the previous one settles', async () => {
    const inst = makeInstance(async () => ({ accessToken: 't' }));
    await acquireTokenSilentOnly(inst, ['C']);
    await acquireTokenSilentOnly(inst, ['C']);
    expect(inst.acquireTokenSilent).toHaveBeenCalledTimes(2);
  });

  it('acquireSharePointToken requests the SharePoint scopes', async () => {
    const inst = makeInstance(async () => ({ accessToken: 'sp' }));
    expect(await acquireSharePointToken(inst)).toBe('sp');
    expect(inst.acquireTokenSilent.mock.calls[0][0].scopes).toEqual(SHAREPOINT_SCOPES);
  });
});
