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
  DEFAULT_ANNOUNCEMENTS,
  CardContent,
  Announcement,
} from '../services/contentService';
import IntranetSidebar from './IntranetSidebar';

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
  const [announcements, setAnnouncements] = useState<Announcement[]>(DEFAULT_ANNOUNCEMENTS);
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
  const [contentLoaded, setContentLoaded] = useState(false);

  // ── Announcement edit state ──
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editAnnouncementDraft, setEditAnnouncementDraft] = useState<Announcement | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false);

  // ── Card edit state ──
  const [editingCard, setEditingCard] = useState<CardContent | null>(null);
  const [editCardDraft, setEditCardDraft] = useState<CardContent | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Hero edit state ──
  const [editingHero, setEditingHero] = useState(false);
  const [heroDraft, setHeroDraft] = useState('');
  const [savingHero, setSavingHero] = useState(false);

  // ── Card drag-and-drop reorder state ──
  const [draggingCardIdx, setDraggingCardIdx] = useState<number | null>(null);
  const [dragOverCardIdx, setDragOverCardIdx] = useState<number | null>(null);

  // ── Load content from SharePoint on mount ──
  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    (async () => {
      const [remoteCards, remoteHero, remoteAnnouncements] = await Promise.all([
        getContent<CardContent[]>(instance, 'homepage-cards'),
        getContent<string>(instance, 'homepage-hero'),
        getContent<Announcement[]>(instance, 'announcements'),
      ]);
      if (remoteCards) setCards(remoteCards);
      if (remoteHero) setHeroImageUrl(remoteHero);
      if (remoteAnnouncements) setAnnouncements(remoteAnnouncements);
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

  // ── Card reordering ──
  const moveCard = async (currentIdx: number, direction: 'up' | 'down') => {
    const sorted = [...cards].sort((a, b) => a.order - b.order);
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[currentIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[currentIdx]];
    const withNewOrders = reordered.map((c, i) => ({ ...c, order: i + 1 }));
    setCards(withNewOrders);
    await setContent(instance, 'homepage-cards', withNewOrders);
  };

  const onCardDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggingCardIdx === null || draggingCardIdx === targetIdx) {
      setDraggingCardIdx(null);
      setDragOverCardIdx(null);
      return;
    }
    const sorted = [...cards].sort((a, b) => a.order - b.order);
    const reordered = [...sorted];
    const [moved] = reordered.splice(draggingCardIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const withNewOrders = reordered.map((c, i) => ({ ...c, order: i + 1 }));
    setCards(withNewOrders);
    setDraggingCardIdx(null);
    setDragOverCardIdx(null);
    await setContent(instance, 'homepage-cards', withNewOrders);
  };

  const savingLabel = uploadingImage ? 'Uploading image…' : savingCard ? 'Saving…' : undefined;

  // ── Announcement editing ──
  const openAnnouncementEdit = useCallback((ann: Announcement) => {
    setEditingAnnouncement(ann);
    setEditAnnouncementDraft({ ...ann });
  }, []);

  const saveAnnouncement = async () => {
    if (!editAnnouncementDraft) return;
    setSavingAnnouncement(true);
    const updated = announcements.some(a => a.id === editAnnouncementDraft.id)
      ? announcements.map(a => a.id === editAnnouncementDraft.id ? editAnnouncementDraft : a)
      : [...announcements, editAnnouncementDraft];
    const ok = await setContent(instance, 'announcements', updated);
    if (ok) setAnnouncements(updated);
    setSavingAnnouncement(false);
    setEditingAnnouncement(null);
  };

  const deleteAnnouncement = async () => {
    if (!editAnnouncementDraft) return;
    setSavingAnnouncement(true);
    const updated = announcements.filter(a => a.id !== editAnnouncementDraft.id);
    const ok = await setContent(instance, 'announcements', updated);
    if (ok) setAnnouncements(updated);
    setSavingAnnouncement(false);
    setEditingAnnouncement(null);
  };

  const addAnnouncement = () => {
    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      title: 'New Announcement',
      content: 'Announcement details go here.',
      date: new Date().toISOString().slice(0, 10),
      isActive: true,
    };
    openAnnouncementEdit(newAnn);
  };

  const activeAnnouncements = announcements
    .filter(a => a.isActive)
    .sort((a, b) => b.date.localeCompare(a.date));
  const visibleAnnouncements = announcementsExpanded ? activeAnnouncements : activeAnnouncements.slice(0, 2);

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

              {/* ── Announcements ── */}
              {(activeAnnouncements.length > 0 || isEditor) && (
                <div style={{ margin: '16px 0 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>
                      📢 Announcements
                    </h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isEditor && (
                        <button className="edit-add-btn" style={{ margin: 0, padding: '5px 14px', fontSize: 12 }} onClick={addAnnouncement}>
                          + Add
                        </button>
                      )}
                    </div>
                  </div>

                  {visibleAnnouncements.map(ann => (
                    <div key={ann.id} className="editable-wrapper" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderLeft: '4px solid #f59e0b', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 3 }}>{ann.title}</div>
                          <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{ann.content}</div>
                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 5 }}>
                            {new Date(ann.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      {isEditor && (
                        <button className="edit-pencil-btn" onClick={() => openAnnouncementEdit(ann)}>✏ Edit</button>
                      )}
                    </div>
                  ))}

                  {activeAnnouncements.length > 2 && (
                    <button
                      onClick={() => setAnnouncementsExpanded(e => !e)}
                      style={{ background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}
                    >
                      {announcementsExpanded ? '▲ Show fewer' : `▼ Show all ${activeAnnouncements.length} announcements`}
                    </button>
                  )}
                </div>
              )}

              {/* ── Cards Grid ── */}
              <div className="grid-layout home-grid-layout">
                {[...cards].sort((a, b) => a.order - b.order).map((card, index, sortedArr) => (
                  <div
                    key={card.order}
                    className={[
                      cardClass(index),
                      'editable-wrapper',
                      isEditor ? 'card-reorderable' : '',
                      draggingCardIdx === index ? 'card-dragging' : '',
                      dragOverCardIdx === index && draggingCardIdx !== index ? 'card-drag-over' : '',
                    ].filter(Boolean).join(' ')}
                    draggable={isEditor}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggingCardIdx(index); }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCardIdx(index); }}
                    onDrop={(e) => onCardDrop(e, index)}
                    onDragEnd={() => { setDraggingCardIdx(null); setDragOverCardIdx(null); }}
                  >
                    {isEditor && (
                      <div className="card-drag-handle" title="Drag to reorder">
                        <div className="drag-dots">
                          <span /><span /><span /><span /><span /><span />
                        </div>
                      </div>
                    )}
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
                      <div className="card-reorder-row">
                        <button
                          className="card-reorder-btn"
                          onClick={(e) => { e.stopPropagation(); moveCard(index, 'up'); }}
                          disabled={index === 0}
                          title="Move card up"
                        >↑</button>
                        <button
                          className="card-reorder-btn"
                          onClick={(e) => { e.stopPropagation(); moveCard(index, 'down'); }}
                          disabled={index === sortedArr.length - 1}
                          title="Move card down"
                        >↓</button>
                        <button className="edit-pencil-btn" style={{ position: 'static', opacity: 1, marginLeft: 4 }} onClick={() => openCardEdit(card)} title="Edit card">
                          ✏ Edit
                        </button>
                      </div>
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
          <IntranetSidebar userInfo={userInfo} className="sidebar-narrow home-sidebar" />
        </div>
      ) : (
        <div className="unauthenticated-message">
          <h2>Welcome to the Company Intranet!</h2>
          <p>Please log in to access more features and content!</p>
        </div>
      )}

      <footer className="footer home-footer">
        <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
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

      {/* Announcement edit modal */}
      {editingAnnouncement && editAnnouncementDraft && (
        <EditModal
          title={editingAnnouncement.id.startsWith('ann-') && !announcements.some(a => a.id === editingAnnouncement.id) ? 'New Announcement' : `Edit: ${editAnnouncementDraft.title}`}
          onClose={() => setEditingAnnouncement(null)}
          onSave={saveAnnouncement}
          isSaving={savingAnnouncement}
          onDelete={announcements.some(a => a.id === editAnnouncementDraft.id) ? deleteAnnouncement : undefined}
        >
          <div className="edit-field-group">
            <label>Title</label>
            <input type="text" value={editAnnouncementDraft.title}
              onChange={e => setEditAnnouncementDraft({ ...editAnnouncementDraft, title: e.target.value })} />
          </div>
          <div className="edit-field-group">
            <label>Message</label>
            <textarea rows={4} value={editAnnouncementDraft.content}
              onChange={e => setEditAnnouncementDraft({ ...editAnnouncementDraft, content: e.target.value })} />
          </div>
          <div className="edit-field-group">
            <label>Date</label>
            <input type="date" value={editAnnouncementDraft.date}
              onChange={e => setEditAnnouncementDraft({ ...editAnnouncementDraft, date: e.target.value })} />
          </div>
          <div className="edit-checkbox-row">
            <input type="checkbox" id="ann-active" checked={editAnnouncementDraft.isActive}
              onChange={e => setEditAnnouncementDraft({ ...editAnnouncementDraft, isActive: e.target.checked })} />
            <label htmlFor="ann-active">Active (visible to all users)</label>
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
