import React, { useEffect, useState, useCallback, useRef } from 'react';
import '../../styles/home-page.css';
import '../../styles/edit-mode.css';
import { useMsal } from '@azure/msal-react';
import { UserInfo } from '../types/user';
import {
  getContent,
  setContent,
  uploadImage,
  DEFAULT_CARDS,
  DEFAULT_SIDEBAR,
  CardContent,
  SidebarSection,
} from '../services/contentService';

import img3 from '../../images/site_3.jpg';
import img3Md from '../../images/site_3_md.jpg';
import img3Sm from '../../images/site_3_sm.jpg';
import img4 from '../../images/coat.jpg';
import img4Md from '../../images/coat_md.jpg';
import img4Sm from '../../images/coat_sm.jpg';
import img7 from '../../images/mm2.jpg';
import img9 from '../../images/vol.jpg';
import img10 from '../../images/emp.jpg';
import img10Md from '../../images/emp_md.jpg';
import img10Sm from '../../images/emp_sm.jpg';
import img11 from '../../images/sip.jpeg';
import img11Md from '../../images/sip_md.jpeg';
import img11Sm from '../../images/sip_sm.jpeg';
import howBanner from '../../images/H.O.W.-banner.png';

// Fallback local images indexed by card order (1-based)
const LOCAL_IMAGES: Record<number, { src: string; srcSet?: string; sizes?: string }> = {
  1: { src: img9 },
  2: { src: img11, srcSet: `${img11Sm} 480w, ${img11Md} 900w, ${img11} 1200w`, sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' },
  3: { src: img7 },
  4: { src: img4, srcSet: `${img4Sm} 480w, ${img4Md} 900w, ${img4} 1200w`, sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' },
  5: { src: img3, srcSet: `${img3Sm} 480w, ${img3Md} 900w, ${img3} 1200w`, sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' },
  6: { src: img10, srcSet: `${img10Sm} 480w, ${img10Md} 900w, ${img10} 1200w`, sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' },
};

interface HomePageProps {
  userInfo: UserInfo;
}

// ─── Tiny Edit Modal component ─────────────────────────────────────────────

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
            <button className="edit-delete-btn" onClick={onDelete} disabled={isSaving}>
              🗑 Delete
            </button>
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

// ─── HomePage ──────────────────────────────────────────────────────────────

const HomePage: React.FC<HomePageProps> = ({ userInfo }) => {
  const { instance } = useMsal();
  const isEditor = userInfo.isEditor;

  // ── Content state ──
  const [cards, setCards] = useState<CardContent[]>(DEFAULT_CARDS);
  const [sidebar, setSidebar] = useState<SidebarSection[]>(DEFAULT_SIDEBAR);
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
  const [contentLoaded, setContentLoaded] = useState(false);

  // ── Card edit state ──
  const [editingCard, setEditingCard] = useState<CardContent | null>(null);
  const [editCardDraft, setEditCardDraft] = useState<CardContent | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Sidebar edit state ──
  const [editingSection, setEditingSection] = useState<SidebarSection | null>(null);
  const [editSectionDraft, setEditSectionDraft] = useState<SidebarSection | null>(null);
  const [savingSection, setSavingSection] = useState(false);

  // ── Hero edit state ──
  const [editingHero, setEditingHero] = useState(false);
  const [heroDraft, setHeroDraft] = useState('');
  const [savingHero, setSavingHero] = useState(false);

  // ── Load content from SharePoint on mount ──
  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    (async () => {
      const [remoteCards, remoteSidebar, remoteHero] = await Promise.all([
        getContent<CardContent[]>(instance, 'homepage-cards'),
        getContent<SidebarSection[]>(instance, 'homepage-sidebar'),
        getContent<string>(instance, 'homepage-hero'),
      ]);
      if (remoteCards) setCards(remoteCards);
      if (remoteSidebar) setSidebar(remoteSidebar);
      if (remoteHero) setHeroImageUrl(remoteHero);
      setContentLoaded(true);
    })();
  }, [userInfo.isAuthenticated, instance]);

  // ── Card editing ──
  const openCardEdit = useCallback((card: CardContent) => {
    setEditingCard(card);
    setEditCardDraft({ ...card, bullets: [...card.bullets] });
    setPendingImageFile(null);
    setImagePreviewUrl(card.imageUrl || '');
  }, []);

  const closeCardEdit = useCallback(() => {
    setEditingCard(null);
    setPendingImageFile(null);
    setImagePreviewUrl('');
  }, []);

  const handleImageFileChange = (file: File) => {
    setPendingImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const saveCard = async () => {
    if (!editCardDraft) return;
    setSavingCard(true);

    let finalDraft = { ...editCardDraft };

    if (pendingImageFile) {
      setUploadingImage(true);
      const uploadedUrl = await uploadImage(instance, pendingImageFile);
      setUploadingImage(false);
      if (uploadedUrl) {
        finalDraft = { ...finalDraft, imageUrl: uploadedUrl };
      } else {
        console.warn('[HomePage] Image upload failed — keeping existing imageUrl');
      }
      setPendingImageFile(null);
    }

    const updated = cards.map(c => c.order === finalDraft.order ? finalDraft : c);
    const ok = await setContent(instance, 'homepage-cards', updated);
    if (ok) { setCards(updated); setEditCardDraft(finalDraft); }
    setSavingCard(false);
    setEditingCard(null);
  };

  const deleteCard = async () => {
    if (!editCardDraft) return;
    setSavingCard(true);
    const updated = cards.filter(c => c.order !== editCardDraft.order);
    const ok = await setContent(instance, 'homepage-cards', updated);
    if (ok) setCards(updated);
    setSavingCard(false);
    closeCardEdit();
  };

  const addCard = async () => {
    const newCard: CardContent = {
      order: cards.length > 0 ? Math.max(...cards.map(c => c.order)) + 1 : 1,
      title: 'New Card',
      bullets: ['Add your content here.'],
      imageUrl: '',
    };
    const updated = [...cards, newCard];
    const ok = await setContent(instance, 'homepage-cards', updated);
    if (ok) { setCards(updated); openCardEdit(newCard); }
  };

  const savingLabel = uploadingImage ? 'Uploading image…' : savingCard ? 'Saving…' : undefined;

  // ── Sidebar editing ──
  const openSectionEdit = useCallback((section: SidebarSection) => {
    setEditingSection(section);
    setEditSectionDraft({ ...section });
  }, []);

  const saveSection = async () => {
    if (!editSectionDraft) return;
    setSavingSection(true);
    const updated = sidebar.map(s => s.key === editSectionDraft.key ? editSectionDraft : s);
    const ok = await setContent(instance, 'homepage-sidebar', updated);
    if (ok) setSidebar(updated);
    setSavingSection(false);
    setEditingSection(null);
  };

  // ── Hero editing ──
  const openHeroEdit = () => { setHeroDraft(heroImageUrl); setEditingHero(true); };

  const saveHero = async () => {
    setSavingHero(true);
    const ok = await setContent(instance, 'homepage-hero', heroDraft);
    if (ok) setHeroImageUrl(heroDraft);
    setSavingHero(false);
    setEditingHero(false);
  };

  // ── Bullet helpers ──
  const bulletsToText = (bullets: string[]) => bullets.join('\n');
  const textToBullets = (text: string) => text.split('\n').filter(l => l.trim() !== '');

  // ── Render helpers ──
  const cardClass = (index: number) => index % 2 === 0 ? 'card odd-card' : 'card even-card';

  const renderCardImage = (card: CardContent, index: number) => {
    if (card.imageUrl) {
      return <img src={card.imageUrl} alt={card.title} className="card-image" />;
    }
    const local = LOCAL_IMAGES[card.order];
    if (!local) return null;
    return (
      <img
        src={local.src}
        srcSet={local.srcSet}
        sizes={local.sizes}
        alt={card.title}
        className="card-image"
      />
    );
  };

  return (
    <div className={`home-page ${userInfo.isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      {userInfo.isAuthenticated ? (
        <div className="home-layout">
          {/* ── Main Content ── */}
          <div className="home-content-container">
            <div className="main-content home-main-content">

              {/* ── Hero Banner ── */}
              <section className="homepage-hero editable-wrapper" aria-label="Homepage banner">
                <img
                  src={heroImageUrl || howBanner}
                  alt="Homepage banner"
                  className="homepage-hero-image"
                />
                <div className="homepage-hero-overlay">
                  <h1 className="homepage-hero-title">
                    <span className="homepage-hero-line"><span className="homepage-hero-acronym">H</span><span className="homepage-hero-rest">ighest standards</span></span>
                    <span className="homepage-hero-line"><span className="homepage-hero-acronym">O</span><span className="homepage-hero-rest">ne team</span></span>
                    <span className="homepage-hero-line"><span className="homepage-hero-acronym">W</span><span className="homepage-hero-rest">in!</span></span>
                  </h1>
                </div>
                {isEditor && (
                  <button className="edit-pencil-btn" onClick={openHeroEdit} title="Edit banner image">
                    ✏ Edit Banner
                  </button>
                )}
              </section>

              {/* ── Cards Grid ── */}
              <div className="grid-layout home-grid-layout">
                {[...cards].sort((a, b) => a.order - b.order).map((card, index) => (
                  <div key={card.order} className={`${cardClass(index)} editable-wrapper`}>
                    {renderCardImage(card, index)}
                    <div className="card-text">
                      <h2>{card.title}</h2>
                      <ul>
                        {card.bullets.map((bullet, bi) => (
                          <li key={bi} dangerouslySetInnerHTML={{ __html: bullet }} />
                        ))}
                      </ul>
                    </div>
                    {isEditor && (
                      <button className="edit-pencil-btn" onClick={() => openCardEdit(card)} title="Edit card">
                        ✏ Edit
                      </button>
                    )}
                  </div>
                ))}

                {/* Add Card button — editors only */}
                {isEditor && contentLoaded && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4px 0 8px' }}>
                    <button className="edit-add-btn" onClick={addCard}>+ Add Card</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="sidebar sidebar-narrow home-sidebar">
            <section className="quick-links">
              <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>
                Report Technology Issue
              </button>
            </section>

            {[...sidebar].sort((a, b) => a.order - b.order).map(section => (
              <section
                key={section.key}
                className={section.key === 'holiday-photos' ? 'updates home-sidebar-fill editable-wrapper' : 'updates editable-wrapper'}
              >
                {section.title && <h2>{section.title}</h2>}
                <p dangerouslySetInnerHTML={{ __html: section.content }} />
                {section.buttonLabel && section.buttonUrl && (
                  <button className="home-button" onClick={() => window.open(section.buttonUrl, '_self')}>
                    {section.buttonLabel}
                  </button>
                )}
                {section.linkLabel && section.linkUrl && (
                  <a href={section.linkUrl} target="_blank" rel="noopener noreferrer">{section.linkLabel}</a>
                )}
                {isEditor && (
                  <button className="edit-pencil-btn" onClick={() => openSectionEdit(section)} title="Edit section">
                    ✏ Edit
                  </button>
                )}
              </section>
            ))}

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
          </aside>
        </div>
      ) : (
        <div className="unauthenticated-message">
          <h2>Welcome to the Symphony Towers Infrastructure Intranet!</h2>
          <p>Please log in to access more features and content!</p>
        </div>
      )}

      <footer className="footer home-footer">
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>

      {/* ──────────── Edit Modals ──────────── */}

      {/* Card edit modal */}
      {editingCard && editCardDraft && (
        <EditModal
          title={`Edit Card: ${editCardDraft.title}`}
          onClose={closeCardEdit}
          onSave={saveCard}
          isSaving={savingCard || uploadingImage}
          onDelete={deleteCard}
        >
          <div className="edit-field-group">
            <label>Card Title</label>
            <input
              type="text"
              value={editCardDraft.title}
              onChange={e => setEditCardDraft({ ...editCardDraft, title: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Bullet Points</label>
            <textarea
              rows={8}
              value={bulletsToText(editCardDraft.bullets)}
              onChange={e => setEditCardDraft({ ...editCardDraft, bullets: textToBullets(e.target.value) })}
            />
            <span className="edit-field-hint">One bullet per line. HTML is supported (e.g. &lt;a href="..."&gt;Link&lt;/a&gt;).</span>
          </div>

          {/* ── Image section ── */}
          <div className="edit-field-group">
            <label>Card Image</label>

            {/* Live preview */}
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="Preview" className="edit-image-preview" />
            )}

            {/* Upload from device */}
            <div
              className="edit-upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
              onDragLeave={e => e.currentTarget.classList.remove('dragover')}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) handleImageFileChange(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFileChange(file);
                }}
              />
              <button type="button" className="edit-upload-trigger">
                📁 Choose Image
              </button>
              {pendingImageFile ? (
                <div className="edit-upload-filename">Selected: {pendingImageFile.name}</div>
              ) : (
                <div className="edit-upload-label">or drag &amp; drop an image here</div>
              )}
              {uploadingImage && (
                <div className="edit-upload-progress">⏳ Uploading to SharePoint…</div>
              )}
            </div>
            <span className="edit-field-hint">
              Uploads directly to SharePoint (Documents/IntranetImages/).
              Visible to all signed-in users via Microsoft SSO.
            </span>

            {/* Divider */}
            <div className="edit-image-divider">or paste a URL</div>

            {/* Manual URL fallback */}
            <input
              type="url"
              placeholder="https://… (leave blank to use the default bundled image)"
              value={pendingImageFile ? '' : editCardDraft.imageUrl}
              disabled={!!pendingImageFile}
              onChange={e => {
                setEditCardDraft({ ...editCardDraft, imageUrl: e.target.value });
                setImagePreviewUrl(e.target.value);
              }}
            />
            {pendingImageFile && (
              <span className="edit-field-hint" style={{ color: '#0d6efd' }}>
                URL field disabled — a new file is queued for upload.{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: 0, fontSize: 12 }}
                  onClick={() => { setPendingImageFile(null); setImagePreviewUrl(editCardDraft.imageUrl); }}
                >
                  Remove file
                </button>
              </span>
            )}
          </div>

          {savingLabel && <div className="edit-saving-indicator">{savingLabel}</div>}
        </EditModal>
      )}

      {/* Sidebar section edit modal */}
      {editingSection && editSectionDraft && (
        <EditModal
          title={`Edit Section: ${editSectionDraft.title || editSectionDraft.key}`}
          onClose={() => setEditingSection(null)}
          onSave={saveSection}
          isSaving={savingSection}
        >
          <div className="edit-field-group">
            <label>Section Title</label>
            <input
              type="text"
              value={editSectionDraft.title}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, title: e.target.value })}
            />
          </div>
          <div className="edit-field-group">
            <label>Content</label>
            <textarea
              rows={5}
              value={editSectionDraft.content}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, content: e.target.value })}
            />
            <span className="edit-field-hint">HTML is supported (e.g. &lt;a href="..."&gt;Link&lt;/a&gt;).</span>
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
              type="url"
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
              type="url"
              value={editSectionDraft.linkUrl || ''}
              onChange={e => setEditSectionDraft({ ...editSectionDraft, linkUrl: e.target.value })}
            />
          </div>
        </EditModal>
      )}

      {/* Hero edit modal */}
      {editingHero && (
        <EditModal
          title="Edit Banner Image"
          onClose={() => setEditingHero(false)}
          onSave={saveHero}
          isSaving={savingHero}
        >
          <div className="edit-field-group">
            <label>Banner Image URL</label>
            <input
              type="url"
              placeholder="https://… (leave blank to use the default H.O.W. banner)"
              value={heroDraft}
              onChange={e => setHeroDraft(e.target.value)}
            />
            {heroDraft && <img src={heroDraft} alt="Banner preview" className="edit-image-preview" />}
            <span className="edit-field-hint">Paste a public image URL or SharePoint CDN link. Recommended size: 1400×400 px.</span>
          </div>
        </EditModal>
      )}
    </div>
  );
};

export default HomePage;
