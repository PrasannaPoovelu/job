import Anthropic from '@anthropic-ai/sdk';
import type { Agent, AgentInput, AgentOutput, ProviderId } from '../types';
import { SYSTEM_PROMPT, buildUserMessage } from './systemPrompt';
import { parseAgentOutput } from './parseOutput';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Minimal interface so we can stub the Anthropic client in tests.
 * Only exposes what the agent actually uses.
 */
export interface AnthropicLike {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: 'user'; content: string }[];
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}

export interface AgentOptions {
  /** Override the API key (otherwise read from VITE_ANTHROPIC_API_KEY). */
  apiKey?: string;
  /** Override the model id. */
  model?: string;
  /** Inject a fake client (used in tests). */
  client?: AnthropicLike;
}

export class JobApplicationAgent implements Agent {
  readonly providerId: ProviderId = 'anthropic';
  private readonly client: AnthropicLike;
  private readonly model: string;

  constructor(opts: AgentOptions = {}) {
    this.model =
      opts.model ?? import.meta.env.VITE_ANTHROPIC_MODEL ?? DEFAULT_MODEL;

    if (opts.client) {
      this.client = opts.client;
    } else {
      const apiKey = opts.apiKey ?? import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          'Missing Anthropic API key. Set VITE_ANTHROPIC_API_KEY in .env.local',
        );
      }
      // The browser SDK requires this opt-in flag because the key is exposed
      // to the page. For production you'd front this with a backend proxy.
      this.client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      }) as unknown as AnthropicLike;
    }
  }

  /** Generic single-shot completion — used by recruiter / job scorer. */
  async ask(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim();
  }

  /**
   * Run the agent end-to-end and return the three parsed sections.
   * Throws if the API call fails or if the response is empty.
   */
  async run(input: AgentInput): Promise<AgentOutput> {
    if (!input.jobDescription.trim()) {
      throw new Error('Job description is empty.');
    }
    if (!input.resume.trim()) {
      throw new Error('Resume is empty.');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserMessage({
            jobDescription: input.jobDescription,
            resume: input.resume,
            region: input.region,
          }),
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();

    if (!text) {
      throw new Error('The model returned an empty response.');
    }

    return parseAgentOutput(text);
  }
}
