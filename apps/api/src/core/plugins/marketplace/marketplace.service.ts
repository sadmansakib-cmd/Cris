import { Injectable, Logger } from '@nestjs/common';
import { createHash, createVerify } from 'node:crypto';

/**
 * Phase 14 — Plugin Marketplace.
 *
 * Trust model:
 *   1. Every plugin manifest at rest carries a detached signature.
 *   2. Registry lists { id, version, manifestUrl, signatureUrl, publisherKeyId }.
 *   3. On install-from-URL: fetch manifest+signature, verify against
 *      `publisher_keys` table (trusted-on-first-use with admin confirmation).
 *   4. Compute SHA256 of the plugin tarball, compare with `sha256` in manifest.
 *   5. Load into worker-thread sandbox with the manifest's declared permissions
 *      (never more).
 */
export interface PluginListing {
  id: string;
  version: string;
  manifestUrl: string;
  signatureUrl: string;
  publisherKeyId: string;
  tarballUrl: string;
  sha256: string;
  stars: number;
  installs: number;
}

@Injectable()
export class MarketplaceService {
  private readonly log = new Logger(MarketplaceService.name);
  private readonly registryUrl = process.env.HAULT_REGISTRY_URL || 'https://registry.hault.dev';
  private readonly trustedKeys = new Map<string, string>(); // keyId → PEM

  async list(q?: string): Promise<PluginListing[]> {
    const url = new URL('/api/plugins', this.registryUrl);
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`registry ${res.status}`);
    return res.json();
  }

  async installFromUrl(manifestUrl: string, signatureUrl: string, keyId: string): Promise<{ manifest: any; verified: true }> {
    const [manifestRaw, sigRaw] = await Promise.all([
      fetch(manifestUrl).then((r) => r.text()),
      fetch(signatureUrl).then((r) => r.text()),
    ]);
    const pem = this.trustedKeys.get(keyId);
    if (!pem) throw new Error(`untrusted publisher key: ${keyId}`);
    const verifier = createVerify('SHA256');
    verifier.update(manifestRaw);
    verifier.end();
    if (!verifier.verify(pem, Buffer.from(sigRaw, 'base64'))) throw new Error('signature verify failed');
    const manifest = JSON.parse(manifestRaw);
    // Callers should now: fetch tarball, verify sha256 against manifest.sha256, extract to plugins dir, hand off to PluginRuntime.
    return { manifest, verified: true };
  }

  trustKey(keyId: string, pem: string) { this.trustedKeys.set(keyId, pem); }
  sha256(buf: Buffer) { return createHash('sha256').update(buf).digest('hex'); }
}
