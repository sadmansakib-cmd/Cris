import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * AES-256-GCM envelope. IV is prepended to the ciphertext; auth tag appended.
 * Layout: [12-byte IV | ciphertext | 16-byte tag]
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.getOrThrow<string>('ENCRYPTION_KEY'), 'base64');
    if (this.key.length !== 32) throw new Error('ENCRYPTION_KEY must decode to 32 bytes');
  }

  encrypt(plaintext: string | Buffer, aad?: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
    const enc = Buffer.concat([
      cipher.update(typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext),
      cipher.final(),
    ]);
    return Buffer.concat([iv, enc, cipher.getAuthTag()]);
  }

  decrypt(payload: Buffer, aad?: string): Buffer {
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(payload.length - 16);
    const ct = payload.subarray(12, payload.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  sha256(input: string | Buffer): string {
    return createHash('sha256').update(input).digest('hex');
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}

@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
