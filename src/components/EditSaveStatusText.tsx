import React from 'react';
import { SetContentResult } from '../services/contentService';

export type EditSaveStatus = 'idle' | 'saving' | 'saved' | 'saved-local' | 'error';

export const SHAREPOINT_SAVE_CLOSE_MS = 1200;

export function editSaveStatusFromResult(result: SetContentResult): EditSaveStatus {
  if (!result.ok) return 'error';
  return result.storage === 'sharepoint' ? 'saved' : 'saved-local';
}

/** Show status; auto-close only after a real SharePoint save. Keeps the editor open on local-only or failed saves. */
export async function finishEditSave(
  result: SetContentResult,
  setStatus: (status: EditSaveStatus) => void,
  onClose: () => void
): Promise<boolean> {
  const status = editSaveStatusFromResult(result);
  setStatus(status);
  if (status === 'saved') {
    await new Promise((resolve) => setTimeout(resolve, SHAREPOINT_SAVE_CLOSE_MS));
    onClose();
    return true;
  }
  // Local-only or error: stay in edit so the user can retry.
  return false;
}

/** True only when SharePoint accepted the write (or there was nothing to persist). */
export function canLeaveEditAfterSave(status: EditSaveStatus): boolean {
  return status === 'saved' || status === 'idle';
}

export const EditSaveStatusText: React.FC<{ status: EditSaveStatus }> = ({ status }) => {
  if (status === 'saving') {
    return <span className="edit-saving-indicator">Saving…</span>;
  }
  if (status === 'saved') {
    return (
      <span className="edit-saving-indicator edit-save-status-ok">Saved to SharePoint</span>
    );
  }
  if (status === 'saved-local') {
    return (
      <span className="edit-saving-indicator edit-save-status-local">
        Saved on this device only
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="edit-saving-indicator edit-save-status-error">
        Could not save — try again
      </span>
    );
  }
  return null;
};
