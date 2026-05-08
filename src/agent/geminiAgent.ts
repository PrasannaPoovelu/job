import type { Agent, AgentInput, AgentOutput, ProviderId } from '../types';
import { SYSTEM_PROMPT, buildUserMessage } from './systemPrompt';
import { parseAgentOutput } from './parseOutput';

/**
 * Google Gemini provider via the OpenAI-compatible endpoint.
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
 *
 * No SDK dependency — we use plain fetch so the bundle stays small.
 *
 * Free tier (May 2026):
 *   • Gemini 2.5 Flash-Lite — 1,000 req/day, 15 RPM, 250k TPM
 *   • Gemini 2.5 Flash      — 250 req/day,   10 RPM
 *   • Gemini 2.5 Pro        — 100 req/day,    5 RPM
 *
 * Get a key at https://aistudio.google.com/app/apikey (no credit card).
 */

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

export interface GeminiAgentOptions {
  apiKey?: string;
  model?: string;
  /** Inject a fake fetch in tests. */
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
}

export class GeminiAgent implements Agent {
  readonly providerId: ProviderId = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(opts: GeminiAgentOptions = {}) {
    this.apiKey = opts.apiKey ?? import.meta.env.VITE_GEMINI_API_KEY ?? '';
    if (!this.apiKey) {
      throw new Error(
        'Missing Gemini API key. Set VITE_GEMINI_API_KEY in .env.local — get one free at https://aistudio.google.com/app/apikey',
      );
    }
    this.model =
      opts.model ?? import.meta.env.VITE_GEMINI_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.endpoint = opts.endpoint ?? ENDPOINT;
  }

  /** Generic single-shot completion — used by recruiter / job scorer. */
  async ask(systemPrompt: string, userMessage: string): Promise<string> {
    const res = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${errText || res.statusText}`);
    }
    const data = (await res.json()) as OpenAIChatResponse;
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  async run(input: AgentInput): Promise<AgentOutput> {
    if (!input.jobDescription.trim()) {
      throw new Error('Job description is empty.');
    }
    if (!input.resume.trim()) {
      throw new Error('Resume is empty.');
    }

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildUserMessage({
            jobDescription: input.jobDescription,
            resume: input.resume,
            region: input.region,
          }),
        },
      ],
      max_tokens: 4096,
      temperature: 0.4,
    };

    const res = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${errText || res.statusText}`);
    }

    const data = (await res.json()) as OpenAIChatResponse;
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new Error('The Gemini model returned an empty response.');
    }
    return parseAgentOutput(text);
  }
}
