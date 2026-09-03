import Busboy from 'busboy';

export type ParsedMultipart = {
  fields: Record<string, string>;
  file?: { buffer: Buffer; filename: string; mimeType: string };
};

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

    const busboy = Busboy({ headers: { 'content-type': contentType } });

    busboy.on('file', (fieldname, stream, info) => {
      if (fieldname !== 'file' && file) return;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
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
