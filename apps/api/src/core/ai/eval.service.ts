import { Injectable, Logger } from '@nestjs/common';
import { AiEngine, type ChatMessage } from './ai.engine';

/**
 * Evaluation harness — replays a golden dataset against the current
 * AI configuration and scores answers with cheap heuristics
 * (exact / contains / regex / length) plus optional LLM-as-judge.
 */

export interface EvalCase {
  id: string;
  prompt: string;
  system?: string;
  expected?: string;
  contains?: string[];
  regex?: string;
  scorer?: 'exact' | 'contains' | 'regex' | 'judge';
}
export interface EvalRun {
  id: string;
  model: string;
  startedAt: string;
  finishedAt?: string;
  results: Array<{
    caseId: string;
    output: string;
    score: number;
    passed: boolean;
    note?: string;
    latencyMs: number;
  }>;
  summary: { total: number; passed: number; avgScore: number; avgLatencyMs: number };
}

@Injectable()
export class EvalService {
  private readonly log = new Logger(EvalService.name);
  private readonly datasets = new Map<string, EvalCase[]>();
  private readonly runs: EvalRun[] = [];

  constructor(private readonly ai: AiEngine) {}

  putDataset(name: string, cases: EvalCase[]) {
    this.datasets.set(name, cases);
    return { name, size: cases.length };
  }
  listDatasets() {
    return [...this.datasets.entries()].map(([name, c]) => ({ name, size: c.length }));
  }
  listRuns() {
    return this.runs.slice(-50).reverse().map((r) => ({ ...r, results: undefined, resultsCount: r.results.length }));
  }
  getRun(id: string) {
    return this.runs.find((r) => r.id === id);
  }

  async run(datasetName: string, model: string, userId: string): Promise<EvalRun> {
    const cases = this.datasets.get(datasetName);
    if (!cases) throw new Error(`dataset ${datasetName} not found`);
    const run: EvalRun = {
      id: crypto.randomUUID(),
      model,
      startedAt: new Date().toISOString(),
      results: [],
      summary: { total: cases.length, passed: 0, avgScore: 0, avgLatencyMs: 0 },
    };
    for (const c of cases) {
      const messages: ChatMessage[] = [
        ...(c.system ? [{ role: 'system' as const, content: c.system }] : []),
        { role: 'user', content: c.prompt },
      ];
      const t0 = Date.now();
      let output = '';
      try {
        const out = await this.ai.complete({ model, messages, userId });
        output = out.content;
      } catch (e: any) {
        output = `ERROR: ${e?.message ?? e}`;
      }
      const latencyMs = Date.now() - t0;
      const { score, passed, note } = this.score(c, output);
      run.results.push({ caseId: c.id, output, score, passed, note, latencyMs });
    }
    run.finishedAt = new Date().toISOString();
    run.summary.passed = run.results.filter((r) => r.passed).length;
    run.summary.avgScore = +(run.results.reduce((s, r) => s + r.score, 0) / (run.results.length || 1)).toFixed(3);
    run.summary.avgLatencyMs = Math.round(run.results.reduce((s, r) => s + r.latencyMs, 0) / (run.results.length || 1));
    this.runs.push(run);
    return run;
  }

  private score(c: EvalCase, output: string): { score: number; passed: boolean; note?: string } {
    const scorer = c.scorer ?? (c.regex ? 'regex' : c.contains ? 'contains' : c.expected ? 'exact' : 'contains');
    if (scorer === 'exact' && c.expected) {
      const ok = output.trim() === c.expected.trim();
      return { score: ok ? 1 : 0, passed: ok };
    }
    if (scorer === 'contains' && c.contains?.length) {
      const hits = c.contains.filter((s) => output.toLowerCase().includes(s.toLowerCase())).length;
      const score = hits / c.contains.length;
      return { score, passed: score >= 0.5, note: `${hits}/${c.contains.length} phrases` };
    }
    if (scorer === 'regex' && c.regex) {
      const ok = new RegExp(c.regex, 'i').test(output);
      return { score: ok ? 1 : 0, passed: ok };
    }
    return { score: 0, passed: false, note: 'no matching scorer' };
  }
}
