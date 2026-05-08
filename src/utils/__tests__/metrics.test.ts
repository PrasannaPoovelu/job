import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  containsTerm,
  extractJdKeywords,
} from '../metrics';

describe('containsTerm', () => {
  it('matches whole words case-insensitively', () => {
    expect(containsTerm('I use TypeScript daily', 'typescript')).toBe(true);
    expect(containsTerm('javascripting is fun', 'JavaScript')).toBe(false);
  });
  it('handles dotted terms like "Node.js" or "Next.js"', () => {
    expect(containsTerm('built with Node.js', 'Node.js')).toBe(true);
    expect(containsTerm('node js without dot', 'Node.js')).toBe(false);
  });
  it('returns false for empty term', () => {
    expect(containsTerm('anything', '')).toBe(false);
  });
});

describe('extractJdKeywords', () => {
  it('finds catalogue terms case-insensitively', () => {
    const out = extractJdKeywords(
      'We need react, TypeScript, and AWS plus Kubernetes.',
    );
    expect(out).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'AWS', 'Kubernetes']),
    );
  });

  it('also catches multi-cap phrases not in the catalogue', () => {
    const out = extractJdKeywords(
      'Familiarity with Spring Boot and GitLab Duo AI is a plus.',
    );
    // Spring Boot is in the catalogue.
    expect(out).toContain('Spring Boot');
    // GitLab Duo AI should be detected via the multi-cap fallback.
    expect(out.some((k) => k.toLowerCase().includes('gitlab duo'))).toBe(true);
  });

  it('caps results at the requested limit', () => {
    const long =
      'TypeScript React Node.js Python Java Go Rust SQL AWS Docker Kubernetes Git Agile Scrum Vue Angular';
    expect(extractJdKeywords(long, 4)).toHaveLength(4);
  });
});

describe('computeMetrics', () => {
  const jd = `Senior React Engineer
We need TypeScript, React, AWS, and Kubernetes experience.
Bonus: Tailwind CSS and CI/CD knowledge.`;

  it('reports a higher after-match when the optimized resume covers more keywords', () => {
    const original = 'Built React apps and used Jenkins.';
    const optimized = `
- Built React + TypeScript apps deployed to AWS
- Wrote Kubernetes manifests and Tailwind CSS UIs
- 30% performance improvement on critical pages
- 200,000 monthly active users supported
- CI/CD pipelines hardened
    `.trim();
    const m = computeMetrics(jd, original, optimized);
    expect(m.afterMatchPct).toBeGreaterThan(m.beforeMatchPct);
    expect(m.keywordsAdded).toEqual(
      expect.arrayContaining(['TypeScript', 'AWS', 'Kubernetes']),
    );
    expect(m.keywordsAdded).not.toContain('React'); // already present
    expect(m.atsScore).toBeGreaterThan(40);
    expect(m.atsScore).toBeLessThanOrEqual(100);
  });

  it('reports 0% when neither resume mentions any JD keyword', () => {
    const m = computeMetrics(jd, 'irrelevant', 'still irrelevant');
    expect(m.beforeMatchPct).toBe(0);
    expect(m.afterMatchPct).toBe(0);
    expect(m.keywordsAdded).toEqual([]);
  });

  it('handles a JD with no detectable keywords gracefully', () => {
    const m = computeMetrics('we want a great person', 'r', 'r2');
    expect(m.jdKeywords).toEqual([]);
    expect(m.beforeMatchPct).toBe(0);
    expect(m.afterMatchPct).toBe(0);
    expect(m.atsScore).toBeGreaterThanOrEqual(0);
  });

  it('lists missing keywords correctly', () => {
    const m = computeMetrics(
      'TypeScript AWS Kubernetes Docker',
      'I know Java',
      'I optimized with TypeScript and Docker',
    );
    expect(m.keywordsMissing).toEqual(
      expect.arrayContaining(['AWS', 'Kubernetes']),
    );
    expect(m.keywordsMissing).not.toContain('TypeScript');
    expect(m.keywordsMissing).not.toContain('Docker');
  });
});
