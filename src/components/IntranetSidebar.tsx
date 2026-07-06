import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { UserInfo } from '../types/user';
import { useEditMode } from '../context/EditMenuContext';
import {
  getContent,
  setContent,
  SidebarSection,
  QuickLink,
  SiteConfig,
  SidebarLayout,
  SidebarLayoutBlock,
  DEFAULT_SIDEBAR,
  DEFAULT_QUICK_LINKS,
  DEFAULT_SITE_CONFIG,
  // Editor email tracking (disabled):
  // getCachedContent,
  // buildSidebarContentFile,
  // stampSidebarSectionEditor,
} from '../services/contentService';
import '../../styles/edit-mode.css';

/*
 * Editor email tracking for homepage-sidebar.json (disabled).
 * To enable: uncomment exports in contentService.ts, then replace setContent calls
 * for sidebar sections with:
 *   const file = buildSidebarContentFile(updated, userInfo.email, getCachedContent('homepage-sidebar'));
 *   await setContent(instance, 'homepage-sidebar', file);
 * Stamp drafts with stampSidebarSectionEditor(draft, userInfo.email, isNew) before saving.
 */

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

const escapeHtmlAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DEFAULT_LINK_LABEL = 'CLICK HERE';

const buildHtmlLink = (url: string, label: string, suffix = ''): string => {
  const linkText = label.trim() || DEFAULT_LINK_LABEL;
  const link = `<a href="${escapeHtmlAttr(url.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(linkText)}</a>`;
  const trimmedSuffix = suffix.trim();
  return trimmedSuffix ? `${link} ${trimmedSuffix}` : link;
};

const getSectionValidationError = (section: SidebarSection): string | null => {
  const buttonUrl = section.buttonUrl?.trim() || '';
  const buttonLabel = section.buttonLabel?.trim() || '';
  const linkUrl = section.linkUrl?.trim() || '';
  const linkLabel = section.linkLabel?.trim() || '';

  if (buttonUrl && !buttonLabel) {
    return 'Button Label is required when Button URL is set.';
  }
  if (linkUrl && !linkLabel) {
    return 'Link Label is required when Link URL is set.';
  }
  return null;
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    new URL(value.trim());
    return true;
  } catch {
    return false;
  }
};

const getQuickLinkValidationError = (link: QuickLink): string | null => {
  const url = link.url?.trim() || '';
  if (!url) {
    return 'URL is required.';
  }
  if (!isValidHttpUrl(url)) {
    return 'Please enter a valid URL (include https://).';
  }
  return null;
};

const QUICK_LINKS_BLOCK: SidebarLayoutBlock = { type: 'quick-links' };

const buildDefaultSidebarLayout = (sections: SidebarSection[]): SidebarLayoutBlock[] => [
  ...[...sections].sort((a, b) => a.order - b.order).map((s) => ({ type: 'section' as const, key: s.key })),
  QUICK_LINKS_BLOCK,
];

const syncSidebarLayout = (
  layoutBlocks: SidebarLayoutBlock[] | undefined,
  sections: SidebarSection[]
): SidebarLayoutBlock[] => {
  const sectionKeys = new Set(sections.map((s) => s.key));
  const base = layoutBlocks?.length ? layoutBlocks : buildDefaultSidebarLayout(sections);

  const seen = new Set<string>();
  const synced: SidebarLayoutBlock[] = [];
  let hasQuickLinks = false;

  for (const block of base) {
    if (block.type === 'quick-links') {
      if (!hasQuickLinks) {
        synced.push(QUICK_LINKS_BLOCK);
        hasQuickLinks = true;
      }
      continue;
    }
    if (sectionKeys.has(block.key) && !seen.has(block.key)) {
      synced.push(block);
      seen.add(block.key);
    }
  }

  for (const section of [...sections].sort((a, b) => a.order - b.order)) {
    if (!seen.has(section.key)) {
      synced.push({ type: 'section', key: section.key });
      seen.add(section.key);
    }
  }

  if (!hasQuickLinks) {
    synced.push(QUICK_LINKS_BLOCK);
  }

  return synced;
};

// ─── IntranetSidebar ──────────────────────────────────────────────────────────

const IntranetSidebar: React.FC<IntranetSidebarProps> = ({ userInfo, className }) => {
  const { instance } = useMsal();
  const isEditor = userInfo.isEditor;
  const { isEditMode } = useEditMode();
  const canEdit = isEditor && isEditMode;

  // ── Data state ──
  const [sections, setSections] = useState<SidebarSection[]>(DEFAULT_SIDEBAR);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(DEFAULT_QUICK_LINKS);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [blocks, setBlocks] = useState<SidebarLayoutBlock[]>(() => buildDefaultSidebarLayout(DEFAULT_SIDEBAR));

  // ── Section edit state ──
  const [editingSection, setEditingSection] = useState<SidebarSection | null>(null);
  const [editSectionDraft, setEditSectionDraft] = useState<SidebarSection | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [linkInsertUrl, setLinkInsertUrl] = useState('');
  const [linkInsertLabel, setLinkInsertLabel] = useState('');
  const [linkInsertSuffix, setLinkInsertSuffix] = useState('');

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
      const [remoteSections, remoteLinks, remoteConfig, remoteLayout] = await Promise.all([
        getContent<SidebarSection[]>(instance, 'homepage-sidebar'),
        getContent<QuickLink[]>(instance, 'quick-links'),
        getContent<SiteConfig>(instance, 'site-config'),
        getContent<SidebarLayout>(instance, 'sidebar-layout'),
      ]);
      const sectionsData = remoteSections ?? [];
      if (remoteSections) setSections(remoteSections);
      if (remoteLinks) setQuickLinks(remoteLinks);
      if (remoteConfig) setSiteConfig(remoteConfig);
      setBlocks(syncSidebarLayout(remoteLayout?.blocks, sectionsData));
    })();
  }, [userInfo.isAuthenticated, instance]);

  const resetSectionLinkInsert = useCallback(() => {
    setLinkInsertUrl('');
    setLinkInsertLabel('');
    setLinkInsertSuffix('');
  }, []);

  const closeSectionEdit = useCallback(() => {
    setEditingSection(null);
    resetSectionLinkInsert();
  }, [resetSectionLinkInsert]);

  // ── Section handlers ──
  const openSectionEdit = useCallback((section: SidebarSection) => {
    setEditingSection(section);
    setEditSectionDraft({ ...section });
    resetSectionLinkInsert();
  }, [resetSectionLinkInsert]);

  const insertLinkIntoSection = useCallback(() => {
    if (!editSectionDraft) return;
    const url = linkInsertUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      window.alert('Please enter a valid URL (include https://).');
      return;
    }
    const snippet = buildHtmlLink(url, linkInsertLabel, linkInsertSuffix);
    const content = editSectionDraft.content.trim();
    setEditSectionDraft({
      ...editSectionDraft,
      content: content ? `${content} ${snippet}` : snippet,
    });
    resetSectionLinkInsert();
  }, [editSectionDraft, linkInsertUrl, linkInsertLabel, linkInsertSuffix, resetSectionLinkInsert]);

  const persistSidebarLayout = async (newBlocks: SidebarLayoutBlock[]) => {
    setBlocks(newBlocks);
    await setContent(instance, 'sidebar-layout', { blocks: newBlocks });
  };

  const saveSection = async () => {
    if (!editSectionDraft) return;
    const validationError = getSectionValidationError(editSectionDraft);
    if (validationError) {
      window.alert(validationError);
      return;
    }
    setSavingSection(true);
    const updated = sections.map(s => s.key === editSectionDraft.key ? editSectionDraft : s);
    // const isNewSection = !sections.some((s) => s.key === editSectionDraft.key);
    // const stamped = stampSidebarSectionEditor(editSectionDraft, userInfo.email, isNewSection);
    // const withStamp = isNewSection
    //   ? [...sections, stamped]
    //   : sections.map((s) => (s.key === editSectionDraft.key ? stamped : s));
    // const file = buildSidebarContentFile(withStamp, userInfo.email, getCachedContent('homepage-sidebar'));
    // const ok = await setContent(instance, 'homepage-sidebar', file);
    const ok = await setContent(instance, 'homepage-sidebar', updated);
    if (ok) setSections(updated);
    setSavingSection(false);
    closeSectionEdit();
  };

  const deleteSection = async () => {
    if (!editSectionDraft) return;
    setSavingSection(true);
    const updated = sections.filter(s => s.key !== editSectionDraft.key);
    const ok = await setContent(instance, 'homepage-sidebar', updated);
    if (ok) {
      setSections(updated);
      await persistSidebarLayout(blocks.filter(b => b.type !== 'section' || b.key !== editSectionDraft.key));
    }
    setSavingSection(false);
    closeSectionEdit();
  };

  const addSection = async () => {
    const newSection: SidebarSection = {
      key: `section-${Date.now()}`,
      order: sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 1,
      title: 'New Section',
      content: 'Add your content here.',
    };
    const updated = [...sections, newSection];
    const newBlock: SidebarLayoutBlock = { type: 'section', key: newSection.key };
    const quickLinksIdx = blocks.findIndex(b => b.type === 'quick-links');
    const newBlocks = quickLinksIdx >= 0
      ? [...blocks.slice(0, quickLinksIdx), newBlock, ...blocks.slice(quickLinksIdx)]
      : [...blocks, newBlock];
    const ok = await setContent(instance, 'homepage-sidebar', updated);
    if (ok) {
      setSections(updated);
      await persistSidebarLayout(newBlocks);
      openSectionEdit(newSection);
    }
  };

  const moveBlock = async (blockIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[blockIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[blockIdx]];
    await persistSidebarLayout(reordered);
  };

  // ── Quick link handlers ──
  const openLinkEdit = useCallback((link: QuickLink, isNew = false) => {
    setEditingLink(link);
    setEditLinkDraft({ ...link });
    setIsNewLink(isNew);
  }, []);

  const saveLink = async () => {
    if (!editLinkDraft) return;
    const validationError = getQuickLinkValidationError(editLinkDraft);
    if (validationError) {
      window.alert(validationError);
      return;
    }
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

  const sortedLinks = [...quickLinks].sort((a, b) => a.order - b.order);

  const renderBlockReorder = (blockIdx: number, compact = false) => (
    <div
      className="card-reorder-row"
      style={{
        justifyContent: 'flex-start',
        padding: compact ? 0 : (canEdit ? '3px 0 0' : 0),
        marginTop: compact ? 0 : (canEdit ? 8 : 0),
      }}
    >
      <button
        type="button"
        className="card-reorder-btn"
        onClick={() => moveBlock(blockIdx, 'up')}
        disabled={blockIdx === 0}
        title="Move block up"
      >↑</button>
      <button
        type="button"
        className="card-reorder-btn"
        onClick={() => moveBlock(blockIdx, 'down')}
        disabled={blockIdx === blocks.length - 1}
        title="Move block down"
      >↓</button>
    </div>
  );

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
              Report IT Issue
            </button>
          ) : (
            canEdit && (
              <span style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>
                No support email configured
              </span>
            )
          )}
          {canEdit && (
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

        {/* ── Sidebar blocks (sections + quick links, unified order) ── */}
        {blocks.map((block, blockIdx) => {
          if (block.type === 'section') {
            const section = sections.find(s => s.key === block.key);
            if (!section) return null;
            return (
              <section key={section.key} className="updates editable-wrapper">
                {section.title && <h2>{section.title}</h2>}
                <p dangerouslySetInnerHTML={{ __html: section.content }} />
                {section.linkLabel && section.linkUrl && (
                  <a href={section.linkUrl} target="_blank" rel="noopener noreferrer">
                    {section.linkLabel}
                  </a>
                )}
                {section.buttonLabel && section.buttonUrl && (
                  <button className="home-button" onClick={() => window.open(section.buttonUrl, '_self')}>
                    {section.buttonLabel}
                  </button>
                )}
                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {renderBlockReorder(blockIdx)}
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
            );
          }

          if (block.type === 'quick-links') {
            return (
              <section key="quick-links-block" className="quick-links editable-wrapper">
                <h2>Quick Links</h2>
                {sortedLinks.map((link, lIdx) => (
                  <div key={link.id} style={{ marginBottom: canEdit ? 6 : 0 }}>
                    <button
                      className="home-button"
                      style={{ width: '100%' }}
                      onClick={() => window.open(link.url, '_blank')}
                    >
                      {link.label}
                    </button>
                    {canEdit && (
                      <div className="card-reorder-row" style={{ justifyContent: 'flex-start', padding: '3px 0 0' }}>
                        <button
                          type="button"
                          className="card-reorder-btn"
                          onClick={() => moveLink(link.id, 'up')}
                          disabled={lIdx === 0}
                          title="Move link up"
                        >↑</button>
                        <button
                          type="button"
                          className="card-reorder-btn"
                          onClick={() => moveLink(link.id, 'down')}
                          disabled={lIdx === sortedLinks.length - 1}
                          title="Move link down"
                        >↓</button>
                        <button
                          type="button"
                          className="edit-pencil-btn"
                          style={{ position: 'static', opacity: 1, marginLeft: 4 }}
                          onClick={() => openLinkEdit(link)}
                          title="Edit link"
                        >
                          ✏ Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <button className="edit-add-btn" style={{ margin: 0 }} onClick={addLink}>
                      + Add Link
                    </button>
                    {renderBlockReorder(blockIdx, true)}
                  </div>
                )}
              </section>
            );
          }

          return null;
        })}

        {canEdit && (
          <div style={{ padding: '4px 0 8px' }}>
            <button className="edit-add-btn" onClick={addSection}>+ Add Section</button>
          </div>
        )}
      </aside>

      {/* ── Section Edit Modal ── */}
      {editingSection && editSectionDraft && (() => {
        const buttonUrlSet = Boolean(editSectionDraft.buttonUrl?.trim());
        const linkUrlSet = Boolean(editSectionDraft.linkUrl?.trim());
        return (
        <EditModal
          title={`Edit Section: ${editSectionDraft.title}`}
          onClose={closeSectionEdit}
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
            <div className="edit-link-insert">
              <span className="edit-link-insert-label">Insert link</span>
              <input
                type="url"
                placeholder="https://…"
                value={linkInsertUrl}
                onChange={e => setLinkInsertUrl(e.target.value)}
              />
              <input
                type="text"
                placeholder={`Link text (defaults to ${DEFAULT_LINK_LABEL})`}
                value={linkInsertLabel}
                onChange={e => setLinkInsertLabel(e.target.value)}
              />
              <input
                type="text"
                placeholder="Optional text after link"
                value={linkInsertSuffix}
                onChange={e => setLinkInsertSuffix(e.target.value)}
              />
              <button
                type="button"
                className="edit-link-insert-btn"
                onClick={insertLinkIntoSection}
                disabled={!linkInsertUrl.trim()}
              >
                Insert link
              </button>
            </div>
            <span className="edit-field-hint">HTML is supported, or use the insert tool above.</span>
          </div>
          <div className="edit-field-group">
            <label>Link Label {linkUrlSet ? '(required)' : '(optional)'}</label>
            <input
              type="text"
              value={editSectionDraft.linkLabel || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, linkLabel: e.target.value })}
              required={linkUrlSet}
            />
            {linkUrlSet && !editSectionDraft.linkLabel?.trim() && (
              <span className="edit-field-hint">Required because Link URL is set.</span>
            )}
          </div>
          <div className="edit-field-group">
            <label>Link URL (optional)</label>
            <input
              type="text"
              value={editSectionDraft.linkUrl || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, linkUrl: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Button Label {buttonUrlSet ? '(required)' : '(optional)'}</label>
            <input
              type="text"
              value={editSectionDraft.buttonLabel || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, buttonLabel: e.target.value })}
              required={buttonUrlSet}
            />
            {buttonUrlSet && !editSectionDraft.buttonLabel?.trim() && (
              <span className="edit-field-hint">Required because Button URL is set.</span>
            )}
          </div>
          <div className="edit-field-group">
            <label>Button URL (optional)</label>
            <input
              type="text"
              value={editSectionDraft.buttonUrl || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, buttonUrl: e.target.value })}
            />
          </div>
        </EditModal>
        );
      })()}

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
            <label>URL (required)</label>
            <input
              type="url"
              value={editLinkDraft.url}
              onChange={e => setEditLinkDraft({ ...editLinkDraft, url: e.target.value })}
              placeholder="https://..."
              required
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
            <label>Support Email ("Report IT Issue" button)</label>
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
