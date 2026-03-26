import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/alert-banner.css';
import '../../styles/edit-mode.css';
import { getContent, setContent, SiteAlert, DEFAULT_ALERT } from '../services/contentService';
import { UserInfo } from '../types/user';

interface AlertBannerProps {
  userInfo: UserInfo;
}

const ICONS: Record<SiteAlert['type'], string> = {
  info:    'ℹ️',
  warning: '⚠️',
  success: '✅',
  error:   '🚨',
};

// Editors see an inline modal to compose / update the alert
interface EditModalProps {
  draft: SiteAlert;
  onChange: (d: SiteAlert) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

const AlertEditModal: React.FC<EditModalProps> = ({ draft, onChange, onSave, onClose, isSaving }) => {
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
            {isSaving && <span className="edit-saving-indicator">Saving…</span>}
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
  const [alert, setAlert] = useState<SiteAlert>(DEFAULT_ALERT);
  const [dismissed, setDismissed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SiteAlert>(DEFAULT_ALERT);
  const [saving, setSaving] = useState(false);

  // Load alert from SharePoint
  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    (async () => {
      const remote = await getContent<SiteAlert>(instance, 'site-alert');
      if (remote) {
        setAlert(remote);
        // Check if this exact message was already dismissed this session
        const dismissedMsg = sessionStorage.getItem('alert-dismissed');
        setDismissed(dismissedMsg === remote.message);
      }
    })();
  }, [userInfo.isAuthenticated, instance]);

  const openEdit = useCallback(() => { setDraft({ ...alert }); setEditing(true); }, [alert]);

  const saveAlert = async () => {
    setSaving(true);
    const ok = await setContent(instance, 'site-alert', draft);
    if (ok) {
      setAlert(draft);
      setDismissed(false);
      sessionStorage.removeItem('alert-dismissed');
    }
    setSaving(false);
    setEditing(false);
  };

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('alert-dismissed', alert.message);
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
          {userInfo.isEditor && (
            <button className="site-alert-edit-btn" onClick={openEdit}>✏ Edit</button>
          )}
          <button className="site-alert-dismiss" onClick={dismiss} aria-label="Dismiss alert">&times;</button>
        </div>
      )}

      {/* When no banner is active, editors see a small "Set Alert" button */}
      {!showBanner && userInfo.isEditor && (
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
          onClose={() => setEditing(false)}
          isSaving={saving}
        />
      )}
    </>
  );
};

export default AlertBanner;
