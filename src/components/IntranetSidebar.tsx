import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { UserInfo } from '../types/user';
import {
  getContent,
  setContent,
  SidebarSection,
  QuickLink,
  SiteConfig,
  DEFAULT_SIDEBAR,
  DEFAULT_QUICK_LINKS,
  DEFAULT_SITE_CONFIG,
} from '../services/contentService';
import '../../styles/edit-mode.css';

interface IntranetSidebarProps {
  userInfo: UserInfo;
  /** Extra CSS classes appended after the base "sidebar" class */
  className?: string;
}

// ─── Shared Edit Modal ────────────────────────────────────────────────────────

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
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="edit-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
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

// ─── IntranetSidebar ──────────────────────────────────────────────────────────

const IntranetSidebar: React.FC<IntranetSidebarProps> = ({ userInfo, className }) => {
  const { instance } = useMsal();
  const isEditor = userInfo.isEditor;

  // ── Data state ──
  const [sections, setSections] = useState<SidebarSection[]>(DEFAULT_SIDEBAR);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(DEFAULT_QUICK_LINKS);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);

  // ── Section edit state ──
  const [editingSection, setEditingSection] = useState<SidebarSection | null>(null);
  const [editSectionDraft, setEditSectionDraft] = useState<SidebarSection | null>(null);
  const [savingSection, setSavingSection] = useState(false);

  // ── Quick link edit state ──
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [editLinkDraft, setEditLinkDraft] = useState<QuickLink | null>(null);
  const [savingLink, setSavingLink] = useState(false);
  const [isNewLink, setIsNewLink] = useState(false);

  // ── Site config edit state ──
  const [editingConfig, setEditingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Load from SharePoint ──
  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    (async () => {
      const [remoteSections, remoteLinks, remoteConfig] = await Promise.all([
        getContent<SidebarSection[]>(instance, 'homepage-sidebar'),
        getContent<QuickLink[]>(instance, 'quick-links'),
        getContent<SiteConfig>(instance, 'site-config'),
      ]);
      if (remoteSections) setSections(remoteSections);
      if (remoteLinks) setQuickLinks(remoteLinks);
      if (remoteConfig) setSiteConfig(remoteConfig);
    })();
  }, [userInfo.isAuthenticated, instance]);

  // ── Section handlers ──
  const openSectionEdit = useCallback((section: SidebarSection) => {
    setEditingSection(section);
    setEditSectionDraft({ ...section });
  }, []);

  const saveSection = async () => {
    if (!editSectionDraft) return;
    setSavingSection(true);
    const updated = sections.map(s => s.key === editSectionDraft.key ? editSectionDraft : s);
    const ok = await setContent(instance, 'homepage-sidebar', updated);
    if (ok) setSections(updated);
    setSavingSection(false);
    setEditingSection(null);
  };

  const deleteSection = async () => {
    if (!editSectionDraft) return;
    setSavingSection(true);
    const updated = sections.filter(s => s.key !== editSectionDraft.key);
    const ok = await setContent(instance, 'homepage-sidebar', updated);
    if (ok) setSections(updated);
    setSavingSection(false);
    setEditingSection(null);
  };

  const addSection = async () => {
    const newSection: SidebarSection = {
      key: `section-${Date.now()}`,
      order: sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 1,
      title: 'New Section',
      content: 'Add your content here.',
    };
    const updated = [...sections, newSection];
    const ok = await setContent(instance, 'homepage-sidebar', updated);
    if (ok) { setSections(updated); openSectionEdit(newSection); }
  };

  const moveSidebarSection = async (key: string, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.key === key);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    const withNewOrders = reordered.map((s, i) => ({ ...s, order: i + 1 }));
    setSections(withNewOrders);
    await setContent(instance, 'homepage-sidebar', withNewOrders);
  };

  // ── Quick link handlers ──
  const openLinkEdit = useCallback((link: QuickLink, isNew = false) => {
    setEditingLink(link);
    setEditLinkDraft({ ...link });
    setIsNewLink(isNew);
  }, []);

  const saveLink = async () => {
    if (!editLinkDraft) return;
    setSavingLink(true);
    const updated = isNewLink
      ? [...quickLinks, editLinkDraft]
      : quickLinks.map(l => l.id === editLinkDraft.id ? editLinkDraft : l);
    const ok = await setContent(instance, 'quick-links', updated);
    if (ok) setQuickLinks(updated);
    setSavingLink(false);
    setEditingLink(null);
  };

  const deleteLink = async () => {
    if (!editLinkDraft) return;
    setSavingLink(true);
    const updated = quickLinks.filter(l => l.id !== editLinkDraft.id);
    const ok = await setContent(instance, 'quick-links', updated);
    if (ok) setQuickLinks(updated);
    setSavingLink(false);
    setEditingLink(null);
  };

  const addLink = () => {
    const newLink: QuickLink = {
      id: `link-${Date.now()}`,
      label: 'New Link',
      url: '',
      order: quickLinks.length > 0 ? Math.max(...quickLinks.map(l => l.order)) + 1 : 1,
    };
    openLinkEdit(newLink, true);
  };

  const moveLink = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...quickLinks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(l => l.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    const withNewOrders = reordered.map((l, i) => ({ ...l, order: i + 1 }));
    setQuickLinks(withNewOrders);
    await setContent(instance, 'quick-links', withNewOrders);
  };

  // ── Site config handlers ──
  const openConfigEdit = () => { setConfigDraft({ ...siteConfig }); setEditingConfig(true); };

  const saveConfig = async () => {
    setSavingConfig(true);
    const ok = await setContent(instance, 'site-config', configDraft);
    if (ok) setSiteConfig(configDraft);
    setSavingConfig(false);
    setEditingConfig(false);
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const sortedLinks = [...quickLinks].sort((a, b) => a.order - b.order);

  return (
    <>
      <aside className={['sidebar', className].filter(Boolean).join(' ')}>

        {/* ── Support email / Site Settings ── */}
        <section className="quick-links">
          {siteConfig.supportEmail ? (
            <button
              className="home-button"
              onClick={() => window.open(`mailto:${siteConfig.supportEmail}`, '_self')}
            >
              Report Technology Issue
            </button>
          ) : (
            isEditor && (
              <span style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>
                No support email configured
              </span>
            )
          )}
          {isEditor && (
            <button
              className="edit-pencil-btn"
              style={{ position: 'static', opacity: 1, marginTop: 6 }}
              onClick={openConfigEdit}
              title="Edit site settings (emails, company name)"
            >
              ⚙ Site Settings
            </button>
          )}
        </section>

        {/* ── Sidebar sections from SharePoint ── */}
        {sortedSections.map((section, sIdx) => (
          <section key={section.key} className="updates editable-wrapper">
            {section.title && <h2>{section.title}</h2>}
            <p dangerouslySetInnerHTML={{ __html: section.content }} />
            {section.buttonLabel && section.buttonUrl && (
              <button className="home-button" onClick={() => window.open(section.buttonUrl, '_self')}>
                {section.buttonLabel}
              </button>
            )}
            {section.linkLabel && section.linkUrl && (
              <a href={section.linkUrl} target="_blank" rel="noopener noreferrer">
                {section.linkLabel}
              </a>
            )}
            {isEditor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <div className="sidebar-reorder-btns">
                  <button
                    className="sidebar-reorder-btn"
                    onClick={() => moveSidebarSection(section.key, 'up')}
                    disabled={sIdx === 0}
                    title="Move section up"
                  >↑</button>
                  <button
                    className="sidebar-reorder-btn"
                    onClick={() => moveSidebarSection(section.key, 'down')}
                    disabled={sIdx === sortedSections.length - 1}
                    title="Move section down"
                  >↓</button>
                </div>
                <button
                  className="edit-pencil-btn"
                  style={{ position: 'static', opacity: 1 }}
                  onClick={() => openSectionEdit(section)}
                  title="Edit section"
                >
                  ✏ Edit
                </button>
              </div>
            )}
          </section>
        ))}

        {isEditor && (
          <div style={{ padding: '4px 0 8px' }}>
            <button className="edit-add-btn" onClick={addSection}>+ Add Section</button>
          </div>
        )}

        {/* ── Quick Links ── */}
        <section className="quick-links">
          <h2>Quick Links</h2>
          {sortedLinks.map((link, lIdx) => (
            <div key={link.id} className={isEditor ? 'editable-wrapper' : ''} style={{ marginBottom: isEditor ? 6 : 0 }}>
              <button
                className="home-button"
                style={{ width: '100%' }}
                onClick={() => window.open(link.url, '_blank')}
              >
                {link.label}
              </button>
              {isEditor && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <div className="sidebar-reorder-btns">
                    <button
                      className="sidebar-reorder-btn"
                      onClick={() => moveLink(link.id, 'up')}
                      disabled={lIdx === 0}
                      title="Move link up"
                    >↑</button>
                    <button
                      className="sidebar-reorder-btn"
                      onClick={() => moveLink(link.id, 'down')}
                      disabled={lIdx === sortedLinks.length - 1}
                      title="Move link down"
                    >↓</button>
                  </div>
                  <button
                    className="edit-pencil-btn"
                    style={{ position: 'static', opacity: 1 }}
                    onClick={() => openLinkEdit(link)}
                    title="Edit link"
                  >✏</button>
                </div>
              )}
            </div>
          ))}
          {isEditor && (
            <button className="edit-add-btn" style={{ marginTop: 6 }} onClick={addLink}>
              + Add Link
            </button>
          )}
        </section>
      </aside>

      {/* ── Section Edit Modal ── */}
      {editingSection && editSectionDraft && (
        <EditModal
          title={`Edit Section: ${editSectionDraft.title}`}
          onClose={() => setEditingSection(null)}
          onSave={saveSection}
          isSaving={savingSection}
          onDelete={deleteSection}
        >
          <div className="edit-field-group">
            <label>Title</label>
            <input
              type="text"
              value={editSectionDraft.title}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, title: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Content (HTML allowed)</label>
            <textarea
              rows={4}
              value={editSectionDraft.content}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, content: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Button Label (optional)</label>
            <input
              type="text"
              value={editSectionDraft.buttonLabel || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, buttonLabel: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Button URL (optional)</label>
            <input
              type="text"
              value={editSectionDraft.buttonUrl || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, buttonUrl: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Link Label (optional)</label>
            <input
              type="text"
              value={editSectionDraft.linkLabel || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, linkLabel: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Link URL (optional)</label>
            <input
              type="text"
              value={editSectionDraft.linkUrl || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, linkUrl: e.target.value })}
            />
          </div>
        </EditModal>
      )}

      {/* ── Quick Link Edit Modal ── */}
      {editingLink && editLinkDraft && (
        <EditModal
          title={isNewLink ? 'New Quick Link' : `Edit Link: ${editLinkDraft.label}`}
          onClose={() => setEditingLink(null)}
          onSave={saveLink}
          isSaving={savingLink}
          onDelete={isNewLink ? undefined : deleteLink}
        >
          <div className="edit-field-group">
            <label>Label</label>
            <input
              type="text"
              value={editLinkDraft.label}
              onChange={e => setEditLinkDraft({ ...editLinkDraft, label: e.target.value })}
              placeholder="e.g. Salesforce"
            />
          </div>
          <div className="edit-field-group">
            <label>URL</label>
            <input
              type="url"
              value={editLinkDraft.url}
              onChange={e => setEditLinkDraft({ ...editLinkDraft, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </EditModal>
      )}

      {/* ── Site Config Edit Modal ── */}
      {editingConfig && (
        <EditModal
          title="Site Settings"
          onClose={() => setEditingConfig(false)}
          onSave={saveConfig}
          isSaving={savingConfig}
        >
          <div className="edit-field-group">
            <label>Support Email ("Report Technology Issue" button)</label>
            <input
              type="email"
              value={configDraft.supportEmail}
              onChange={e => setConfigDraft({ ...configDraft, supportEmail: e.target.value })}
              placeholder="it@yourcompany.com"
            />
          </div>
          <div className="edit-field-group">
            <label>Lead Generation Recipient Email</label>
            <input
              type="email"
              value={configDraft.leadGenEmail}
              onChange={e => setConfigDraft({ ...configDraft, leadGenEmail: e.target.value })}
              placeholder="leads@yourcompany.com"
            />
          </div>
          <div className="edit-field-group">
            <label>Company Name (used in page titles and email signatures)</label>
            <input
              type="text"
              value={configDraft.companyName}
              onChange={e => setConfigDraft({ ...configDraft, companyName: e.target.value })}
              placeholder="My Company"
            />
          </div>
        </EditModal>
      )}
    </>
  );
};

export default IntranetSidebar;
