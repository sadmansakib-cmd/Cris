import { Injectable } from '@nestjs/common';
import { AiEngine, type ChatMessage } from './ai.engine';
import { PrismaService } from '../prisma/prisma.module';

/**
 * Thin service layer above AiEngine that:
 *   - owns thread persistence (Chat + ChatMessage tables)
 *   - assembles the message history for each turn
 *   - streams deltas back to callers as an async iterator
 */
@Injectable()
export class AiService {
  constructor(private readonly engine: AiEngine, private readonly prisma: PrismaService) {}

  listThreads(userId: string) {
    return this.prisma.chatThread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, model: true, updatedAt: true },
    });
  }

  async createThread(userId: string, title = 'New chat', model = 'gpt-4o-mini') {
    return this.prisma.chatThread.create({ data: { userId, title, model } });
  }

  async getThread(userId: string, threadId: string) {
    const thread = await this.prisma.chatThread.findFirstOrThrow({
      where: { id: threadId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return thread;
  }

  async send(userId: string, threadId: string, content: string, model?: string) {
    const thread = await this.getThread(userId, threadId);
    const chosenModel = model ?? thread.model ?? 'gpt-4o-mini';

    await this.prisma.chatMessage.create({
      data: { threadId, role: 'user', content },
    });

    const history: ChatMessage[] = [
      { role: 'system', content: 'You are HAULT, a permission-gated AI operating system assistant.' },
      ...thread.messages.map((m: any) => ({ role: m.role as ChatMessage['role'], content: m.content })),
      { role: 'user', content },
    ];

    const reply = await this.engine.complete({
      model: chosenModel,
      messages: history,
      userId,
    });

    const saved = await this.prisma.chatMessage.create({
      data: { threadId, role: 'assistant', content: reply.content },
    });
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date(), model: chosenModel },
    });
    return saved;
  }
}
