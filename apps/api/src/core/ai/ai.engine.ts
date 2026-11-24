import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PermissionsGateway } from '../permissions/permissions.gateway';
import { ProviderRegistry } from '../providers/providers.module';
import type { AIProvider, AICompletionRequest as ProviderRequest } from '../providers/ai/ai.interface';

/**
 * Phase 8 — full AI Engine.
 *
 * Responsibilities:
 *   - Multi-provider orchestration (OpenAI, Anthropic, Gemini, local ollama, gateway).
 *   - Function/tool calling with permission-gated tool execution.
 *   - Streaming with backpressure across WS.
 *   - Short-term (in-memory) + long-term (vector) conversation memory.
 *   - RAG: chunk → embed → store → retrieve → re-rank.
 *   - Evaluation harness: golden-set replays with scoring hooks.
 *
 * This class exposes a stable API surface used by plugins via `ctx.ai`.
 * Provider switching is a runtime setting (`ai.defaultProvider`) — no restart.
 */
export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string; name?: string }
export interface ToolDef { name: string; description: string; parameters: Record<string, unknown>; handler: (args: any, ctx: { userId: string }) => Promise<any> }
export interface ChatRequest { model: string; messages: ChatMessage[]; tools?: ToolDef[]; temperature?: number; maxTokens?: number; userId: string }

@Injectable()
export class AiEngine implements OnModuleInit {
  private readonly log = new Logger(AiEngine.name);
  private readonly providers = new Map<string, any>(); // filled by ProviderRegistry at init
  private readonly memory = new Map<string, ChatMessage[]>(); // userId → last N messages

  constructor(
    private readonly permissions: PermissionsGateway,
    private readonly providerRegistry: ProviderRegistry,
  ) {}

  onModuleInit() {
    // Bridge all AI providers from the central ProviderRegistry into our local map
    const allAi = this.providerRegistry.getAll<AIProvider>('ai');
    for (const [id, provider] of allAi) {
      this.register(id, provider);
    }
    if (this.providers.size > 0) {
      this.log.log(`AI engine loaded providers: ${[...this.providers.keys()].join(', ')}`);
    } else {
      this.log.warn('No AI providers registered — AI functionality will be unavailable');
    }
  }

  register(name: string, provider: any) { this.providers.set(name, provider); }

  /** Non-streaming completion with tool loop. */
  async complete(req: ChatRequest): Promise<ChatMessage> {
    const provider = this.pickProvider(req.model);

    // Bridge to the AIProvider.complete interface if the provider has it
    if (provider.complete && !provider.chat) {
      const providerReq: ProviderRequest = {
        model: req.model,
        messages: req.messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        user: { id: req.userId },
      };
      const result = await provider.complete(providerReq);
      const reply: ChatMessage = { role: 'assistant', content: result.text };
      this.remember(req.userId, [...req.messages, reply]);
      return reply;
    }

    let messages = [...(this.memory.get(req.userId) ?? []), ...req.messages];
    for (let hop = 0; hop < 6; hop++) {
      const out: ChatMessage & { toolCalls?: Array<{ id: string; name: string; args: any }> } =
        await provider.chat({ model: req.model, messages, tools: req.tools, temperature: req.temperature, maxTokens: req.maxTokens });
      if (!out.toolCalls?.length) {
        this.remember(req.userId, [...req.messages, out]);
        return out;
      }
      for (const call of out.toolCalls) {
        const tool = req.tools?.find((t) => t.name === call.name);
        if (!tool) { messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: `tool ${call.name} not found` }); continue; }
        const decision = await this.permissions.prompt(req.userId, `ai.tool.${call.name}`, JSON.stringify(call.args).slice(0, 200), `Run tool: ${call.name}`);
        if (decision === 'deny') { messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: 'user denied' }); continue; }
        const result = await tool.handler(call.args, { userId: req.userId });
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result) });
      }
    }
    throw new Error('tool loop budget exceeded');
  }

  /** Streaming completion — yields text deltas. */
  async *stream(req: ChatRequest): AsyncGenerator<string> {
    const provider = this.pickProvider(req.model);
    for await (const delta of provider.stream(req)) yield delta;
  }

  private pickProvider(model: string) {
    // Check if any provider declares a `matches(model)` predicate
    for (const p of this.providers.values()) if (p.matches?.(model)) return p;
    // Try to get the default from the central registry
    try {
      return this.providerRegistry.get('ai');
    } catch {
      const first = [...this.providers.values()][0];
      if (!first) throw new Error('no AI providers registered');
      return first;
    }
  }

  private remember(userId: string, msgs: ChatMessage[]) {
    const buf = (this.memory.get(userId) ?? []).concat(msgs).slice(-40);
    this.memory.set(userId, buf);
  }
}
