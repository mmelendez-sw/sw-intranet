import React, { useEffect } from 'react';
import { EditSaveStatus, EditSaveStatusText } from './EditSaveStatusText';

// ─── Tiny Edit Modal component (shared by HomePage and DevHomePage) ─────────

export interface EditModalProps {
  title: string;
  onClose: () => void;
  onSave?: () => Promise<void>;
  isSaving: boolean;
  onDelete?: () => Promise<void>;
  children: React.ReactNode;
  autoSave?: boolean;
  saveStatus?: EditSaveStatus;
  /** Autosave "Done" — defaults to onClose. Use to block leave until SharePoint save succeeds. */
  onDone?: () => void | Promise<void>;
}

const EditModal: React.FC<EditModalProps> = ({
  title,
  onClose,
  onSave,
  isSaving,
  onDelete,
  children,
  autoSave = false,
  saveStatus = 'idle',
  onDone,
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="edit-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="edit-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="edit-modal-header">
          <h3>{title}</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="edit-modal-body">{children}</div>
        <div className="edit-modal-footer">
          {onDelete && (
            <button className="edit-delete-btn" onClick={onDelete} disabled={isSaving}>
              🗑 Delete
            </button>
          )}
          <div className="edit-modal-footer-right">
            {autoSave ? (
              <>
                {saveStatus === 'idle' ? (
                  <span className="edit-saving-indicator" style={{ color: '#6c757d' }}>Edits save automatically</span>
                ) : (
                  <EditSaveStatusText status={saveStatus} />
                )}
                <button
                  className="edit-btn-save"
                  onClick={() => { void (onDone ?? onClose)(); }}
                  disabled={saveStatus === 'saving'}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <EditSaveStatusText status={isSaving ? 'saving' : saveStatus} />
                <button className="edit-btn-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
                <button className="edit-btn-save" onClick={onSave} disabled={isSaving || !onSave}>Save</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
