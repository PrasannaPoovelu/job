import { describe, it, expect, vi } from 'vitest';
import { JobApplicationAgent, type AnthropicLike } from '../agent';

function makeFakeClient(replyText: string): AnthropicLike {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: replyText }],
      }),
    },
  };
}

const FULL_REPLY = [
  '## OUTPUT 1: OPTIMIZED RESUME',
  'resume body',
  '## OUTPUT 2: COVER LETTER',
  'cover body',
  '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
  'interview body',
].join('\n');

describe('JobApplicationAgent', () => {
  it('runs end-to-end with a fake client and returns parsed sections', async () => {
    const client = makeFakeClient(FULL_REPLY);
    const agent = new JobApplicationAgent({ client, model: 'test-model' });

    const out = await agent.run({
      jobDescription: 'A great job',
      resume: 'My resume',
      region: 'USA',
    });

    expect(out.optimizedResume).toBe('resume body');
    expect(out.coverLetter).toBe('cover body');
    expect(out.interviewPrep).toBe('interview body');
    expect(agent.providerId).toBe('anthropic');

    // Ensure the model + system prompt were forwarded.
    const callArgs = (client.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(callArgs.model).toBe('test-model');
    expect(callArgs.system).toMatch(/AI Job Application Optimization Agent/);
    expect(callArgs.messages[0].content).toMatch(/TARGET REGION: USA/);
  });

  it('throws on empty job description', async () => {
    const agent = new JobApplicationAgent({
      client: makeFakeClient(FULL_REPLY),
    });
    await expect(
      agent.run({ jobDescription: '   ', resume: 'r', region: 'USA' }),
    ).rejects.toThrow(/Job description is empty/);
  });

  it('throws on empty resume', async () => {
    const agent = new JobApplicationAgent({
      client: makeFakeClient(FULL_REPLY),
    });
    await expect(
      agent.run({ jobDescription: 'jd', resume: '   ', region: 'USA' }),
    ).rejects.toThrow(/Resume is empty/);
  });

  it('throws when the model returns no text content', async () => {
    const client: AnthropicLike = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [] }),
      },
    };
    const agent = new JobApplicationAgent({ client });
    await expect(
      agent.run({ jobDescription: 'jd', resume: 'r', region: 'USA' }),
    ).rejects.toThrow(/empty response/);
  });
});
