import type { ScoredJob } from '../jobs/types';

interface JobCardProps {
  job: ScoredJob;
}

function scoreBand(score: number): string {
  if (score >= 75) return 'bg-green-100 text-green-800 ring-green-200';
  if (score >= 50) return 'bg-amber-100 text-amber-800 ring-amber-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const days = Math.max(1, Math.round((Date.now() - t) / (1000 * 60 * 60 * 24)));
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

const SOURCE_LABEL: Record<string, string> = {
  adzuna: 'Adzuna',
  jsearch: 'Indeed (JSearch)',
  themuse: 'The Muse',
  remotive: 'Remotive',
};

export function JobCard({ job }: JobCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-900">
            {job.title}
          </h4>
          <p className="truncate text-xs text-slate-600">
            {job.company}
            {job.location && (
              <span className="text-slate-400"> · {job.location}</span>
            )}
          </p>
        </div>
        <span
          className={[
            'flex shrink-0 flex-col items-center rounded-lg px-2 py-1 text-center text-xs font-bold ring-1',
            scoreBand(job.fitScore),
          ].join(' ')}
          title={`Fit score (LLM-estimated): ${job.fitScore}/100`}
        >
          <span className="text-base leading-none">{job.fitScore}</span>
          <span className="text-[9px] font-medium opacity-80">FIT</span>
        </span>
      </header>

      {job.fitReasons.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-slate-600">
          {job.fitReasons.slice(0, 2).map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-green-600">✓</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {SOURCE_LABEL[job.source] ?? job.source}
          </span>
          {job.salary && <span>{job.salary}</span>}
          {job.posted && <span>{timeAgo(job.posted)}</span>}
          {job.remote && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              Remote
            </span>
          )}
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Apply ↗
        </a>
      </div>
    </article>
  );
}
