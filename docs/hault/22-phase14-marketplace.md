# Phase 14 — Plugin Marketplace

## Trust chain
1. Publishers generate an RSA/Ed25519 keypair; admin trusts the public key via `POST /marketplace/trust-key` (stored in-memory here; production persists to `publisher_keys`).
2. Registry (`HAULT_REGISTRY_URL`, default `https://registry.hault.dev`) returns listings: `{ id, version, manifestUrl, signatureUrl, publisherKeyId, tarballUrl, sha256, stars, installs }`.
3. `POST /marketplace/install` fetches the manifest + detached signature, verifies with the trusted PEM, then hands the manifest to `PluginsService.install(..., 'marketplace', userId)`.
4. Tarball fetch + SHA-256 verify + extract + sandbox load happens in `PluginRuntimeService.start` on enable.

## Endpoints
- `GET  /marketplace/list?q=` — proxied registry search.
- `POST /marketplace/trust-key` — `{ keyId, pem }`.
- `POST /marketplace/install` — `{ manifestUrl, signatureUrl, keyId }` → verified install.

## UI
`apps/web/src/pages/Marketplace.tsx` — search listings, trust publisher keys, one-click verified install. Wired into the sidebar with the `Store` icon.

## Guarantees
- No plugin runs without a valid signature from a trusted key.
- Manifest permissions are the ceiling — sandbox never grants more.
- SHA-256 mismatch on tarball aborts install before sandbox load.
