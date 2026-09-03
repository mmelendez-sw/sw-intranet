import React, { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isIcemanAllowlisted } from '../authConfig';
import { UserInfo } from '../types/user';
import '../../styles/iceman.css';

interface IcemanProps {
  userInfo: UserInfo;
}

const DEFAULT_MAX_ROWS = 500;

const ICEMAN_API_URL = (() => {
  if (typeof window === 'undefined') return '/api/iceman/generate';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001/api/iceman/generate';
  }
  return '/api/iceman/generate';
})();

const isAcceptedFile = (name: string) => {
  const lower = name.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');
};

const Iceman: React.FC<IcemanProps> = ({ userInfo }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!userInfo.isAuthenticated || !isIcemanAllowlisted(userInfo.email)) {
    return <Navigate to="/" replace />;
  }

  const selectFile = useCallback((picked: File | null) => {
    setError(null);
    setStatus(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (!isAcceptedFile(picked.name)) {
      setFile(null);
      setError('Only .csv and .xlsx files are supported.');
      return;
    }
    setFile(picked);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0] ?? null);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    selectFile(e.dataTransfer.files?.[0] ?? null);
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onGenerate = async () => {
    if (!file) {
      setError('Choose a .csv or .xlsx file first.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('Fetching Nearmap imagery and building workbook…');

    try {
      const form = new FormData();
      form.append('file', file);

      const url = `${ICEMAN_API_URL}?max_rows=${DEFAULT_MAX_ROWS}`;
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
      const downloadName =
        match?.[1] || `iceman-output-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
          <p className="iceman-kicker">Site imagery toolkit</p>
          <h1>ICEMAN</h1>
          <p className="iceman-subtitle">
            Upload coordinates and download an Excel workbook with Nearmap thumbnails for each
            location — vertical (~250m), vertical (~50m), and north oblique.
          </p>
          {userInfo.email && (
            <p className="iceman-signed-in">Signed in as {userInfo.email}</p>
          )}
        </header>

        <div className="iceman-text-bar">
          <h2>Generate site imagery workbook</h2>
        </div>

        {error && (
          <div className="iceman-alert iceman-alert-error" role="alert">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <div>
              <strong>Could not generate workbook</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {status && !error && (
          <div className="iceman-alert iceman-alert-success" role="status">
            <i className="fa-solid fa-circle-check" aria-hidden="true" />
            <div>
              <strong>{loading ? 'Working…' : 'Ready'}</strong>
              <p>{status}</p>
            </div>
          </div>
        )}

        <section className="iceman-panel" aria-labelledby="iceman-upload-heading">
          <div className="iceman-panel-header">
            <h3 id="iceman-upload-heading">1. Upload coordinates</h3>
            <p>CSV or Excel with <code>lat</code>/<code>lng</code> (or latitude/longitude) columns.</p>
          </div>

          <div
            className={`iceman-dropzone${dragOver ? ' is-dragover' : ''}${file ? ' has-file' : ''}${loading ? ' is-disabled' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault();
              if (!loading) setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!loading) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={loading ? undefined : onDrop}
            onClick={() => {
              if (!loading) fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (loading) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Choose or drop a CSV or Excel file"
          >
            <input
              id="iceman-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFileChange}
              disabled={loading}
              hidden
            />
            <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
            {file ? (
              <div className="iceman-file-selected">
                <p className="iceman-file-name">{file.name}</p>
                <p className="iceman-file-meta">
                  {(file.size / 1024).toFixed(1)} KB · click to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="iceman-dropzone-title">Drop your file here</p>
                <p className="iceman-dropzone-hint">or click to browse · .csv / .xlsx</p>
              </div>
            )}
          </div>

          {file && (
            <div className="iceman-file-actions">
              <button type="button" className="iceman-btn-secondary" onClick={clearFile} disabled={loading}>
                Clear file
              </button>
            </div>
          )}
        </section>

        <section className="iceman-panel" aria-labelledby="iceman-generate-heading">
          <div className="iceman-panel-header">
            <h3 id="iceman-generate-heading">2. Generate &amp; download</h3>
            <p>
              Nearmap imagery is fetched for each row. Large files take longer; keep the tab open
              until the download starts.
            </p>
          </div>

          <div className="iceman-actions">
            <button
              type="button"
              className="iceman-btn-primary"
              onClick={onGenerate}
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <span className="iceman-spinner" aria-hidden="true" />
                  Generating…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-file-excel" aria-hidden="true" />
                  Generate XLSX
                </>
              )}
            </button>
          </div>
        </section>

        <section className="iceman-guide" aria-labelledby="iceman-guide-heading">
          <h3 id="iceman-guide-heading">What you get</h3>
          <div className="iceman-guide-grid">
            <div className="iceman-guide-item">
              <span className="iceman-guide-num">A–B</span>
              <div>
                <strong>Coordinates</strong>
                <p>Latitude and longitude from your upload</p>
              </div>
            </div>
            <div className="iceman-guide-item">
              <span className="iceman-guide-num">C+</span>
              <div>
                <strong>Pass-through</strong>
                <p>Any other columns copied into the output</p>
              </div>
            </div>
            <div className="iceman-guide-item">
              <span className="iceman-guide-num">Img</span>
              <div>
                <strong>Three thumbnails</strong>
                <p>Vertical ~250m, vertical ~50m, north oblique</p>
              </div>
            </div>
            <div className="iceman-guide-item">
              <span className="iceman-guide-num">St</span>
              <div>
                <strong>Status</strong>
                <p>Notes when coverage or imagery is missing</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Iceman;
