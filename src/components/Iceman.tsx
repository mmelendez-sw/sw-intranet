import React, { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isIcemanAllowlisted } from '../authConfig';
import { UserInfo } from '../types/user';
import '../../styles/iceman.css';

interface IcemanProps {
  userInfo: UserInfo;
}

const ICEMAN_API_URL = (() => {
  if (typeof window === 'undefined') return '/api/iceman/generate';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001/api/iceman/generate';
  }
  return '/api/iceman/generate';
})();

const Iceman: React.FC<IcemanProps> = ({ userInfo }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [maxRows, setMaxRows] = useState(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!userInfo.isAuthenticated || !isIcemanAllowlisted(userInfo.email)) {
    return <Navigate to="/" replace />;
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setStatus(null);
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
  };

  const onGenerate = async () => {
    if (!file) {
      setError('Choose a .csv or .xlsx file first.');
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setError('Only .csv and .xlsx files are supported.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('Fetching Nearmap imagery and building workbook…');

    try {
      const form = new FormData();
      form.append('file', file);

      const url = `${ICEMAN_API_URL}?max_rows=${encodeURIComponent(String(maxRows))}`;
      const res = await fetch(url, { method: 'POST', body: form });

      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          /* binary or empty body */
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const downloadName = match?.[1] || `iceman-output-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      setStatus(`Download started: ${downloadName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate workbook.');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="iceman-page">
      <div className="iceman-container">
        <header className="iceman-header">
          <h1>ICEMAN</h1>
          <p>
            Upload a spreadsheet with <strong>lat</strong> / <strong>lng</strong> columns (or{' '}
            <strong>latitude</strong> / <strong>longitude</strong>). The tool fetches Nearmap
            imagery for each row and returns an Excel file with three thumbnails per site:
            vertical ~250m, vertical ~50m, and north oblique.
          </p>
        </header>

        <section className="iceman-card">
          <label className="iceman-label" htmlFor="iceman-file">
            Input file (.csv or .xlsx)
          </label>
          <input
            id="iceman-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileChange}
            disabled={loading}
          />
          {file && <p className="iceman-file-name">Selected: {file.name}</p>}

          <label className="iceman-label" htmlFor="iceman-max-rows">
            Max rows (up to 500)
          </label>
          <input
            id="iceman-max-rows"
            type="number"
            min={1}
            max={500}
            value={maxRows}
            onChange={(e) => setMaxRows(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
            disabled={loading}
          />

          <button
            type="button"
            className="iceman-submit"
            onClick={onGenerate}
            disabled={loading || !file}
          >
            {loading ? 'Generating…' : 'Generate XLSX'}
          </button>

          {status && <p className="iceman-status">{status}</p>}
          {error && (
            <p className="iceman-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="iceman-help">
          <h2>Expected columns</h2>
          <ul>
            <li>
              <strong>Latitude / Longitude</strong> — required (<code>lat</code>, <code>lng</code>,{' '}
              <code>latitude</code>, <code>longitude</code>)
            </li>
            <li>
              <strong>Pass-through columns</strong> — any other columns are copied into the output
            </li>
            <li>
              <strong>Output images</strong> — Vertical ~250m, Vertical ~50m, North Oblique, plus
              a Status column for any missing imagery
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default Iceman;
