# 06 — Provider Interfaces

Every external capability is an interface with ≥2 implementations. Selection is per-tenant (system default + user override) via the `ProviderRegistry`, driven by env config.

## AI provider

```ts
export interface AIProvider {
  id: string;                         // "openai" | "anthropic" | "gemini" | "ollama"
  complete(req: {
    model?: string;
    messages: Array<{ role: "system"|"user"|"assistant"; content: string }>;
    tools?: ToolSpec[];
    stream?: boolean;
    user: { id: string };
    signal?: AbortSignal;
  }): Promise<CompletionResult> | AsyncIterable<CompletionChunk>;

  embed(req: { model?: string; input: string[] }): Promise<{ vectors: number[][] }>;
  transcribe?(req: { audio: Blob; language?: string }): Promise<{ text: string }>;
  speak?(req: { text: string; voice?: string }): Promise<Blob>;
  image?(req: { prompt: string; size?: string }): Promise<Blob>;
  listModels(): Promise<Array<{ id: string; kind: "chat"|"embed"|"image"|"audio" }>>;
}
```

Implementations: `openai`, `anthropic`, `gemini`, `ollama`, `openrouter`.

## Storage provider

```ts
export interface StorageProvider {
  id: string;                         // "local" | "s3" | "r2" | "gcs" | "azure"
  put(key: string, body: ReadableStream | Buffer, meta?: PutMeta): Promise<{ etag: string }>;
  get(key: string): Promise<{ body: ReadableStream; meta: ObjectMeta }>;
  head(key: string): Promise<ObjectMeta | null>;
  delete(key: string): Promise<void>;
  list(prefix: string, cursor?: string): Promise<{ items: ObjectMeta[]; cursor?: string }>;
  presign(op: "get"|"put", key: string, ttlSec: number): Promise<string>;
}
```

## Email provider

```ts
export interface EmailProvider {
  id: string;                         // "smtp" | "resend" | "postmark" | "ses"
  send(msg: { to: string[]; from: string; subject: string; html?: string; text?: string; attachments?: Attachment[] }): Promise<{ id: string }>;
}
```

## Auth provider (OAuth adapter)

```ts
export interface OAuthProvider {
  id: string;                         // "google" | "github" | "microsoft" | ...
  authUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<{ providerId: string; profile: OAuthProfile; tokens: OAuthTokens }>;
}
```

## Vector provider

```ts
export interface VectorProvider {
  id: string;                         // "pgvector" | "qdrant" | "chroma"
  upsert(ns: string, items: Array<{ id: string; vector: number[]; metadata?: Json }>): Promise<void>;
  query(ns: string, vector: number[], k: number, filter?: Json): Promise<Array<{ id: string; score: number; metadata?: Json }>>;
  delete(ns: string, ids: string[]): Promise<void>;
}
```

## Queue provider

`BullMQ` on Redis is the default; interface exists so it can be swapped for RabbitMQ/NATS later.

## Payment provider (later phase)

Common interface with `createCheckout`, `createPortal`, `verifyWebhook`, `listSubscriptions`. Impls: `stripe`, `paddle`, `lemonsqueezy`.

## Registration & selection

```ts
ProviderRegistry.register("ai", new OpenAIProvider(env));
ProviderRegistry.register("ai", new AnthropicProvider(env));
ProviderRegistry.setDefault("ai", env.AI_DEFAULT_PROVIDER);        // "openai"

// runtime
const ai = ProviderRegistry.get<AIProvider>("ai", user.overrides?.ai);
```

## Env matrix (excerpt of `.env.example`)

```env
# ── Core ────────────────────────────────────────────────
NODE_ENV=production
APP_URL=https://hault.example.com
DATABASE_URL=postgresql://hault:password@postgres:5432/hault
REDIS_URL=redis://redis:6379
ENCRYPTION_KEY=                     # 32 bytes base64
JWT_SECRET=                         # 64+ chars
SEED_ADMIN_EMAIL=admin@example.com

# ── AI providers (fill any you use) ─────────────────────
AI_DEFAULT_PROVIDER=openai
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434

# ── Storage ─────────────────────────────────────────────
STORAGE_DEFAULT_PROVIDER=local
STORAGE_LOCAL_ROOT=/var/hault/files
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
R2_ACCOUNT_ID=
GCS_PROJECT_ID=
GCS_KEYFILE_JSON=
AZURE_STORAGE_CONNECTION_STRING=

# ── Email ───────────────────────────────────────────────
EMAIL_DEFAULT_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
RESEND_API_KEY=
POSTMARK_TOKEN=

# ── OAuth (optional) ────────────────────────────────────
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
```

**Never commit real values.** Only `.env.example` is tracked.
