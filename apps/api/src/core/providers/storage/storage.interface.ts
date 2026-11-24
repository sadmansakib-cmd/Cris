import type { Readable } from 'node:stream';

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

export interface StorageProvider {
  put(key: string, data: Buffer | Readable, contentType?: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<StoredObject | null>;
  signedUrl(key: string, expiresInSec?: number): Promise<string>;
}
