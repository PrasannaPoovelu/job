import type { Job, JobSearchQuery } from './types';

/**
 * Remotive job-search client. Returns ONLY remote roles.
 *
 * Docs: https://remotive.com/api/remote-jobs
 *   • Public, no auth
 *   • Fetch sparingly — Remotive asks devs to cache (≤ 4 fetches/day)
 *   • CORS-friendly
 */

interface RemotiveResponse {
  jobs?: Array<{
    id: number;
    url: string;
    title: string;
    company_name: string;
    candidate_required_location?: string;
    job_type?: string;
    salary?: string;
    publication_date?: string;
    description?: string;
    tags?: string[];
  }>;
}

export interface RemotiveOptions {
  fetchImpl?: typeof fetch;
}

export class RemotiveClient {
  readonly source = 'remotive' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: RemotiveOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  isConfigured(): boolean {
    return true;
  }

  async search(q: JobSearchQuery): Promise<Job[]> {
    const params = new URLSearchParams();
    if (q.keywords) params.set('search', q.keywords);
    if (q.perPage) params.set('limit', String(q.perPage));

    const url = `https://remotive.com/api/remote-jobs?${params.toString()}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Remotive ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as RemotiveResponse;
    return (data.jobs ?? []).map((r) => normalizeRemotive(r));
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRemotive(
  r: NonNullable<RemotiveResponse['jobs']>[number],
): Job {
  return {
    id: `remotive:${r.id}`,
    source: 'remotive',
    title: r.title,
    company: r.company_name,
    location: r.candidate_required_location ?? 'Remote',
    description: stripHtml(r.description ?? '').slice(0, 1500),
    url: r.url,
    posted: r.publication_date,
    salary: r.salary,
    remote: true,
    tags: r.tags,
  };
}
