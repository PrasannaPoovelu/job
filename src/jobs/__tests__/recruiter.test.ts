import { describe, it, expect, vi } from 'vitest';
import {
  categorizeJobs,
  extractResumeProfile,
  heuristicProfile,
  scoreJobs,
} from '../recruiter';
import type { Job, ResumeProfile, ScoredJob } from '../types';

const SAMPLE_RESUME = `Jane Doe
Senior Front-End Developer · React.js & TypeScript Specialist
5+ years building enterprise web applications.

Skills: React.js, TypeScript, Tailwind CSS, Redux Toolkit, AWS, GitLab.`;

describe('heuristicProfile (fallback when no LLM)', () => {
  it('infers seniority and primary role from resume text', () => {
    const p = heuristicProfile(SAMPLE_RESUME);
    expect(p.seniority).toBe('senior');
    expect(p.yearsExperience).toBe(5);
    expect(p.primaryRole).toMatch(/Front-End/);
    expect(p.topSkills).toEqual(
      expect.arrayContaining(['React.js', 'TypeScript', 'Tailwind CSS']),
    );
    expect(p.targetLocations).toContain('India');
  });

  it('handles a resume with no years mentioned', () => {
    const p = heuristicProfile('Junior dev keen on React');
    expect(p.yearsExperience).toBe(3);
    expect(p.primaryRole).toMatch(/Front-End/);
  });
});

describe('extractResumeProfile (LLM path)', () => {
  it('parses a fenced JSON block from the LLM', async () => {
    const ask = vi.fn(async () => `\`\`\`json
{
  "primaryRole": "Senior React Engineer",
  "alternativeRoles": ["Front-End Engineer"],
  "seniority": "senior",
  "yearsExperience": 6,
  "topSkills": ["React", "TypeScript"],
  "targetLocations": ["India", "Remote"],
  "industryFit": ["Fintech"]
}
\`\`\``);
    const p = await extractResumeProfile(SAMPLE_RESUME, ask);
    expect(p.primaryRole).toBe('Senior React Engineer');
    expect(p.yearsExperience).toBe(6);
    expect(ask).toHaveBeenCalled();
  });

  it('falls back to heuristic when LLM returns junk', async () => {
    const ask = vi.fn(async () => 'no json here');
    const p = await extractResumeProfile(SAMPLE_RESUME, ask);
    expect(p.primaryRole).toMatch(/Front-End/);
  });

  it('falls back to heuristic when LLM throws', async () => {
    const ask = vi.fn(async () => {
      throw new Error('rate limit');
    });
    const p = await extractResumeProfile(SAMPLE_RESUME, ask);
    expect(p.seniority).toBe('senior');
  });
});

describe('scoreJobs', () => {
  const profile: ResumeProfile = {
    primaryRole: 'Senior Front-End Developer',
    alternativeRoles: [],
    seniority: 'senior',
    yearsExperience: 5,
    topSkills: ['react', 'typescript', 'tailwind css'],
    targetLocations: ['India'],
    industryFit: [],
  };

  const jobA: Job = {
    id: 'j1',
    source: 'adzuna',
    title: 'Senior Front-End Developer',
    company: 'A',
    location: 'India',
    description: 'We need React, TypeScript, Tailwind CSS experts.',
    url: 'https://example.com/a',
  };
  const jobB: Job = {
    id: 'j2',
    source: 'adzuna',
    title: 'Backend Java Engineer',
    company: 'B',
    location: 'India',
    description: 'Spring Boot and Kafka work.',
    url: 'https://example.com/b',
  };

  it('uses heuristic scoring when no ask fn is provided', async () => {
    const scored = await scoreJobs([jobA, jobB], profile, SAMPLE_RESUME, null);
    const a = scored.find((s) => s.id === 'j1')!;
    const b = scored.find((s) => s.id === 'j2')!;
    expect(a.fitScore).toBeGreaterThan(b.fitScore);
    expect(a.category === 'high' || a.category === 'medium').toBe(true);
  });

  it('uses heuristic when providerId is "demo" even if ask is provided', async () => {
    const ask = vi.fn();
    const scored = await scoreJobs([jobA], profile, SAMPLE_RESUME, ask, 'demo');
    expect(ask).not.toHaveBeenCalled();
    expect(scored).toHaveLength(1);
  });

  it('parses LLM batch response and clamps scores into [0,100]', async () => {
    const ask = vi.fn(async () => `\`\`\`json
{
  "scores": [
    { "id": "j1", "score": 92, "reasons": ["Strong skill match", "Same level"] },
    { "id": "j2", "score": 200, "reasons": ["Way out of range"] }
  ]
}
\`\`\``);
    const scored = await scoreJobs([jobA, jobB], profile, SAMPLE_RESUME, ask);
    expect(scored[0].fitScore).toBe(92);
    expect(scored[0].category).toBe('high');
    expect(scored[1].fitScore).toBe(100); // clamped
  });

  it('falls back to heuristic when LLM batch fails', async () => {
    const ask = vi.fn(async () => {
      throw new Error('boom');
    });
    const scored = await scoreJobs([jobA], profile, SAMPLE_RESUME, ask);
    expect(scored).toHaveLength(1);
    expect(typeof scored[0].fitScore).toBe('number');
  });
});

describe('categorizeJobs', () => {
  const j = (id: string, score: number): ScoredJob => ({
    id,
    source: 'adzuna',
    title: id,
    company: 'C',
    location: '',
    description: '',
    url: `https://example.com/${id}`,
    fitScore: score,
    fitReasons: [],
    category: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'stretch',
  });

  it('splits into the three buckets and sorts each desc by score', () => {
    const buckets = categorizeJobs([j('a', 80), j('b', 60), j('c', 30), j('d', 90), j('e', 55)]);
    expect(buckets.high.map((x) => x.id)).toEqual(['d', 'a']);
    expect(buckets.medium.map((x) => x.id)).toEqual(['b', 'e']);
    expect(buckets.stretch.map((x) => x.id)).toEqual(['c']);
  });
});
