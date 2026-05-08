import { describe, it, expect, vi } from 'vitest';
import { JobAggregator } from '../aggregator';
import type { Job, JobSearchQuery, ResumeProfile } from '../types';

function fakeClient(source: 'adzuna' | 'themuse' | 'remotive', jobs: Job[]) {
  return {
    source,
    isConfigured: () => true,
    search: vi.fn(async (_q: JobSearchQuery) => jobs),
  };
}

const profile: ResumeProfile = {
  primaryRole: 'Senior Front-End Developer',
  alternativeRoles: ['React Engineer'],
  seniority: 'senior',
  yearsExperience: 5,
  topSkills: ['React', 'TypeScript'],
  targetLocations: ['India', 'Remote'],
  industryFit: ['SaaS'],
};

describe('JobAggregator.buildQueries', () => {
  it('caps at 4 queries (2 roles × 2 locations)', () => {
    const qs = JobAggregator.buildQueries(profile);
    expect(qs.length).toBeLessThanOrEqual(4);
    expect(qs[0].keywords).toBe('Senior Front-End Developer');
    expect(qs[0].location).toBe('India');
  });

  it('falls back to a generic query when profile is empty', () => {
    const qs = JobAggregator.buildQueries({
      primaryRole: '',
      alternativeRoles: [],
      seniority: 'unknown',
      yearsExperience: 0,
      topSkills: [],
      targetLocations: [],
      industryFit: [],
    });
    expect(qs).toHaveLength(1);
    expect(qs[0].keywords).toBe('engineer');
  });
});

describe('JobAggregator.search', () => {
  const sampleJob = (id: string, source: Job['source'], url = `https://example.com/job/${id}`): Job => ({
    id,
    source,
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'India',
    description: 'React + TypeScript work',
    url,
  });

  it('runs all configured clients and returns deduped, capped jobs', async () => {
    const adzuna = fakeClient('adzuna', [
      sampleJob('a1', 'adzuna'),
      sampleJob('a2', 'adzuna'),
    ]);
    const muse = fakeClient('themuse', [sampleJob('m1', 'themuse')]);
    const agg = new JobAggregator({ clients: [adzuna, muse], maxTotal: 50 });

    const out = await agg.search(profile);
    // 2 search queries × 2 sources = 4 calls. Each returns the same fixture.
    expect(out.length).toBeGreaterThan(0);
    const urls = out.map((j) => j.url);
    expect(new Set(urls).size).toBe(urls.length); // deduped
  });

  it('captures per-source errors and continues', async () => {
    const broken = {
      source: 'adzuna' as const,
      isConfigured: () => true,
      search: vi.fn(async () => {
        throw new Error('rate limit');
      }),
    };
    const ok = fakeClient('themuse', [sampleJob('m1', 'themuse')]);
    const agg = new JobAggregator({ clients: [broken, ok] });

    const jobs = await agg.search(profile);
    expect(jobs.length).toBeGreaterThan(0);
    expect(agg.lastErrors.adzuna).toMatch(/rate limit/);
  });

  it('skips link-less jobs', async () => {
    const noLink = fakeClient('themuse', [
      { ...sampleJob('m1', 'themuse'), url: '' },
    ]);
    const agg = new JobAggregator({ clients: [noLink] });
    const jobs = await agg.search(profile);
    expect(jobs).toHaveLength(0);
  });
});
