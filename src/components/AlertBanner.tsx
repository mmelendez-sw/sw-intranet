import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/alert-banner.css';
import '../../styles/edit-mode.css';
import { setContentDetailed, SiteAlert, DEFAULT_ALERT } from '../services/contentService';
import { useSharePointContent } from '../hooks/useSharePointContent';
import { UserInfo } from '../types/user';
import { useEditMode } from '../context/EditMenuContext';
import {
  EditSaveStatus,
  EditSaveStatusText,
  finishEditSave,
} from './EditSaveStatusText';

interface AlertBannerProps {
  userInfo: UserInfo;
}

const ICONS: Record<SiteAlert['type'], string> = {
  info:    'ℹ️',
  warning: '⚠️',
  success: '✅',
  error:   '🚨',
};

const DISMISSED_STORAGE_KEY = 'alert-dismissed';

/** Dismissal key: changes when the message, severity, or link changes (djb2 over the fields). */
const alertDismissKey = (alert: SiteAlert): string => {
  const text = JSON.stringify([alert.message, alert.type, alert.linkLabel || '', alert.linkUrl || '']);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `v2:${(hash >>> 0).toString(36)}`;
};

const readDismissedKey = (): string | null => {
  try {
    return sessionStorage.getItem(DISMISSED_STORAGE_KEY);
  } catch {
    return null;
  }
};

// Editors see an inline modal to compose / update the alert
interface EditModalProps {
  draft: SiteAlert;
  onChange: (d: SiteAlert) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  saveStatus?: EditSaveStatus;
}

const AlertEditModal: React.FC<EditModalProps> = ({
  draft,
  onChange,
  onSave,
  onClose,
  isSaving,
  saveStatus = 'idle',
}) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="edit-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="edit-modal" role="dialog" aria-label="Edit site alert">
        <div className="edit-modal-header">
          <h3>Site-wide Alert Banner</h3>
          <button className="edit-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="edit-modal-body">
          <div className="edit-checkbox-row" style={{ marginBottom: 8 }}>
            <input type="checkbox" id="alert-active" checked={draft.isActive}
              onChange={e => onChange({ ...draft, isActive: e.target.checked })} />
            <label htmlFor="alert-active" style={{ fontWeight: 600 }}>Banner is active (visible to all users)</label>
          </div>
          <div className="edit-field-group">
            <label>Message</label>
            <textarea rows={3} value={draft.message}
              onChange={e => onChange({ ...draft, message: e.target.value })}
              placeholder="e.g. Office closed Friday, April 18 — Good Friday holiday." />
          </div>
          <div className="edit-field-group">
            <label>Type</label>
            <select value={draft.type} onChange={e => onChange({ ...draft, type: e.target.value as SiteAlert['type'] })}>
              <option value="info">ℹ️ Info (blue)</option>
              <option value="warning">⚠️ Warning (yellow)</option>
              <option value="success">✅ Success (green)</option>
              <option value="error">🚨 Alert (red)</option>
            </select>
          </div>
          <div className="edit-field-group">
            <label>CTA Link Label (optional)</label>
            <input type="text" value={draft.linkLabel || ''}
              onChange={e => onChange({ ...draft, linkLabel: e.target.value })}
              placeholder="e.g. Read more" />
          </div>
          <div className="edit-field-group">
            <label>CTA Link URL (optional)</label>
            <input type="url" value={draft.linkUrl || ''}
              onChange={e => onChange({ ...draft, linkUrl: e.target.value })}
              placeholder="https://…" />
          </div>
        </div>
        <div className="edit-modal-footer">
          <div className="edit-modal-footer-right">
            <EditSaveStatusText status={isSaving ? 'saving' : saveStatus} />
            <button className="edit-btn-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button className="edit-btn-save" onClick={onSave} disabled={isSaving}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main AlertBanner component ───────────────────────────────────────────────

const AlertBanner: React.FC<AlertBannerProps> = ({ userInfo }) => {
  const { instance } = useMsal();
  const { isEditMode } = useEditMode();
  const canEdit = userInfo.isEditor && isEditMode;
  const { data: alert, setData: setAlert } = useSharePointContent<SiteAlert>('site-alert', {
    fallback: DEFAULT_ALERT,
    enabled: !!userInfo.isAuthenticated,
  });
  const [dismissedKey, setDismissedKey] = useState<string | null>(readDismissedKey);
  // Re-shows automatically when the alert changes (new key) even mid-session.
  const dismissed = dismissedKey === alertDismissKey(alert);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SiteAlert>(DEFAULT_ALERT);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<EditSaveStatus>('idle');

  const openEdit = useCallback(() => {
    setDraft({ ...alert });
    setSaveStatus('idle');
    setEditing(true);
  }, [alert]);

  const closeEdit = useCallback(() => {
    setEditing(false);
    setSaveStatus('idle');
  }, []);

  const saveAlert = async () => {
    setSaving(true);
    setSaveStatus('saving');
    const result = await setContentDetailed(instance, 'site-alert', draft);
    if (result.ok) {
      setAlert(draft);
      setDismissedKey(null);
      try {
        sessionStorage.removeItem(DISMISSED_STORAGE_KEY);
      } catch {
        // ignore private mode
      }
    }
    setSaving(false);
    await finishEditSave(result, setSaveStatus, closeEdit);
  };

  const dismiss = () => {
    const key = alertDismissKey(alert);
    setDismissedKey(key);
    try {
      sessionStorage.setItem(DISMISSED_STORAGE_KEY, key);
    } catch {
      // ignore private mode
    }
  };

  const showBanner = alert.isActive && alert.message && !dismissed;

  return (
    <>
      {/* Active banner visible to all users */}
      {showBanner && (
        <div className={`site-alert-banner alert-${alert.type}`} role="alert">
          <span className="site-alert-icon">{ICONS[alert.type]}</span>
          <span className="site-alert-message">
            {alert.message}
            {alert.linkLabel && alert.linkUrl && (
              <a href={alert.linkUrl} className="site-alert-link" target="_blank" rel="noopener noreferrer">
                {alert.linkLabel}
              </a>
            )}
          </span>
          {canEdit && (
            <button className="site-alert-edit-btn" onClick={openEdit}>✏ Edit</button>
          )}
          <button className="site-alert-dismiss" onClick={dismiss} aria-label="Dismiss alert">&times;</button>
        </div>
      )}

      {/* When no banner is active, editors see a small "Set Alert" button */}
      {!showBanner && canEdit && (
        <div style={{ background: '#f0f0f0', borderBottom: '1px solid #ddd', padding: '4px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#888' }}>No active alert</span>
          <button className="site-alert-edit-btn" style={{ background: '#0d6efd', color: '#fff' }} onClick={openEdit}>
            + Set Alert
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <AlertEditModal
          draft={draft}
          onChange={setDraft}
          onSave={saveAlert}
          onClose={closeEdit}
          isSaving={saving}
          saveStatus={saveStatus}
        />
      )}
    </>
  );
};

export default AlertBanner;
