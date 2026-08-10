import React from 'react';
import { SetContentResult } from '../services/contentService';

export type EditSaveStatus = 'idle' | 'saving' | 'saved' | 'saved-local' | 'error';

export const SHAREPOINT_SAVE_CLOSE_MS = 1200;

export function editSaveStatusFromResult(result: SetContentResult): EditSaveStatus {
  if (!result.ok) return 'error';
  return result.storage === 'sharepoint' ? 'saved' : 'saved-local';
}

/** Show status; auto-close only after a real SharePoint save. */
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
  return result.ok;
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
