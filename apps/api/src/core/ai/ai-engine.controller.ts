import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';
import { RagService } from './rag.service';
import { MemoryVectorStore } from './memory-vector.store';
import { EvalService, type EvalCase } from './eval.service';

@UseGuards(JwtAuthGuard)
@Controller('ai/engine')
export class AiEngineController {
  constructor(
    private readonly rag: RagService,
    private readonly store: MemoryVectorStore,
    private readonly evals: EvalService,
  ) {}

  // RAG
  @Post('rag/index')
  index(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({
      namespace: z.string().min(1),
      docId: z.string().min(1),
      text: z.string().min(1),
      metadata: z.record(z.any()).optional(),
    })))
    body: { namespace: string; docId: string; text: string; metadata?: Record<string, any> },
  ) {
    return this.rag.index(`${userId}:${body.namespace}`, body.docId, body.text, body.metadata).then(() => ({ ok: true }));
  }

  @Post('rag/query')
  async query(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({
      namespace: z.string(),
      query: z.string(),
      k: z.number().int().min(1).max(50).optional(),
    })))
    body: { namespace: string; query: string; k?: number },
  ) {
    return this.rag.retrieve(`${userId}:${body.namespace}`, body.query, body.k ?? 6);
  }

  @Get('rag/namespaces')
  namespaces(@CurrentUser() userId: string) {
    return this.store.namespaces().filter((n) => n.ns.startsWith(`${userId}:`));
  }

  @Delete('rag/namespace/:ns')
  wipe(@CurrentUser() userId: string, @Param('ns') ns: string) {
    this.store.wipe(`${userId}:${ns}`);
    return { ok: true };
  }

  // Evaluation harness
  @Get('eval/datasets')
  datasets() {
    return this.evals.listDatasets();
  }

  @Post('eval/datasets')
  putDataset(
    @Body(new ZodValidationPipe(z.object({
      name: z.string(),
      cases: z.array(z.object({
        id: z.string(),
        prompt: z.string(),
        system: z.string().optional(),
        expected: z.string().optional(),
        contains: z.array(z.string()).optional(),
        regex: z.string().optional(),
        scorer: z.enum(['exact', 'contains', 'regex', 'judge']).optional(),
      })),
    })))
    body: { name: string; cases: EvalCase[] },
  ) {
    return this.evals.putDataset(body.name, body.cases);
  }

  @Get('eval/runs')
  runs() {
    return this.evals.listRuns();
  }

  @Get('eval/runs/:id')
  run(@Param('id') id: string) {
    return this.evals.getRun(id);
  }

  @Post('eval/run')
  execute(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ dataset: z.string(), model: z.string() })))
    body: { dataset: string; model: string },
  ) {
    return this.evals.run(body.dataset, body.model, userId);
  }
}
