import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const msalInstance = vi.hoisted(() => ({ id: 'msal' }));
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: msalInstance }),
}));

const getContent = vi.fn();
const setContentDetailed = vi.fn();
vi.mock('../services/contentService', () => ({
  DEFAULT_ALERT: { message: '', isActive: false, type: 'info' },
  getContent: (...args: unknown[]) => getContent(...args),
  setContentDetailed: (...args: unknown[]) => setContentDetailed(...args),
}));

import AlertBanner from './AlertBanner';
import { EditMenuProvider } from '../context/EditMenuContext';
import { UserInfo } from '../types/user';

const viewer: UserInfo = { isAuthenticated: true, isEliteGroup: false, isEditor: false };
const editor: UserInfo = { ...viewer, isEditor: true };

const renderBanner = (userInfo: UserInfo, editMode = false) => {
  sessionStorage.setItem('intranet_edit_mode', String(editMode));
  return render(
    <EditMenuProvider>
      <AlertBanner userInfo={userInfo} />
    </EditMenuProvider>
  );
};

const activeAlert = {
  message: 'Office closed Friday',
  isActive: true,
  type: 'warning' as const,
  linkLabel: 'Details',
  linkUrl: 'https://example.com/closed',
};

describe('<AlertBanner />', () => {
  beforeEach(() => {
    sessionStorage.clear();
    getContent.mockReset();
    setContentDetailed.mockReset();
  });
  afterEach(cleanup);

  it('does not load content when signed out', () => {
    renderBanner({ ...viewer, isAuthenticated: false });
    expect(getContent).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an active alert with its link and type class', async () => {
    getContent.mockResolvedValue(activeAlert);
    renderBanner(viewer);
    const banner = await screen.findByRole('alert');
    expect(getContent).toHaveBeenCalledWith({ id: 'msal' }, 'site-alert');
    expect(banner.className).toContain('alert-warning');
    expect(banner.textContent).toContain('Office closed Friday');
    const link = screen.getByRole('link', { name: 'Details' }) as HTMLAnchorElement;
    expect(link.href).toBe('https://example.com/closed');
    expect(link.target).toBe('_blank');
    expect(screen.queryByText('✏ Edit')).toBeNull();
  });

  it('hides inactive or empty alerts', async () => {
    getContent.mockResolvedValue({ ...activeAlert, isActive: false });
    renderBanner(viewer);
    await waitFor(() => expect(getContent).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dismisses for the session and stays dismissed for the same message', async () => {
    getContent.mockResolvedValue(activeAlert);
    renderBanner(viewer);
    fireEvent.click(await screen.findByLabelText('Dismiss alert'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sessionStorage.getItem('alert-dismissed')).toBe('Office closed Friday');

    cleanup();
    render(
      <EditMenuProvider>
        <AlertBanner userInfo={viewer} />
      </EditMenuProvider>
    );
    await waitFor(() => expect(getContent).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a new message even if an older one was dismissed', async () => {
    sessionStorage.setItem('alert-dismissed', 'old message');
    getContent.mockResolvedValue(activeAlert);
    renderBanner(viewer);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('editors outside edit mode get no edit controls', async () => {
    getContent.mockResolvedValue(null);
    renderBanner(editor, false);
    await waitFor(() => expect(getContent).toHaveBeenCalled());
    expect(screen.queryByText('+ Set Alert')).toBeNull();
  });

  it('editors in edit mode can set and save an alert (local save keeps modal open)', async () => {
    getContent.mockResolvedValue(null);
    setContentDetailed.mockResolvedValue({ ok: true, storage: 'local' });
    renderBanner(editor, true);
    fireEvent.click(await screen.findByText('+ Set Alert'));
    expect(screen.getByRole('dialog', { name: 'Edit site alert' })).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Banner is active (visible to all users)'));
    fireEvent.change(screen.getByPlaceholderText(/Office closed Friday/), {
      target: { value: 'New alert' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Saved on this device only')).toBeTruthy());
    expect(setContentDetailed).toHaveBeenCalledWith(
      { id: 'msal' },
      'site-alert',
      expect.objectContaining({ message: 'New alert', isActive: true, type: 'info' })
    );
    expect(screen.getByRole('alert').textContent).toContain('New alert');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('a failed save shows the error and does not change the banner', async () => {
    getContent.mockResolvedValue(activeAlert);
    setContentDetailed.mockResolvedValue({ ok: false, storage: 'none' });
    renderBanner(editor, true);
    fireEvent.click(await screen.findByText('✏ Edit'));
    fireEvent.change(screen.getByPlaceholderText(/Office closed Friday/), {
      target: { value: 'Changed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Could not save — try again')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('Office closed Friday');
  });

  it('closes the modal on Escape and Cancel', async () => {
    getContent.mockResolvedValue(null);
    renderBanner(editor, true);
    fireEvent.click(await screen.findByText('+ Set Alert'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('+ Set Alert'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
