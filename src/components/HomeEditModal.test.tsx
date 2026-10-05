import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../services/contentService', () => ({}));

import EditModal from './HomeEditModal';

afterEach(() => {
  cleanup();
});

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('HomeEditModal (EditModal)', () => {
  it('renders title, children and an accessible dialog', () => {
    render(
      <EditModal title="Edit card" onClose={() => {}} isSaving={false}>
        <p>body content</p>
      </EditModal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Edit card');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Edit card');
    expect(screen.getByText('body content')).toBeTruthy();
  });

  it('manual mode: Save calls onSave, Cancel and the close button call onClose', () => {
    const onClose = vi.fn();
    const onSave = vi.fn(async () => {});
    render(
      <EditModal title="T" onClose={onClose} onSave={onSave} isSaving={false}>
        x
      </EditModal>
    );
    fireEvent.click(button('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(button('Cancel'));
    fireEvent.click(button('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('manual mode: Save is disabled without onSave, and Save/Cancel/Delete disabled while saving', () => {
    const { rerender } = render(
      <EditModal title="T" onClose={() => {}} isSaving={false}>
        x
      </EditModal>
    );
    expect(button('Save').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(false);

    rerender(
      <EditModal title="T" onClose={() => {}} onSave={async () => {}} onDelete={async () => {}} isSaving>
        x
      </EditModal>
    );
    expect(button('Save').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    expect(button('🗑 Delete').disabled).toBe(true);
    expect(screen.getByText('Saving…')).toBeTruthy();
  });

  it('shows the Delete button only when onDelete is provided', () => {
    const onDelete = vi.fn(async () => {});
    const { rerender } = render(
      <EditModal title="T" onClose={() => {}} isSaving={false}>
        x
      </EditModal>
    );
    expect(screen.queryByRole('button', { name: '🗑 Delete' })).toBeNull();

    rerender(
      <EditModal title="T" onClose={() => {}} isSaving={false} onDelete={onDelete}>
        x
      </EditModal>
    );
    fireEvent.click(button('🗑 Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('autosave mode: idle shows hint, Done calls onDone (or onClose by default)', () => {
    const onClose = vi.fn();
    const onDone = vi.fn();
    const { rerender } = render(
      <EditModal title="T" onClose={onClose} isSaving={false} autoSave>
        x
      </EditModal>
    );
    expect(screen.getByText('Edits save automatically')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(button('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <EditModal title="T" onClose={onClose} isSaving={false} autoSave onDone={onDone}>
        x
      </EditModal>
    );
    fireEvent.click(button('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('autosave mode: Done is disabled while saving and status text reflects saveStatus', () => {
    const { rerender } = render(
      <EditModal title="T" onClose={() => {}} isSaving={false} autoSave saveStatus="saving">
        x
      </EditModal>
    );
    expect(button('Done').disabled).toBe(true);
    expect(screen.getByText('Saving…')).toBeTruthy();

    rerender(
      <EditModal title="T" onClose={() => {}} isSaving={false} autoSave saveStatus="saved">
        x
      </EditModal>
    );
    expect(button('Done').disabled).toBe(false);
    expect(screen.getByText('Saved to SharePoint')).toBeTruthy();
  });

  it('Escape key calls onClose and the listener is removed on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <EditModal title="T" onClose={onClose} isSaving={false}>
        x
      </EditModal>
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop click closes, but clicks inside the dialog do not', () => {
    const onClose = vi.fn();
    const { container } = render(
      <EditModal title="T" onClose={onClose} isSaving={false}>
        <span>inner</span>
      </EditModal>
    );
    fireEvent.click(screen.getByText('inner'));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.edit-modal-backdrop') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
