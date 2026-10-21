import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { ICEMAN_GENERATE_URL, isIcemanAllowlisted } from '../authConfig';
import { UserInfo } from '../types/user';
import { intranetApiFetch } from '../services/intranetApi';
import {
  CoordinateRow,
  buildCoordinateCsv,
  emptyRow,
  isBlankRow,
  isStructuredPaste,
  mapLinkFor,
  parseCoordinateText,
  validateRow,
} from '../utils/icemanCoordinates';
import closeObliqueExample from '../../images/iceman/north-oblique-close-example.jpg';
import farObliqueExample from '../../images/iceman/north-oblique-far-example.jpg';
import '../../styles/iceman.css';

interface IcemanProps {
  userInfo: UserInfo;
}

/**
 * Amplify's proxy times out around 30s (~1–2s per row), so keep uploads small.
 * Mirrors ICEMAN_MAX_ROWS in server/iceman.ts — the Lambda clamps to the same value.
 */
const MAX_ROWS = 15;

/**
 * Lambda Function URLs cap the request body at 6 MB *after* base64 encoding, so anything
 * over ~4.5 MB is rejected before our handler runs. Mirrors MAX_UPLOAD_BYTES in server/multipart.ts.
 */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const CLOSE_OBLIQUE_MIN_M = 15;
const CLOSE_OBLIQUE_MAX_M = 75;
const CLOSE_OBLIQUE_DEFAULT_M = 45;

const FAR_OBLIQUE_MIN_M = 200;
const FAR_OBLIQUE_MAX_M = 750;
const FAR_OBLIQUE_DEFAULT_M = 375;

/** Mirrors TOP_DOWN_M in server/iceman.ts. */
const TOP_DOWN_M = 180;

// Legacy .xls (BIFF) is no longer parsed server-side (the xlsx package was dropped).
const isAcceptedFile = (name: string) => {
  const lower = name.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.xlsx');
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The Lambda returns the workbook in one response, so progress is estimated from the site
 * count (~30 s for a full 15-site batch). Tune these from the [iceman] timing logs.
 */
const ESTIMATE_OVERHEAD_S = 3;
const ESTIMATE_SECONDS_PER_SITE = 1.8;
/** The bar holds here until the download actually arrives. */
const ESTIMATE_MAX_PERCENT = 95;

/** Rows in a CSV that carry a lat/lng pair (skips the header). Null for .xlsx. */
async function countCsvSites(file: File): Promise<number | null> {
  if (!file.name.toLowerCase().endsWith('.csv')) return null;
  try {
    const text = await file.text();
    const sites = text.split(/\r?\n/).filter((line) => (line.match(/-?\d+(\.\d+)?/g) || []).length >= 2).length;
    return sites ? Math.min(sites, MAX_ROWS) : null;
  } catch {
    return null;
  }
}

interface ProgressEstimate {
  /** Known site count, or null when the server will find out (xlsx uploads). */
  sites: number | null;
  startedAt: number;
}

type InputMode = 'manual' | 'file';
type CellField = 'lat' | 'lng' | 'name';

const INITIAL_ROWS = 3;

const Iceman: React.FC<IcemanProps> = ({ userInfo }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<InputMode>('manual');
  const [rows, setRows] = useState<CoordinateRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, emptyRow)
  );
  const [pendingFocus, setPendingFocus] = useState<{ row: number; field: CellField } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [closeMeters, setCloseMeters] = useState(CLOSE_OBLIQUE_DEFAULT_M);
  const [farMeters, setFarMeters] = useState(FAR_OBLIQUE_DEFAULT_M);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressEstimate | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { instance } = useMsal();

  useEffect(() => {
    if (!pendingFocus) return;
    tableRef.current
      ?.querySelector<HTMLInputElement>(
        `[data-row="${pendingFocus.row}"][data-field="${pendingFocus.field}"]`
      )
      ?.focus();
    setPendingFocus(null);
  }, [pendingFocus, rows]);

  const resetMessages = () => {
    setError(null);
    setStatus(null);
    setNotice(null);
  };

  const updateCell = (index: number, field: CellField, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, emptyRow()]);
    setPendingFocus({ row: rows.length, field: 'lat' });
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyRow()]));
  };

  const clearRows = () => {
    resetMessages();
    setRows(Array.from({ length: INITIAL_ROWS }, emptyRow));
  };

  /** Spreads pasted coordinates across rows, starting at the row that was pasted into. */
  const onTablePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const rowAttr = target.getAttribute('data-row');
    const text = e.clipboardData.getData('text');
    if (rowAttr === null || !isStructuredPaste(text)) return;

    e.preventDefault();
    resetMessages();
    const parsed = parseCoordinateText(text);
    if (!parsed.length) {
      setError('No coordinates found in the pasted text. Paste latitude and longitude pairs.');
      return;
    }

    const start = Number(rowAttr);
    const fits = parsed.slice(0, Math.max(0, MAX_ROWS - start));
    setRows((prev) => {
      const next = [...prev];
      fits.forEach((p, k) => {
        const i = start + k;
        const existing = next[i] ?? emptyRow();
        // A lone "lat, lng" pasted over a row keeps the site name already typed there.
        const name = fits.length === 1 && !p.name ? existing.name : p.name;
        next[i] = { ...existing, ...p, name };
      });
      return next;
    });

    const dropped = parsed.length - fits.length;
    setNotice(
      `Pasted ${fits.length} location${fits.length === 1 ? '' : 's'}.` +
        (dropped > 0
          ? ` ${dropped} more did not fit — the limit is ${MAX_ROWS} rows per run.`
          : '')
    );
  };

  /** Enter moves down a row in the same column, adding a row at the end when there is room. */
  const onCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: CellField) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (index + 1 < rows.length) {
      setPendingFocus({ row: index + 1, field });
    } else if (rows.length < MAX_ROWS) {
      setRows((prev) => [...prev, emptyRow()]);
      setPendingFocus({ row: index + 1, field });
    }
  };

  const filledRows = rows.filter((r) => !isBlankRow(r));
  const rowErrors = rows.map(validateRow);
  const invalidCount = rowErrors.filter((v) => v.lat || v.lng).length;
  const canGenerate = mode === 'manual' ? filledRows.length > 0 && invalidCount === 0 : !!file;

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
    if (picked.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError(
        `That file is ${(picked.size / (1024 * 1024)).toFixed(1)} MB; uploads are limited to ` +
          `${MAX_UPLOAD_BYTES / (1024 * 1024)} MB. Trim it to the first ${MAX_ROWS} rows and try again.`
      );
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
    setNotice(null);
    let upload: Blob;
    let uploadName: string;
    if (mode === 'manual') {
      if (invalidCount > 0) {
        setError('Fix the highlighted coordinates before generating.');
        return;
      }
      if (!filledRows.length) {
        setError('Enter at least one latitude and longitude.');
        return;
      }
      upload = new Blob([buildCoordinateCsv(filledRows)], { type: 'text/csv' });
      uploadName = 'iceman-coordinates.csv';
    } else {
      if (!file) {
        setError('Choose a .csv or .xlsx file first.');
        return;
      }
      upload = file;
      uploadName = file.name;
    }

    const closeM = Math.round(clamp(closeMeters, CLOSE_OBLIQUE_MIN_M, CLOSE_OBLIQUE_MAX_M));
    const farM = Math.round(clamp(farMeters, FAR_OBLIQUE_MIN_M, FAR_OBLIQUE_MAX_M));

    setLoading(true);
    setProgress({
      sites: mode === 'manual' ? filledRows.length : await countCsvSites(upload as File),
      startedAt: Date.now(),
    });
    setNow(Date.now());
    setError(null);
    setStatus(
      `Fetching north oblique imagery (~${closeM}m and ~${farM}m) and building workbook…`
    );

    try {
      const form = new FormData();
      form.append('file', upload, uploadName);
      form.append('close_m', String(closeM));
      form.append('far_m', String(farM));

      const url =
        `${ICEMAN_GENERATE_URL}?max_rows=${MAX_ROWS}` +
        `&close_m=${encodeURIComponent(String(closeM))}` +
        `&far_m=${encodeURIComponent(String(farM))}`;
      const res = await intranetApiFetch(instance, url, { method: 'POST', body: form });

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
      setProgress(null);
    }
  };

  useEffect(() => {
    if (!progress) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [progress]);

  const progressView = (() => {
    if (!progress) return null;
    const elapsedS = Math.max(0, (now - progress.startedAt) / 1000);
    const sites = progress.sites ?? MAX_ROWS;
    const totalS = ESTIMATE_OVERHEAD_S + sites * ESTIMATE_SECONDS_PER_SITE;
    const percent = Math.min(ESTIMATE_MAX_PERCENT, Math.round((elapsedS / totalS) * 100));
    const siteNow = Math.floor((elapsedS - ESTIMATE_OVERHEAD_S / 2) / ESTIMATE_SECONDS_PER_SITE) + 1;
    let label: string;
    if (siteNow < 1) label = 'Sending coordinates…';
    else if (siteNow <= sites) {
      label = progress.sites ? `Fetching imagery: about site ${siteNow} of ${sites}` : `Fetching imagery: about site ${siteNow}`;
    } else label = 'Building the workbook…';
    return { percent, label, elapsed: Math.floor(elapsedS) };
  })();

  // After every hook, so hooks run in the same order on each render.
  if (!userInfo.isAuthenticated || !isIcemanAllowlisted(userInfo.email)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="iceman-page">
      <div className="iceman-container">
        <header className="iceman-header">
          <p className="iceman-kicker">Site imagery toolkit</p>
          <h1>ICEMAN</h1>
          <p className="iceman-subtitle">
            Enter or paste coordinates and download an Excel workbook with three Nearmap
            thumbnails per location — a top-down view, a close north oblique and a wider context
            oblique.
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
            <h3 id="iceman-upload-heading">1. Add coordinates</h3>
            <p>
              <strong>Up to {MAX_ROWS} locations per run.</strong> Split larger lists into
              several runs.
            </p>
          </div>

          <div className="iceman-tabs" role="tablist" aria-label="How to add coordinates">
            <button
              type="button"
              role="tab"
              id="iceman-tab-manual"
              aria-controls="iceman-tabpanel-manual"
              aria-selected={mode === 'manual'}
              className={`iceman-tab${mode === 'manual' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('manual');
                resetMessages();
              }}
              disabled={loading}
            >
              <i className="fa-solid fa-keyboard" aria-hidden="true" />
              Enter or paste
            </button>
            <button
              type="button"
              role="tab"
              id="iceman-tab-file"
              aria-controls="iceman-tabpanel-file"
              aria-selected={mode === 'file'}
              className={`iceman-tab${mode === 'file' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('file');
                resetMessages();
              }}
              disabled={loading}
            >
              <i className="fa-solid fa-file-arrow-up" aria-hidden="true" />
              Upload a file
            </button>
          </div>

          {mode === 'manual' && (
            <div id="iceman-tabpanel-manual" role="tabpanel" aria-labelledby="iceman-tab-manual">
              <p className="iceman-hint">
                Type coordinates, or paste into any cell — rows copied from Excel or{' '}
                <code>40.7128, -74.0060</code> pairs from Google Maps fill the rows below
                automatically. Press Enter to move to the next row.
              </p>

              <div className="iceman-coords" ref={tableRef} onPaste={onTablePaste}>
                <table className="iceman-coords-table">
                  <thead>
                    <tr>
                      <th scope="col" className="iceman-coords-num">
                        #
                      </th>
                      <th scope="col">Latitude</th>
                      <th scope="col">Longitude</th>
                      <th scope="col">
                        Site name <span className="iceman-optional">(optional)</span>
                      </th>
                      <th scope="col" className="iceman-coords-remove">
                        <span className="iceman-sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const errs = rowErrors[i];
                      const mappable = !isBlankRow(row) && !errs.lat && !errs.lng;
                      return (
                        <tr key={row.id}>
                          <td className="iceman-coords-num">{i + 1}</td>
                          {(['lat', 'lng'] as const).map((field) => (
                            <td key={field}>
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                spellCheck={false}
                                className={`iceman-cell${errs[field] ? ' is-invalid' : ''}`}
                                placeholder={field === 'lat' ? '40.7128' : '-74.0060'}
                                value={row[field]}
                                data-row={i}
                                data-field={field}
                                aria-label={`Row ${i + 1} ${field === 'lat' ? 'latitude' : 'longitude'}`}
                                aria-invalid={!!errs[field]}
                                title={errs[field]}
                                disabled={loading}
                                onChange={(e) => updateCell(i, field, e.target.value)}
                                onKeyDown={(e) => onCellKeyDown(e, i, field)}
                              />
                            </td>
                          ))}
                          <td>
                            <input
                              type="text"
                              autoComplete="off"
                              className="iceman-cell"
                              placeholder="e.g. Main St rooftop"
                              value={row.name}
                              data-row={i}
                              data-field="name"
                              aria-label={`Row ${i + 1} site name`}
                              disabled={loading}
                              onChange={(e) => updateCell(i, 'name', e.target.value)}
                              onKeyDown={(e) => onCellKeyDown(e, i, 'name')}
                            />
                          </td>
                          <td className="iceman-coords-remove">
                            {mappable && (
                              <a
                                className="iceman-icon-btn iceman-map-link"
                                href={mapLinkFor(row)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`View row ${i + 1} on a map`}
                                title="Check this location on Google Maps"
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                  <path
                                    fill="currentColor"
                                    d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                                  />
                                </svg>
                              </a>
                            )}
                            <button
                              type="button"
                              className="iceman-icon-btn"
                              onClick={() => removeRow(i)}
                              disabled={loading}
                              aria-label={`Remove row ${i + 1}`}
                              title="Remove row"
                            >
                              {/* Inline SVG: Font Awesome is not loaded (public/index.html). */}
                              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                <path
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  d="M6 6l12 12M18 6L6 18"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {invalidCount > 0 && (
                <p className="iceman-field-error" role="alert">
                  {invalidCount} row{invalidCount === 1 ? ' has' : 's have'} an invalid
                  coordinate. Latitude must be between -90 and 90, longitude between -180 and 180.
                </p>
              )}
              {notice && !error && (
                <p className="iceman-notice" role="status">
                  {notice}
                </p>
              )}

              <div className="iceman-coords-actions">
                <button
                  type="button"
                  className="iceman-btn-secondary"
                  onClick={addRow}
                  disabled={loading || rows.length >= MAX_ROWS}
                >
                  <i className="fa-solid fa-plus" aria-hidden="true" />
                  Add row
                </button>
                <span className="iceman-coords-count">
                  {filledRows.length} of {MAX_ROWS} locations
                </span>
                <button
                  type="button"
                  className="iceman-btn-secondary"
                  onClick={clearRows}
                  disabled={loading || filledRows.length === 0}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {mode === 'file' && (
            <div id="iceman-tabpanel-file" role="tabpanel" aria-labelledby="iceman-tab-file">
              <p className="iceman-hint">
                CSV or Excel with <code>lat</code>/<code>lng</code> (or latitude/longitude) columns.
                Only the first {MAX_ROWS} rows are processed. Any other columns are copied into the
                output. .csv or .xlsx only (legacy .xls is not accepted), up to{' '}
                {MAX_UPLOAD_BYTES / (1024 * 1024)} MB.
              </p>

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
                  accept=".csv,.xlsx"
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
                    <p className="iceman-dropzone-hint">
                      or click to browse · .csv / .xlsx · up to {MAX_ROWS} rows · max{' '}
                      {MAX_UPLOAD_BYTES / (1024 * 1024)} MB
                    </p>
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
            </div>
          )}
        </section>

        <section className="iceman-panel" aria-labelledby="iceman-range-heading">
          <div className="iceman-panel-header">
            <h3 id="iceman-range-heading">2. Set oblique distances</h3>
            <p>
              Choose the ground width of each north-oblique thumbnail, centred on the site. Defaults
              are {CLOSE_OBLIQUE_DEFAULT_M}&nbsp;m (close) and {FAR_OBLIQUE_DEFAULT_M}&nbsp;m
              (context). The top-down view is fixed at {TOP_DOWN_M}&nbsp;m.
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
              Nearmap imagery is fetched for each location (up to {MAX_ROWS}). This can take up
              to 30 seconds; keep the tab open until the download starts.
            </p>
          </div>

          <div className="iceman-actions">
            <button
              type="button"
              className="iceman-btn-primary"
              onClick={onGenerate}
              disabled={loading || !canGenerate}
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

          {progressView && (
            <div className="iceman-progress">
              <div
                className="iceman-progress-track"
                role="progressbar"
                aria-label="Estimated progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressView.percent}
              >
                <div className="iceman-progress-fill" style={{ width: `${progressView.percent}%` }} />
              </div>
              <p className="iceman-progress-text">
                <span>{progressView.label}</span>
                <span>{progressView.elapsed}s elapsed · estimate</span>
              </p>
            </div>
          )}
        </section>

        <section className="iceman-guide" aria-labelledby="iceman-guide-heading">
          <h3 id="iceman-guide-heading">What you get</h3>
          <div className="iceman-guide-grid">
            <div className="iceman-guide-item">
              <span className="iceman-guide-num">A–B</span>
              <div>
                <strong>Coordinates</strong>
                <p>Latitude and longitude you entered or uploaded</p>
              </div>
            </div>
            <div className="iceman-guide-item">
              <span className="iceman-guide-num">C+</span>
              <div>
                <strong>Pass-through</strong>
                <p>Site names, or any other columns from your file</p>
              </div>
            </div>
            <div className="iceman-guide-item">
              <span className="iceman-guide-num">Img</span>
              <div>
                <strong>Three images</strong>
                <p>
                  Top-down (~{TOP_DOWN_M} m), close oblique ({CLOSE_OBLIQUE_MIN_M}–
                  {CLOSE_OBLIQUE_MAX_M} m) and far oblique ({FAR_OBLIQUE_MIN_M}–
                  {FAR_OBLIQUE_MAX_M} m)
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
