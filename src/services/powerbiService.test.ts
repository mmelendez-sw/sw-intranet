import { describe, it, expect, vi, afterEach } from 'vitest';
import { PowerbiService } from './powerbiService';
import { POWERBI_EMBED_TOKEN_URL } from '../authConfig';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('PowerbiService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a singleton', () => {
    expect(PowerbiService.getInstance()).toBe(PowerbiService.getInstance());
  });

  it('requests an embed token for the given report and maps the response', async () => {
    const fetchMock = vi.fn(async () =>
      json({ reportId: 'r2', embedUrl: 'https://embed', token: 't', tokenType: 'Aad', expiration: 'exp' })
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await PowerbiService.getInstance().generateEmbedToken('r 1');
    expect(fetchMock).toHaveBeenCalledWith(`${POWERBI_EMBED_TOKEN_URL}?reportId=r%201`);
    expect(out).toEqual({ reportId: 'r2', embedUrl: 'https://embed', token: 't', tokenType: 'Aad', expiration: 'exp' });
  });

  it('defaults reportId, tokenType and expiration', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ embedUrl: 'https://embed', token: 't', tokenType: 'weird' })));
    const out = await PowerbiService.getInstance().generateEmbedToken('rid');
    expect(out).toEqual({ reportId: 'rid', embedUrl: 'https://embed', token: 't', tokenType: 'Embed', expiration: '' });
  });

  it('uses a default report id when none is passed', async () => {
    const fetchMock = vi.fn(async () => json({ embedUrl: 'e', token: 't' }));
    vi.stubGlobal('fetch', fetchMock);
    await PowerbiService.getInstance().generateEmbedToken();
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toMatch(/\?reportId=[0-9a-f-]{36}$/);
  });

  it('throws the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'not configured' }, 500)));
    await expect(PowerbiService.getInstance().generateEmbedToken('r')).rejects.toThrow('not configured');
  });

  it('throws a status message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })));
    await expect(PowerbiService.getInstance().generateEmbedToken('r')).rejects.toThrow(
      'Failed to get Power BI embed token (502)'
    );
  });

  it('throws when embedUrl or token is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ embedUrl: 'e' })));
    await expect(PowerbiService.getInstance().generateEmbedToken('r')).rejects.toThrow(
      'missing embedUrl or token'
    );
  });
});
