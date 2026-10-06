/**
 * Helpers shared by HomePage and the /dev DevHomePage fork: edit modal, card ordering,
 * bullet text, announcement dates, and cached initial content.
 */

import React, { useEffect } from 'react';
import {
  getCachedContent,
  DEFAULT_CARDS,
  SEED_CARDS,
  DEFAULT_ANNOUNCEMENTS,
  CardContent,
  Announcement,
  HomepageCardsPerRow,
  parseHomepageCardsContent,
  parseAnnouncementsContent,
} from '../services/contentService';
import { EditSaveStatus, EditSaveStatusText } from './EditSaveStatusText';

export interface EditModalProps {
  title: string;
  onClose: () => void;
  onSave?: () => Promise<void>;
  isSaving: boolean;
  onDelete?: () => Promise<void>;
  children: React.ReactNode;
  autoSave?: boolean;
  saveStatus?: EditSaveStatus;
  /** Autosave "Done" — defaults to onClose. Use to block leave until SharePoint save succeeds. */
  onDone?: () => void | Promise<void>;
}

export const EditModal: React.FC<EditModalProps> = ({
  title,
  onClose,
  onSave,
  isSaving,
  onDelete,
  children,
  autoSave = false,
  saveStatus = 'idle',
  onDone,
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
                {saveStatus === 'idle' ? (
                  <span className="edit-saving-indicator" style={{ color: '#6c757d' }}>Edits save automatically</span>
                ) : (
                  <EditSaveStatusText status={saveStatus} />
                )}
                <button
                  className="edit-btn-save"
                  onClick={() => { void (onDone ?? onClose)(); }}
                  disabled={saveStatus === 'saving'}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <EditSaveStatusText status={isSaving ? 'saving' : saveStatus} />
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

export const CARDS_CONTENT_KEY = 'homepage-cards';

export const HERO_CONTENT_KEY = 'homepage-hero';

export const ANNOUNCEMENTS_CONTENT_KEY = 'announcements';

export const HOMEPAGE_LAYOUT_CONTENT_KEY = 'homepage-layout';

export const CARD_POLL = { remoteOnly: true } as const;

export const CARD_AUTOSAVE_MS = 800;

export const CARD_POLL_MS = 20_000;

/** Minimum time to show the cards loading spinner (set to 0 in production). */
export const CARDS_SPINNER_MIN_MS = 0;

export const sortCardsByOrder = (cardList: CardContent[]): CardContent[] =>
  [...cardList].sort((a, b) => a.order - b.order);

/** Assign sequential order values; preserves the array's current display order. */
export const renumberCards = (cardList: CardContent[]): CardContent[] =>
  cardList.map((c, i) => ({ ...c, order: i + 1 }));

export const normalizeCards = (remoteCards: CardContent[]): CardContent[] =>
  renumberCards(sortCardsByOrder(remoteCards));

export const cardsMatch = (a: CardContent[], b: CardContent[]) => JSON.stringify(a) === JSON.stringify(b);

export const getInitialCards = (): CardContent[] => {
  const cached = getCachedContent<unknown>(CARDS_CONTENT_KEY);
  const parsed = parseHomepageCardsContent(cached);
  if (parsed.length) return normalizeCards(parsed);
  if (SEED_CARDS.length) return normalizeCards(SEED_CARDS);
  return DEFAULT_CARDS;
};

export const bulletsToText = (bullets: string[]) => bullets.join('\n');

export const parseBulletLines = (text: string) => text.split('\n');

export const sanitizeBullets = (bullets: string[]) => bullets.filter((l) => l.trim() !== '');

/** YYYY-MM-DD in local timezone (avoids UTC off-by-one from toISOString). */
export const todayLocalDateString = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Parse date-only strings as local calendar dates, not UTC midnight. */
export const formatAnnouncementDate = (dateStr: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const CARDS_PER_ROW_OPTIONS: HomepageCardsPerRow[] = [2, 3, 4, 5];

export const getInitialAnnouncements = (): Announcement[] => {
  const parsed = parseAnnouncementsContent(getCachedContent(ANNOUNCEMENTS_CONTENT_KEY));
  return parsed.length ? parsed : DEFAULT_ANNOUNCEMENTS;
};

/** 4-col layout: alternate colors, but cards 4–5, 8–9, 12–13, … (multiples of 4) share a color. */
export const isOddCardFor4Columns = (index: number): boolean => {
  let isOdd = true;
  for (let i = 1; i <= index; i++) {
    const cardNum = i + 1;
    if (cardNum % 4 === 1 && cardNum > 4) {
      continue;
    }
    isOdd = !isOdd;
  }
  return isOdd;
};
