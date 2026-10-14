import Busboy from 'busboy';

export type ParsedMultipart = {
  fields: Record<string, string>;
  file?: { buffer: Buffer; filename: string; mimeType: string };
};

/**
 * Function URLs cap the request at 6 MB and that applies to the base64-encoded body (4/3 overhead),
 * so the decoded upload must stay under ~4.5 MB. src/components/Iceman.tsx should enforce the same cap.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Parse multipart/form-data from a Lambda Function URL / API Gateway event.
 */
export function parseMultipart(
  body: string | Buffer | undefined,
  contentType: string | undefined,
  isBase64Encoded = false
): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    if (!body || !contentType) {
      reject(new Error('Missing request body or Content-Type'));
      return;
    }

    const raw =
      typeof body === 'string'
        ? isBase64Encoded
          ? Buffer.from(body, 'base64')
          : Buffer.from(body, 'utf8')
        : body;

    const fields: Record<string, string> = {};
    let file: ParsedMultipart['file'];

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 3, fields: 20 },
    });

    busboy.on('file', (fieldname, stream, info) => {
      // Unread streams stall Busboy, so drain anything we don't keep.
      if (fieldname !== 'file' || file) {
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => reject(new Error('Upload too large (max 4 MB)')));
      stream.on('end', () => {
        file = {
          buffer: Buffer.concat(chunks),
          filename: info.filename || 'upload',
          mimeType: info.mimeType || 'application/octet-stream',
        };
      });
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('finish', () => resolve({ fields, file }));
    busboy.on('error', reject);
    busboy.end(raw);
  });
}
