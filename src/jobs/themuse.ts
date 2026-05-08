import type { Job, JobSearchQuery } from './types';

/**
 * The Muse job-search client. PUBLIC API — no auth required.
 *
 * Docs: https://www.themuse.com/developers/api/v2
 *   • 500 req/hr without an API key, 3,600 req/hr with one
 *   • CORS-friendly
 *   • Mostly US/tech-focused — supplements Adzuna nicely
 *
 * Endpoint: GET https://www.themuse.com/api/public/jobs
 *   ?category=Software+Engineering&location=Bangalore&page=1
 */

interface MuseResponse {
  results?: Array<{
    id: number;
    name: string;
    contents?: string;
    company?: { name?: string };
    locations?: Array<{ name?: string }>;
    levels?: Array<{ name?: string }>;
    publication_date?: string;
    refs?: { landing_page?: string };
  }>;
  page?: number;
  page_count?: number;
}

export interface MuseOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Map our free-form keyword string to the closest Muse category.
 * Muse uses a fixed taxonomy — we pick the best fit, default to "Software Engineering".
 */
function pickCategory(keywords: string): string {
  const lower = keywords.toLowerCase();
  if (/(front[- ]?end|react|vue|angular|ui|web)/.test(lower)) {
    return 'Software Engineering';
  }
  if (/(back[- ]?end|node|java|python|api|server)/.test(lower)) {
    return 'Software Engineering';
  }
  if (/(data|analyst|sql|machine|ml|ai)/.test(lower)) return 'Data Science';
  if (/(design|ux|figma)/.test(lower)) return 'Design and UX';
  if (/(product|pm)/.test(lower)) return 'Product';
  if (/(marketing|seo|growth)/.test(lower)) return 'Marketing';
  if (/(sales|account)/.test(lower)) return 'Sales';
  return 'Software Engineering';
}

export class MuseClient {
  readonly source = 'themuse' as const;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MuseOptions = {}) {
    this.apiKey = opts.apiKey ?? import.meta.env.VITE_MUSE_API_KEY ?? '';
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  /** Always usable — no key required. */
  isConfigured(): boolean {
    return true;
  }

  async search(q: JobSearchQuery): Promise<Job[]> {
    const params = new URLSearchParams({
      page: String(q.page ?? 1),
      category: pickCategory(q.keywords),
    });
    if (q.location) params.set('location', q.location);
    if (this.apiKey) params.set('api_key', this.apiKey);

    const url = `https://www.themuse.com/api/public/jobs?${params.toString()}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Muse ${res.status}: ${text || res.statusText}`);
    }
    const data = (await res.json()) as MuseResponse;
    return (data.results ?? [])
      .map((r) => normalizeMuse(r, q.keywords))
      .filter((j) => j.url);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMuse(
  r: NonNullable<MuseResponse['results']>[number],
  keywords: string,
): Job {
  const lowerKw = keywords.toLowerCase().split(/\s+/).filter(Boolean);
  const lowerTitle = (r.name ?? '').toLowerCase();
  const matchesKeyword =
    lowerKw.length === 0 ||
    lowerKw.some((k) => lowerTitle.includes(k));

  return {
    id: `themuse:${r.id}`,
    source: 'themuse',
    title: (r.name ?? 'Untitled').trim(),
    company: r.company?.name ?? 'Unknown company',
    location: (r.locations ?? []).map((l) => l.name).filter(Boolean).join(' / '),
    description: stripHtml(r.contents ?? '').slice(0, 1500),
    url: r.refs?.landing_page ?? '',
    posted: r.publication_date,
    tags: r.levels?.map((l) => l.name ?? '').filter(Boolean),
    // We DON'T filter by keyword here — caller can do that. We just leave a
    // hint by ranking — the aggregator scores all jobs anyway.
    remote: matchesKeyword ? undefined : undefined,
  };
}
