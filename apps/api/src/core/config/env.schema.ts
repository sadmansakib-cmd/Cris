import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.string().default('http://localhost:5173'),
    API_URL: z.string().url().optional(),
    API_PORT: z.coerce.number().int().positive().default(3000),
    TRUST_PROXY: z.string().default('1'),
    APP_VERSION: z.string().default('0.1.0'),
    ENABLE_SWAGGER: z.enum(['true', 'false']).default('true'),

    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥ 32 chars'),
    ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must be 32 bytes base64'),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(600),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

    SEED_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
    SEED_ADMIN_NAME: z.string().default('Admin'),

    AI_DEFAULT_PROVIDER: z.string().default('openai'),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.string().url().optional(),

    STORAGE_DEFAULT_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('./var/files'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    EMAIL_DEFAULT_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
    EMAIL_FROM: z.string().default('HAULT <no-reply@localhost>'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: z.coerce.boolean().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),

    // OAuth
    OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
    OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
    OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
    OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),

    // WebAuthn
    WEBAUTHN_RP_ID: z.string().default('localhost'),

    // Media providers
    STT_DEFAULT_PROVIDER: z.string().default('openai'),
    TTS_DEFAULT_PROVIDER: z.string().default('openai'),
    OCR_DEFAULT_PROVIDER: z.string().default('tesseract'),
    VISION_DEFAULT_PROVIDER: z.string().default('ai-vision'),
  })
  .passthrough();

export type Env = z.infer<typeof envSchema>;

