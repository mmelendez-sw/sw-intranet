/**
 * "Report IT Issue" form. Sends a formatted ticket from the signed-in user's mailbox to the
 * support address in Site Settings (Graph /me/sendMail, same as Lead Generation), so replies
 * from IT land back in the requester's inbox.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import type { IPublicClientApplication } from '@azure/msal-browser';
import '../../styles/it-ticket.css';

export const IT_TICKET_CATEGORIES = [
  'Account, password, or sign-in',
  'Computer or hardware',
  'Software or app',
  'Email, Teams, or Outlook',
  'Network, Wi-Fi, or VPN',
  'Printer or scanner',
  'Phone or mobile device',
  'Access request (files, folders, systems)',
  'Other',
] as const;

export const IT_TICKET_PRIORITIES = [
  { value: 'Low', hint: 'Whenever IT has time' },
  { value: 'Normal', hint: 'Affects my work, but I have a workaround' },
  { value: 'High', hint: 'I can’t do part of my job' },
  { value: 'Urgent', hint: 'I can’t work at all, or several people are affected' },
] as const;

type Priority = (typeof IT_TICKET_PRIORITIES)[number]['value'];

/** Graph sendMail rejects requests over ~4 MB; attachments are base64 (+33%). */
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

interface ITTicketModalProps {
  supportEmail: string;
  companyName: string;
  userName: string;
  userEmail: string;
  onClose: () => void;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

async function acquireMailToken(instance: IPublicClientApplication): Promise<string> {
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
  if (!account) throw new Error('You are signed out. Log in again, then resend the ticket.');
  const request = { scopes: ['Mail.Send'], account };
  try {
    return (await instance.acquireTokenSilent(request)).accessToken;
  } catch {
    // Popup keeps the form on screen; a redirect would discard what the user typed.
    try {
      return (await instance.acquireTokenPopup(request)).accessToken;
    } catch (err: any) {
      if (err?.errorCode === 'popup_window_error' || err?.errorCode === 'empty_window_error') {
        throw new Error(
          'Your sign-in expired and the browser blocked the sign-in window. ' +
            'Use the Login button at the top of the page, then send the ticket again.'
        );
      }
      throw err;
    }
  }
}

const ITTicketModal: React.FC<ITTicketModalProps> = ({
  supportEmail,
  companyName,
  userName,
  userEmail,
  onClose,
}) => {
  const { instance } = useMsal();
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('Normal');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [ccMe, setCcMe] = useState(true);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sending = status === 'sending';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files, ...Array.from(list)].slice(0, MAX_ATTACHMENTS);
    if (next.reduce((sum, f) => sum + f.size, 0) > MAX_ATTACHMENT_BYTES) {
      setError(`Attachments can total up to ${formatBytes(MAX_ATTACHMENT_BYTES)}. Try a smaller screenshot.`);
      return;
    }
    setError('');
    setFiles(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !subject.trim() || !description.trim()) {
      setError('Choose a category and fill in the subject and description.');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const token = await acquireMailToken(instance);
      const submittedAt = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const row = (label: string, value: string, shaded = false) =>
        `<tr${shaded ? ' style="background-color:#f8f9fa;"' : ''}>` +
        `<td style="padding:10px;border:1px solid #dee2e6;font-weight:bold;width:140px;">${label}</td>` +
        `<td style="padding:10px;border:1px solid #dee2e6;">${value}</td></tr>`;
      const body = `
        <h2 style="font-family:Arial,sans-serif;">IT ticket: ${escapeHtml(subject.trim())}</h2>
        <table style="border-collapse:collapse;width:100%;max-width:640px;font-family:Arial,sans-serif;">
          ${row('Requested by', `${escapeHtml(userName)} &lt;${escapeHtml(userEmail)}&gt;`)}
          ${row('Category', escapeHtml(category), true)}
          ${row('Priority', escapeHtml(priority))}
          ${row('Submitted', escapeHtml(submittedAt), true)}
          ${row('Description', escapeHtml(description.trim()).replace(/\n/g, '<br>'))}
          ${row('Attachments', files.length ? files.map((f) => escapeHtml(f.name)).join(', ') : 'None', true)}
        </table>
        <p style="color:#666;font-size:12px;font-family:Arial,sans-serif;">
          Sent from the ${escapeHtml(companyName || 'company')} intranet. Reply to this email to reach the requester.
        </p>`;

      const attachments = await Promise.all(
        files.map(async (file) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: file.name,
          contentType: file.type || 'application/octet-stream',
          contentBytes: await fileToBase64(file),
        }))
      );

      const message: Record<string, unknown> = {
        subject: `[IT Ticket] [${priority}] ${category}: ${subject.trim()}`,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: supportEmail } }],
        importance: priority === 'High' || priority === 'Urgent' ? 'high' : 'normal',
      };
      if (ccMe && userEmail) message.ccRecipients = [{ emailAddress: { address: userEmail } }];
      if (attachments.length) message.attachments = attachments;

      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, saveToSentItems: true }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error?.message || `Sending failed (${res.status}).`);
      }
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'The ticket could not be sent. Try again in a moment.');
    }
  };

  return (
    <div
      className="edit-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="edit-modal it-ticket-modal" role="dialog" aria-modal="true" aria-label="Report an IT issue">
        <div className="edit-modal-header">
          <h3>Report an IT issue</h3>
          <button className="edit-modal-close" onClick={onClose} disabled={sending} aria-label="Close">
            &times;
          </button>
        </div>

        {status === 'sent' ? (
          <>
            <div className="edit-modal-body it-ticket-sent" role="status">
              <div className="it-ticket-sent-icon" aria-hidden="true">✓</div>
              <h4>Ticket sent to IT</h4>
              <p>
                IT will reply by email{ccMe ? '. A copy is in your inbox' : ''}. You can find it in
                your Sent Items too.
              </p>
            </div>
            <div className="edit-modal-footer">
              <div className="edit-modal-footer-right">
                <button className="edit-btn-save" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="edit-modal-body">
              <div className="it-ticket-row">
                <div className="edit-field-group">
                  <label htmlFor="it-ticket-category">Category</label>
                  <select
                    id="it-ticket-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={sending}
                    required
                  >
                    <option value="" disabled>
                      Choose a category…
                    </option>
                    {IT_TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="edit-field-group">
                  <label htmlFor="it-ticket-priority">Priority</label>
                  <select
                    id="it-ticket-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    disabled={sending}
                  >
                    {IT_TICKET_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.value}
                      </option>
                    ))}
                  </select>
                  <span className="edit-field-hint">
                    {IT_TICKET_PRIORITIES.find((p) => p.value === priority)?.hint}
                  </span>
                </div>
              </div>

              <div className="edit-field-group">
                <label htmlFor="it-ticket-subject">Subject</label>
                <input
                  id="it-ticket-subject"
                  type="text"
                  maxLength={120}
                  value={subject}
                  placeholder="e.g. Outlook keeps asking for my password"
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                  required
                />
              </div>

              <div className="edit-field-group">
                <label htmlFor="it-ticket-description">Description</label>
                <textarea
                  id="it-ticket-description"
                  rows={6}
                  value={description}
                  placeholder="What happened, what you were doing, and any error message you saw."
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={sending}
                  required
                />
              </div>

              <div className="edit-field-group">
                <label>Screenshots or files (optional)</label>
                <div className="it-ticket-files">
                  <button
                    type="button"
                    className="it-ticket-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || files.length >= MAX_ATTACHMENTS}
                  >
                    📎 Attach files
                  </button>
                  <span className="edit-field-hint">
                    Up to {MAX_ATTACHMENTS} files, {formatBytes(MAX_ATTACHMENT_BYTES)} total
                    {files.length ? ` · ${formatBytes(totalBytes)} used` : ''}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>
                {files.length > 0 && (
                  <ul className="it-ticket-file-list">
                    {files.map((file, i) => (
                      <li key={`${file.name}-${i}`}>
                        <span>
                          {file.name} <small>({formatBytes(file.size)})</small>
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          disabled={sending}
                          aria-label={`Remove ${file.name}`}
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="edit-checkbox-row">
                <input type="checkbox" checked={ccMe} onChange={(e) => setCcMe(e.target.checked)} disabled={sending} />
                Send me a copy
              </label>

              {error && (
                <p className="it-ticket-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="edit-modal-footer">
              <span className="edit-field-hint it-ticket-to">To: {supportEmail}</span>
              <div className="edit-modal-footer-right">
                <button type="button" className="edit-btn-cancel" onClick={onClose} disabled={sending}>
                  Cancel
                </button>
                <button type="submit" className="edit-btn-save" disabled={sending}>
                  {sending ? 'Sending…' : 'Send to IT'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ITTicketModal;
