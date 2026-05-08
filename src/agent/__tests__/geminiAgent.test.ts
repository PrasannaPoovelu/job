import { describe, it, expect, vi } from 'vitest';
import { GeminiAgent } from '../geminiAgent';

const FULL_REPLY = [
  '## OUTPUT 1: OPTIMIZED RESUME',
  'resume body',
  '## OUTPUT 2: COVER LETTER',
  'cover body',
  '## OUTPUT 3: INTERVIEW PREPARATION GUIDE',
  'interview body',
].join('\n');

function makeFakeFetch(replyText: string, status = 200): typeof fetch {
  return vi.fn(async () => {
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: replyText } }],
      }),
      { status, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

describe('GeminiAgent', () => {
  it('parses a successful chat-completion response', async () => {
    const fetchImpl = makeFakeFetch(FULL_REPLY);
    const agent = new GeminiAgent({
      apiKey: 'test-key',
      model: 'gemini-test',
      fetchImpl,
    });

    const out = await agent.run({
      jobDescription: 'A great job',
      resume: 'My resume',
      region: 'USA',
    });

    expect(out.optimizedResume).toBe('resume body');
    expect(out.coverLetter).toBe('cover body');
    expect(out.interviewPrep).toBe('interview body');
    expect(agent.providerId).toBe('gemini');

    // Ensure the request body included the prompt + region.
    const callArgs = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe('gemini-test');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toMatch(/TARGET REGION: USA/);
  });

  it('throws on a non-2xx response with body text', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('quota exceeded', {
          status: 429,
          statusText: 'Too Many Requests',
        }),
    ) as unknown as typeof fetch;
    const agent = new GeminiAgent({
      apiKey: 'k',
      fetchImpl,
    });
    await expect(
      agent.run({ jobDescription: 'jd', resume: 'r', region: 'USA' }),
    ).rejects.toThrow(/429/);
  });

  it('throws when no API key is configured', () => {
    expect(
      () => new GeminiAgent({ apiKey: '' }),
    ).toThrow(/Missing Gemini API key/);
  });

  it('throws on empty inputs', async () => {
    const agent = new GeminiAgent({
      apiKey: 'k',
      fetchImpl: makeFakeFetch(FULL_REPLY),
    });
    await expect(
      agent.run({ jobDescription: '', resume: 'r', region: 'USA' }),
    ).rejects.toThrow(/Job description is empty/);
    await expect(
      agent.run({ jobDescription: 'j', resume: '', region: 'USA' }),
    ).rejects.toThrow(/Resume is empty/);
  });

  it('throws when the model returns no content', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;
    const agent = new GeminiAgent({ apiKey: 'k', fetchImpl });
    await expect(
      agent.run({ jobDescription: 'j', resume: 'r', region: 'USA' }),
    ).rejects.toThrow(/empty response/);
  });
});
