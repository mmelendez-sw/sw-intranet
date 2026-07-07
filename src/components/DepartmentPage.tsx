import React, { useCallback, useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/department-page.css';
import '../../styles/edit-mode.css';
import { DepartmentConfig } from '../config/departments';
import {
  DepartmentPageContent,
  DepartmentSectionContent,
  getDepartmentContent,
  normalizeDepartmentContent,
  setDepartmentContent,
} from '../services/contentService';
import { UserInfo } from '../types/user';
import { useEditMode } from '../context/EditMenuContext';
import IntranetSidebar from './IntranetSidebar';

interface DepartmentPageProps {
  userInfo: UserInfo;
  department: DepartmentConfig;
}

type DepartmentSectionKey = keyof DepartmentPageContent;

interface EditModalProps {
  title: string;
  onClose: () => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  children: React.ReactNode;
}

const EditModal: React.FC<EditModalProps> = ({ title, onClose, onSave, isSaving, children }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="edit-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="edit-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="edit-modal-header">
          <h3>{title}</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="edit-modal-body">{children}</div>
        <div className="edit-modal-footer">
          <div className="edit-modal-footer-right">
            {isSaving && <span className="edit-saving-indicator">Saving…</span>}
            <button className="edit-btn-cancel" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button className="edit-btn-save" onClick={onSave} disabled={isSaving}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const bulletsToText = (bullets: string[]): string => bullets.join('\n');
const parseBulletLines = (text: string): string[] => text.split('\n');
const sanitizeBullets = (bullets: string[]): string[] =>
  bullets.map((line) => line.trim()).filter((line) => line !== '');

const escapeHtmlAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DEFAULT_LINK_LABEL = 'CLICK HERE';

const buildClickHereBullet = (url: string, label: string, suffix = ''): string => {
  const linkText = label.trim() || DEFAULT_LINK_LABEL;
  const link = `<a href="${escapeHtmlAttr(url.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(linkText)}</a>`;
  const trimmedSuffix = suffix.trim();
  return trimmedSuffix ? `${link} ${trimmedSuffix}` : link;
};

const DepartmentPage: React.FC<DepartmentPageProps> = ({ userInfo, department }) => {
  const { instance } = useMsal();
  const { isEditMode } = useEditMode();
  const canEdit = userInfo.isEditor && isEditMode;

  const [content, setContent] = useState<DepartmentPageContent>(department.defaultContent);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [editingSection, setEditingSection] = useState<DepartmentSectionKey | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [sectionDraft, setSectionDraft] = useState<string[]>([]);
  const [linkInsertUrl, setLinkInsertUrl] = useState('');
  const [linkInsertLabel, setLinkInsertLabel] = useState('');
  const [linkInsertSuffix, setLinkInsertSuffix] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    let cancelled = false;

    (async () => {
      const remote = await getDepartmentContent(instance, department.slug);
      if (cancelled) return;
      setContent(normalizeDepartmentContent(remote, department.defaultContent));
      setContentLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userInfo.isAuthenticated, instance, department.slug, department.defaultContent]);

  const resetLinkInsert = useCallback(() => {
    setLinkInsertUrl('');
    setLinkInsertLabel('');
    setLinkInsertSuffix('');
  }, []);

  const openSectionEdit = useCallback(
    (section: DepartmentSectionKey) => {
      const sectionContent = content[section];
      setEditingSection(section);
      setTitleDraft(sectionContent.title);
      setSectionDraft([...sectionContent.items]);
      resetLinkInsert();
    },
    [content, resetLinkInsert]
  );

  const closeSectionEdit = useCallback(() => {
    setEditingSection(null);
    setTitleDraft('');
    setSectionDraft([]);
    resetLinkInsert();
  }, [resetLinkInsert]);

  const insertClickHereLink = useCallback(() => {
    const url = linkInsertUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      window.alert('Please enter a valid URL (include https://).');
      return;
    }
    setSectionDraft((current) => [
      ...current,
      buildClickHereBullet(url, linkInsertLabel, linkInsertSuffix),
    ]);
    resetLinkInsert();
  }, [linkInsertUrl, linkInsertLabel, linkInsertSuffix, resetLinkInsert]);

  const saveSection = async () => {
    if (!editingSection) return;
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle) {
      window.alert('Section title is required.');
      return;
    }

    setIsSaving(true);
    const updatedSection: DepartmentSectionContent = {
      title: trimmedTitle,
      items: sanitizeBullets(sectionDraft),
    };
    const updated: DepartmentPageContent = {
      ...content,
      [editingSection]: updatedSection,
    };
    const ok = await setDepartmentContent(instance, department.slug, updated);
    if (ok) setContent(updated);
    setIsSaving(false);
    closeSectionEdit();
  };

  const renderBullets = (items: string[]) => (
    <ul>
      {sanitizeBullets(items).map((item, index) => (
        <li key={`${item}-${index}`} dangerouslySetInnerHTML={{ __html: item }} />
      ))}
    </ul>
  );

  const renderEditButton = (section: DepartmentSectionKey, label: string) =>
    canEdit && contentLoaded ? (
      <button
        type="button"
        className="edit-pencil-btn department-edit-btn"
        onClick={() => openSectionEdit(section)}
        title={`Edit ${label}`}
      >
        ✏ Edit
      </button>
    ) : null;

  const renderSectionCard = (
    section: DepartmentSectionKey,
    cardClassName: string
  ) => {
    const sectionContent = content[section];
    return (
      <div className={cardClassName}>
        <div className="card-text">
          <div className="department-card-header">
            <h2>{sectionContent.title}</h2>
            {renderEditButton(section, sectionContent.title)}
          </div>
          {renderBullets(sectionContent.items)}
        </div>
      </div>
    );
  };

  return (
    <div className="home-page department-page authenticated">
      <div className="content-container">
        <div className="main-content">
          <div className="department-updates-large-card">
            {renderSectionCard('updates', 'card odd-card editable-wrapper')}
          </div>

          <div className="department-resources-faq-container">
            {renderSectionCard(
              'resources',
              'card even-card blue-column department-small-card editable-wrapper'
            )}
            {renderSectionCard(
              'faq',
              'card even-card blue-column department-small-card editable-wrapper'
            )}
          </div>

          {canEdit && contentLoaded && (
            <p className="department-save-hint">
              Department content saves to Shared Documents/General/intranet/departments/
              {department.slug}.json
            </p>
          )}
        </div>

        <IntranetSidebar userInfo={userInfo} className="department-sidebar" />
      </div>
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
      </footer>

      {editingSection && (
        <EditModal
          title={`Edit ${content[editingSection].title}`}
          onClose={closeSectionEdit}
          onSave={saveSection}
          isSaving={isSaving}
        >
          <div className="edit-field-group">
            <label>Section title</label>
            <input
              type="text"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
          </div>
          <div className="edit-field-group">
            <label>Bullet points</label>
            <textarea
              rows={10}
              value={bulletsToText(sectionDraft)}
              onChange={(event) => setSectionDraft(parseBulletLines(event.target.value))}
            />
            <div className="edit-link-insert">
              <span className="edit-link-insert-label">Insert link</span>
              <input
                type="url"
                placeholder="https://…"
                value={linkInsertUrl}
                onChange={(event) => setLinkInsertUrl(event.target.value)}
              />
              <input
                type="text"
                placeholder={`Link text (defaults to ${DEFAULT_LINK_LABEL})`}
                value={linkInsertLabel}
                onChange={(event) => setLinkInsertLabel(event.target.value)}
              />
              <input
                type="text"
                placeholder="Optional text after link (e.g. to learn more…)"
                value={linkInsertSuffix}
                onChange={(event) => setLinkInsertSuffix(event.target.value)}
              />
              <button
                type="button"
                className="edit-link-insert-btn"
                onClick={insertClickHereLink}
                disabled={!linkInsertUrl.trim()}
              >
                Insert link
              </button>
            </div>
            <span className="edit-field-hint">
              One item per line. HTML is supported, or use the insert tool above.
            </span>
          </div>
        </EditModal>
      )}
    </div>
  );
};

export default DepartmentPage;
