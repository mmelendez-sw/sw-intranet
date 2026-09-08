import React, { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isIcemanAllowlisted } from '../authConfig';
import { UserInfo } from '../types/user';
import closeObliqueExample from '../../images/iceman/north-oblique-close-example.jpg';
import farObliqueExample from '../../images/iceman/north-oblique-far-example.jpg';
import '../../styles/iceman.css';

interface IcemanProps {
  userInfo: UserInfo;
}

const DEFAULT_MAX_ROWS = 500;

const CLOSE_OBLIQUE_MIN_M = 15;
const CLOSE_OBLIQUE_MAX_M = 50;
const CLOSE_OBLIQUE_DEFAULT_M = 35;

const FAR_OBLIQUE_MIN_M = 200;
const FAR_OBLIQUE_MAX_M = 500;
const FAR_OBLIQUE_DEFAULT_M = 300;

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

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const Iceman: React.FC<IcemanProps> = ({ userInfo }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [closeMeters, setCloseMeters] = useState(CLOSE_OBLIQUE_DEFAULT_M);
  const [farMeters, setFarMeters] = useState(FAR_OBLIQUE_DEFAULT_M);
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

    const closeM = Math.round(clamp(closeMeters, CLOSE_OBLIQUE_MIN_M, CLOSE_OBLIQUE_MAX_M));
    const farM = Math.round(clamp(farMeters, FAR_OBLIQUE_MIN_M, FAR_OBLIQUE_MAX_M));

    setLoading(true);
    setError(null);
    setStatus(
      `Fetching north oblique imagery (~${closeM}m and ~${farM}m) and building workbook…`
    );

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('close_m', String(closeM));
      form.append('far_m', String(farM));

      const url =
        `${ICEMAN_API_URL}?max_rows=${DEFAULT_MAX_ROWS}` +
        `&close_m=${encodeURIComponent(String(closeM))}` +
        `&far_m=${encodeURIComponent(String(farM))}`;
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
            Upload coordinates and download an Excel workbook with two north-oblique Nearmap
            thumbnails per location — a close view and a wider context view.
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
            <p>
              CSV or Excel with <code>lat</code>/<code>lng</code> (or latitude/longitude) columns.
            </p>
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
              <button
                type="button"
                className="iceman-btn-secondary"
                onClick={clearFile}
                disabled={loading}
              >
                Clear file
              </button>
            </div>
          )}
        </section>

        <section className="iceman-panel" aria-labelledby="iceman-range-heading">
          <div className="iceman-panel-header">
            <h3 id="iceman-range-heading">2. Set oblique distances</h3>
            <p>
              Choose approximate ground coverage for each north-oblique thumbnail. Defaults are
              35&nbsp;m (close) and 300&nbsp;m (context).
            </p>
          </div>

          <div className="iceman-range-grid">
            <label className="iceman-range-control" htmlFor="iceman-close-m">
              <div className="iceman-range-example">
                <img
                  src={closeObliqueExample}
                  alt="Example north oblique at about 30 meters"
                />
                <span className="iceman-range-example-caption">Example · ~30 m</span>
              </div>
              <div className="iceman-range-top">
                <span>Close oblique</span>
                <strong>{closeMeters} m</strong>
              </div>
              <input
                id="iceman-close-m"
                type="range"
                min={CLOSE_OBLIQUE_MIN_M}
                max={CLOSE_OBLIQUE_MAX_M}
                step={1}
                value={closeMeters}
                disabled={loading}
                onChange={(e) => setCloseMeters(Number(e.target.value))}
              />
              <div className="iceman-range-bounds">
                <span>{CLOSE_OBLIQUE_MIN_M} m</span>
                <span>{CLOSE_OBLIQUE_MAX_M} m</span>
              </div>
            </label>

            <label className="iceman-range-control" htmlFor="iceman-far-m">
              <div className="iceman-range-example">
                <img
                  src={farObliqueExample}
                  alt="Example north oblique at about 300 meters"
                />
                <span className="iceman-range-example-caption">Example · ~300 m</span>
              </div>
              <div className="iceman-range-top">
                <span>Far oblique</span>
                <strong>{farMeters} m</strong>
              </div>
              <input
                id="iceman-far-m"
                type="range"
                min={FAR_OBLIQUE_MIN_M}
                max={FAR_OBLIQUE_MAX_M}
                step={5}
                value={farMeters}
                disabled={loading}
                onChange={(e) => setFarMeters(Number(e.target.value))}
              />
              <div className="iceman-range-bounds">
                <span>{FAR_OBLIQUE_MIN_M} m</span>
                <span>{FAR_OBLIQUE_MAX_M} m</span>
              </div>
            </label>
          </div>
        </section>

        <section className="iceman-panel" aria-labelledby="iceman-generate-heading">
          <div className="iceman-panel-header">
            <h3 id="iceman-generate-heading">3. Generate &amp; download</h3>
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
                <strong>Two north obliques</strong>
                <p>
                  Close ({CLOSE_OBLIQUE_MIN_M}–{CLOSE_OBLIQUE_MAX_M} m) and far (
                  {FAR_OBLIQUE_MIN_M}–{FAR_OBLIQUE_MAX_M} m)
                </p>
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
