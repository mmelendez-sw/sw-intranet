import React, { useEffect, useState, useCallback, useRef } from 'react';
import '../../styles/home-page.css';
import '../../styles/edit-mode.css';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { UserInfo } from '../types/user';
import { useEditMode } from '../context/EditMenuContext';
import {
  getContent,
  setContent,
  setContentDetailed,
  uploadImage,
  uploadImageFromUrl,
  DEFAULT_CARDS,
  SEED_CARDS,
  DEFAULT_ANNOUNCEMENTS,
  getCachedContent,
  isSharePointImageUrl,
  preloadSharePointImages,
  CardContent,
  Announcement,
} from '../services/contentService';
import IntranetSidebar from './IntranetSidebar';
import SharePointImage from './SharePointImage';
// import { useTvLayout } from '../hooks/useTvLayout';

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
import img11 from '../../images/wider_app.png';
import howBanner from '../../images/H.O.W.-banner.png';

// Fallback local images indexed by card order (1-based)
const LOCAL_IMAGES: Record<number, { src: string; srcSet?: string; sizes?: string }> = {
  1: { src: img9 },
  2: { src: img11 },
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
  onSave?: () => Promise<void>;
  isSaving: boolean;
  onDelete?: () => Promise<void>;
  children: React.ReactNode;
  autoSave?: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'saved-local' | 'error';
}

const EditModal: React.FC<EditModalProps> = ({
  title,
  onClose,
  onSave,
  isSaving,
  onDelete,
  children,
  autoSave = false,
  saveStatus = 'idle',
}) => {
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
            {autoSave ? (
              <>
                {saveStatus === 'saving' ? (
                  <span className="edit-saving-indicator">Saving…</span>
                ) : saveStatus === 'saved' ? (
                  <span className="edit-saving-indicator" style={{ color: '#198754' }}>Saved to SharePoint</span>
                ) : saveStatus === 'saved-local' ? (
                  <span className="edit-saving-indicator" style={{ color: '#b45309' }}>Saved on this device only</span>
                ) : saveStatus === 'error' ? (
                  <span className="edit-saving-indicator" style={{ color: '#dc3545' }}>Could not save — try again</span>
                ) : (
                  <span className="edit-saving-indicator" style={{ color: '#6c757d' }}>Edits save automatically</span>
                )}
                <button className="edit-btn-save" onClick={onClose} disabled={saveStatus === 'saving'}>Done</button>
              </>
            ) : (
              <>
                {isSaving && <span className="edit-saving-indicator">Saving…</span>}
                <button className="edit-btn-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
                <button className="edit-btn-save" onClick={onSave} disabled={isSaving || !onSave}>Save</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CARDS_CONTENT_KEY = 'homepage-cards';
const HERO_CONTENT_KEY = 'homepage-hero';
const ANNOUNCEMENTS_CONTENT_KEY = 'announcements';
const CARD_POLL = { remoteOnly: true } as const;
const CARD_AUTOSAVE_MS = 800;
const CARD_POLL_MS = 20_000;
/** Minimum time to show the cards loading spinner (set to 0 in production). */
const CARDS_SPINNER_MIN_MS = 0;

const sortCardsByOrder = (cardList: CardContent[]): CardContent[] =>
  [...cardList].sort((a, b) => a.order - b.order);

/** Assign sequential order values; preserves the array's current display order. */
const renumberCards = (cardList: CardContent[]): CardContent[] =>
  cardList.map((c, i) => ({ ...c, order: i + 1 }));

const normalizeCards = (remoteCards: CardContent[]): CardContent[] => {
  const totalFallbacks = Object.keys(LOCAL_IMAGES).length;
  return renumberCards(sortCardsByOrder(remoteCards)).map((card, idx) => ({
    ...card,
    imageIndex: card.imageIndex ?? (((idx % totalFallbacks) + 1) as CardContent['imageIndex']),
  }));
};

const cardsMatch = (a: CardContent[], b: CardContent[]) => JSON.stringify(a) === JSON.stringify(b);

const getInitialCards = (): CardContent[] => {
  const cached = getCachedContent<CardContent[]>(CARDS_CONTENT_KEY);
  if (cached?.length) return normalizeCards(cached);
  if (SEED_CARDS.length) return normalizeCards(SEED_CARDS);
  return DEFAULT_CARDS;
};

const bulletsToText = (bullets: string[]) => bullets.join('\n');
const parseBulletLines = (text: string) => text.split('\n');
const sanitizeBullets = (bullets: string[]) => bullets.filter((l) => l.trim() !== '');

// ─── HomePage ──────────────────────────────────────────────────────────────

const HomePage: React.FC<HomePageProps> = ({ userInfo }) => {
  const { instance } = useMsal();
  const msalAuthenticated = useIsAuthenticated();
  const isEditor = userInfo.isEditor;
  const { isEditMode } = useEditMode();
  const canEdit = isEditor && isEditMode;
  const showHomeContent = userInfo.isAuthenticated || msalAuthenticated;
  // const isTvLayout = useTvLayout();
  // useEffect(() => {
  //   if (!isTvLayout) return;
  //   document.body.classList.add('home-tv-mode');
  //   return () => document.body.classList.remove('home-tv-mode');
  // }, [isTvLayout]);

  // ── Content state ──
  const [cards, setCards] = useState<CardContent[]>(getInitialCards);
  const [cardsLoading, setCardsLoading] = useState(
    () => CARDS_SPINNER_MIN_MS > 0 || getInitialCards().length === 0
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    () => getCachedContent<Announcement[]>(ANNOUNCEMENTS_CONTENT_KEY) ?? DEFAULT_ANNOUNCEMENTS
  );
  const [heroImageUrl, setHeroImageUrl] = useState(
    () => getCachedContent<string>(HERO_CONTENT_KEY) || ''
  );
  const contentLoaded = showHomeContent;

  // ── Announcement edit state ──
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editAnnouncementDraft, setEditAnnouncementDraft] = useState<Announcement | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false);

  // ── Card edit state ──
  const [editingCard, setEditingCard] = useState<CardContent | null>(null);
  const [editCardDraft, setEditCardDraft] = useState<CardContent | null>(null);
  const [isNewCard, setIsNewCard] = useState(false);
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
  const [cardSaveStatus, setCardSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'saved-local' | 'error'>('idle');

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const editCardDraftRef = useRef(editCardDraft);
  editCardDraftRef.current = editCardDraft;
  const pendingImageFileRef = useRef(pendingImageFile);
  pendingImageFileRef.current = pendingImageFile;
  const isNewCardRef = useRef(isNewCard);
  isNewCardRef.current = isNewCard;
  const cardAutosaveTimerRef = useRef<number | null>(null);
  const originalCardImageUrlRef = useRef('');
  const lastLocalCardSaveRef = useRef(0);
  const skipNextAutosaveRef = useRef(false);
  const draggingCardIdxRef = useRef<number | null>(null);
  const userModifiedCardsRef = useRef(false);
  const hasFetchedCardsRef = useRef(false);
  const preloadedImageUrlsRef = useRef(new Set<string>());
  const cardsLoadingStartedRef = useRef(Date.now());

  const persistCardsToSharePoint = useCallback(async (updated: CardContent[]): Promise<boolean> => {
    setCardSaveStatus('saving');
    const sanitized = updated.map((c) => ({ ...c, bullets: sanitizeBullets(c.bullets) }));
    const result = await setContentDetailed(instance, CARDS_CONTENT_KEY, sanitized);
    if (result.ok) {
      setCards(sanitized);
      lastLocalCardSaveRef.current = Date.now();
      userModifiedCardsRef.current = true;
      setCardSaveStatus(result.storage === 'sharepoint' ? 'saved' : 'saved-local');
      return true;
    }
    setCardSaveStatus('error');
    return false;
  }, [instance]);

  const applyCardOrderChange = useCallback(async (withNewOrders: CardContent[]) => {
    userModifiedCardsRef.current = true;
    lastLocalCardSaveRef.current = Date.now();
    setCards(withNewOrders);
    return persistCardsToSharePoint(withNewOrders);
  }, [persistCardsToSharePoint]);

  // ── Preload SharePoint card/hero images as soon as URLs are known ──
  useEffect(() => {
    if (!showHomeContent) return;
    const urls = [
      ...cards.map((card) => card.imageUrl),
      heroImageUrl || undefined,
    ].filter((url): url is string => !!url && isSharePointImageUrl(url));
    const pending = urls.filter((url) => !preloadedImageUrlsRef.current.has(url));
    pending.forEach((url) => preloadedImageUrlsRef.current.add(url));
    if (pending.length) preloadSharePointImages(instance, pending);
  }, [showHomeContent, instance, cards, heroImageUrl]);

  // ── Load content from SharePoint (background refresh; UI uses cache immediately) ──
  useEffect(() => {
    if (!showHomeContent) return;
    if (hasFetchedCardsRef.current) return;

    let cancelled = false;
    hasFetchedCardsRef.current = true;
    if (cardsRef.current.length === 0) {
      cardsLoadingStartedRef.current = Date.now();
      setCardsLoading(true);
    }

    void (async () => {
      const finishCardsLoading = async () => {
        const remaining = CARDS_SPINNER_MIN_MS - (Date.now() - cardsLoadingStartedRef.current);
        if (remaining > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remaining));
        }
        if (!cancelled) setCardsLoading(false);
      };

      try {
        const cachedCards = await getContent<CardContent[]>(instance, CARDS_CONTENT_KEY);
        if (!cancelled && cachedCards && !userModifiedCardsRef.current) {
          const normalized = normalizeCards(cachedCards);
          if (!cardsMatch(normalized, cardsRef.current)) {
            setCards(normalized);
          }
        }

        const remoteCards = await getContent<CardContent[]>(instance, CARDS_CONTENT_KEY, CARD_POLL);
        if (!cancelled && remoteCards && !userModifiedCardsRef.current) {
          const normalized = normalizeCards(remoteCards);
          if (!cardsMatch(normalized, cardsRef.current)) {
            setCards(normalized);
          }
        }
      } catch (err) {
        console.error('[HomePage] failed to load cards:', err);
      }

      await finishCardsLoading();

      if (cancelled) return;

      try {
        const [remoteHero, remoteAnnouncements] = await Promise.all([
          getContent<string>(instance, HERO_CONTENT_KEY),
          getContent<Announcement[]>(instance, ANNOUNCEMENTS_CONTENT_KEY),
        ]);
        if (cancelled) return;
        if (remoteHero) setHeroImageUrl(remoteHero);
        if (remoteAnnouncements) setAnnouncements(remoteAnnouncements);
      } catch (err) {
        console.error('[HomePage] failed to load hero/announcements:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showHomeContent, instance]);

  // ── Poll SharePoint so all devices stay in sync ──
  useEffect(() => {
    if (!showHomeContent || !contentLoaded) return;

    const syncCardsFromSharePoint = async () => {
      if (editCardDraftRef.current) return;
      if (userModifiedCardsRef.current && Date.now() - lastLocalCardSaveRef.current < 120_000) return;
      const remote = await getContent<CardContent[]>(instance, CARDS_CONTENT_KEY, CARD_POLL);
      if (!remote) return;
      const normalized = normalizeCards(remote);
      if (!cardsMatch(normalized, cardsRef.current)) {
        userModifiedCardsRef.current = false;
        setCards(normalized);
      }
    };

    const intervalId = window.setInterval(() => {
      void syncCardsFromSharePoint();
    }, CARD_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [showHomeContent, contentLoaded, instance]);

  // ── Card editing ──
  const openCardEdit = useCallback((card: CardContent) => {
    setEditingCard(card);
    setEditCardDraft({ ...card, bullets: [...card.bullets] });
    setPendingImageFile(null);
    setImagePreviewUrl(card.imageUrl || '');
    originalCardImageUrlRef.current = card.imageUrl || '';
    setIsNewCard(false);
    setCardSaveStatus('idle');
  }, []);

  const openNewCardEdit = useCallback(() => {
    const nextOrder = cards.length + 1;
    const totalFallbacks = Object.keys(LOCAL_IMAGES).length;
    const nextImageIndex = ((cards.length % totalFallbacks) + 1);
    setEditingCard(null);
    setEditCardDraft({
      order: nextOrder,
      title: 'New Card',
      bullets: ['Add your content here.'],
      imageUrl: '',
      imageIndex: nextImageIndex,
    });
    setPendingImageFile(null);
    setImagePreviewUrl('');
    originalCardImageUrlRef.current = '';
    setIsNewCard(true);
    setCardSaveStatus('idle');
  }, [cards]);

  const handleImageFileChange = (file: File) => {
    setPendingImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const buildCardsWithDraft = useCallback(
    (draft: CardContent, currentCards: CardContent[], isNew: boolean): CardContent[] => {
      if (isNew && !currentCards.some((c) => c.order === draft.order)) {
        return [...currentCards, draft];
      }
      return currentCards.map((c) => (c.order === draft.order ? draft : c));
    },
    []
  );

  const flushCardDraftSave = useCallback(async () => {
    const draft = editCardDraftRef.current;
    if (!draft || !canEdit) return;

    const pendingFile = pendingImageFileRef.current;
    let finalDraft = { ...draft };

    if (pendingFile || draft.imageUrl) {
      setUploadingImage(true);
      let uploadedUrl: string | null = null;

      if (pendingFile) {
        uploadedUrl = await uploadImage(instance, pendingFile);
        if (uploadedUrl) {
          setPendingImageFile(null);
          pendingImageFileRef.current = null;
          originalCardImageUrlRef.current = uploadedUrl;
        }
      } else if (
        draft.imageUrl &&
        !draft.imageUrl.startsWith('data:') &&
        !isSharePointImageUrl(draft.imageUrl) &&
        draft.imageUrl !== originalCardImageUrlRef.current
      ) {
        uploadedUrl = await uploadImageFromUrl(instance, draft.imageUrl);
        if (uploadedUrl) {
          originalCardImageUrlRef.current = uploadedUrl;
        }
      }

      if (uploadedUrl) {
        finalDraft = { ...finalDraft, imageUrl: uploadedUrl };
        setImagePreviewUrl(uploadedUrl);
      }
      setUploadingImage(false);
    }

    const updated = buildCardsWithDraft(finalDraft, cardsRef.current, isNewCardRef.current);
    if (!pendingFile && cardsMatch(updated, cardsRef.current)) {
      return;
    }

    setSavingCard(true);
    try {
      const ok = await persistCardsToSharePoint(updated);
      if (ok) {
        if (isNewCardRef.current) setIsNewCard(false);
        const draftJson = JSON.stringify(finalDraft);
        const currentJson = JSON.stringify(editCardDraftRef.current);
        if (draftJson !== currentJson) {
          skipNextAutosaveRef.current = true;
          setEditCardDraft(finalDraft);
          editCardDraftRef.current = finalDraft;
        }
      }
    } catch (err) {
      console.error('[HomePage] autosave card failed:', err);
      setCardSaveStatus('error');
    } finally {
      setSavingCard(false);
      setUploadingImage(false);
    }
  }, [buildCardsWithDraft, canEdit, instance, persistCardsToSharePoint]);

  const scheduleCardAutosave = useCallback(() => {
    if (cardAutosaveTimerRef.current) {
      window.clearTimeout(cardAutosaveTimerRef.current);
    }
    setCardSaveStatus((status) =>
      status === 'saved' || status === 'saved-local' ? 'idle' : status
    );
    const delay = pendingImageFileRef.current ? 300 : CARD_AUTOSAVE_MS;
    cardAutosaveTimerRef.current = window.setTimeout(() => {
      void flushCardDraftSave();
    }, delay);
  }, [flushCardDraftSave]);

  useEffect(() => {
    if (!editCardDraft || !canEdit) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    scheduleCardAutosave();
    return () => {
      if (cardAutosaveTimerRef.current) {
        window.clearTimeout(cardAutosaveTimerRef.current);
      }
    };
  }, [editCardDraft, pendingImageFile, canEdit, scheduleCardAutosave]);

  const closeCardEdit = useCallback(async () => {
    if (cardAutosaveTimerRef.current) {
      window.clearTimeout(cardAutosaveTimerRef.current);
      cardAutosaveTimerRef.current = null;
    }
    if (editCardDraftRef.current && canEdit) {
      await flushCardDraftSave();
    }
    setEditingCard(null);
    setEditCardDraft(null);
    editCardDraftRef.current = null;
    setIsNewCard(false);
    setPendingImageFile(null);
    pendingImageFileRef.current = null;
    setImagePreviewUrl('');
    setCardSaveStatus('idle');
  }, [canEdit, flushCardDraftSave]);

  const deleteCardByOrder = async (order: number) => {
    if (!window.confirm('Delete this card?')) return;
    setSavingCard(true);
    const updated = renumberCards(cardsRef.current.filter((c) => c.order !== order));
    const ok = await persistCardsToSharePoint(updated);
    if (!ok) {
      const remoteCards = await getContent<CardContent[]>(instance, CARDS_CONTENT_KEY, CARD_POLL);
      if (remoteCards) setCards(normalizeCards(remoteCards));
    }
    setSavingCard(false);
    closeCardEdit();
  };

  const deleteCard = async () => {
    if (!editCardDraft) return;
    await deleteCardByOrder(editCardDraft.order);
  };

  const addCard = () => {
    openNewCardEdit();
  };

  // ── Card reordering ──
  const moveCard = async (currentIdx: number, direction: 'up' | 'down') => {
    const displayOrder = [...cardsRef.current];
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= displayOrder.length) return;
    const reordered = [...displayOrder];
    [reordered[currentIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[currentIdx]];
    await applyCardOrderChange(renumberCards(reordered));
  };

  const onCardDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = draggingCardIdxRef.current;
    if (fromIdx === null || fromIdx === targetIdx) {
      draggingCardIdxRef.current = null;
      setDraggingCardIdx(null);
      setDragOverCardIdx(null);
      return;
    }
    const reordered = [...cardsRef.current];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    draggingCardIdxRef.current = null;
    setDraggingCardIdx(null);
    setDragOverCardIdx(null);
    await applyCardOrderChange(renumberCards(reordered));
  };

  const onCardDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    draggingCardIdxRef.current = index;
    setDraggingCardIdx(index);
  };

  const onCardDragEnd = () => {
    draggingCardIdxRef.current = null;
    setDraggingCardIdx(null);
    setDragOverCardIdx(null);
  };

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

  // ── Render helpers ──
  const cardClass = (index: number) => {
    // if (isTvLayout) {
    //   return index % 2 === 0 ? 'card odd-card' : 'card even-card';
    // }
    if (index === 0) return 'card odd-card';
    const block = Math.floor((index - 1) / 2);
    return block % 2 === 0 ? 'card even-card' : 'card odd-card';
  };

  const renderCardImage = (card: CardContent, index: number) => {
    const blockImageDrag = canEdit
      ? { draggable: false, onDragStart: (e: React.DragEvent) => e.preventDefault() }
      : {};

    const totalFallbacks = Object.keys(LOCAL_IMAGES).length;
    const fallbackIndex = card.imageIndex ?? ((index % totalFallbacks) + 1);
    const local = LOCAL_IMAGES[fallbackIndex];

    if (card.imageUrl) {
      return (
        <SharePointImage
          src={card.imageUrl}
          placeholderSrc={local.src}
          alt={card.title}
          className="card-image"
          {...blockImageDrag}
        />
      );
    }

    return (
      <img
        src={local.src}
        srcSet={local.srcSet}
        sizes={local.sizes}
        alt={card.title}
        className="card-image"
        {...blockImageDrag}
      />
    );
  };

  return (
    <div className={`home-page ${showHomeContent ? 'authenticated' : 'unauthenticated'}`}>
      {showHomeContent ? (
        <div className="home-layout">
          {/* ── Main Content ── */}
          <div className="home-content-container">
            <div className="main-content home-main-content">

              {/* ── Hero Banner ── */}
              <section className="homepage-hero editable-wrapper" aria-label="Homepage banner">
                <SharePointImage
                  src={heroImageUrl || howBanner}
                  placeholderSrc={howBanner}
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
                {canEdit && (
                  <button className="edit-pencil-btn" onClick={openHeroEdit} title="Edit banner image">
                    ✏ Edit Banner
                  </button>
                )}
              </section>

              {/* ── Announcements ── */}
              {(activeAnnouncements.length > 0 || canEdit) && (
                <div className="home-announcements" style={{ margin: '16px 0 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>
                      📢 Announcements
                    </h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {canEdit && (
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
                      {canEdit && (
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
                {cardsLoading ? (
                  <div className="home-cards-loading" role="status" aria-label="Loading cards">
                    <div className="app-loading-spinner" aria-hidden="true" />
                  </div>
                ) : (
                cards.map((card, index) => (
                  <div
                    key={`card-${card.order}-${card.title}`}
                    className={[
                      cardClass(index),
                      'editable-wrapper',
                      canEdit ? 'card-reorderable' : '',
                      draggingCardIdx === index ? 'card-dragging' : '',
                      dragOverCardIdx === index && draggingCardIdx !== index ? 'card-drag-over' : '',
                    ].filter(Boolean).join(' ')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverCardIdx(index);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverCardIdx((current) => (current === index ? null : current));
                      }
                    }}
                    onDrop={(e) => onCardDrop(e, index)}
                  >
                    {canEdit && contentLoaded && (
                      <div
                        className="card-drag-handle"
                        title="Drag to reorder"
                        draggable
                        onDragStart={(e) => onCardDragStart(e, index)}
                        onDragEnd={onCardDragEnd}
                      >
                        <div className="drag-dots">
                          <span /><span /><span /><span /><span /><span />
                        </div>
                      </div>
                    )}
                    {renderCardImage(card, index)}
                    <div className="card-text">
                      <h2>{card.title}</h2>
                      <ul>
                        {sanitizeBullets(card.bullets).map((bullet, bi) => (
                          <li key={bi} dangerouslySetInnerHTML={{ __html: bullet }} />
                        ))}
                      </ul>
                    </div>
                    {canEdit && contentLoaded && (
                      <div className="card-reorder-row">
                        <button
                          type="button"
                          className="card-reorder-btn"
                          onClick={(e) => { e.stopPropagation(); void moveCard(index, 'up'); }}
                          disabled={index === 0}
                          title="Move card up"
                        >↑</button>
                        <button
                          type="button"
                          className="card-reorder-btn"
                          onClick={(e) => { e.stopPropagation(); void moveCard(index, 'down'); }}
                          disabled={index === cards.length - 1}
                          title="Move card down"
                        >↓</button>
                        <button type="button" className="edit-pencil-btn" style={{ position: 'static', opacity: 1, marginLeft: 4 }} onClick={() => openCardEdit(card)} title="Edit card">
                          ✏ Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))
                )}

                {/* Add Card button — editors only */}
                {canEdit && contentLoaded && (
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
      {editCardDraft && (
        <EditModal
          title={isNewCard ? 'New Card' : `Edit Card: ${editCardDraft.title}`}
          onClose={() => { void closeCardEdit(); }}
          isSaving={cardSaveStatus === 'saving'}
          onDelete={isNewCard ? undefined : deleteCard}
          autoSave
          saveStatus={cardSaveStatus}
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
              onChange={e => setEditCardDraft({ ...editCardDraft, bullets: parseBulletLines(e.target.value) })}
            />
            <span className="edit-field-hint">One bullet per line. HTML is supported (e.g. &lt;a href="..."&gt;Link&lt;/a&gt;).</span>
          </div>

          {/* ── Image section ── */}
          <div className="edit-field-group">
            <label>Card Image</label>

            {/* Live preview */}
            {imagePreviewUrl && (
              <SharePointImage src={imagePreviewUrl} alt="Preview" className="edit-image-preview" />
            )}

            {/* Upload from device */}
            <div
              className="edit-upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('dragover'); }}
              onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
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
              Card text saves to Shared Documents/General/intranet/homepage-cards.json.
              Images upload to Shared Documents/General/intranet/images.
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
            {heroDraft && <SharePointImage src={heroDraft} alt="Banner preview" className="edit-image-preview" />}
            <span className="edit-field-hint">Paste a public image URL or SharePoint CDN link. Recommended size: 1400×400 px.</span>
          </div>
        </EditModal>
      )}
    </div>
  );
};

export default HomePage;
