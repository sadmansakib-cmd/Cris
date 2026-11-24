Continue from the audit you just completed.

The audit report is accepted.

Do not create another plan.

Do not stop at analysis.

Now execute the entire remediation plan against the existing HALT codebase.

Your objective is to leave HALT in the most complete, secure and functional state possible.

IMPORTANT

The previous audit identified real credentials in .env and apps/api/.env.

Do not print, expose, copy, commit or place any real credentials into source code, documentation, logs, generated files or your response.

Do not display the values of any API key, password, JWT secret, database password, OAuth secret or encryption key.

Preserve the existing secrets locally if necessary for testing, but make sure they are ignored by git.

Create a safe .env.example containing variable names and placeholder values only.

Do not commit .env or apps/api/.env.

After the codebase is repaired, tell me exactly which credentials must be rotated.

EXECUTION RULE

Work through the previously identified issues one by one.

For every issue:

inspect the existing implementation
make the smallest correct architectural change
run the relevant test or build
fix any new errors
verify the result
move to the next issue

Do not merely modify files based on the audit description.

Read the actual current source code first.

If the audit description conflicts with the current code, trust the current code.

PHASE 1

Fix the AI provider architecture.

Implement GeminiProvider using the existing AIProvider abstraction.

Do not introduce a second incompatible AI architecture.

Inspect the exact AIProvider interface before implementing GeminiProvider.

Support the capabilities HALT actually expects.

Verify:

normal completion
chat
streaming if the existing architecture supports it
tool calling if supported
structured responses if supported
error handling
API failures
rate limits
timeouts

Do not assume Gemini's API format matches OpenAI.

Use the correct Gemini API request and response format for the SDK or REST implementation selected.

Keep provider-specific code isolated.

PHASE 2

Fix ProviderRegistry and AiEngine integration.

There must be one clear source of truth for registered AI providers.

Remove the situation where ProviderRegistry contains providers but AiEngine has an unrelated empty Map.

Make sure AiEngine can actually obtain the configured provider.

Verify behavior when:

Gemini is configured
OpenAI is configured
Anthropic is configured
multiple providers are configured
no provider is configured
the configured provider fails

HALT must return a useful error instead of crashing.

PHASE 3

Fix authentication controllers.

Register:

AuthController
OAuthController
WebAuthnController

inside the correct AuthModule.

Verify that the routes actually appear when NestJS starts.

Fix the OAuth environment variable mismatch.

Use the correct environment variable names consistently throughout the project.

Audit all OAuth references, not only oauth.controller.ts.

Check:

Google OAuth
GitHub OAuth
callback URLs
frontend URLs
API URLs
redirect URI construction
state validation
error handling

Do not hardcode localhost URLs into production logic.

PHASE 4

Fix WebAuthn.

Inspect the existing WebAuthn implementation.

Protect registration endpoints appropriately.

Use the project's existing CurrentUser mechanism where available.

Do not use unsafe request casting when a proper decorator or typed request mechanism exists.

Verify:

registration
authentication
challenge handling
credential storage
user association
authentication failure
unauthorized requests

Do not weaken WebAuthn security simply to make the route work.

PHASE 5

Fix ADMIN SECURITY.

Create the AdminGuard only if the existing architecture does not already provide an equivalent.

Inspect the actual User model and authorization architecture first.

Do not assume user.isAdmin exists.

If the database uses another role or permission structure, use that existing structure.

Admin endpoints must reject:

unauthenticated users
normal authenticated users

and allow only authorized administrators.

Test this through the actual HTTP API.

Do not rely only on frontend hiding.

PHASE 6

Fix the Permissions WebSocket Gateway.

This is a critical security issue.

Never trust:

socket.handshake.auth.userId

as proof of identity.

Authenticate the WebSocket connection using a valid JWT.

Determine how the existing JWT strategy validates tokens and reuse that logic rather than implementing a second incompatible authentication system.

Verify:

valid token
missing token
invalid token
expired token
wrong user identity
permission request
permission response
disconnect behavior

A client must never be able to impersonate another HALT user simply by sending another user ID.

PHASE 7

Fix plugin permission enforcement.

This is another critical security issue.

Remove any unconditional:

granted: true

behavior.

Inspect the existing PermissionsEngine API before modifying PluginRuntimeService.

Trace how user identity reaches plugin execution.

Every permission-sensitive plugin operation must receive the correct user context.

Verify:

allowed permission
denied permission
missing permission
disabled plugin
revoked permission
unauthenticated execution

Do not simply return false.

Actually enforce the permission boundary.

If the plugin architecture currently cannot safely propagate user identity, repair the architecture rather than bypassing the check.

PHASE 8

PLUGIN SECURITY AUDIT

There are 56 plugin directories.

Do not manually rewrite all 56 unless necessary.

First inspect the shared plugin runtime, manifest format, SDK and permission system.

Identify whether one central fix protects all plugins.

Audit:

manifest validation
plugin loading
worker thread isolation
permission requests
filesystem access
network access
process execution
environment variable access
database access
user identity
plugin lifecycle
timeouts
resource limits
error handling

Pay particular attention to whether plugins can access arbitrary environment variables.

Plugins must never automatically receive secrets such as:

DATABASE_URL
JWT_SECRET
ENCRYPTION_KEY
AI API keys
OAuth secrets

unless a specific architecture explicitly requires it and the permission system authorizes it.

PHASE 9

ENVIRONMENT CONFIGURATION

Create a complete .env.example.

Before adding variables, search the entire repository for process.env and equivalent configuration access.

Build the environment variable list from actual code rather than guessing.

Include:

database
redis
JWT
encryption
AI
OAuth
WebAuthn
STT
TTS
OCR
vision
storage
email
external APIs
application URLs
frontend URLs
desktop configuration
anything else actually required

For every variable, provide a safe placeholder.

Do not put real secrets in .env.example.

Update env.schema.ts to validate all required variables correctly.

Make optional integrations genuinely optional where the application architecture supports that.

Do not make the application fail startup because an optional provider is absent.

PHASE 10

DATABASE

Use the existing Supabase database unless there is a technical reason it cannot be used.

Do not switch to local Docker PostgreSQL merely because it is easier.

The existing database may contain important development data.

Run Prisma generate.

Inspect migration status.

Do not execute destructive migrations automatically.

Do not reset the database.

Do not delete existing data.

If a migration is necessary, make it safe and explain it.

Verify the API can connect to the database.

PHASE 11

REDIS

Check whether Redis is required by the actual running API.

If Docker is available and the repository contains an appropriate Redis configuration, use it for local development if necessary.

Do not replace a production Redis configuration with an arbitrary local configuration.

Verify:

connection
rate limiting
BullMQ
background jobs

If Redis is unavailable, produce a clear configuration error rather than an obscure runtime crash.

PHASE 12

FRONTEND

Audit the entire React application.

Do not assume only AppShell.tsx is broken.

Inspect all routes and pages.

Verify every important button and form.

Check:

routing
authentication state
API calls
loading
success
error
empty states
logout
thread creation
chat
settings
permissions
admin UI
plugin UI

Compare frontend API calls against actual NestJS routes.

Fix mismatches.

Do not create fake successful responses.

PHASE 13

API CONTRACT CONSISTENCY

Compare:

frontend request schemas
backend DTOs
Zod schemas
Prisma models
API responses
shared types

Look for mismatched:

field names
IDs
dates
enums
nullable values
pagination
error formats

Use @hault/shared where appropriate rather than duplicating incompatible types.

PHASE 14

ERROR HANDLING

HALT must fail gracefully.

Audit important operations for:

database failure
AI failure
invalid input
expired authentication
permission denial
provider timeout
network failure
Redis failure
plugin failure

Do not expose stack traces or secrets to users.

Do not swallow errors silently.

Use structured server-side logging where appropriate.

PHASE 15

SECURITY AUDIT

Perform a second security audit after implementing the fixes.

Look specifically for:

authentication bypass
authorization bypass
IDOR
path traversal
command injection
SQL injection
SSRF
XSS
CSRF
unsafe file uploads
unsafe file access
secret leakage
environment variable exposure
prototype pollution
unsafe deserialization
arbitrary code execution
plugin escape
WebSocket impersonation
prompt injection
tool permission bypass

For HALT specifically, pay special attention to AI tool execution.

The AI model must never be treated as inherently trusted.

The model should request actions through the permission system.

The model should not be able to silently escalate privileges.

PHASE 16

AI TOOL SAFETY

Trace an actual command from:

user
to AI
to tool selection
to permission check
to tool execution
to result
to AI

Verify that authorization happens before the dangerous operation.

Test examples such as:

read a file
delete a file
send an email
execute a command
access a private resource
open a browser
navigate to a website

The permission layer must be enforced server-side.

Do not rely on frontend checks.

PHASE 17

BUILD AND TEST

Run the actual repository commands.

At minimum:

pnpm install
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm --filter @hault/api prisma:generate

Also inspect package-specific scripts if those commands do not exist.

If a command fails:

find the root cause
fix it
run it again

Do not simply document the failure.

PHASE 18

RUN THE APPLICATION

Start the API and web application.

Verify startup.

Check:

health endpoint
authentication
database
Redis
AI
WebSocket
plugin system

Use actual HTTP requests where practical.

Do not claim an endpoint works just because NestJS compiled.

PHASE 19

CRITICAL END TO END TEST

Perform at least one complete user journey.

Example:

register
login
create AI thread
send message
receive AI response
create or execute a safe tool operation
permission request
permission approval
tool execution
result returned
logout

If the application uses another intended workflow, use that instead.

Fix every failure you encounter.

PHASE 20

OAUTH AND EXTERNAL SERVICES

Use available authenticated IDE/browser capabilities only where legitimate.

If Antigravity has access to my accounts and can safely inspect configuration, use that access to determine what can be configured automatically.

Do not bypass:

OAuth consent
2FA
billing confirmation
security warnings
account ownership confirmation

If an API credential can be created through an authorized workflow, configure the integration appropriately.

If a credential requires my explicit approval, stop only at that point and tell me exactly what I must approve.

Never print credentials.

PHASE 21

CREATE FINAL FILES

Create or update:

.env.example
SETUP.md
AUDIT_REPORT.md

SETUP.md must clearly divide:

Configured automatically
Already available
Required from me
Optional
Production requirements

For every credential provide:

variable name
service
purpose
where to obtain it
required scopes
whether OAuth is required
whether billing may be required

Do not include secret values.

AUDIT_REPORT.md must describe what was actually fixed.

Do not write that something was fixed unless you actually changed and verified it.

Include:

issue
root cause
fix
verification
remaining limitation

PHASE 22

GIT SECURITY

Inspect git status and git tracking.

Verify that:

.env
apps/api/.env
other secret files

are ignored.

Check whether secrets exist in tracked files.

If secrets are currently tracked, remove them from future commits without destroying local configuration.

Do not rewrite git history destructively without explicit approval.

Tell me that credentials need rotation.

PHASE 23

FINAL STATUS

At the end provide a concise final report with:

Build status
Typecheck status
Lint status
Test status
Database status
Redis status
AI provider status
Authentication status
OAuth status
WebAuthn status
WebSocket status
Plugin status
Permission status
Frontend status
Security status

Then provide:

1. Things you successfully fixed
2. Things you successfully verified
3. Things that still require my action
4. Exact environment variables I need to provide
5. Credentials that should be rotated
6. Any remaining known limitations

IMPORTANT

Do not stop simply because you encounter a missing API key.

Configure everything that can be configured without my intervention.

For anything that genuinely requires my action, document it and continue working on everything else.

Do not ask me to manually inspect source code when you can inspect it yourself.

Do not ask me to copy information that already exists in the repository.

Do not invent API keys.

Do not expose API keys.

Do not claim success without verification.

Do not leave the project in a partially modified broken state.

Start executing now.
IMPORTANT CHANGE TO THE PREVIOUS INSTRUCTIONS

I want you to operate as autonomously as your available environment and authenticated account access allows.

Do not immediately give me a list of APIs and tell me to manually create them.

First investigate whether you can configure them yourself.

You have access to the development environment and may have authenticated browser or account access available through the IDE.

For every external service HALT requires:

1. Determine whether an existing account, project or credential is already available.

2. Determine whether the service is already configured.

3. If configuration is missing and you have legitimate authenticated access, navigate to the appropriate official service dashboard and configure what is required.

4. If an API needs to be enabled, enable it when the account permissions allow it.

5. If an API key can legitimately be created through the authenticated account, create it.

6. If OAuth credentials can legitimately be created, configure them.

7. Configure callback URLs, origins, scopes and application settings correctly.

8. Put credentials into the appropriate local .env file only when it is safe and supported by the environment.

9. Never put secrets into source code.

10. Never put real secrets into .env.example.

11. Never print secret values into the terminal output, logs, documentation or final response.

12. Never commit secrets to git.

13. Verify each integration after configuration.

SERVICES TO INVESTIGATE

Inspect the existing HALT codebase first and determine which services are actually required.

Potential services include:

Supabase
PostgreSQL
Redis
Google AI / Gemini
OpenAI
Anthropic
Google OAuth
GitHub OAuth
WebAuthn
email provider
speech to text provider
text to speech provider
vision provider
OCR provider
storage provider
browser automation services
any other external API already referenced by HALT

Do not create unnecessary accounts or APIs.

Only configure services actually required by the current HALT implementation.

SUPABASE

If Supabase is already configured:

inspect the existing project
verify the database connection
verify the project URL
verify the database configuration
verify required authentication configuration
verify whether required Supabase APIs are enabled

If authenticated access allows you to retrieve non-secret configuration information, use it.

If a database password or secret needs to be regenerated and the interface allows it, do not rotate it automatically if doing so could break the existing application.

Instead determine the safest migration process.

Do not delete the existing database.

Do not reset the database.

Do not destroy existing data.

If the current credentials are exposed in git, flag them for rotation after the application is migrated to secure environment variables.

GOOGLE GEMINI

Inspect the existing Gemini configuration.

If the authenticated Google account has access to the required Google AI service:

check whether the required API is enabled
check whether a project already exists
check whether an API key already exists
create/configure the required credential if the account permits it
configure the correct API usage
connect it to HALT
test a real request

If Google requires a confirmation, billing decision, CAPTCHA, 2FA or other human approval, stop at that exact point and tell me what I need to do.

Do not ask me to manually create something that you can legitimately create yourself.

GOOGLE OAUTH

Inspect the Google OAuth configuration.

If an existing Google Cloud project is available:

configure the OAuth consent screen if necessary
configure the application type
configure redirect URIs
configure authorized origins
create credentials if permitted
connect the credentials to HALT

Use the actual HALT API callback URL.

Do not guess callback URLs.

GITHUB OAUTH

Inspect GitHub developer settings.

If authenticated access is available:

check whether an OAuth application already exists
create one if appropriate
configure the callback URL
connect it to HALT

Do not create duplicate applications unnecessarily.

OPENAI AND ANTHROPIC

If HALT contains OpenAI or Anthropic provider implementations:

determine whether credentials already exist in the environment
determine whether an authenticated dashboard can provide the required configuration
configure what can be configured

Do not assume an API key can be retrieved from an account dashboard.

If the provider only displays a secret once or requires explicit user action, tell me exactly what is required.

Do not fabricate credentials.

REDIS

Determine whether HALT needs Redis locally.

If Docker configuration exists:

inspect it
start the appropriate Redis service
verify connectivity
configure the environment

If a remote Redis service is already configured, verify it instead.

Do not replace a working production Redis service with local Redis.

EMAIL

If HALT requires email:

inspect the existing email implementation and provider.

If an authenticated provider dashboard is available and the required configuration can be safely created, configure it.

Otherwise document exactly what is missing.

VOICE

For STT and TTS:

inspect the actual provider implementations first.

Determine whether the application can use an already configured AI provider.

Do not create unnecessary third-party accounts.

VISION AND OCR

Do the same for vision and OCR.

Prefer providers already supported by the application.

Avoid unnecessary paid services.

ENVIRONMENT MANAGEMENT

After configuring available services:

create/update the local .env file
create/update .env.example
update env.schema.ts

Make sure every actual environment variable used by HALT is represented correctly.

Use safe placeholders in .env.example.

Do not expose secret values anywhere else.

SECURITY

Before writing any newly created credential into .env, verify that:

.env is ignored
apps/api/.env is ignored
no secret file is tracked
no secret is copied into frontend source
no VITE_ variable contains a server-side secret
no secret is embedded into a plugin manifest
no secret appears in logs

FRONTEND SECRET CHECK

This is mandatory.

Search all frontend code for:

API keys
tokens
database credentials
JWT secrets
OAuth client secrets
private keys

Remember that VITE_ variables are exposed to the browser.

Never put server-side secrets into VITE_ variables.

FINAL ACCOUNT CONFIGURATION REPORT

At the end, do NOT show secret values.

Instead report each integration as:

Configured and verified
Configured but needs human approval
Already configured
Missing
Not required
Blocked by provider

For anything blocked, give me the exact action I need to perform.

For example:

Open the Google Cloud OAuth configuration
Approve the requested permission
Create/confirm billing
Complete 2FA
Paste the newly generated secret into the local .env

Do not ask me for anything that you were able to configure yourself.

MOST IMPORTANT RULE

Attempt autonomous configuration first.

Do not turn this into a checklist for me.

Your job is to do the work.

Only involve me when an external service explicitly requires an action that cannot be performed by the available authenticated environment.

After completing account/API configuration, return to the HALT remediation plan and continue the audit, implementation and verification process.

Do not stop after configuring APIs.

The final goal is a working HALT application.
