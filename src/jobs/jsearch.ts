import type { Job, JobSearchQuery } from './types';

/**
 * JSearch (via RapidAPI) job-search client.
 *
 * One of the most useful free Indeed sources today — JSearch aggregates
 * listings from Indeed, LinkedIn, Google for Jobs, ZipRecruiter, and others
 * into a single endpoint and CORS-friendly response.
 *
 *   GET https://jsearch.p.rapidapi.com/search?query=…&page=…
 *
 * Free tier (May 2026):
 *   • 200 requests / month
 *   • No credit card to sign up — needs RapidAPI account
 *
 * Get a key at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch (Subscribe → Basic).
 */

const ENDPOINT = 'https://jsearch.p.rapidapi.com/search';

interface JSearchResponse {
  data?: Array<{
    job_id?: string;
    job_title?: string;
    employer_name?: string;
    employer_logo?: string | null;
    job_publisher?: string;
    job_employment_type?: string;
    job_apply_link?: string;
    job_description?: string;
    job_is_remote?: boolean;
    job_posted_at_datetime_utc?: string;
    job_city?: string;
    job_state?: string;
    job_country?: string;
    job_min_salary?: number;
    job_max_salary?: number;
    job_salary_currency?: string;
    job_salary_period?: string;
    job_required_skills?: string[] | null;
  }>;
  status?: string;
  error?: { message?: string };
}

export interface JSearchOptions {
  apiKey?: string;
  /** RapidAPI host header — must match the JSearch host. */
  host?: string;
  fetchImpl?: typeof fetch;
}

export class JSearchClient {
  readonly source = 'jsearch' as const;
  private readonly apiKey: string;
  private readonly host: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: JSearchOptions = {}) {
    this.apiKey = opts.apiKey ?? import.meta.env.VITE_JSEARCH_API_KEY ?? '';
    this.host = opts.host ?? 'jsearch.p.rapidapi.com';
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(q: JobSearchQuery): Promise<Job[]> {
    if (!this.isConfigured()) {
      throw new Error(
        'JSearch not configured. Add VITE_JSEARCH_API_KEY to .env.local — free signup at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
      );
    }

    // JSearch concatenates "what + where" into a single query string.
    const queryParts = [q.keywords];
    if (q.location) queryParts.push(`in ${q.location}`);
    const params = new URLSearchParams({
      query: queryParts.join(' '),
      page: String(q.page ?? 1),
      num_pages: '1',
      // 'all' lets JSearch pick the best mix; 'today' / 'week' filter recency.
      date_posted: 'month',
    });

    const url = `${ENDPOINT}?${params.toString()}`;
    const res = await this.fetchImpl(url, {
      headers: {
        'x-rapidapi-key': this.apiKey,
        'x-rapidapi-host': this.host,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`JSearch ${res.status}: ${text || res.statusText}`);
    }

    const data = (await res.json()) as JSearchResponse;
    return (data.data ?? [])
      .map(normalizeJSearchItem)
      .filter((j) => j.url && j.title);
  }
}

function normalizeJSearchItem(
  r: NonNullable<JSearchResponse['data']>[number],
): Job {
  const location = [r.job_city, r.job_state, r.job_country]
    .filter(Boolean)
    .join(', ');

  let salary: string | undefined;
  if (r.job_min_salary && r.job_max_salary) {
    const fmt = (n: number) =>
      n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
    const cur = r.job_salary_currency ? `${r.job_salary_currency} ` : '';
    salary = `${cur}${fmt(r.job_min_salary)}–${fmt(r.job_max_salary)}`;
    if (r.job_salary_period) salary += ` / ${r.job_salary_period.toLowerCase()}`;
  }

  return {
    id: `jsearch:${r.job_id ?? r.job_apply_link ?? ''}`,
    source: 'jsearch',
    title: (r.job_title ?? 'Untitled role').trim(),
    company: r.employer_name ?? 'Unknown company',
    location,
    description: (r.job_description ?? '').slice(0, 1500),
    url: r.job_apply_link ?? '',
    posted: r.job_posted_at_datetime_utc,
    salary,
    remote: r.job_is_remote,
    tags: [
      r.job_publisher,
      r.job_employment_type,
      ...(r.job_required_skills ?? []),
    ].filter(Boolean) as string[],
  };
}
