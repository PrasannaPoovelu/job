import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { extractTextFromFile, isSupported } from '../utils/fileParser';

interface FileUploadProps {
  label: string;
  hint?: string;
  /** Receives the parsed text once the file has been read. */
  onText: (text: string, filename: string) => void;
  /** Called whenever an error occurs (unsupported type, parse failure, etc). */
  onError?: (error: Error) => void;
  accept?: string;
}

const DEFAULT_ACCEPT = '.pdf,.docx,.txt,.md';

export function FileUpload({
  label,
  hint,
  onText,
  onError,
  accept = DEFAULT_ACCEPT,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErrorMsg(null);
    if (!isSupported(file.name)) {
      const err = new Error(
        `Unsupported file type. Please use PDF, DOCX, TXT, or MD.`,
      );
      setErrorMsg(err.message);
      onError?.(err);
      return;
    }
    setBusy(true);
    try {
      const text = await extractTextFromFile(file);
      setFilename(file.name);
      onText(text, file.name);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setErrorMsg(err.message);
      onError?.(err);
    } finally {
      setBusy(false);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function clear() {
    setFilename(null);
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = '';
    onText('', '');
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          isDragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 bg-white hover:border-brand-500',
        ].join(' ')}
      >
        {filename ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col text-left">
              <span className="font-medium text-slate-800">{filename}</span>
              <span className="text-xs text-slate-500">
                {busy ? 'Reading…' : 'Loaded ✓'}
              </span>
            </div>
            <button
              type="button"
              onClick={clear}
              className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              Replace
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Drag &amp; drop here, or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline"
              >
                browse
              </button>
            </p>
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          aria-label={label}
        />
      </div>
      {errorMsg && (
        <p role="alert" className="text-xs text-red-600">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
