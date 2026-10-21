/** Manual coordinate entry for ICEMAN: paste parsing, validation and CSV building. */

export interface CoordinateRow {
  id: number;
  lat: string;
  lng: string;
  name: string;
}

export interface ParsedCoordinate {
  lat: string;
  lng: string;
  name: string;
}

let nextRowId = 1;

export const emptyRow = (): CoordinateRow => ({ id: nextRowId++, lat: '', lng: '', name: '' });

export const isBlankRow = (row: CoordinateRow): boolean =>
  !row.lat.trim() && !row.lng.trim() && !row.name.trim();

/**
 * Reads one coordinate token: "40.7128", "-74.006", "40.7128°", "74.006° W", "74.006W".
 * A trailing S or W makes the value negative.
 */
const parseCoordinateToken = (token: string): number | null => {
  const match = token.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSEWnsew])?$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const hemisphere = match[2]?.toUpperCase();
  return hemisphere === 'S' || hemisphere === 'W' ? -Math.abs(value) : value;
};

const splitLine = (line: string): string[] => {
  if (line.includes('\t')) return line.split('\t');
  if (/[,;]/.test(line)) return line.split(/[,;]/);
  return line.trim().split(/\s+/);
};

const isLatLng = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// Mirrors the header names findLatLngColumns accepts in server/iceman.ts.
const LAT_HEADERS = new Set(['lat', 'latitude', 'y']);
const LNG_HEADERS = new Set(['lng', 'lon', 'long', 'longitude', 'x']);

/** Column indexes when a line is a header row naming both coordinate columns. */
const findHeaderColumns = (cells: string[]): { lat: number; lng: number } | null => {
  const norm = cells.map((c) => c.trim().toLowerCase());
  const lat = norm.findIndex((c) => LAT_HEADERS.has(c));
  const lng = norm.findIndex((c) => LNG_HEADERS.has(c));
  return lat >= 0 && lng >= 0 ? { lat, lng } : null;
};

const nameFrom = (cells: string[], skip: number[]) =>
  cells.filter((c, i) => c && !skip.includes(i)).join(' ');

/**
 * Pulls lat/lng pairs out of pasted text — rows copied from Excel (tab-separated),
 * "lat, lng" pairs from Google Maps, or space-separated values.
 *
 * If the first line is a header naming lat/lng columns, those columns are used. Otherwise
 * the coordinates are the first two adjacent numeric cells that form a valid lat/lng (or
 * lng/lat, swapped). Every other cell becomes the site name, so a site ID column is kept.
 * Lines without a coordinate pair are skipped.
 */
export const parseCoordinateText = (text: string): ParsedCoordinate[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  const header = findHeaderColumns(splitLine(lines[0]));
  if (header) {
    const parsed: ParsedCoordinate[] = [];
    for (const line of lines.slice(1)) {
      const cells = splitLine(line).map((c) => c.trim());
      const lat = parseCoordinateToken(cells[header.lat] ?? '');
      const lng = parseCoordinateToken(cells[header.lng] ?? '');
      if (lat === null || lng === null) continue;
      parsed.push({ lat: String(lat), lng: String(lng), name: nameFrom(cells, [header.lat, header.lng]) });
    }
    return parsed;
  }

  const parsed: ParsedCoordinate[] = [];
  for (const line of lines) {
    const cells = splitLine(line).map((c) => c.trim());
    const values = cells.map(parseCoordinateToken);

    // Prefer a pair already in lat, lng order anywhere on the line before trying a swap,
    // so "101, 40.71, -74.00" reads the ID as a name rather than 101/40.71 as lng/lat.
    const findPair = (swapped: boolean) => {
      for (let i = 0; i + 1 < cells.length; i++) {
        const a = values[i];
        const b = values[i + 1];
        if (a !== null && b !== null && (swapped ? isLatLng(b, a) : isLatLng(a, b))) return i;
      }
      return -1;
    };
    let swap = false;
    let pairAt = findPair(false);
    if (pairAt < 0) {
      pairAt = findPair(true);
      swap = true;
    }
    if (pairAt < 0) continue;

    const lat = values[swap ? pairAt + 1 : pairAt] as number;
    const lng = values[swap ? pairAt : pairAt + 1] as number;
    parsed.push({ lat: String(lat), lng: String(lng), name: nameFrom(cells, [pairAt, pairAt + 1]) });
  }
  return parsed;
};

/** True when a paste should be spread across rows rather than typed into one cell. */
export const isStructuredPaste = (text: string): boolean =>
  /\r?\n/.test(text.trim()) || parseCoordinateText(text).length > 0;

/** Google Maps pin for a quick visual check before spending Nearmap requests. */
export const mapLinkFor = (row: CoordinateRow): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${Number(row.lat)},${Number(row.lng)}`
  )}`;

export interface RowValidation {
  lat?: string;
  lng?: string;
}

export const validateRow = (row: CoordinateRow): RowValidation => {
  if (isBlankRow(row)) return {};
  const errors: RowValidation = {};
  const lat = row.lat.trim() === '' ? NaN : Number(row.lat);
  const lng = row.lng.trim() === '' ? NaN : Number(row.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.lat = 'Latitude must be -90 to 90';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.lng = 'Longitude must be -180 to 180';
  return errors;
};

const csvCell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** CSV the Lambda already accepts: lat, lng, and a "Site name" pass-through column when used. */
export const buildCoordinateCsv = (rows: CoordinateRow[]): string => {
  const withNames = rows.some((r) => r.name.trim());
  const header = withNames ? 'lat,lng,Site name' : 'lat,lng';
  const lines = rows.map((r) => {
    const base = `${Number(r.lat)},${Number(r.lng)}`;
    return withNames ? `${base},${csvCell(r.name.trim())}` : base;
  });
  return [header, ...lines].join('\r\n') + '\r\n';
};
