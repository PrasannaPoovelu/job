import type { Job, JobSearchQuery } from './types';

/**
 * Adzuna job-search client.
 *
 * Docs: https://developer.adzuna.com/  (free signup → app_id + app_key)
 * Free tier: ~25 RPM / 250 RPD per app.
 *
 * Endpoint: GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
 * Country codes used here: in (India), gb (UK), us (USA), de (DE), au (AU), ca (CA).
 *
 * Without `app_id` + `app_key` in env, this client throws — callers should
 * detect and skip silently.
 */

const COUNTRIES: Record<string, string> = {
  india: 'in',
  in: 'in',
  uk: 'gb',
  'united kingdom': 'gb',
  usa: 'us',
  us: 'us',
  'united states': 'us',
  germany: 'de',
  france: 'fr',
  canada: 'ca',
  australia: 'au',
  singapore: 'sg',
  remote: 'gb', // fallback — Adzuna doesn't have a global "remote" feed
};

interface AdzunaResultsResponse {
  count?: number;
  results?: Array<{
    id: string;
    title?: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    description?: string;
    redirect_url?: string;
    created?: string;
    salary_min?: number;
    salary_max?: number;
    salary_is_predicted?: string;
  }>;
}

export interface AdzunaOptions {
  appId?: string;
  appKey?: string;
  fetchImpl?: typeof fetch;
}

export class AdzunaClient {
  readonly source = 'adzuna' as const;
  private readonly appId: string;
  private readonly appKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AdzunaOptions = {}) {
    this.appId = opts.appId ?? import.meta.env.VITE_ADZUNA_APP_ID ?? '';
    this.appKey = opts.appKey ?? import.meta.env.VITE_ADZUNA_APP_KEY ?? '';
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  isConfigured(): boolean {
    return !!(this.appId && this.appKey);
  }

  private resolveCountry(country?: string): string {
    if (!country) return 'in';
    const cc = COUNTRIES[country.toLowerCase()];
    if (cc) return cc;
    if (country.length === 2) return country.toLowerCase();
    return 'in';
  }

  async search(q: JobSearchQuery): Promise<Job[]> {
    if (!this.isConfigured()) {
      throw new Error(
        'Adzuna not configured. Add VITE_ADZUNA_APP_ID and VITE_ADZUNA_APP_KEY to .env.local — free signup at https://developer.adzuna.com/',
      );
    }

    const country = this.resolveCountry(q.country ?? q.location);
    const page = q.page ?? 1;
    const params = new URLSearchParams({
      app_id: this.appId,
      app_key: this.appKey,
      results_per_page: String(Math.min(q.perPage ?? 20, 50)),
      what: q.keywords,
      content_type: 'application/json',
    });
    if (q.location && !COUNTRIES[q.location.toLowerCase()]) {
      params.set('where', q.location);
    }

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Adzuna ${res.status}: ${text || res.statusText}`);
    }
    const data = (await res.json()) as AdzunaResultsResponse;
    return (data.results ?? []).map((r) => normalizeAdzuna(r));
  }
}

function normalizeAdzuna(r: NonNullable<AdzunaResultsResponse['results']>[number]): Job {
  let salary: string | undefined;
  if (r.salary_min && r.salary_max) {
    const fmt = (n: number) =>
      n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
    salary = `${fmt(r.salary_min)}–${fmt(r.salary_max)}`;
  }
  return {
    id: `adzuna:${r.id}`,
    source: 'adzuna',
    title: (r.title ?? 'Untitled role').replace(/\s+/g, ' ').trim(),
    company: r.company?.display_name ?? 'Unknown company',
    location: r.location?.display_name ?? '',
    description: (r.description ?? '').slice(0, 1500),
    url: r.redirect_url ?? '',
    posted: r.created,
    salary,
  };
}
