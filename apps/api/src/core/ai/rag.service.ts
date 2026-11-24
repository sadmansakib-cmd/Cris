import { Injectable, Logger } from '@nestjs/common';

/**
 * Phase 8 — RAG service.
 * Provider-agnostic: needs an EmbeddingsProvider and a VectorStore.
 */
export interface EmbeddingsProvider { embed(texts: string[]): Promise<number[][]> }
export interface VectorStore {
  upsert(ns: string, items: Array<{ id: string; vector: number[]; metadata: any; text: string }>): Promise<void>;
  query(ns: string, vector: number[], k: number): Promise<Array<{ id: string; score: number; metadata: any; text: string }>>;
  delete(ns: string, ids: string[]): Promise<void>;
}

@Injectable()
export class RagService {
  private readonly log = new Logger(RagService.name);
  constructor(private readonly embed: EmbeddingsProvider, private readonly vec: VectorStore) {}

  /** Chunk long text into overlapping windows suitable for embedding. */
  chunk(text: string, size = 900, overlap = 120): string[] {
    const out: string[] = []; let i = 0;
    while (i < text.length) { out.push(text.slice(i, i + size)); i += size - overlap; }
    return out;
  }

  async index(ns: string, docId: string, text: string, metadata: Record<string, any> = {}) {
    const chunks = this.chunk(text);
    const vectors = await this.embed.embed(chunks);
    await this.vec.upsert(ns, chunks.map((t, i) => ({
      id: `${docId}#${i}`, vector: vectors[i], text: t, metadata: { ...metadata, docId, chunk: i },
    })));
  }

  async retrieve(ns: string, query: string, k = 6) {
    const [qv] = await this.embed.embed([query]);
    return this.vec.query(ns, qv, k);
  }
}
