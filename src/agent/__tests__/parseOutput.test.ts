import { describe, it, expect } from 'vitest';
import { parseAgentOutput } from '../parseOutput';

describe('parseAgentOutput — section splitting', () => {
  it('splits a well-formed three-section response', () => {
    const raw = [
      '## OUTPUT 1: OPTIMIZED RESUME',
      'Jane Doe — Senior Engineer',
      'Skills: TypeScript, React',
      '',
      '## OUTPUT 2: COVER LETTER',
      'Dear Hiring Manager,',
      'I am excited to apply.',
      '',
      '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
      'Q: Tell me about yourself.',
      'A: STAR-style answer here.',
    ].join('\n');

    const out = parseAgentOutput(raw);
    expect(out.optimizedResume).toContain('Jane Doe');
    expect(out.coverLetter).toContain('Dear Hiring Manager');
    expect(out.interviewPrep).toContain('Tell me about yourself');
    expect(out.resumeData).toBeUndefined();
    expect(out.raw).toBe(raw);
  });

  it('is tolerant of case and whitespace in headings', () => {
    const raw = [
      '##  output 1: optimized resume   ',
      'resume body',
      '##  Output 2:  Cover Letter',
      'cover body',
      '## OUTPUT 3: INTERVIEW PREPARATION',
      'interview body',
    ].join('\n');
    const out = parseAgentOutput(raw);
    expect(out.optimizedResume).toBe('resume body');
    expect(out.coverLetter).toBe('cover body');
    expect(out.interviewPrep).toBe('interview body');
  });

  it('handles a missing cover letter gracefully', () => {
    const raw = [
      '## OUTPUT 1: OPTIMIZED RESUME',
      'resume only',
      '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
      'interview only',
    ].join('\n');
    const out = parseAgentOutput(raw);
    expect(out.optimizedResume).toBe('resume only');
    expect(out.coverLetter).toBe('');
    expect(out.interviewPrep).toBe('interview only');
  });

  it('falls back to placing everything in resume when no headings are present', () => {
    const raw = 'free-form text without any heading';
    const out = parseAgentOutput(raw);
    expect(out.optimizedResume).toBe(raw);
    expect(out.coverLetter).toBe('');
    expect(out.interviewPrep).toBe('');
  });

  it('normalizes Windows line endings', () => {
    const raw = '## OUTPUT 1: OPTIMIZED RESUME\r\nbody\r\n';
    const out = parseAgentOutput(raw);
    expect(out.optimizedResume).toBe('body');
  });
});

describe('parseAgentOutput — structured resume JSON', () => {
  const validJson = `{
    "name": "Jane Doe",
    "title": "Senior Engineer",
    "contact": { "email": "jane@example.com" },
    "coreSkills": [{ "label": "Frontend", "values": ["React"] }],
    "experience": [{ "role": "Eng", "company": "ACME", "dates": "2024–", "bullets": ["Did things"] }],
    "education": [],
    "certifications": [],
    "languages": ["English"]
  }`;

  it('extracts a fenced ```json RESUME block into resumeData', () => {
    const raw = [
      '## OUTPUT 1: OPTIMIZED RESUME',
      'plain text resume',
      '',
      '```json RESUME',
      validJson,
      '```',
      '',
      '## OUTPUT 2: COVER LETTER',
      'cover',
      '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
      'prep',
    ].join('\n');

    const out = parseAgentOutput(raw);
    expect(out.resumeData).toBeDefined();
    expect(out.resumeData?.name).toBe('Jane Doe');
    expect(out.resumeData?.contact.email).toBe('jane@example.com');
    expect(out.resumeData?.coreSkills[0].values).toContain('React');
    // The fenced block should be stripped from the human-readable resume.
    expect(out.optimizedResume).not.toContain('```json');
    expect(out.optimizedResume).toContain('plain text resume');
  });

  it('also accepts plain ```json without the RESUME tag', () => {
    const raw = [
      '## OUTPUT 1: OPTIMIZED RESUME',
      'text',
      '```json',
      validJson,
      '```',
      '## OUTPUT 2: COVER LETTER',
      'c',
      '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
      'i',
    ].join('\n');
    expect(parseAgentOutput(raw).resumeData?.name).toBe('Jane Doe');
  });

  it('leaves resumeData undefined when JSON is malformed', () => {
    const raw = [
      '## OUTPUT 1: OPTIMIZED RESUME',
      'text',
      '```json RESUME',
      '{ "name": "broken" ', // missing closing brace
      '```',
      '## OUTPUT 2: COVER LETTER',
      'c',
      '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
      'i',
    ].join('\n');
    const out = parseAgentOutput(raw);
    expect(out.resumeData).toBeUndefined();
    expect(out.optimizedResume).toContain('text');
    expect(out.optimizedResume).not.toContain('```json');
  });

  it('fills in missing arrays with empty defaults so the PDF stays safe', () => {
    const minimalJson = `{ "name": "Solo", "contact": {} }`;
    const raw = [
      '## OUTPUT 1: OPTIMIZED RESUME',
      'r',
      '```json RESUME',
      minimalJson,
      '```',
      '## OUTPUT 2: COVER LETTER',
      'c',
      '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
      'i',
    ].join('\n');
    const out = parseAgentOutput(raw);
    expect(out.resumeData?.coreSkills).toEqual([]);
    expect(out.resumeData?.experience).toEqual([]);
    expect(out.resumeData?.education).toEqual([]);
    expect(out.resumeData?.certifications).toEqual([]);
    expect(out.resumeData?.languages).toEqual([]);
  });
});
