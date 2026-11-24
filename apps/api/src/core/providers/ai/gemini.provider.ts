import type { AICompletionRequest, AICompletionResult, AIProvider } from './ai.interface';

/**
 * Google Gemini AI provider.
 * Uses the Gemini REST API (v1beta / generateContent).
 */
export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly apiKey: string) {}

  private mapModel(model: string): string {
    // Normalise common aliases and fallback to actual Gemini model names
    const aliases: Record<string, string> = {
      'gemini': 'gemini-3.6-flash',
      'gemini-pro': 'gemini-3.8-flash',
      'gemini-flash': 'gemini-3.6-flash',
      'gpt-4o-mini': 'gemini-3.6-flash',
      'gpt-4o': 'gemini-3.8-flash',
    };
    return aliases[model] ?? (model.startsWith('gemini') ? model : 'gemini-3.6-flash');
  }

  matches(model: string): boolean {
    return model.startsWith('gemini');
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const model = this.mapModel(req.model ?? 'gemini-3.6-flash');

    // Gemini uses a different message format: system instruction + contents
    const systemMsg = req.messages.find((m) => m.role === 'system');
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
      },
    };

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      signal: req.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('') ?? '';

    return {
      text,
      model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount ?? 0,
            completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }

  async embed(req: { model?: string; input: string[] }) {
    const model = req.model ?? 'text-embedding-004';
    const vectors: number[][] = [];

    // Gemini embedding API handles one text at a time
    for (const text of req.input) {
      const url = `${this.baseUrl}/models/${model}:embedContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      });
      if (!res.ok) throw new Error(`Gemini embeddings ${res.status}`);
      const data = (await res.json()) as { embedding?: { values?: number[] } };
      vectors.push(data.embedding?.values ?? []);
    }

    return { vectors };
  }
}
