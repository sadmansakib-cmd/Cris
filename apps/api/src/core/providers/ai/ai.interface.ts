export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  user: { id: string };
  signal?: AbortSignal;
}

export interface AICompletionResult {
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AIProvider {
  readonly id: string;
  complete(req: AICompletionRequest): Promise<AICompletionResult>;
  embed?(req: { model?: string; input: string[] }): Promise<{ vectors: number[][] }>;
}
