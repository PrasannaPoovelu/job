import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT, buildUserMessage } from '../systemPrompt';

describe('SYSTEM_PROMPT', () => {
  it('contains the required output contract headings', () => {
    expect(SYSTEM_PROMPT).toContain('## OUTPUT 1: OPTIMIZED RESUME');
    expect(SYSTEM_PROMPT).toContain('## OUTPUT 2: COVER LETTER');
    expect(SYSTEM_PROMPT).toContain('## OUTPUT 3: INTERVIEW PREPARATION GUIDE');
  });

  it('mentions all required regions', () => {
    for (const region of ['USA', 'UK', 'Europe', 'India']) {
      expect(SYSTEM_PROMPT).toContain(region);
    }
  });

  it('forbids fabrication of experience', () => {
    expect(SYSTEM_PROMPT).toMatch(/DO NOT hallucinate/);
  });
});

describe('buildUserMessage', () => {
  it('wraps inputs in delimited blocks and includes the region', () => {
    const msg = buildUserMessage({
      jobDescription: '  Senior TypeScript role  ',
      resume: '  Jane Doe — engineer  ',
      region: 'UK',
    });
    expect(msg).toContain('TARGET REGION: UK');
    expect(msg).toContain('<job_description>');
    expect(msg).toContain('Senior TypeScript role');
    expect(msg).toContain('</job_description>');
    expect(msg).toContain('<candidate_resume>');
    expect(msg).toContain('Jane Doe — engineer');
    expect(msg).toContain('</candidate_resume>');
    // Trims surrounding whitespace inside the blocks.
    expect(msg).not.toContain('  Senior TypeScript role  ');
  });
});
