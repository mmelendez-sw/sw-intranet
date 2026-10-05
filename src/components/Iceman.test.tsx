import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Iceman from './Iceman';
import { UserInfo } from '../types/user';

const allowed: UserInfo = {
  isAuthenticated: true,
  isEliteGroup: false,
  isEditor: false,
  email: 'MMelendez@SymphonyInfra.com',
};

const renderIceman = (userInfo: UserInfo) =>
  render(
    <MemoryRouter initialEntries={['/iceman']}>
      <Routes>
        <Route path="/" element={<div>home page</div>} />
        <Route path="/iceman" element={<Iceman userInfo={userInfo} />} />
      </Routes>
    </MemoryRouter>
  );

const fileInput = () => document.getElementById('iceman-file') as HTMLInputElement;

const pickFile = (name: string) => {
  const f = new File(['lat,lng\n1,2'], name, { type: 'text/csv' });
  fireEvent.change(fileInput(), { target: { files: [f] } });
  return f;
};

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

  it('renders for an allowlisted email regardless of case', () => {
    renderIceman(allowed);
    expect(screen.getByText('ICEMAN')).toBeTruthy();
    expect(screen.getByText(`Signed in as ${allowed.email}`)).toBeTruthy();
    expect(screen.getByText('35 m')).toBeTruthy();
    expect(screen.getByText('300 m')).toBeTruthy();
    const generate = screen.getByRole('button', { name: /Generate XLSX/ }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
  });

  it('rejects a file that is not csv/xlsx', () => {
    renderIceman(allowed);
    pickFile('coords.txt');
    expect(screen.getByText('Only .csv and .xlsx files are supported.')).toBeTruthy();
    expect(screen.queryByText('coords.txt')).toBeNull();
  });

  it('accepts a csv and can clear it', () => {
    renderIceman(allowed);
    pickFile('coords.CSV');
    expect(screen.getByText('coords.CSV')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear file' }));
    expect(screen.queryByText('coords.CSV')).toBeNull();
  });

  it('posts FormData and triggers a download on success', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Blob(['xlsx']), {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="out.xlsx"' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderIceman(allowed);
    const f = pickFile('coords.xlsx');
    fireEvent.click(screen.getByRole('button', { name: /Generate XLSX/ }));

    await waitFor(() => expect(screen.getByText('Download started: out.xlsx')).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith('/api/iceman/generate?max_rows=500&close_m=35&far_m=300')).toBe(true);
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe(f.name);
    expect(body.get('close_m')).toBe('35');
    expect(body.get('far_m')).toBe('300');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('uses slider values in the request', async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(['x']), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderIceman(allowed);
    pickFile('coords.csv');
    fireEvent.change(document.getElementById('iceman-close-m')!, { target: { value: '20' } });
    fireEvent.change(document.getElementById('iceman-far-m')!, { target: { value: '450' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate XLSX/ }));

    await waitFor(() => expect(screen.getByText(/Download started: iceman-output-/)).toBeTruthy());
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('close_m=20&far_m=450');
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
    pickFile('coords.csv');
    fireEvent.click(screen.getByRole('button', { name: /Generate XLSX/ }));
    await waitFor(() => expect(screen.getByText('Nearmap quota exceeded')).toBeTruthy());
    expect(screen.getByText('Could not generate workbook')).toBeTruthy();
  });

  it('falls back to a status message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })));
    renderIceman(allowed);
    pickFile('coords.csv');
    fireEvent.click(screen.getByRole('button', { name: /Generate XLSX/ }));
    await waitFor(() => expect(screen.getByText('Request failed (500)')).toBeTruthy());
  });

  it('does not throw when allowlist status flips between renders (hooks order regression)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = renderIceman(allowed);
    expect(screen.getByText('ICEMAN')).toBeTruthy();
    expect(() =>
      rerender(
        <MemoryRouter initialEntries={['/iceman']}>
          <Routes>
            <Route path="/" element={<div>home page</div>} />
            <Route
              path="/iceman"
              element={<Iceman userInfo={{ ...allowed, email: 'nobody@symphonyinfra.com' }} />}
            />
          </Routes>
        </MemoryRouter>
      )
    ).not.toThrow();
    expect(screen.getByText('home page')).toBeTruthy();
    const hookErrors = errSpy.mock.calls.filter((c) => String(c[0]).includes('hooks'));
    expect(hookErrors).toHaveLength(0);
  });
});
