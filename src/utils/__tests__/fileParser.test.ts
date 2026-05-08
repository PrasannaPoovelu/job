import { describe, it, expect } from 'vitest';
import {
  getExtension,
  isSupported,
  extractTextFromFile,
  UnsupportedFileError,
} from '../fileParser';

function makeTxtFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' });
}

describe('getExtension', () => {
  it('returns the lowercased extension', () => {
    expect(getExtension('Resume.PDF')).toBe('pdf');
    expect(getExtension('cv.docx')).toBe('docx');
    expect(getExtension('notes.md')).toBe('md');
  });

  it('returns empty string when there is no extension', () => {
    expect(getExtension('README')).toBe('');
  });
});

describe('isSupported', () => {
  it('accepts the documented file types', () => {
    expect(isSupported('a.pdf')).toBe(true);
    expect(isSupported('a.docx')).toBe(true);
    expect(isSupported('a.txt')).toBe(true);
    expect(isSupported('a.md')).toBe(true);
  });
  it('rejects unsupported types', () => {
    expect(isSupported('a.doc')).toBe(false);
    expect(isSupported('a.png')).toBe(false);
    expect(isSupported('noextension')).toBe(false);
  });
});

describe('extractTextFromFile', () => {
  it('reads .txt as UTF-8', async () => {
    const file = makeTxtFile('jd.txt', 'Hello world');
    await expect(extractTextFromFile(file)).resolves.toBe('Hello world');
  });

  it('reads .md as UTF-8', async () => {
    const file = makeTxtFile('notes.md', '# Heading');
    await expect(extractTextFromFile(file)).resolves.toBe('# Heading');
  });

  it('throws UnsupportedFileError for unknown types', async () => {
    const file = makeTxtFile('weird.xyz', 'content');
    await expect(extractTextFromFile(file)).rejects.toBeInstanceOf(
      UnsupportedFileError,
    );
  });

  it('rejects files larger than 5 MB', async () => {
    // Build a sparse-ish 6 MB blob so we don't allocate 6 MB of real content.
    const big = new Blob([new Uint8Array(6 * 1024 * 1024)]);
    const file = new File([big], 'huge.txt', { type: 'text/plain' });
    await expect(extractTextFromFile(file)).rejects.toThrow(/too large/);
  });
});
