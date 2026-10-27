import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const msalInstance = { id: 'msal' };
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: msalInstance }),
}));

vi.mock('../utils/msalToken', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/msalToken')>();
  return { ...actual, acquireIdTokenSilentOnly: vi.fn(async () => 'id-token') };
});

// The admin usage panel has its own fetch; keep it out of the generate-request assertions.
vi.mock('./IcemanUsage', () => ({ default: () => <div data-testid="iceman-usage" /> }));

import Iceman from './Iceman';
import { UserInfo } from '../types/user';

const allowed: UserInfo = {
  isAuthenticated: true,
  isEliteGroup: false,
  isEditor: false,
  email: 'MMelendez@SymphonyInfra.com',
};

const routes = (userInfo: UserInfo) => (
  <MemoryRouter initialEntries={['/iceman']}>
    <Routes>
      <Route path="/" element={<div>home page</div>} />
      <Route path="/iceman" element={<Iceman userInfo={userInfo} />} />
    </Routes>
  </MemoryRouter>
);

const renderIceman = (userInfo: UserInfo) => render(routes(userInfo));

const generateButton = () => screen.getByRole('button', { name: /Generate XLSX/ }) as HTMLButtonElement;
const cell = (row: number, field: 'latitude' | 'longitude' | 'site name') =>
  screen.getByLabelText(`Row ${row} ${field}`) as HTMLInputElement;

const fileInput = () => document.getElementById('iceman-file') as HTMLInputElement;

const switchToFileMode = () => fireEvent.click(screen.getByRole('tab', { name: /Upload a file/ }));

const pickFile = (name: string, content = 'lat,lng\n1,2') => {
  const f = new File([content], name, { type: 'text/csv' });
  fireEvent.change(fileInput(), { target: { files: [f] } });
  return f;
};

const okResponse = (headers: Record<string, string> = {}) =>
  new Response(new Blob(['xlsx']), { status: 200, headers });

type FetchCall = [string, RequestInit];

/** jsdom's Blob has no text(); read it through FileReader. */
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

describe('Iceman', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redirects home when the user is not allowlisted', () => {
    renderIceman({ ...allowed, email: 'someone@symphonyinfra.com' });
    expect(screen.getByText('home page')).toBeTruthy();
    expect(screen.queryByText('ICEMAN')).toBeNull();
  });

  it('redirects home when the user is not authenticated', () => {
    renderIceman({ ...allowed, isAuthenticated: false });
    expect(screen.getByText('home page')).toBeTruthy();
  });

  it('redirects home when email is missing', () => {
    renderIceman({ ...allowed, email: undefined });
    expect(screen.getByText('home page')).toBeTruthy();
  });

  it('shows the usage panel only to ICEMAN admins', () => {
    renderIceman(allowed);
    expect(screen.getByTestId('iceman-usage')).toBeTruthy();
    cleanup();
    renderIceman({ ...allowed, email: 'janhalt@symphonyinfra.com' });
    expect(screen.queryByTestId('iceman-usage')).toBeNull();
  });

  it('renders for an allowlisted email regardless of case, in manual mode with defaults', () => {
    renderIceman(allowed);
    expect(screen.getByText('ICEMAN')).toBeTruthy();
    expect(screen.getByText(`Signed in as ${allowed.email}`)).toBeTruthy();
    expect(screen.getByText('45 m')).toBeTruthy();
    expect(screen.getByText('375 m')).toBeTruthy();
    expect(screen.getByText('0 of 15 locations')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Enter or paste/ }).getAttribute('aria-selected')).toBe('true');
    expect(cell(3, 'latitude')).toBeTruthy();
    expect(generateButton().disabled).toBe(true);
  });

  it('flags an out-of-range coordinate and keeps Generate disabled', () => {
    renderIceman(allowed);
    fireEvent.change(cell(1, 'latitude'), { target: { value: '95' } });
    fireEvent.change(cell(1, 'longitude'), { target: { value: '-74' } });
    expect(cell(1, 'latitude').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/1 row has an invalid/)).toBeTruthy();
    expect(generateButton().disabled).toBe(true);
  });

  it('spreads pasted coordinates across rows starting at the pasted row', () => {
    renderIceman(allowed);
    fireEvent.paste(cell(2, 'latitude'), {
      clipboardData: { getData: () => '40.7128\t-74.006\tSite A\n34.05\t-118.24\tSite B' },
    });
    expect(cell(2, 'latitude').value).toBe('40.7128');
    expect(cell(2, 'longitude').value).toBe('-74.006');
    expect(cell(2, 'site name').value).toBe('Site A');
    expect(cell(3, 'latitude').value).toBe('34.05');
    expect(cell(3, 'site name').value).toBe('Site B');
    expect(screen.getByText('Pasted 2 locations.')).toBeTruthy();
    expect(screen.getByText('2 of 15 locations')).toBeTruthy();
  });

  it('posts manual rows as a CSV with the ID token and triggers a download', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      okResponse({ 'Content-Disposition': 'attachment; filename="out.xlsx"' })
    );
    vi.stubGlobal('fetch', fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderIceman(allowed);
    fireEvent.change(cell(1, 'latitude'), { target: { value: '40.5' } });
    fireEvent.change(cell(1, 'longitude'), { target: { value: '-74.25' } });
    fireEvent.change(cell(1, 'site name'), { target: { value: 'Roof, North' } });
    expect(generateButton().disabled).toBe(false);
    fireEvent.click(generateButton());

    await waitFor(() => expect(screen.getByText('Download started: out.xlsx')).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as FetchCall;
    expect(url.endsWith('/api/iceman/generate?max_rows=15&close_m=45&far_m=375')).toBe(true);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer id-token');
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const uploaded = body.get('file') as File;
    expect(uploaded.name).toBe('iceman-coordinates.csv');
    expect(await readBlob(uploaded)).toBe('lat,lng,Site name\r\n40.5,-74.25,"Roof, North"\r\n');
    expect(body.get('close_m')).toBe('45');
    expect(body.get('far_m')).toBe('375');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  describe('file upload mode', () => {
    it('rejects a file that is not csv/xlsx', () => {
      renderIceman(allowed);
      switchToFileMode();
      pickFile('coords.txt');
      expect(screen.getByText('Only .csv and .xlsx files are supported.')).toBeTruthy();
      expect(screen.queryByText('coords.txt')).toBeNull();
    });

    it('rejects legacy .xls files', () => {
      renderIceman(allowed);
      switchToFileMode();
      pickFile('coords.xls');
      expect(screen.getByText('Only .csv and .xlsx files are supported.')).toBeTruthy();
    });

    it('rejects files over the 4 MB upload cap', () => {
      renderIceman(allowed);
      switchToFileMode();
      const big = new File(['x'], 'big.csv', { type: 'text/csv' });
      Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 });
      fireEvent.change(fileInput(), { target: { files: [big] } });
      expect(screen.getByText(/uploads are limited to 4 MB/)).toBeTruthy();
      expect(screen.queryByText('big.csv')).toBeNull();
    });

    it('accepts a csv and can clear it', () => {
      renderIceman(allowed);
      switchToFileMode();
      expect(generateButton().disabled).toBe(true);
      pickFile('coords.CSV');
      expect(screen.getByText('coords.CSV')).toBeTruthy();
      expect(generateButton().disabled).toBe(false);
      fireEvent.click(screen.getByRole('button', { name: 'Clear file' }));
      expect(screen.queryByText('coords.CSV')).toBeNull();
      expect(generateButton().disabled).toBe(true);
    });

    it('posts the picked file and uses slider values in the request', async () => {
      const fetchMock = vi.fn(async (..._args: unknown[]) => okResponse());
      vi.stubGlobal('fetch', fetchMock);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      renderIceman(allowed);
      switchToFileMode();
      const f = pickFile('coords.xlsx');
      fireEvent.change(document.getElementById('iceman-close-m')!, { target: { value: '20' } });
      fireEvent.change(document.getElementById('iceman-far-m')!, { target: { value: '450' } });
      fireEvent.click(generateButton());

      await waitFor(() => expect(screen.getByText(/Download started: iceman-output-/)).toBeTruthy());
      const [url, init] = fetchMock.mock.calls[0] as unknown as FetchCall;
      expect(url).toContain('max_rows=15&close_m=20&far_m=450');
      expect(((init.body as FormData).get('file') as File).name).toBe(f.name);
    });

    it('surfaces the server JSON error text', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(JSON.stringify({ error: 'Nearmap quota exceeded' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
      renderIceman(allowed);
      switchToFileMode();
      pickFile('coords.csv');
      fireEvent.click(generateButton());
      await waitFor(() => expect(screen.getByText('Nearmap quota exceeded')).toBeTruthy());
      expect(screen.getByText('Could not generate workbook')).toBeTruthy();
    });

    it('falls back to a status message when the error body is not JSON', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })));
      renderIceman(allowed);
      switchToFileMode();
      pickFile('coords.csv');
      fireEvent.click(generateButton());
      await waitFor(() => expect(screen.getByText('Request failed (500)')).toBeTruthy());
    });
  });

  it('does not throw when allowlist status flips between renders (hooks order regression)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = renderIceman(allowed);
    expect(screen.getByText('ICEMAN')).toBeTruthy();
    expect(() => rerender(routes({ ...allowed, email: 'nobody@symphonyinfra.com' }))).not.toThrow();
    expect(screen.getByText('home page')).toBeTruthy();
    const hookErrors = errSpy.mock.calls.filter((c) => String(c[0]).includes('hooks'));
    expect(hookErrors).toHaveLength(0);
  });
});
