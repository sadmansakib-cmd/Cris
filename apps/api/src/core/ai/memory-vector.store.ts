import { Injectable } from '@nestjs/common';
import type { EmbeddingsProvider, VectorStore } from './rag.service';

/**
 * Deterministic hashed-bag-of-words embedder — no external API required.
 * Good enough for local demos and unit tests; swap for OpenAI/Gemini in prod.
 */
@Injectable()
export class HashEmbeddings implements EmbeddingsProvider {
  private readonly dims = 384;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vec(t));
  }
  private vec(t: string): number[] {
    const v = new Array<number>(this.dims).fill(0);
    for (const tok of t.toLowerCase().split(/\W+/).filter(Boolean)) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) h = ((h ^ tok.charCodeAt(i)) * 16777619) >>> 0;
      v[h % this.dims] += 1;
    }
    // L2 normalize
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  }
}

/** Simple in-memory vector store with cosine similarity — usable in tests and single-node dev. */
@Injectable()
export class MemoryVectorStore implements VectorStore {
  private readonly ns = new Map<string, Map<string, { vector: number[]; metadata: any; text: string }>>();
  private ensure(n: string) {
    if (!this.ns.has(n)) this.ns.set(n, new Map());
    return this.ns.get(n)!;
  }
  async upsert(ns: string, items: { id: string; vector: number[]; metadata: any; text: string }[]) {
    const m = this.ensure(ns);
    for (const it of items) m.set(it.id, { vector: it.vector, metadata: it.metadata, text: it.text });
  }
  async delete(ns: string, ids: string[]) {
    const m = this.ensure(ns);
    for (const id of ids) m.delete(id);
  }
  async query(ns: string, vector: number[], k: number) {
    const m = this.ensure(ns);
    const out: Array<{ id: string; score: number; metadata: any; text: string }> = [];
    for (const [id, v] of m) {
      let dot = 0;
      for (let i = 0; i < vector.length; i++) dot += vector[i] * v.vector[i];
      out.push({ id, score: dot, metadata: v.metadata, text: v.text });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, k);
  }

  /** Introspection helpers for the admin UI. */
  namespaces() {
    return [...this.ns.keys()].map((n) => ({ ns: n, size: this.ns.get(n)!.size }));
  }
  wipe(ns: string) {
    this.ns.delete(ns);
  }
}
