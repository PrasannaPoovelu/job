import type { Job, JobSearchQuery, JobSource, ResumeProfile } from './types';
import { AdzunaClient } from './adzuna';
import { JSearchClient } from './jsearch';
import { MuseClient } from './themuse';
import { RemotiveClient } from './remotive';

/**
 * SourceClient interface — the minimal shape an aggregator caller cares about.
 */
interface SourceClient {
  readonly source: JobSource;
  isConfigured(): boolean;
  search(q: JobSearchQuery): Promise<Job[]>;
}

export interface AggregatorOptions {
  /** Override default clients (used in tests). */
  clients?: SourceClient[];
  /** Cap total jobs returned across all queries. */
  maxTotal?: number;
}

/**
 * Builds a small fan-out of search queries from the resume profile and
 * runs them across every configured source in parallel.
 *
 * Returns deduped results sorted by source priority (Adzuna → Muse → Remotive).
 * Errors from individual sources are swallowed (we still return what we got).
 */
export class JobAggregator {
  private readonly clients: SourceClient[];
  private readonly maxTotal: number;
  /** Per-source error captured during the last `search()` call, for UI display. */
  readonly lastErrors: Record<string, string> = {};

  constructor(opts: AggregatorOptions = {}) {
    this.clients = opts.clients ?? [
      new AdzunaClient(),
      new JSearchClient(),
      new MuseClient(),
      new RemotiveClient(),
    ];
    this.maxTotal = opts.maxTotal ?? 60;
  }

  /** Which sources are usable right now? */
  configuredSources(): string[] {
    return this.clients.filter((c) => c.isConfigured()).map((c) => c.source);
  }

  /**
   * Build 2–4 search queries from the profile that, together, give a good
   * mix across keywords and target geographies.
   */
  static buildQueries(profile: ResumeProfile): JobSearchQuery[] {
    const queries: JobSearchQuery[] = [];
    const roles = [profile.primaryRole, ...profile.alternativeRoles].filter(
      Boolean,
    );
    const locations = profile.targetLocations.length
      ? profile.targetLocations
      : ['India', 'Remote'];

    // Build at most 4 (role × location) pairs — keep API budget tight.
    for (const role of roles.slice(0, 2)) {
      for (const loc of locations.slice(0, 2)) {
        queries.push({
          keywords: role,
          location: loc,
          country: loc,
          perPage: 25,
        });
        if (queries.length >= 4) return queries;
      }
    }
    if (queries.length === 0) {
      queries.push({ keywords: 'engineer', perPage: 25 });
    }
    return queries;
  }

  async search(profile: ResumeProfile): Promise<Job[]> {
    Object.keys(this.lastErrors).forEach((k) => delete this.lastErrors[k]);
    const queries = JobAggregator.buildQueries(profile);
    const usable = this.clients.filter((c) => c.isConfigured());
    if (usable.length === 0) return [];

    // Each query × each source = one fetch, all in parallel.
    const tasks: Promise<Job[]>[] = [];
    for (const q of queries) {
      for (const c of usable) {
        tasks.push(
          c.search(q).catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            this.lastErrors[c.source] = msg;
            return [] as Job[];
          }),
        );
      }
    }
    const all = (await Promise.all(tasks)).flat();
    return dedupeAndCap(all, this.maxTotal);
  }
}

/**
 * Dedupe by URL; if a job has no URL, fall back to title+company so we
 * still drop obvious duplicates between sources.
 */
function dedupeAndCap(jobs: Job[], cap: number): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  // Source priority ordering (Adzuna first — best metadata).
  const order: Record<string, number> = {
    adzuna: 0,
    jsearch: 1,
    themuse: 2,
    remotive: 3,
  };
  jobs.sort((a, b) => (order[a.source] ?? 9) - (order[b.source] ?? 9));
  for (const j of jobs) {
    const key =
      (j.url || `${j.title}::${j.company}`).toLowerCase().split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    if (j.url) out.push(j); // never include link-less jobs
    if (out.length >= cap) break;
  }
  return out;
}
