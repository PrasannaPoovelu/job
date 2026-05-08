import { useMemo, useState } from 'react';
import type { Agent, AgentInput, AgentStatus, ProviderId, Region } from './types';
import { JobApplicationAgent } from './agent/agent';
import { GeminiAgent } from './agent/geminiAgent';
import { DemoAgent } from './agent/demoAgent';
import { FileUpload } from './components/FileUpload';
import { RegionSelector } from './components/RegionSelector';
import { ResultsView } from './components/ResultsView';
import { JobHunter } from './components/JobHunter';
import { computeMetrics } from './utils/metrics';

/** Heuristic — does the API error look like a billing/credit problem? */
function looksLikeBillingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('credit balance') ||
    m.includes('billing') ||
    m.includes('quota') ||
    m.includes('insufficient') ||
    m.includes('payment') ||
    /\b(401|402|403|429)\b/.test(m)
  );
}

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'Anthropic Claude',
  gemini: 'Google Gemini (free)',
  demo: 'Demo Mode (offline)',
};

function tryConstruct<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch {
    return null;
  }
}

export default function App() {
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [region, setRegion] = useState<Region>('USA');
  const [status, setStatus] = useState<AgentStatus>({ kind: 'idle' });

  // Demo mode default comes from env, but the user can toggle it at runtime.
  const envDemo =
    String(import.meta.env.VITE_USE_DEMO_MODE ?? '').toLowerCase() === 'true';
  const [demoMode, setDemoMode] = useState<boolean>(envDemo);

  // Build all agents up-front; constructors throw if their key is missing.
  const liveAgents = useMemo(
    () => ({
      gemini: tryConstruct<Agent>(() => new GeminiAgent()),
      anthropic: tryConstruct<Agent>(() => new JobApplicationAgent()),
    }),
    [],
  );
  const demoAgent = useMemo<Agent>(() => new DemoAgent(), []);

  /** Preferred live provider — Gemini first (free), Anthropic next. */
  const preferredLive: Agent | null =
    liveAgents.gemini ?? liveAgents.anthropic ?? null;

  const activeAgent: Agent = demoMode || !preferredLive ? demoAgent : preferredLive;
  const activeProvider: ProviderId = activeAgent.providerId;

  const canSubmit =
    jdText.trim().length > 0 &&
    resumeText.trim().length > 0 &&
    status.kind !== 'loading';

  async function runWith(agent: Agent, input: AgentInput) {
    setStatus({
      kind: 'loading',
      message:
        agent.providerId === 'demo'
          ? 'Generating template output (demo mode)…'
          : `Optimizing with ${PROVIDER_LABEL[agent.providerId]} — 10–40 seconds…`,
    });
    try {
      const output = await agent.run(input);
      const metrics = computeMetrics(
        input.jobDescription,
        input.resume,
        output.optimizedResume,
      );
      setStatus({ kind: 'success', output: { ...output, metrics } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ kind: 'error', message: msg });
    }
  }

  function handleGenerate() {
    void runWith(activeAgent, {
      jobDescription: jdText,
      resume: resumeText,
      region,
    });
  }

  function handleFallbackToDemo() {
    setDemoMode(true);
    void runWith(demoAgent, {
      jobDescription: jdText,
      resume: resumeText,
      region,
    });
  }

  function reset() {
    setJdText('');
    setResumeText('');
    setStatus({ kind: 'idle' });
  }

  const showDemoFallback =
    status.kind === 'error' &&
    activeProvider !== 'demo' &&
    looksLikeBillingError(status.message);

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              AI Job Application Optimizer
            </h1>
            <p className="text-xs text-slate-500">
              ATS-friendly resume, tailored cover letter, and interview prep —
              powered by{' '}
              <span className="font-semibold text-slate-700">
                {PROVIDER_LABEL[activeProvider]}
              </span>
              .
            </p>
          </div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-brand-700"
          >
            Get free Gemini key ↗
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[420px_1fr]">
        <section className="flex flex-col gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Inputs</h2>

          <FileUpload
            label="Job Description"
            hint="PDF, DOCX, TXT, or MD — max 5 MB"
            onText={setJdText}
          />

          <FileUpload
            label="Your Resume"
            hint="PDF, DOCX, TXT, or MD — max 5 MB"
            onText={setResumeText}
          />

          <RegionSelector value={region} onChange={setRegion} />

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs text-slate-600">
              <span className="block font-semibold text-slate-800">
                Demo Mode (no API call)
              </span>
              Generate template output locally — useful if you're out of API
              credits or just want to preview the UI / PDF.
            </span>
          </label>

          {!preferredLive && !demoMode && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              No API key detected. Add{' '}
              <code className="rounded bg-amber-100 px-1">VITE_GEMINI_API_KEY</code>{' '}
              (free) or{' '}
              <code className="rounded bg-amber-100 px-1">
                VITE_ANTHROPIC_API_KEY
              </code>{' '}
              to <code className="rounded bg-amber-100 px-1">.env.local</code> and
              restart, or check the box above to use Demo Mode.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {status.kind === 'loading'
                ? 'Generating…'
                : `Generate with ${PROVIDER_LABEL[activeProvider]}`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          {jdText && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-600">
                Preview parsed inputs
              </summary>
              <div className="mt-2 grid gap-3">
                <div>
                  <div className="font-semibold">JD ({jdText.length} chars)</div>
                  <pre className="pretty-scroll mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">
                    {jdText.slice(0, 500)}
                    {jdText.length > 500 ? '…' : ''}
                  </pre>
                </div>
                <div>
                  <div className="font-semibold">
                    Resume ({resumeText.length} chars)
                  </div>
                  <pre className="pretty-scroll mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">
                    {resumeText.slice(0, 500)}
                    {resumeText.length > 500 ? '…' : ''}
                  </pre>
                </div>
              </div>
            </details>
          )}
        </section>

        <section className="flex flex-col gap-4">
          {status.kind === 'idle' && (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Upload a job description and your resume to get started.
            </div>
          )}
          {status.kind === 'loading' && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50 text-sm text-brand-700">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
              {status.message}
            </div>
          )}
          {status.kind === 'error' && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <div className="font-semibold">Something went wrong</div>
              <div className="mt-1 break-words">{status.message}</div>
              {showDemoFallback && (
                <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="text-xs">
                    Looks like a billing or rate-limit issue. You can keep
                    working offline:
                  </div>
                  <button
                    type="button"
                    onClick={handleFallbackToDemo}
                    className="self-start rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Try in Demo Mode
                  </button>
                  <div className="text-xs">
                    Or get a{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      free Gemini API key
                    </a>{' '}
                    (no credit card) and add it to <code>.env.local</code> as{' '}
                    <code>VITE_GEMINI_API_KEY</code>.
                  </div>
                </div>
              )}
            </div>
          )}
          {status.kind === 'success' && <ResultsView output={status.output} />}

          {/* AI Job Hunter — independent of optimization, runs whenever a resume is uploaded */}
          {resumeText.trim() && (
            <JobHunter resumeText={resumeText} agent={activeAgent} />
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-8 text-center text-xs text-slate-400">
        Built with React + TypeScript + Vite + Tailwind · Tested with Vitest
      </footer>
    </div>
  );
}
