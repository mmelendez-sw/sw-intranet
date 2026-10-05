import { describe, it, expect } from 'vitest';
import { parseMultipart } from '../multipart';

const BOUNDARY = '----vitestBoundary7MA4YWxkTrZu0gW';
const CT = `multipart/form-data; boundary=${BOUNDARY}`;

type Part =
  | { name: string; value: string }
  | { name: string; filename?: string; contentType?: string; data: string | Buffer };

function buildBody(parts: Part[]): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`));
    if ('value' in part) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
      chunks.push(Buffer.from(part.value));
    } else {
      const fn = part.filename === undefined ? '' : `; filename="${part.filename}"`;
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"${fn}\r\n`));
      if (part.contentType) chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n`));
      chunks.push(Buffer.from('\r\n'));
      chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data));
    }
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

describe('parseMultipart', () => {
  const body = buildBody([
    { name: 'max_rows', value: '25' },
    { name: 'file', filename: 'sites.csv', contentType: 'text/csv', data: 'lat,lng\n1,2\n' },
    { name: 'close_m', value: '40' },
  ]);

  it('parses fields and file from a Buffer body', async () => {
    const out = await parseMultipart(body, CT);
    expect(out.fields).toEqual({ max_rows: '25', close_m: '40' });
    expect(out.file?.filename).toBe('sites.csv');
    expect(out.file?.mimeType).toBe('text/csv');
    expect(out.file?.buffer.toString('utf8')).toBe('lat,lng\n1,2\n');
  });

  it('decodes a base64 string body when isBase64Encoded', async () => {
    const out = await parseMultipart(body.toString('base64'), CT, true);
    expect(out.fields.max_rows).toBe('25');
    expect(out.file?.buffer.toString('utf8')).toBe('lat,lng\n1,2\n');
  });

  it('treats a string body as utf8 when not base64', async () => {
    const out = await parseMultipart(body.toString('utf8'), CT, false);
    expect(out.file?.filename).toBe('sites.csv');
    expect(out.fields.close_m).toBe('40');
  });

  it('round-trips binary file content via base64', async () => {
    const bin = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80, 0x0d, 0x0a]);
    const b = buildBody([{ name: 'file', filename: 'a.xlsx', data: bin }]);
    const out = await parseMultipart(b.toString('base64'), CT, true);
    expect(out.file?.buffer.equals(bin)).toBe(true);
  });

  it('accepts a case-variant Content-Type header value', async () => {
    const out = await parseMultipart(body, `Multipart/Form-Data; boundary=${BOUNDARY}`);
    expect(out.file?.filename).toBe('sites.csv');
  });

  it('defaults mime type when part has none', async () => {
    const b = buildBody([{ name: 'file', filename: 'a.csv', data: 'x' }]);
    const out = await parseMultipart(b, CT);
    // busboy itself defaults to text/plain when no Content-Type is given.
    expect(out.file?.mimeType).toBe('text/plain');
  });

  // busboy 1.x treats filename="" as a plain field, so the 'upload' fallback in
  // multipart.ts is effectively unreachable; the part lands in fields instead.
  it('treats an empty filename as a field (busboy behavior; "upload" default unreachable)', async () => {
    const b = buildBody([{ name: 'file', filename: '', contentType: 'text/csv', data: 'x' }]);
    const out = await parseMultipart(b, CT);
    expect(out.file).toBeUndefined();
    expect(out.fields.file).toBe('x');
  });

  it('returns no file when only fields are present', async () => {
    const out = await parseMultipart(buildBody([{ name: 'a', value: '1' }]), CT);
    expect(out.file).toBeUndefined();
    expect(out.fields).toEqual({ a: '1' });
  });

  // KNOWN ISSUE (reported, not fixed): the guard `fieldname !== 'file' && file`
  // checks `file`, which is only assigned on stream 'end'. With an in-memory body the
  // second part's 'file' event fires before the first stream ends, so a later
  // non-"file" upload overwrites the "file" part.
  it('currently lets a later non-"file" upload overwrite the "file" part (known issue)', async () => {
    const b = buildBody([
      { name: 'file', filename: 'first.csv', contentType: 'text/csv', data: 'one' },
      { name: 'other', filename: 'second.csv', contentType: 'text/csv', data: 'two' },
    ]);
    const out = await parseMultipart(b, CT);
    expect(out.file?.filename).toBe('second.csv');
  });

  it('uses a single "file" part even if other field parts surround it', async () => {
    const b = buildBody([
      { name: 'a', value: '1' },
      { name: 'file', filename: 'only.xlsx', contentType: 'application/octet-stream', data: 'z' },
      { name: 'b', value: '2' },
    ]);
    const out = await parseMultipart(b, CT);
    expect(out.file?.filename).toBe('only.xlsx');
    expect(out.fields).toEqual({ a: '1', b: '2' });
  });

  it('rejects missing body', async () => {
    await expect(parseMultipart(undefined, CT)).rejects.toThrow('Missing request body or Content-Type');
    await expect(parseMultipart('', CT)).rejects.toThrow('Missing request body or Content-Type');
  });

  it('rejects missing content-type', async () => {
    await expect(parseMultipart(body, undefined)).rejects.toThrow(
      'Missing request body or Content-Type'
    );
  });

  it('rejects a non-multipart content-type', async () => {
    await expect(parseMultipart(body, 'application/json')).rejects.toThrow();
  });

  it('rejects multipart without a boundary', async () => {
    await expect(parseMultipart(body, 'multipart/form-data')).rejects.toThrow();
  });
});
