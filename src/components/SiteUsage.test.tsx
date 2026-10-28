import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// Stable like the real hook: a new instance per render would refetch forever.
const msalState = vi.hoisted(() => ({ instance: { id: 'msal' } }));
vi.mock('@azure/msal-react', () => ({ useMsal: () => msalState }));

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('../services/intranetApi', () => ({
  intranetApiFetch: (...args: unknown[]) => apiFetch(...args),
}));

vi.mock('../hooks/useSharePointContent', () => ({
  useSharePointContent: (key: string) => ({
    data:
      key === 'reports'
        ? [
            { title: 'Portfolio Overview', link: 'https://app.powerbi.com/a' },
            { title: 'Lease Expirations', link: 'https://app.powerbi.com/b' },
            { title: 'No Link Yet', link: '' },
          ]
        : [
            { id: '1', label: 'Benefits', url: 'https://x.test' },
            { id: '2', label: 'Payroll', url: 'https://y.test' },
          ],
  }),
}));

import SiteUsage from './SiteUsage';

const kinds = (overrides: Record<string, { label: string; opens: number; people: number }[]> = {}) => ({
  page: [],
  report: [],
  'quick-link': [],
  'card-link': [],
  'sidebar-link': [],
  search: [],
  ...overrides,
});

const summary = (days: number, extra: Record<string, unknown> = {}) => ({
  days,
  totals: { events: 42, people: 9 },
  since: '2026-01-01T00:00:00.000Z',
  kinds: kinds({
    report: [{ label: 'Portfolio Overview', opens: 12, people: 5 }],
    'quick-link': [{ label: 'benefits', opens: 3, people: 2 }],
  }),
  ...extra,
});

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(cleanup);

describe('SiteUsage', () => {
  it('shows totals, tables, and reports and links nobody opened', async () => {
    apiFetch.mockResolvedValue(Response.json(summary(30)));
    render(<SiteUsage />);
    expect(await screen.findByText('Portfolio Overview')).toBeTruthy();
    expect(screen.getByText('42').closest('p')?.textContent).toContain('last 30 days');
    expect(apiFetch.mock.calls[0][1]).toMatch(/\/api\/analytics\/summary\?days=30$/);

    const unopened = screen.getByText('Not opened in 30 days').closest('section')!;
    expect(unopened.textContent).toContain('Lease Expirations');
    expect(unopened.textContent).toContain('Payroll');
    // Opened ones (quick-link match is case-insensitive) and link-less reports are left out.
    expect(unopened.textContent).not.toContain('Portfolio Overview');
    expect(unopened.textContent).not.toContain('Benefits');
    expect(unopened.textContent).not.toContain('No Link Yet');
  });

  it('says when tracking began inside the period', async () => {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
    apiFetch.mockResolvedValue(Response.json(summary(30, { since })));
    render(<SiteUsage />);
    expect(await screen.findByText(/^Not opened since /)).toBeTruthy();
    expect(screen.getByText('42').closest('p')?.textContent).toContain('since tracking began on');
  });

  it('refetches when the period changes', async () => {
    apiFetch.mockImplementation((_i: unknown, url: string) =>
      Promise.resolve(Response.json(summary(Number(new URL(url, 'http://x').searchParams.get('days')))))
    );
    render(<SiteUsage />);
    await screen.findByText('Not opened in 30 days');
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() => expect(screen.getByText('Not opened in 7 days')).toBeTruthy());
    expect(apiFetch.mock.lastCall?.[1]).toMatch(/days=7$/);
  });

  it('shows an error when the summary fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    apiFetch.mockResolvedValue(new Response('{}', { status: 403 }));
    render(<SiteUsage />);
    expect(await screen.findByText(/Couldn't load usage/)).toBeTruthy();
  });
});
