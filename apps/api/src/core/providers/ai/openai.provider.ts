import type { AICompletionRequest, AICompletionResult, AIProvider } from './ai.interface';

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(private readonly apiKey: string) {}

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const model = req.model ?? 'gpt-4o-mini';
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: req.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens,
        user: req.user.id,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      text: data.choices[0]?.message.content ?? '',
      model,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
    };
  }

  async embed(req: { model?: string; input: string[] }) {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: req.model ?? 'text-embedding-3-small', input: req.input }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return { vectors: data.data.map((d) => d.embedding) };
  }
}
