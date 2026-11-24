import type { AICompletionRequest, AICompletionResult, AIProvider } from './ai.interface';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  private readonly baseUrl = 'https://api.anthropic.com/v1';

  constructor(private readonly apiKey: string) {}

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const model = req.model ?? 'claude-3-5-sonnet-latest';
    const system = req.messages.find((m) => m.role === 'system')?.content;
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      signal: req.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system,
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 4096,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      content: { type: string; text: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };
    return {
      text: data.content.filter((c) => c.type === 'text').map((c) => c.text).join(''),
      model,
      usage: data.usage
        ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens }
        : undefined,
    };
  }
}
