import React, { useEffect, useState, useCallback } from 'react';
import '../styles/reports.css';
import '../../styles/edit-mode.css';
import { useMsal } from '@azure/msal-react';
import { UserInfo } from '../types/user';
import {
  getContent,
  setContent,
  DEFAULT_REPORTS,
  ReportItemContent,
} from '../services/contentService';

interface TechnologyReportsProps {
  userInfo: UserInfo;
}

// ─── Inline Edit Modal ─────────────────────────────────────────────────────

interface EditModalProps {
  title: string;
  onClose: () => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  onDelete?: () => Promise<void>;
  children: React.ReactNode;
}

const EditModal: React.FC<EditModalProps> = ({ title, onClose, onSave, isSaving, onDelete, children }) => {
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
            <button className="edit-delete-btn" onClick={onDelete} disabled={isSaving}>🗑 Delete</button>
          )}
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

// ─── Reports Page ──────────────────────────────────────────────────────────

const TechnologyReports: React.FC<TechnologyReportsProps> = ({ userInfo }) => {
  const { instance } = useMsal();
  const isEditor = userInfo.isEditor;

  const [allReports, setAllReports] = useState<ReportItemContent[]>(DEFAULT_REPORTS);
  const [editingReport, setEditingReport] = useState<ReportItemContent | null>(null);
  const [editDraft, setEditDraft] = useState<ReportItemContent | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Load from SharePoint on mount ──
  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    (async () => {
      const remote = await getContent<ReportItemContent[]>(instance, 'reports');
      if (remote) setAllReports(remote);
    })();
  }, [userInfo.isAuthenticated, instance]);

  // ── Filter for display ──
  const displayReports = allReports
    .filter(r => {
      if (r.isEliteOnly && !userInfo.isEliteGroup) return false;
      if (r.excludedEmails?.length && userInfo.email) {
        return !r.excludedEmails.map(e => e.toLowerCase()).includes(userInfo.email.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);

  const pageTitle = userInfo.isEliteGroup
    ? 'Symphony Towers Infrastructure Elite Status Reports'
    : 'Symphony Towers Infrastructure Status Reports';

  // ── Editing ──
  const openEdit = useCallback((report: ReportItemContent) => {
    setEditingReport(report);
    setEditDraft({ ...report, excludedEmails: [...report.excludedEmails] });
  }, []);

  const saveReport = async () => {
    if (!editDraft) return;
    setSaving(true);
    const updated = allReports.map(r => r.order === editDraft.order ? editDraft : r);
    const ok = await setContent(instance, 'reports', updated);
    if (ok) setAllReports(updated);
    setSaving(false);
    setEditingReport(null);
  };

  const deleteReport = async () => {
    if (!editDraft) return;
    setSaving(true);
    const updated = allReports.filter(r => r.order !== editDraft.order);
    const ok = await setContent(instance, 'reports', updated);
    if (ok) setAllReports(updated);
    setSaving(false);
    setEditingReport(null);
  };

  const addReport = async () => {
    const newReport: ReportItemContent = {
      order: allReports.length > 0 ? Math.max(...allReports.map(r => r.order)) + 1 : 1,
      title: 'New Report',
      description: 'Description of the new report.',
      link: '',
      isEliteOnly: false,
      excludedEmails: [],
    };
    const updated = [...allReports, newReport];
    const ok = await setContent(instance, 'reports', updated);
    if (ok) { setAllReports(updated); openEdit(newReport); }
  };

  return (
    <div className="home-page">
      <div className="outermost-container">
        <div className="reports-content-container">
          <div className="reports-text-bar">
            <h2>{pageTitle}</h2>
            {userInfo.isEliteGroup && (
              <div className="elite-access-banner">Elite Access — Additional reports available</div>
            )}
          </div>

          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  {isEditor && <th style={{ width: 80 }}>Edit</th>}
                </tr>
              </thead>
              <tbody>
                {displayReports.map((report, index) => (
                  <tr key={report.order} className={index % 2 === 0 ? 'odd-row' : 'even-row'}>
                    <td>
                      {report.link ? (
                        <button className="report-button" onClick={() => window.open(report.link, '_blank')}>
                          {report.title}
                        </button>
                      ) : (
                        <button className="report-button" disabled>{report.title}</button>
                      )}
                    </td>
                    <td className="report-description-cell">{report.description}</td>
                    {isEditor && (
                      <td>
                        <div className="edit-row-actions">
                          <button className="edit-row-btn" onClick={() => openEdit(report)}>✏</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {isEditor && (
              <div style={{ padding: '10px 0' }}>
                <button className="edit-add-btn" onClick={addReport}>+ Add Report</button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="sidebar reports-sidebar">
          <section className="quick-links">
            <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>
              Report Technology Issue
            </button>
          </section>
          <section className="updates">
            <h2>IT Updates</h2>
            <p>Do not click any phishing links</p>
          </section>
          <section className="quick-links">
            <h2>Quick Links</h2>
            <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>Salesforce</button>
            <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>SiteTracker</button>
            <button className="home-button" onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}>Synaptek AI Search</button>
            {userInfo.isEliteGroup ? (
              <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/reports', '_blank')}>Elite Reports</button>
            ) : (
              <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/reports', '_blank')}>Reports</button>
            )}
            <button className="home-button" onClick={() => window.open('https://identity.trinet.com/', '_blank')}>Trinet</button>
            <button className="home-button" onClick={() => window.open('https://www.concursolutions.com/', '_blank')}>Concur</button>
            <button className="home-button" onClick={() => window.open('https://system.netsuite.com/app/center/card.nl?c=8089687', '_blank')}>Netsuite</button>
            <button className="home-button" onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button>
          </section>
          <section className="updates">
            <h2>Exciting News</h2>
            <p>
              Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers). Read the{' '}
              <a href="https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html" target="_blank" rel="noopener noreferrer">Press Release</a>.
            </p>
          </section>
          <section className="updates">
            <h2>Holiday Party Photos</h2>
            <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
            <a href="https://symphonywireless.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202024" target="_blank" rel="noopener noreferrer">Holiday Party 2024</a>
          </section>
        </aside>
      </div>

      <footer className="footer">
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>

      {/* ── Edit Modal ── */}
      {editingReport && editDraft && (
        <EditModal
          title={`Edit Report: ${editDraft.title}`}
          onClose={() => setEditingReport(null)}
          onSave={saveReport}
          isSaving={saving}
          onDelete={deleteReport}
        >
          <div className="edit-field-group">
            <label>Report Title</label>
            <input
              type="text"
              value={editDraft.title}
              onChange={e => setEditDraft({ ...editDraft, title: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Description</label>
            <textarea
              rows={3}
              value={editDraft.description}
              onChange={e => setEditDraft({ ...editDraft, description: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Power BI / Report Link</label>
            <input
              type="url"
              placeholder="https://app.powerbi.com/…  (leave blank if report is WIP)"
              value={editDraft.link}
              onChange={e => setEditDraft({ ...editDraft, link: e.target.value })}
            />
          </div>
          <div className="edit-checkbox-row">
            <input
              type="checkbox"
              id="elite-only"
              checked={editDraft.isEliteOnly}
              onChange={e => setEditDraft({ ...editDraft, isEliteOnly: e.target.checked })}
            />
            <label htmlFor="elite-only">Elite group only</label>
          </div>
          <div className="edit-field-group">
            <label>Excluded Emails</label>
            <input
              type="text"
              placeholder="user@example.com, user2@example.com"
              value={editDraft.excludedEmails.join(', ')}
              onChange={e => setEditDraft({
                ...editDraft,
                excludedEmails: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              })}
            />
            <span className="edit-field-hint">Comma-separated. These users will not see this report.</span>
          </div>
          <div className="edit-field-group">
            <label>Display Order</label>
            <input
              type="text"
              value={editDraft.order}
              onChange={e => {
                const n = parseInt(e.target.value);
                if (!isNaN(n)) setEditDraft({ ...editDraft, order: n });
              }}
            />
          </div>
        </EditModal>
      )}
    </div>
  );
};

export default TechnologyReports;
