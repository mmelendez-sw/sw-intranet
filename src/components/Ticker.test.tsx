import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const msalInstance = vi.hoisted(() => ({ id: 'msal' }));
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: msalInstance }),
}));

const getContent = vi.fn();
const setContent = vi.fn();
const setContentDetailed = vi.fn();
vi.mock('../services/contentService', () => ({
  DEFAULT_TICKER_ITEMS: [],
  getContent: (...args: unknown[]) => getContent(...args),
  setContent: (...args: unknown[]) => setContent(...args),
  setContentDetailed: (...args: unknown[]) => setContentDetailed(...args),
}));

import Ticker from './Ticker';
import { EditMenuProvider } from '../context/EditMenuContext';
import { UserInfo } from '../types/user';

const viewer: UserInfo = { isAuthenticated: true, isEliteGroup: false, isEditor: false };
const editor: UserInfo = { ...viewer, isEditor: true };

const items = [
  { id: 'b', text: 'Second', order: 2 },
  { id: 'a', text: 'First', order: 1 },
  { id: 'c', text: 'Third', order: 3 },
];

const renderTicker = (userInfo: UserInfo, editMode = false) => {
  sessionStorage.setItem('intranet_edit_mode', String(editMode));
  return render(
    <EditMenuProvider>
      <Ticker userInfo={userInfo} />
    </EditMenuProvider>
  );
};

const tickerTexts = () =>
  Array.from(document.querySelectorAll('.ticker__item')).map((el) => el.textContent);

describe('<Ticker />', () => {
  beforeEach(() => {
    sessionStorage.clear();
    getContent.mockReset();
    setContent.mockReset().mockResolvedValue(true);
    setContentDetailed.mockReset();
  });
  afterEach(cleanup);

  it('renders nothing for viewers when there are no items', async () => {
    getContent.mockResolvedValue(null);
    const { container } = renderTicker(viewer);
    await waitFor(() => expect(getContent).toHaveBeenCalledWith({ id: 'msal' }, 'ticker-items'));
    expect(container.innerHTML).toBe('');
  });

  it('does not fetch when signed out', () => {
    renderTicker({ ...viewer, isAuthenticated: false });
    expect(getContent).not.toHaveBeenCalled();
  });

  it('renders items sorted by order', async () => {
    getContent.mockResolvedValue(items);
    renderTicker(viewer);
    await waitFor(() => expect(tickerTexts()).toEqual(['- First', '- Second', '- Third']));
    expect(screen.queryByText('✏ Edit Ticker')).toBeNull();
  });

  it('editors in edit mode with no items see an add prompt', async () => {
    getContent.mockResolvedValue(null);
    renderTicker(editor, true);
    fireEvent.click(await screen.findByText('+ Add Ticker Items'));
    expect(screen.getByRole('dialog', { name: 'Manage Ticker' })).toBeTruthy();
    expect(screen.getByText('No items yet. Add one below.')).toBeTruthy();
  });

  it('adds a new item with the next order and saves it', async () => {
    getContent.mockResolvedValue(items);
    setContentDetailed.mockResolvedValue({ ok: true, storage: 'local' });
    renderTicker(editor, true);
    fireEvent.click(await screen.findByText('✏ Edit Ticker'));
    fireEvent.click(screen.getByText('+ Add Item'));
    expect(screen.getByRole('dialog', { name: 'New Ticker Item' })).toBeTruthy();
    expect(screen.queryByText('🗑 Delete')).toBeNull();
    fireEvent.change(screen.getByDisplayValue('New announcement'), { target: { value: 'Fourth' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(tickerTexts()).toEqual(['- First', '- Second', '- Third', '- Fourth']));
    const saved = setContentDetailed.mock.calls[0][2];
    expect(saved).toHaveLength(4);
    expect(saved[3]).toMatchObject({ text: 'Fourth', order: 4 });
    expect(saved[3].id).toMatch(/^ticker-\d+$/);
  });

  it('edits and deletes an existing item', async () => {
    getContent.mockResolvedValue(items);
    setContentDetailed.mockResolvedValue({ ok: true, storage: 'local' });
    renderTicker(editor, true);
    fireEvent.click(await screen.findByText('✏ Edit Ticker'));
    fireEvent.click(screen.getAllByText('✏')[1]);
    expect(screen.getByRole('dialog', { name: 'Edit Ticker Item' })).toBeTruthy();
    fireEvent.click(screen.getByText('🗑 Delete'));
    await waitFor(() => expect(tickerTexts()).toEqual(['- First', '- Third']));
    expect(setContentDetailed.mock.calls[0][2].map((i: { id: string }) => i.id)).toEqual(['a', 'c']);
  });

  it('does not apply a failed save', async () => {
    getContent.mockResolvedValue(items);
    setContentDetailed.mockResolvedValue({ ok: false, storage: 'none' });
    renderTicker(editor, true);
    fireEvent.click(await screen.findByText('✏ Edit Ticker'));
    fireEvent.click(screen.getAllByText('✏')[0]);
    fireEvent.change(screen.getByDisplayValue('First'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Could not save — try again')).toBeTruthy());
    expect(tickerTexts()).toEqual(['- First', '- Second', '- Third']);
  });

  it('reorders items and renumbers order', async () => {
    getContent.mockResolvedValue(items);
    renderTicker(editor, true);
    fireEvent.click(await screen.findByText('✏ Edit Ticker'));
    const ups = screen.getAllByText('↑') as HTMLButtonElement[];
    const downs = screen.getAllByText('↓') as HTMLButtonElement[];
    expect(ups[0].disabled).toBe(true);
    expect(downs[2].disabled).toBe(true);
    fireEvent.click(ups[2]);
    await waitFor(() => expect(tickerTexts()).toEqual(['- First', '- Third', '- Second']));
    expect(setContent).toHaveBeenCalledWith({ id: 'msal' }, 'ticker-items', [
      { id: 'a', text: 'First', order: 1 },
      { id: 'c', text: 'Third', order: 2 },
      { id: 'b', text: 'Second', order: 3 },
    ]);
  });
});
