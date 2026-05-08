import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { AgentOutput } from '../types';
import { ResumePdfDocument } from '../pdf/ResumePdfDocument';
import { MetricsPanel } from './MetricsPanel';

interface ResultsViewProps {
  output: AgentOutput;
}

type Tab = 'resume' | 'cover' | 'interview';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'resume', label: 'Optimized Resume', emoji: '📄' },
  { id: 'cover', label: 'Cover Letter', emoji: '✉️' },
  { id: 'interview', label: 'Interview Prep', emoji: '🎯' },
];

function pickContent(output: AgentOutput, tab: Tab): string {
  switch (tab) {
    case 'resume':
      return output.optimizedResume;
    case 'cover':
      return output.coverLetter;
    case 'interview':
      return output.interviewPrep;
  }
}

function suggestedFilename(tab: Tab, format: 'txt' | 'pdf' = 'txt'): string {
  const base =
    tab === 'resume'
      ? 'optimized-resume'
      : tab === 'cover'
        ? 'cover-letter'
        : 'interview-prep';
  return `${base}.${format}`;
}

export function ResultsView({ output }: ResultsViewProps) {
  const [active, setActive] = useState<Tab>('resume');
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const content = pickContent(output, active);

  const canDownloadPdf = active === 'resume' && !!output.resumeData;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently fail */
    }
  }

  function downloadAsTxt() {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, suggestedFilename(active, 'txt'));
  }

  async function downloadAsPdf() {
    if (!output.resumeData) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const doc = <ResumePdfDocument data={output.resumeData} />;
      const blob = await pdf(doc).toBlob();
      const safeName = (output.resumeData.name || 'resume')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      triggerDownload(blob, `${safeName}_Resume.pdf`);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF generation failed');
    } finally {
      setPdfBusy(false);
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
        <div role="tablist" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active === t.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <span className="mr-1.5">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyToClipboard}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={downloadAsTxt}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Download .txt
          </button>
          {active === 'resume' && (
            <button
              type="button"
              onClick={downloadAsPdf}
              disabled={!canDownloadPdf || pdfBusy}
              title={
                canDownloadPdf
                  ? 'Download a styled one-page PDF'
                  : 'PDF needs structured resume data — re-run with the live LLM, or rerun in demo mode.'
              }
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {pdfBusy ? 'Building PDF…' : 'Download PDF'}
            </button>
          )}
        </div>
      </div>

      {pdfError && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700"
        >
          PDF error: {pdfError}
        </div>
      )}

      <pre className="pretty-scroll max-h-[60vh] overflow-auto whitespace-pre-wrap break-words p-5 font-sans text-sm leading-6 text-slate-800">
        {content || (
          <span className="text-slate-400">
            (No content for this section — the model may have skipped it.)
          </span>
        )}
      </pre>
    </section>

      {output.metrics && <MetricsPanel metrics={output.metrics} />}
    </div>
  );
}
