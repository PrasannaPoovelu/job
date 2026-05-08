import { describe, it, expect, vi } from 'vitest';
import { JSearchClient } from '../jsearch';

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

describe('JSearchClient', () => {
  it('reports as not configured without an API key', () => {
    expect(new JSearchClient({ apiKey: '' }).isConfigured()).toBe(false);
  });

  it('throws on search() with no key', async () => {
    const c = new JSearchClient({ apiKey: '' });
    await expect(c.search({ keywords: 'react' })).rejects.toThrow(
      /not configured/i,
    );
  });

  it('builds the query string and posts the right RapidAPI headers', async () => {
    const fetchImpl = fakeFetch({
      data: [
        {
          job_id: 'idx1',
          job_title: 'Senior React Developer',
          employer_name: 'Acme',
          job_apply_link: 'https://indeed.com/viewjob?jk=x',
          job_city: 'Bangalore',
          job_country: 'IN',
          job_description: 'React + TypeScript role',
          job_publisher: 'Indeed',
          job_employment_type: 'FULLTIME',
          job_is_remote: false,
          job_min_salary: 1500000,
          job_max_salary: 2500000,
          job_salary_currency: 'INR',
          job_salary_period: 'YEAR',
        },
      ],
    });

    const c = new JSearchClient({ apiKey: 'rapid-key', fetchImpl });
    const out = await c.search({
      keywords: 'React Developer',
      location: 'India',
      page: 1,
    });

    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('jsearch');
    expect(out[0].title).toBe('Senior React Developer');
    expect(out[0].company).toBe('Acme');
    expect(out[0].location).toBe('Bangalore, IN');
    expect(out[0].url).toBe('https://indeed.com/viewjob?jk=x');
    expect(out[0].salary).toContain('INR');

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(call[0]).toContain('jsearch.p.rapidapi.com/search');
    expect(call[0]).toContain('query=React+Developer+in+India');
    expect(call[1].headers['x-rapidapi-key']).toBe('rapid-key');
    expect(call[1].headers['x-rapidapi-host']).toBe('jsearch.p.rapidapi.com');
  });

  it('drops items without title or url', async () => {
    const fetchImpl = fakeFetch({
      data: [
        { job_title: 'No url' }, // missing apply link
        { job_apply_link: 'https://x.com/y' }, // missing title
        { job_title: 'Good', job_apply_link: 'https://x.com/g' },
      ],
    });
    const c = new JSearchClient({ apiKey: 'k', fetchImpl });
    const out = await c.search({ keywords: 'x' });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Good');
  });

  it('surfaces non-2xx errors', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('quota exceeded', {
          status: 429,
          statusText: 'Too Many Requests',
        }),
    ) as unknown as typeof fetch;
    const c = new JSearchClient({ apiKey: 'k', fetchImpl });
    await expect(c.search({ keywords: 'x' })).rejects.toThrow(/429/);
  });

  it('handles a malformed response gracefully', async () => {
    const fetchImpl = fakeFetch({});
    const c = new JSearchClient({ apiKey: 'k', fetchImpl });
    const out = await c.search({ keywords: 'x' });
    expect(out).toEqual([]);
  });
});
