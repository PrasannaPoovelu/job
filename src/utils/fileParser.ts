/**
 * File-to-text utilities for the resume / JD upload flow.
 *
 * Supported types:
 *   - .txt / .md → read as UTF-8 text
 *   - .docx     → mammoth (browser bundle)
 *   - .pdf      → pdfjs-dist with the bundled worker
 *
 * Anything else throws a friendly error so the UI can surface it.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — keeps browser memory sane

export type SupportedExt = 'txt' | 'md' | 'docx' | 'pdf';

export class UnsupportedFileError extends Error {
  constructor(name: string) {
    super(
      `Unsupported file: "${name}". Please upload a .pdf, .docx, .txt, or .md file.`,
    );
    this.name = 'UnsupportedFileError';
  }
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase();
}

export function isSupported(filename: string): boolean {
  const ext = getExtension(filename);
  return ext === 'pdf' || ext === 'docx' || ext === 'txt' || ext === 'md';
}

async function readAsText(file: File): Promise<string> {
  return await file.text();
}

async function readDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  // Lazy import keeps the initial bundle small.
  const mammoth = await import('mammoth/mammoth.browser');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function readPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdfjs = await import('pdfjs-dist');
  // Vite-friendly worker import — `?url` returns the asset URL.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url'))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }
  return pageTexts.join('\n\n');
}

/**
 * Extract plain text from an uploaded file. Throws `UnsupportedFileError`
 * for unknown types and a generic Error if the file is too large.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(
        1,
      )} MB). Limit is 5 MB.`,
    );
  }

  const ext = getExtension(file.name);
  switch (ext) {
    case 'txt':
    case 'md':
      return await readAsText(file);
    case 'docx':
      return await readDocx(file);
    case 'pdf':
      return await readPdf(file);
    default:
      throw new UnsupportedFileError(file.name);
  }
}
