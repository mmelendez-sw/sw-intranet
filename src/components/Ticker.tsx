import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/ticker.css';
import '../../styles/edit-mode.css';
import {
  getContent,
  setContent,
  TickerItem,
  DEFAULT_TICKER_ITEMS,
} from '../services/contentService';
import { UserInfo } from '../types/user';

interface TickerProps {
  userInfo: UserInfo;
}

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

const Ticker: React.FC<TickerProps> = ({ userInfo }) => {
  const { instance } = useMsal();
  const isEditor = userInfo.isEditor;

  const [items, setItems] = useState<TickerItem[]>(DEFAULT_TICKER_ITEMS);
  const [editingItem, setEditingItem] = useState<TickerItem | null>(null);
  const [editDraft, setEditDraft] = useState<TickerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [managingTicker, setManagingTicker] = useState(false);

  useEffect(() => {
    if (!userInfo.isAuthenticated) return;
    (async () => {
      const remote = await getContent<TickerItem[]>(instance, 'ticker-items');
      if (remote) setItems(remote);
    })();
  }, [userInfo.isAuthenticated, instance]);

  const openEdit = useCallback((item: TickerItem, isNewItem = false) => {
    setEditingItem(item);
    setEditDraft({ ...item });
    setIsNew(isNewItem);
  }, []);

  const saveItem = async () => {
    if (!editDraft) return;
    setSaving(true);
    const updated = isNew
      ? [...items, editDraft]
      : items.map(i => i.id === editDraft.id ? editDraft : i);
    const ok = await setContent(instance, 'ticker-items', updated);
    if (ok) setItems(updated);
    setSaving(false);
    setEditingItem(null);
  };

  const deleteItem = async () => {
    if (!editDraft) return;
    setSaving(true);
    const updated = items.filter(i => i.id !== editDraft.id);
    const ok = await setContent(instance, 'ticker-items', updated);
    if (ok) setItems(updated);
    setSaving(false);
    setEditingItem(null);
  };

  const addItem = () => {
    const newItem: TickerItem = {
      id: `ticker-${Date.now()}`,
      text: 'New announcement',
      order: items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 1,
    };
    openEdit(newItem, true);
  };

  const moveItem = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(i => i.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    const withNewOrders = reordered.map((i, n) => ({ ...i, order: n + 1 }));
    setItems(withNewOrders);
    await setContent(instance, 'ticker-items', withNewOrders);
  };

  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  // Don't render the ticker if there's nothing to show (and user isn't an editor)
  if (sortedItems.length === 0 && !isEditor) return null;

  return (
    <>
      {sortedItems.length > 0 && (
        <div className="ticker-wrap">
          <div className="ticker">
            {sortedItems.map(item => (
              <div key={item.id} className="ticker__item">- {item.text}</div>
            ))}
          </div>
          {isEditor && (
            <button
              className="edit-pencil-btn"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', opacity: 1, zIndex: 10 }}
              onClick={() => setManagingTicker(true)}
              title="Manage ticker items"
            >
              ✏ Edit Ticker
            </button>
          )}
        </div>
      )}

      {/* Editors with no items see a prompt to add some */}
      {sortedItems.length === 0 && isEditor && (
        <div style={{ background: '#f0f0f0', borderBottom: '1px solid #ddd', padding: '4px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#888' }}>No ticker items</span>
          <button className="site-alert-edit-btn" style={{ background: '#0d6efd', color: '#fff' }} onClick={() => setManagingTicker(true)}>
            + Add Ticker Items
          </button>
        </div>
      )}

      {/* ── Ticker Manager Modal ── */}
      {managingTicker && (
        <div className="edit-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setManagingTicker(false); }}>
          <div className="edit-modal" role="dialog" aria-modal="true" aria-label="Manage Ticker">
            <div className="edit-modal-header">
              <h3>Manage Ticker Items</h3>
              <button className="edit-modal-close" onClick={() => setManagingTicker(false)} aria-label="Close">&times;</button>
            </div>
            <div className="edit-modal-body">
              {sortedItems.length === 0 && (
                <p style={{ color: '#888', fontSize: 13 }}>No items yet. Add one below.</p>
              )}
              {sortedItems.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div className="sidebar-reorder-btns">
                    <button className="sidebar-reorder-btn" onClick={() => moveItem(item.id, 'up')} disabled={idx === 0}>↑</button>
                    <button className="sidebar-reorder-btn" onClick={() => moveItem(item.id, 'down')} disabled={idx === sortedItems.length - 1}>↓</button>
                  </div>
                  <span style={{ flex: 1, fontSize: 13 }}>{item.text}</span>
                  <button className="edit-pencil-btn" style={{ position: 'static', opacity: 1 }} onClick={() => { setManagingTicker(false); openEdit(item); }}>✏</button>
                </div>
              ))}
            </div>
            <div className="edit-modal-footer">
              <button className="edit-add-btn" onClick={() => { setManagingTicker(false); addItem(); }}>+ Add Item</button>
              <div className="edit-modal-footer-right">
                <button className="edit-btn-cancel" onClick={() => setManagingTicker(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Edit Modal ── */}
      {editingItem && editDraft && (
        <EditModal
          title={isNew ? 'New Ticker Item' : 'Edit Ticker Item'}
          onClose={() => setEditingItem(null)}
          onSave={saveItem}
          isSaving={saving}
          onDelete={isNew ? undefined : deleteItem}
        >
          <div className="edit-field-group">
            <label>Text</label>
            <input
              type="text"
              value={editDraft.text}
              onChange={e => setEditDraft({ ...editDraft, text: e.target.value })}
              placeholder="e.g. Office closed Friday for Good Friday"
              autoFocus
            />
          </div>
        </EditModal>
      )}
    </>
  );
};

export default Ticker;
