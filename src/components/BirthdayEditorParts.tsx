import React, { useState } from 'react';
import type { BirthdayPerson } from '../services/contentService';
import type { GraphUser } from '../services/directoryService';
import {
  birthdayDirectoryStatus,
  mergeBirthdayImport,
  parseBirthdaySpreadsheet,
} from '../utils/birthdays';

/** Directory cross-reference badge shown on each row of the birthdays editor. */
export const BirthdayStatusBadge: React.FC<{ person: BirthdayPerson; users: GraphUser[] | null | undefined }> = ({
  person,
  users,
}) => {
  if (users === undefined) return <span className="birthday-status">Checking directory…</span>;
  const status = birthdayDirectoryStatus(person, users);
  if (status === 'active') return <span className="birthday-status is-active">✓ In directory</span>;
  if (status === 'contractor') return <span className="birthday-status is-hidden">Contractor/consultant — hidden</span>;
  if (status === 'not-found') return <span className="birthday-status is-hidden">Not in directory — hidden</span>;
  return <span className="birthday-status">Directory unavailable — shown</span>;
};

interface BirthdayImportPanelProps {
  people: BirthdayPerson[];
  users: GraphUser[] | null | undefined;
  disabled: boolean;
  onImport: (people: BirthdayPerson[]) => void;
}

/** Paste rows from the HR spreadsheet (Birth Date, Employee Name "Last,First", Department). */
export const BirthdayImportPanel: React.FC<BirthdayImportPanelProps> = ({ people, users, disabled, onImport }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [summary, setSummary] = useState<string | null>(null);

  const runImport = () => {
    const { rows, skipped } = parseBirthdaySpreadsheet(text);
    if (!rows.length) {
      setSummary('No rows found. Paste the table including the Birth Date and Employee Name columns.');
      return;
    }
    const result = mergeBirthdayImport(people, rows, users ?? null);
    onImport(result.people);
    const parts = [`Imported ${rows.length} row${rows.length === 1 ? '' : 's'}.`];
    if (users && result.notFound.length) {
      parts.push(`${result.notFound.length} not found in the directory (kept, but hidden): ${result.notFound.join(', ')}.`);
    }
    if (!users) parts.push('Directory unavailable — names were not matched.');
    if (skipped.length) parts.push(`${skipped.length} line${skipped.length === 1 ? '' : 's'} skipped.`);
    parts.push('Review below, then Save.');
    setSummary(parts.join(' '));
    setText('');
  };

  if (!open) {
    return (
      <button type="button" className="edit-add-btn" onClick={() => setOpen(true)} disabled={disabled}>
        ⤓ Import from spreadsheet
      </button>
    );
  }

  return (
    <div className="edit-field-group birthdays-import">
      <label htmlFor="birthdays-import-text">Paste rows from Excel</label>
      <textarea
        id="birthdays-import-text"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Month\tMonth Name\tBirth Date\tEmployee Name\t…\n1\tJANUARY\t1/25\tLast,First\t…'}
      />
      <span className="edit-field-hint">
        Names are matched to the Employee Directory; existing entries for the same person are updated.
      </span>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button type="button" className="edit-add-btn" onClick={runImport} disabled={disabled || !text.trim()}>
          Import
        </button>
        <button type="button" className="edit-btn-cancel" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {summary && <p className="edit-field-hint" role="status">{summary}</p>}
    </div>
  );
};
