import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  canLeaveEditAfterSave,
  editSaveStatusFromResult,
  EditSaveStatusText,
  finishEditSave,
  SHAREPOINT_SAVE_CLOSE_MS,
} from './EditSaveStatusText';

describe('editSaveStatusFromResult', () => {
  it('maps results to statuses', () => {
    expect(editSaveStatusFromResult({ ok: true, storage: 'sharepoint' })).toBe('saved');
    expect(editSaveStatusFromResult({ ok: true, storage: 'local' })).toBe('saved-local');
    expect(editSaveStatusFromResult({ ok: false, storage: 'none' })).toBe('error');
    expect(editSaveStatusFromResult({ ok: false, storage: 'sharepoint' })).toBe('error');
  });
});

describe('finishEditSave', () => {
  afterEach(() => vi.useRealTimers());

  it('closes after the delay only on a SharePoint save', async () => {
    vi.useFakeTimers();
    const setStatus = vi.fn();
    const onClose = vi.fn();
    const done = finishEditSave({ ok: true, storage: 'sharepoint' }, setStatus, onClose);
    expect(setStatus).toHaveBeenCalledWith('saved');
    await vi.advanceTimersByTimeAsync(SHAREPOINT_SAVE_CLOSE_MS - 1);
    expect(onClose).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await done).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open on local-only or failed saves', async () => {
    const setStatus = vi.fn();
    const onClose = vi.fn();
    expect(await finishEditSave({ ok: true, storage: 'local' }, setStatus, onClose)).toBe(false);
    expect(setStatus).toHaveBeenLastCalledWith('saved-local');
    expect(await finishEditSave({ ok: false, storage: 'none' }, setStatus, onClose)).toBe(false);
    expect(setStatus).toHaveBeenLastCalledWith('error');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('canLeaveEditAfterSave', () => {
  it('only allows leaving after a real save or no-op', () => {
    expect(canLeaveEditAfterSave('saved')).toBe(true);
    expect(canLeaveEditAfterSave('idle')).toBe(true);
    expect(canLeaveEditAfterSave('saved-local')).toBe(false);
    expect(canLeaveEditAfterSave('error')).toBe(false);
    expect(canLeaveEditAfterSave('saving')).toBe(false);
  });
});

describe('<EditSaveStatusText />', () => {
  afterEach(cleanup);

  it.each([
    ['saving', 'Saving…', 'edit-saving-indicator'],
    ['saved', 'Saved to SharePoint', 'edit-save-status-ok'],
    ['saved-local', 'Saved on this device only', 'edit-save-status-local'],
    ['error', 'Could not save — try again', 'edit-save-status-error'],
  ] as const)('renders %s', (status, text, cls) => {
    const { container } = render(<EditSaveStatusText status={status} />);
    const span = container.querySelector('span')!;
    expect(span.textContent?.trim()).toBe(text);
    expect(span.classList.contains(cls)).toBe(true);
  });

  it('renders nothing when idle', () => {
    const { container } = render(<EditSaveStatusText status="idle" />);
    expect(container.innerHTML).toBe('');
  });
});
