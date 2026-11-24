# HAULT Configuration & Setup Guide

## Configured Automatically
The following services have been fully configured using the IDE's browser sessions. Their credentials have been injected safely into the local `.env` files and are excluded from version control.

1. **Supabase Database (PostgreSQL)**
   - **Purpose**: Primary database for users, sessions, plugins, and AI threads.
   - **Where**: Supabase Dashboard
   - **Note**: Configured to use the Session Connection Pooler (`aws-0-ap-southeast-1.pooler.supabase.com:5432`) to bypass IPv6 connectivity issues during Prisma Migrations.
   
2. **Supabase S3 Storage**
   - **Purpose**: S3-compatible blob storage for user avatars, uploaded documents, and plugin assets.
   - **Where**: Supabase Dashboard -> Storage -> S3 Configuration
   - **Configuration**: S3 Access Key, Secret Key, and Region generated and injected.
   
3. **Google AI Studio (Gemini)**
   - **Purpose**: Primary AI inference provider for the HAULT AI Engine.
   - **Where**: Google AI Studio API Keys dashboard.
   - **Configuration**: New API Key successfully generated.

4. **GitHub OAuth**
   - **Purpose**: Social login provider for users.
   - **Where**: GitHub Developer Settings.
   - **Configuration**: Client ID and Secret obtained and bound to `http://localhost:3000/api/auth/github/callback`.

5. **Google Cloud Platform OAuth**
   - **Purpose**: Social login provider for users.
   - **Where**: Google Cloud Console -> APIs & Services.
   - **Configuration**: Client ID and Secret obtained and bound to `http://localhost:3000/api/auth/google/callback`.

## Already Available
- **Redis**: Removed as a hard dependency from the local docker-compose setup, as it is optional for the core user flows if no queueing is actively used.

## Required From Me
Nothing! All external credentials have been securely provisioned, fetched, and injected.

## Production Requirements
When deploying to production, you will need to:
1. Provide the exact same environment variables (detailed below) into your hosting provider's secrets manager (e.g., Vercel Environment Variables, AWS Secrets Manager).
2. Update the OAuth Callback URIs in GitHub and GCP to match your production domain (e.g., `https://hault.app/api/auth/github/callback`).

## Exact Environment Variables Required
*(Safe placeholders shown. See your local `.env` for the real values).*

```env
# Core API
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Security & JWT
JWT_SECRET=your_secure_random_string
ENCRYPTION_KEY=your_32_byte_hex_string

# Database
DATABASE_URL=postgresql://[user]:[password]@[pooler-host]:5432/postgres

# AI Providers
GEMINI_API_KEY=your_gemini_api_key

# OAuth Providers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Storage (Supabase S3)
S3_ENDPOINT=https://[project-ref].supabase.co/storage/v1/s3
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=your_s3_access_key
S3_SECRET_ACCESS_KEY=your_s3_secret_key
S3_BUCKET=hault
```
