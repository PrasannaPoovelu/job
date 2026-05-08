import { useState } from 'react';
import type { Agent } from '../types';
import type { ResumeProfile, ScoredJob } from '../jobs/types';
import { JobAggregator } from '../jobs/aggregator';
import {
  categorizeJobs,
  extractResumeProfile,
  scoreJobs,
} from '../jobs/recruiter';
import { JobCard } from './JobCard';

interface JobHunterProps {
  resumeText: string;
  /** Active agent — its `ask()` powers profile extraction and fit scoring. */
  agent: Agent;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'analyzing'; message: string }
  | { kind: 'searching'; message: string; profile: ResumeProfile }
  | { kind: 'scoring'; message: string; profile: ResumeProfile; foundCount: number }
  | { kind: 'done'; profile: ResumeProfile; jobs: ScoredJob[]; sourceErrors: Record<string, string> }
  | { kind: 'error'; message: string };

const TIER_META = {
  high: {
    label: 'High-probability',
    desc: 'Apply first — strongest match for your skills and seniority',
    color: 'border-green-300 bg-green-50',
  },
  medium: {
    label: 'Medium-probability',
    desc: 'Worth applying — solid overlap with the role',
    color: 'border-amber-300 bg-amber-50',
  },
  stretch: {
    label: 'Stretch roles',
    desc: 'Lower fit but interesting if the company / mission appeals to you',
    color: 'border-slate-300 bg-slate-50',
  },
} as const;

export function JobHunter({ resumeText, agent }: JobHunterProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  async function run() {
    if (!resumeText.trim()) {
      setPhase({
        kind: 'error',
        message: 'Upload your resume first, then click Find Jobs.',
      });
      return;
    }

    setPhase({
      kind: 'analyzing',
      message: 'Reading your resume to identify target roles…',
    });

    const ask = agent.ask
      ? (sys: string, user: string) => agent.ask!(sys, user)
      : null;

    let profile: ResumeProfile;
    try {
      profile = await extractResumeProfile(resumeText, ask);
    } catch (e) {
      setPhase({
        kind: 'error',
        message: `Resume analysis failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }

    setPhase({
      kind: 'searching',
      message: `Searching real job listings for "${profile.primaryRole}"…`,
      profile,
    });

    const aggregator = new JobAggregator();
    if (aggregator.configuredSources().length === 0) {
      setPhase({
        kind: 'error',
        message: 'No job sources configured. The Muse and Remotive should always work — check your network.',
      });
      return;
    }

    let jobs;
    try {
      jobs = await aggregator.search(profile);
    } catch (e) {
      setPhase({
        kind: 'error',
        message: `Job search failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }

    if (jobs.length === 0) {
      setPhase({
        kind: 'done',
        profile,
        jobs: [],
        sourceErrors: { ...aggregator.lastErrors },
      });
      return;
    }

    setPhase({
      kind: 'scoring',
      message: `Scoring ${jobs.length} jobs against your profile…`,
      profile,
      foundCount: jobs.length,
    });

    let scored: ScoredJob[];
    try {
      scored = await scoreJobs(jobs, profile, resumeText, ask, agent.providerId);
    } catch (e) {
      setPhase({
        kind: 'error',
        message: `Fit scoring failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }

    setPhase({
      kind: 'done',
      profile,
      jobs: scored,
      sourceErrors: { ...aggregator.lastErrors },
    });
  }

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            🎯 AI Job Hunter
          </h3>
          <p className="text-xs text-slate-500">
            Real listings from Adzuna, The Muse, and Remotive — scored by fit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={
            !resumeText.trim() ||
            phase.kind === 'analyzing' ||
            phase.kind === 'searching' ||
            phase.kind === 'scoring'
          }
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {phase.kind === 'analyzing' ||
          phase.kind === 'searching' ||
          phase.kind === 'scoring'
            ? 'Working…'
            : 'Find Matching Jobs'}
        </button>
      </header>

      <div className="p-5">
        {phase.kind === 'idle' && (
          <p className="text-sm text-slate-500">
            Upload a resume above, then click <strong>Find Matching Jobs</strong>.
            We&rsquo;ll analyze your background, query real job APIs (Adzuna +
            The Muse + Remotive), and rank every result by fit so you know
            where to apply first.
          </p>
        )}

        {(phase.kind === 'analyzing' ||
          phase.kind === 'searching' ||
          phase.kind === 'scoring') && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
            <span>{phase.message}</span>
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Something went wrong.</strong> {phase.message}
          </div>
        )}

        {phase.kind === 'done' && <DoneView phase={phase} />}
      </div>
    </section>
  );
}

interface DonePhase {
  kind: 'done';
  profile: ResumeProfile;
  jobs: ScoredJob[];
  sourceErrors: Record<string, string>;
}

function DoneView({ phase }: { phase: DonePhase }) {
  const { profile, jobs, sourceErrors } = phase;
  const { high, medium, stretch } = categorizeJobs(jobs);

  return (
    <div className="flex flex-col gap-5">
      <ProfileSummary profile={profile} totalJobs={jobs.length} />

      {Object.keys(sourceErrors).length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Some sources had issues:</strong>{' '}
          {Object.entries(sourceErrors)
            .map(([src, msg]) => `${src}: ${msg}`)
            .join(' · ')}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No jobs returned — try widening your target role or location, or set
          up the free Adzuna API key for broader coverage.
        </div>
      ) : (
        <>
          <Tier title="high" jobs={high} />
          <Tier title="medium" jobs={medium} />
          <Tier title="stretch" jobs={stretch} />
        </>
      )}
    </div>
  );
}

function ProfileSummary({
  profile,
  totalJobs,
}: {
  profile: ResumeProfile;
  totalJobs: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <h4 className="text-sm font-semibold text-slate-900">Your target profile</h4>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-semibold text-slate-700">Primary role</dt>
          <dd className="text-slate-900">{profile.primaryRole}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Seniority</dt>
          <dd className="text-slate-900 capitalize">
            {profile.seniority} · {profile.yearsExperience} yrs
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Locations</dt>
          <dd className="text-slate-900">
            {profile.targetLocations.slice(0, 4).join(' · ')}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Total jobs found</dt>
          <dd className="text-slate-900">{totalJobs}</dd>
        </div>
      </dl>
      {profile.alternativeRoles.length > 0 && (
        <p className="mt-3 text-xs text-slate-600">
          <span className="font-semibold">Also searching: </span>
          {profile.alternativeRoles.join(' · ')}
        </p>
      )}
      {profile.topSkills.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {profile.topSkills.slice(0, 14).map((s) => (
            <li
              key={s}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tier({
  title,
  jobs,
}: {
  title: keyof typeof TIER_META;
  jobs: ScoredJob[];
}) {
  if (jobs.length === 0) return null;
  const meta = TIER_META[title];
  return (
    <div className={['rounded-xl border-l-4 p-4', meta.color].join(' ')}>
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            {meta.label} <span className="text-slate-500">({jobs.length})</span>
          </h4>
          <p className="text-xs text-slate-600">{meta.desc}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </div>
  );
}
