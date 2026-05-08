import type { ResumeMetrics } from '../utils/metrics';

interface MetricsPanelProps {
  metrics: ResumeMetrics;
}

function bandClass(pct: number): string {
  if (pct >= 80) return 'text-green-700 bg-green-50 ring-green-200';
  if (pct >= 60) return 'text-amber-700 bg-amber-50 ring-amber-200';
  return 'text-red-700 bg-red-50 ring-red-200';
}

function deltaText(before: number, after: number): {
  text: string;
  positive: boolean;
} {
  const d = after - before;
  if (d === 0) return { text: 'no change', positive: false };
  return {
    text: `${d > 0 ? '+' : ''}${d}% vs original`,
    positive: d > 0,
  };
}

function StatCard({
  label,
  value,
  sub,
  band,
  children,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  band?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={[
        'flex flex-col gap-1 rounded-xl p-4 ring-1',
        band ?? 'bg-slate-50 ring-slate-200 text-slate-800',
      ].join(' ')}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="text-3xl font-bold leading-none">{value}</div>
      {sub && <div className="text-xs opacity-80">{sub}</div>}
      {children}
    </div>
  );
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const delta = deltaText(metrics.beforeMatchPct, metrics.afterMatchPct);
  const noKeywords = metrics.jdKeywords.length === 0;

  return (
    <section
      aria-label="Resume optimization metrics"
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Optimization metrics
        </h3>
        <span className="text-xs text-slate-500">
          {noKeywords
            ? 'No keywords detected in JD'
            : `Based on ${metrics.jdKeywords.length} JD keywords`}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard
          label="Before optimization"
          value={`${metrics.beforeMatchPct}%`}
          sub="JD match — original resume"
          band={bandClass(metrics.beforeMatchPct)}
        />

        <StatCard
          label="After optimization"
          value={`${metrics.afterMatchPct}%`}
          sub={
            <span
              className={
                delta.positive
                  ? 'font-semibold text-green-700'
                  : 'text-slate-500'
              }
            >
              {delta.text}
            </span>
          }
          band={bandClass(metrics.afterMatchPct)}
        />

        <StatCard
          label="ATS score"
          value={`${metrics.atsScore}/100`}
          sub="Keywords + bullets + quantified impact"
          band={bandClass(metrics.atsScore)}
        />

        <StatCard
          label="Keywords added"
          value={String(metrics.keywordsAdded.length)}
          sub={
            metrics.keywordsAdded.length === 0
              ? 'No new keywords matched'
              : 'New JD keywords now in resume'
          }
        >
          {metrics.keywordsAdded.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {metrics.keywordsAdded.map((k) => (
                <li
                  key={k}
                  className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                >
                  + {k}
                </li>
              ))}
            </ul>
          )}
        </StatCard>
      </div>

      {metrics.keywordsMissing.length > 0 && (
        <details className="mt-4 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-700">
            {metrics.keywordsMissing.length} JD keyword
            {metrics.keywordsMissing.length === 1 ? '' : 's'} still missing
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1">
            {metrics.keywordsMissing.map((k) => (
              <li
                key={k}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                {k}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
