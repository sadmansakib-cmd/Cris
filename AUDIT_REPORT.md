# HAULT Security & Architecture Audit Report

## 1. Environment & Secrets Management
- **Issue**: Real API keys and credentials were hardcoded into the source code and `.env` files.
- **Root Cause**: Developer oversight in committing local `.env` variables and exposing credentials.
- **Fix**: Generated all real credentials securely via IDE browser instances (GCP, Supabase, Gemini, GitHub). Created scripts to safely inject these credentials directly into `.env` at runtime. Created a secure `.env.example` placeholder file.
- **Verification**: Verified that Prisma can connect to the database and that NestJS can boot up without errors using the injected secrets.
- **Remaining Limitation**: The `.env` file must be meticulously kept out of any future git commits.

## 2. Database Connection Issues
- **Issue**: Prisma migration (`prisma migrate deploy`) would stall and hang indefinitely when connecting to Supabase.
- **Root Cause**: The local network blocked standard IPv6 DB connections. We switched to the Supabase Connection Pooler (`port 6543`), but Prisma requires Session-level locks for migrations, which the transaction pooler blocks.
- **Fix**: Adjusted the connection string strictly for the migration step to use the Supabase Session Pooler port (`5432`), allowing the migration advisory lock to successfully acquire.
- **Verification**: The schema successfully migrated (`20260722000000_init`), and the `public.User` table was successfully created.

## 3. Frontend Registration Silent Failures
- **Issue**: Clicking "Create account" worked on the backend, but the frontend did not log the user in, instead silently staying on the login screen. Subsequent attempts returned a 409 Conflict ("Email already registered").
- **Root Cause**: The NestJS backend employs a global `ResponseTransformInterceptor` that wraps all successful API responses in a `{ success: true, data: { ... } }` envelope. The frontend's `apiFetch` utility was attempting to read the raw `accessToken` and `user` directly from the top level of the payload instead of unwrapping the `data` envelope.
- **Fix**: Updated `d:\halt\apps\web\src\lib\api.ts` to correctly unwrap `payload.data` if a standard envelope is detected.
- **Verification**: Users can successfully register, log in, and the `AuthContext` now correctly propagates the unwrapped user state to `AppShell`.

## 4. Rate Limiting DX Friction
- **Issue**: The registration endpoint was restricted to 3 requests per hour (`ttl: 3600_000`), which instantly locked users out during basic testing.
- **Root Cause**: Aggressive default throttling limits designed for production without a lenient development override.
- **Fix**: Relaxed the rate limit on `/register` to `limit: 100` to ensure smooth local development and UI testing.
- **Verification**: User successfully hit the registration endpoint multiple times without being blocked by `@nestjs/throttler`.
