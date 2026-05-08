import { describe, it, expect } from 'vitest';
import {
  DemoAgent,
  extractKeywords,
  extractCompany,
  extractRole,
  extractContact,
  extractName,
} from '../demoAgent';

describe('extractKeywords', () => {
  it('finds common tech keywords', () => {
    const out = extractKeywords(
      'We need TypeScript, React, and AWS expertise. Bonus: Kubernetes.',
    );
    expect(out).toEqual(expect.arrayContaining(['TypeScript', 'React', 'AWS', 'Kubernetes']));
  });

  it('returns an empty array when no keywords match', () => {
    expect(extractKeywords('We are looking for a great person.')).toEqual([]);
  });

  it('caps results at the requested limit', () => {
    const text =
      'TypeScript React Node.js Python Java Go Rust SQL AWS Docker Kubernetes Git Agile';
    expect(extractKeywords(text, 3)).toHaveLength(3);
  });

  it('deduplicates repeats', () => {
    const out = extractKeywords('React React React TypeScript');
    expect(out.filter((k) => k === 'React')).toHaveLength(1);
  });
});

describe('extractCompany / extractRole', () => {
  it('captures "at <Company>"', () => {
    expect(extractCompany('Senior engineer at Acme Corp.')).toBe('Acme Corp');
  });
  it('falls back to a generic placeholder when no match', () => {
    expect(extractCompany('Looking for a great engineer.')).toBe('the company');
  });
  it('returns the first non-empty line', () => {
    expect(
      extractRole('\n  Senior TypeScript Engineer  \nFull-time, remote'),
    ).toBe('Senior TypeScript Engineer');
  });
  it('truncates very long titles', () => {
    expect(extractRole('A '.repeat(100)).length).toBeLessThanOrEqual(70);
  });
});

describe('extractContact / extractName', () => {
  it('finds phone, email, linkedin, github from free text', () => {
    const r = `John Doe
Senior Engineer
+91 8015411102
john.doe@example.com
linkedin.com/in/johndoe
github.com/johndoe`;
    const c = extractContact(r);
    expect(c.email).toBe('john.doe@example.com');
    expect(c.phone).toMatch(/8015411102/);
    expect(c.linkedin).toContain('linkedin.com/in/johndoe');
    expect(c.github).toContain('github.com/johndoe');
  });
  it('uses the first non-contact line as the name', () => {
    expect(extractName('Jane Doe\nfoo@bar.com\n+1 555')).toBe('Jane Doe');
  });
});

describe('DemoAgent', () => {
  it('produces all three sections plus structured resumeData', async () => {
    const agent = new DemoAgent();
    const out = await agent.run({
      jobDescription:
        'Senior React Engineer at FooCorp\nLooking for TypeScript and AWS experience.',
      resume:
        'Jane Doe\n+1 555-123-4567\njane@example.com\nlinkedin.com/in/jane\nReact engineer',
      region: 'USA',
    });
    expect(out.optimizedResume).toContain('DEMO MODE');
    expect(out.coverLetter).toMatch(/Dear Hiring Manager/);
    expect(out.coverLetter).toContain('FooCorp');
    expect(out.interviewPrep).toMatch(/INTERVIEW PREPARATION GUIDE/);
    expect(out.resumeData).toBeDefined();
    expect(out.resumeData?.name).toBe('Jane Doe');
    expect(out.resumeData?.contact.email).toBe('jane@example.com');
    expect(out.resumeData?.coreSkills[0].values).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'AWS']),
    );
  });

  it('throws when inputs are empty', async () => {
    const agent = new DemoAgent();
    await expect(
      agent.run({ jobDescription: '', resume: 'r', region: 'USA' }),
    ).rejects.toThrow(/Job description is empty/);
    await expect(
      agent.run({ jobDescription: 'jd', resume: '', region: 'USA' }),
    ).rejects.toThrow(/Resume is empty/);
  });

  it('adds a summary in UK / Europe formats but not USA', async () => {
    const agent = new DemoAgent();
    const usa = await agent.run({
      jobDescription: 'a job',
      resume: 'r',
      region: 'USA',
    });
    const uk = await agent.run({
      jobDescription: 'a job',
      resume: 'r',
      region: 'UK',
    });
    expect(usa.resumeData?.summary).toBeUndefined();
    expect(uk.resumeData?.summary).toBeDefined();
  });

  it('reports providerId as "demo"', () => {
    expect(new DemoAgent().providerId).toBe('demo');
  });
});
