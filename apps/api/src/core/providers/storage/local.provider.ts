import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import type { StorageProvider } from './storage.interface';

/**
 * Local filesystem storage. Keys are treated as POSIX-style relative paths.
 * Any `..` or absolute keys are rejected to prevent traversal.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local';
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
  }

  private safePath(key: string): string {
    const clean = normalize(key).replace(/^([/\\])+/, '');
    const full = resolve(this.root, clean);
    if (!full.startsWith(this.root + sep) && full !== this.root) {
      throw new Error(`Refusing storage key outside root: ${key}`);
    }
    return full;
  }

  async put(key: string, body: Buffer | import('node:stream').Readable, contentType?: string) {
    const path = this.safePath(key);
    await fs.mkdir(dirname(path), { recursive: true });
    if (Buffer.isBuffer(body)) {
      await fs.writeFile(path, body);
      return { key, size: body.length, contentType: contentType || 'application/octet-stream' };
    }
    throw new Error('Streams not implemented for local put');
  }

  async get(key: string) {
    const path = this.safePath(key);
    return await fs.readFile(path);
  }

  async head(key: string) {
    try {
      const stat = await fs.stat(this.safePath(key));
      return { key, size: stat.size, contentType: 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await fs.rm(this.safePath(key), { force: true });
  }

  async signedUrl(key: string, expiresInSec?: number): Promise<string> {
    return `http://localhost:3000/api/files/${key}`;
  }
}
