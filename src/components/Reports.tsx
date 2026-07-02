import React, { useEffect, useState, useCallback, useRef } from 'react';
import '../styles/reports.css';
import '../../styles/home-page.css';
import '../../styles/edit-mode.css';
import { useMsal } from '@azure/msal-react';
import { UserInfo } from '../types/user';
import { useEditMode } from '../context/EditMenuContext';
import {
  getContent,
  setContent,
  getCachedContent,
  DEFAULT_REPORTS,
  DEFAULT_SITE_CONFIG,
  ReportItemContent,
  SiteConfig,
} from '../services/contentService';
import IntranetSidebar from './IntranetSidebar';

interface ReportsProps {
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

const sortReportsByOrder = (reports: ReportItemContent[]): ReportItemContent[] =>
  [...reports].sort((a, b) => a.order - b.order);

/** Assign sequential order values; preserves the array's current display order. */
const renumberReports = (reports: ReportItemContent[]): ReportItemContent[] =>
  reports.map((r, i) => ({ ...r, order: i + 1 }));

const REPORTS_CONTENT_KEY = 'reports';
/** Minimum time to show the reports loading spinner (set to 0 in production). */
const REPORTS_SPINNER_MIN_MS = 0;

const getInitialReports = (): ReportItemContent[] =>
  getCachedContent<ReportItemContent[]>(REPORTS_CONTENT_KEY) ?? DEFAULT_REPORTS;

const Reports: React.FC<ReportsProps> = ({ userInfo }) => {
  const { instance } = useMsal();
  const isEditor = userInfo.isEditor;
  const { isEditMode } = useEditMode();
  const canEdit = isEditor && isEditMode;

  const [allReports, setAllReports] = useState<ReportItemContent[]>(getInitialReports);
  const [reportsLoading, setReportsLoading] = useState(
    () => REPORTS_SPINNER_MIN_MS > 0 || getInitialReports().length === 0
  );
  const [editingReport, setEditingReport] = useState<ReportItemContent | null>(null);
  const [editDraft, setEditDraft] = useState<ReportItemContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [draggingReportIdx, setDraggingReportIdx] = useState<number | null>(null);
  const [dragOverReportIdx, setDragOverReportIdx] = useState<number | null>(null);

  const allReportsRef = useRef(allReports);
  allReportsRef.current = allReports;
  const draggingReportIdxRef = useRef<number | null>(null);
  const hasFetchedReportsRef = useRef(false);
  const reportsLoadingStartedRef = useRef(Date.now());

  // ── Load from SharePoint on mount ──
  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    if (hasFetchedReportsRef.current) return;

    let cancelled = false;
    hasFetchedReportsRef.current = true;
    if (allReportsRef.current.length === 0) {
      reportsLoadingStartedRef.current = Date.now();
      setReportsLoading(true);
    }

    void (async () => {
      const finishReportsLoading = async () => {
        const remaining = REPORTS_SPINNER_MIN_MS - (Date.now() - reportsLoadingStartedRef.current);
        if (remaining > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remaining));
        }
        if (!cancelled) setReportsLoading(false);
      };

      try {
        const [remote, remoteConfig] = await Promise.all([
          getContent<ReportItemContent[]>(instance, REPORTS_CONTENT_KEY),
          getContent<SiteConfig>(instance, 'site-config'),
        ]);
        if (!cancelled) {
          if (remote) setAllReports(remote);
          if (remoteConfig) setSiteConfig(remoteConfig);
        }
      } catch (err) {
        console.error('[Reports] failed to load reports:', err);
      }

      await finishReportsLoading();
    })();

    return () => {
      cancelled = true;
    };
  }, [userInfo.isAuthenticated, instance]);

  const isReportVisible = useCallback((report: ReportItemContent) => {
    if (report.isEliteOnly && !userInfo.isEliteGroup) return false;
    if (report.excludedEmails?.length && userInfo.email) {
      return !report.excludedEmails.map((e) => e.toLowerCase()).includes(userInfo.email.toLowerCase());
    }
    return true;
  }, [userInfo.isEliteGroup, userInfo.email]);

  const orderedReports = sortReportsByOrder(allReports);
  const visibleReports = canEdit ? orderedReports : orderedReports.filter(isReportVisible);

  const pageTitle = userInfo.isEliteGroup
    ? `${siteConfig.companyName} Elite Status Reports`
    : `${siteConfig.companyName} Status Reports`;

  const persistReports = useCallback(async (updated: ReportItemContent[]) => {
    const ok = await setContent(instance, 'reports', updated);
    if (ok) setAllReports(updated);
    return ok;
  }, [instance]);

  const applyReportOrderChange = useCallback(async (withNewOrders: ReportItemContent[]) => {
    setAllReports(withNewOrders);
    return persistReports(withNewOrders);
  }, [persistReports]);

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
    const updated = renumberReports(allReports.filter((r) => r.order !== editDraft.order));
    const ok = await setContent(instance, 'reports', updated);
    if (ok) setAllReports(updated);
    setSaving(false);
    setEditingReport(null);
  };

  const addReport = async () => {
    const newReport: ReportItemContent = {
      order: allReports.length > 0 ? Math.max(...allReports.map((r) => r.order)) + 1 : 1,
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

  // ── Report reordering ──
  const moveReport = async (currentIdx: number, direction: 'up' | 'down') => {
    const displayOrder = sortReportsByOrder(allReportsRef.current);
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= displayOrder.length) return;
    const reordered = [...displayOrder];
    [reordered[currentIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[currentIdx]];
    await applyReportOrderChange(renumberReports(reordered));
  };

  const onReportDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = draggingReportIdxRef.current;
    if (fromIdx === null || fromIdx === targetIdx) {
      draggingReportIdxRef.current = null;
      setDraggingReportIdx(null);
      setDragOverReportIdx(null);
      return;
    }
    const ordered = sortReportsByOrder(allReportsRef.current);
    const reordered = [...ordered];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    draggingReportIdxRef.current = null;
    setDraggingReportIdx(null);
    setDragOverReportIdx(null);
    await applyReportOrderChange(renumberReports(reordered));
  };

  const onReportDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    draggingReportIdxRef.current = index;
    setDraggingReportIdx(index);
  };

  const onReportDragEnd = () => {
    draggingReportIdxRef.current = null;
    setDraggingReportIdx(null);
    setDragOverReportIdx(null);
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

          {reportsLoading ? (
            <div className="reports-loading" role="status" aria-label="Loading reports">
              <div className="app-loading-spinner" aria-hidden="true" />
            </div>
          ) : (
          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  {canEdit && <th style={{ width: 44 }} aria-label="Reorder" />}
                  <th>Title</th>
                  <th>Description</th>
                  {canEdit && <th style={{ width: 120 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((report, index) => (
                  <tr
                    key={`report-${report.order}-${report.title}`}
                    className={[
                      index % 2 === 0 ? 'odd-row' : 'even-row',
                      canEdit ? 'report-row-reorderable' : '',
                      draggingReportIdx === index ? 'report-row-dragging' : '',
                      dragOverReportIdx === index && draggingReportIdx !== index ? 'report-row-drag-over' : '',
                    ].filter(Boolean).join(' ')}
                    onDragOver={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverReportIdx(index);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverReportIdx((current) => (current === index ? null : current));
                      }
                    }}
                    onDrop={(e) => { if (canEdit) void onReportDrop(e, index); }}
                  >
                    {canEdit && (
                      <td className="report-reorder-cell">
                        <div
                          className="report-drag-handle"
                          title="Drag to reorder"
                          draggable
                          onDragStart={(e) => onReportDragStart(e, index)}
                          onDragEnd={onReportDragEnd}
                        >
                          <div className="drag-dots">
                            <span /><span /><span /><span /><span /><span />
                          </div>
                        </div>
                      </td>
                    )}
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
                    {canEdit && (
                      <td>
                        <div className="report-reorder-actions">
                          <button
                            type="button"
                            className="card-reorder-btn"
                            onClick={(e) => { e.stopPropagation(); void moveReport(index, 'up'); }}
                            disabled={index === 0}
                            title="Move report up"
                          >↑</button>
                          <button
                            type="button"
                            className="card-reorder-btn"
                            onClick={(e) => { e.stopPropagation(); void moveReport(index, 'down'); }}
                            disabled={index === visibleReports.length - 1}
                            title="Move report down"
                          >↓</button>
                          <button className="edit-row-btn" onClick={() => openEdit(report)} title="Edit report">✏</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {canEdit && (
              <div style={{ padding: '10px 0' }}>
                <button className="edit-add-btn" onClick={addReport}>+ Add Report</button>
              </div>
            )}
          </div>
          )}
        </div>

        <IntranetSidebar userInfo={userInfo} className="home-sidebar" />
      </div>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
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
          {/* <div className="edit-field-group">
            <label>Display Order</label>
            <input
              type="text"
              value={editDraft.order}
              onChange={e => {
                const n = parseInt(e.target.value);
                if (!isNaN(n)) setEditDraft({ ...editDraft, order: n });
              }}
            />
          </div> */}
        </EditModal>
      )}
    </div>
  );
};

export default Reports;
