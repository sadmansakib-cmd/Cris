import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import type { StorageProvider, StoredObject } from './storage.interface';

/**
 * S3-compatible storage provider.
 * Works with AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, etc.
 * Configure via env: S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_FORCE_PATH_STYLE.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly log = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'hault';
    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
    });
  }

  async put(key: string, data: Buffer | Readable, contentType?: string): Promise<StoredObject> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: data as any, ContentType: contentType,
    }));
    return { key, size: Buffer.isBuffer(data) ? data.length : 0, contentType: contentType || 'application/octet-stream' };
  }

  async get(key: string): Promise<Buffer> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const c of out.Body as Readable) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const h = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { key, size: h.ContentLength || 0, contentType: h.ContentType || 'application/octet-stream' };
    } catch { return null; }
  }

  async signedUrl(key: string, expiresInSec = 900): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSec });
  }
}
