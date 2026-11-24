You are now the lead engineer responsible for taking my existing HALT project from its current state to a fully working, production ready application.

Do not rebuild the project from scratch.

First understand the entire existing codebase, architecture, features, dependencies, database structure, API routes, frontend, backend, authentication, AI systems, plugins, permissions, desktop functionality, browser functionality, communication systems, automation systems and deployment configuration.

Your job is to audit everything, find the actual faults, fix them, configure missing integrations and leave the project in a working state.

HALT is my personal AI assistant.

The goal is to make HALT a real usable AI assistant rather than a UI prototype or collection of placeholder features.

CORE REQUIREMENT

Work autonomously as much as possible.

Do not stop after identifying problems.

Find the problem
Understand why it exists
Fix it
Test the fix
Check for related problems
Fix those too
Run the application
Test the affected functionality
Continue until the project is stable

Do not replace working systems unnecessarily.

Do not delete existing functionality simply because it is incomplete.

If something is implemented incorrectly, repair the existing implementation.

If something is only a placeholder, determine what is required to make it functional and implement it.

PHASE 1

FULL PROJECT DISCOVERY

Start by inspecting the entire repository.

Inspect:

package files
lock files
environment files
environment examples
frontend
backend
API routes
database
ORM
authentication
middleware
configuration
AI integrations
plugin system
browser system
computer control
file system access
communication integrations
email
WhatsApp if implemented
calling features if implemented
task management
calendar
automation
research
coding
knowledge and RAG
voice
vision
health modules
finance modules
marketplace
admin
desktop application
mobile shell
security
logging
error handling
deployment
Docker configuration if present
CI or CD
Prisma or other database migrations
TypeScript configuration
build configuration

Also inspect all TODOs, FIXMEs, mock implementations, placeholder responses, hardcoded values, dead code and unused dependencies.

Create an internal architecture map before changing anything.

PHASE 2

FIND ALL FAULTS

Perform a complete technical audit.

Look for:

build errors
TypeScript errors
JavaScript errors
React errors
runtime errors
API failures
incorrect imports
incorrect exports
broken routes
broken middleware
authentication problems
authorization problems
database connection problems
Prisma problems
migration problems
schema inconsistencies
environment variable problems
CORS problems
cookie problems
session problems
OAuth problems
AI API problems
streaming problems
websocket problems
plugin loading problems
permission problems
sandbox problems
file access problems
browser automation problems
computer control problems
voice problems
vision problems
RAG problems
vector database problems
embedding problems
rate limit problems
error handling problems
security vulnerabilities
race conditions
memory leaks
infinite loops
broken UI states
loading states
empty states
mobile responsiveness problems
desktop problems
deployment problems

Do not only look for syntax errors.

Check whether the architecture actually makes sense.

Check whether frontend requests match backend endpoints.

Check whether backend responses match frontend expectations.

Check whether database schemas match application logic.

Check whether authentication state is correctly propagated.

Check whether permissions are actually enforced rather than only displayed in the UI.

Check whether plugins are actually isolated.

Check whether dangerous tools require authorization.

Check whether secrets can accidentally reach the frontend.

Check whether users can bypass permission checks through direct API requests.

PHASE 3

RUN EVERYTHING

Run the appropriate installation, type checking, linting, tests and build commands.

If the project does not have proper tests, create practical tests for critical systems.

Run the development server.

Test important API endpoints.

Test authentication.

Test database connectivity.

Test AI requests.

Test plugin loading.

Test permissions.

Test file operations.

Test browser operations if supported.

Test the desktop shell if possible.

Test the application as an actual user would.

When you find an error, do not simply report it.

Fix it and run the test again.

PHASE 4

AI PROVIDER AUDIT

Identify every AI provider currently used by HALT.

Determine:

which provider is used
which model is used
which API endpoint is used
which features depend on it
whether the API is correctly configured
whether the SDK version is compatible
whether streaming works
whether tool calling works
whether structured output works
whether fallback models exist
whether errors are handled
whether rate limits are handled

Make the AI provider system modular.

HALT should not be tightly coupled to one provider if the existing architecture allows a provider abstraction.

If multiple providers are already supported, verify every provider.

If a required API key is missing, do not invent one.

Determine exactly which credential is required and where it belongs.

PHASE 5

ENVIRONMENT CONFIGURATION

Create or repair:

.env.example

The example file must contain every environment variable required by the application.

Do not put real secrets inside .env.example.

Group variables logically.

For example:

application configuration
database
authentication
AI providers
OAuth providers
email
communication
browser services
storage
vector database
voice
vision
payments if applicable
external APIs
desktop configuration

For every variable include a short explanation in a safe documentation file or setup document.

Do not expose secret values in source code.

Search the entire repository for accidentally hardcoded:

API keys
tokens
passwords
OAuth secrets
database credentials
private keys
service account credentials

If you find any, replace them with environment variables.

Do not print the secret values in the final report.

PHASE 6

CONNECTED ACCOUNTS AND API SETUP

Use the capabilities available in this IDE and connected accounts to inspect the services that can be configured.

Where you have permission to access an account or integration, determine:

whether the required API is enabled
whether an existing API credential can be used
whether OAuth is already configured
whether a project needs to be created
whether scopes are missing
whether redirect URLs are missing
whether the integration is incorrectly configured

If the environment provides a legitimate authenticated workflow for obtaining configuration information, use it.

Do not bypass authentication, security controls, billing restrictions or confirmation screens.

Do not expose credentials in chat, source files, logs or screenshots.

If an action requires my explicit approval, stop only at that specific approval step and clearly tell me what I need to approve.

Otherwise continue autonomously.

PHASE 7

CREATE A SETUP DOCUMENT

Create:

SETUP.md

This must explain exactly what I need to provide manually.

Separate requirements into:

Already configured
Automatically configured
Required from me
Optional
Production only

For every required credential explain:

service name
purpose
environment variable name
where to obtain it
required permissions or scopes
whether it is free or potentially paid
whether OAuth is preferred
whether a callback URL is required

Do not ask me for something that the existing environment can safely configure itself.

PHASE 8

HALT SECURITY AUDIT

This is extremely important.

HALT is a personal AI assistant with potentially powerful permissions.

Audit the security architecture carefully.

Verify:

authentication
authorization
RBAC if present
plugin permissions
tool permissions
filesystem permissions
browser permissions
computer control permissions
network permissions
command execution
shell access
database access
secret handling
prompt injection resistance
tool injection resistance
SSRF protection
path traversal protection
command injection protection
XSS protection
CSRF protection
SQL injection protection
rate limiting
audit logs
session security
OAuth token handling
API key handling

A user or AI model must not be able to silently escalate permissions.

Dangerous operations should require explicit authorization according to the existing permission architecture.

Examples include:

deleting files
sending messages
sending emails
making purchases
executing arbitrary shell commands
changing system settings
accessing private accounts
sharing private information
changing security settings

Fix vulnerabilities you discover.

PHASE 9

PLUGIN SYSTEM

Audit the plugin architecture.

Every plugin should have:

manifest
identity
description
permissions
input schema
output schema
execution handler
error handling
security boundary
logging

Verify that plugins cannot request arbitrary permissions without authorization.

Verify that disabled plugins actually become unavailable.

Verify that revoked permissions are actually enforced at runtime.

Verify that plugin configuration survives application restart where appropriate.

Remove fake plugin success responses.

PHASE 10

DATABASE

Audit the database completely.

Check:

schema
relations
indexes
constraints
migrations
seed data
connection handling
transactions
error handling
production configuration

Run migrations safely.

Do not destroy existing user data.

If a destructive migration is genuinely required, stop and clearly explain it before executing it.

Otherwise make the migration backward compatible.

PHASE 11

AUTHENTICATION

Test:

registration
login
logout
session persistence
session expiration
password handling
OAuth
protected routes
frontend authentication state
backend authentication middleware
refresh behavior
permission enforcement

Make sure authentication cannot be bypassed by directly calling API endpoints.

PHASE 12

BROWSER AND COMPUTER CONTROL

If these systems exist, audit them carefully.

Verify:

browser launching
navigation
page reading
clicking
typing
downloads
uploads
file interaction
computer control
permission prompts
session handling

Do not allow arbitrary websites or pages to trick HALT into executing privileged actions without the correct permission flow.

Protect against prompt injection from webpages.

PHASE 13

VOICE AND VISION

If implemented, verify:

microphone permissions
speech recognition
text to speech
streaming
voice commands
camera permissions
image processing
vision model calls
error recovery

Make sure voice commands still pass through the same authorization system as typed commands.

PHASE 14

RAG AND KNOWLEDGE

Audit:

document ingestion
chunking
embeddings
vector storage
retrieval
metadata
source attribution
context limits
deletion
re-indexing

Make sure deleted documents are actually removed from retrieval.

Make sure private knowledge is not accidentally exposed to another user.

PHASE 15

AUTOMATIONS

Audit scheduled tasks and background jobs.

Verify:

scheduling
execution
retries
failure handling
timezone handling
duplicate prevention
cancellation
authorization

Make sure a failed automation does not silently repeat dangerous operations indefinitely.

PHASE 16

DESKTOP APPLICATION

If the Tauri desktop application exists, verify:

frontend loading
backend communication
filesystem permissions
native commands
window management
secure IPC
permission boundaries
production build
development build

Do not expose privileged native commands directly to untrusted frontend input.

PHASE 17

MOBILE APPLICATION

If the Expo/mobile shell exists, verify:

API connection
authentication
navigation
permissions
responsive UI
error states

Do not assume desktop-only APIs work on mobile.

PHASE 18

UI AND UX

Audit the complete interface.

Fix:

broken buttons
dead pages
fake loading states
incorrect navigation
missing error messages
bad forms
broken responsive layouts
console errors
inconsistent state
duplicate components
unfinished screens

The application should feel like one coherent product.

Do not redesign the entire UI unless necessary.

PHASE 19

REMOVE FAKE FUNCTIONALITY

Search for:

mock
dummy
fake
placeholder
coming soon
not implemented
TODO
FIXME
hardcoded response
simulated response

For each occurrence determine whether it is intentional.

If a feature is supposed to work, implement it.

If a feature genuinely cannot be implemented without an external service, connect the proper service or document the exact missing requirement.

Do not pretend something works when it does not.

PHASE 20

OBSERVABILITY

Improve logging and error reporting where necessary.

Errors should contain enough information for debugging without exposing:

API keys
passwords
tokens
private user data
OAuth secrets

Create useful server-side logs.

Create clear user-facing errors.

PHASE 21

PERFORMANCE

Check for:

unnecessary API calls
duplicate requests
unnecessary database queries
large client bundles
memory leaks
unbounded logs
slow AI requests
missing caching where appropriate
blocking operations
unnecessary rerenders

Improve obvious bottlenecks without overengineering.

PHASE 22

FINAL VERIFICATION

After fixing everything:

run type checking
run linting
run tests
run production build
start the production build if possible
test critical API routes
test authentication
test AI functionality
test database
test permissions
test plugins
test important UI flows

Fix any errors generated by these final checks.

Do not finish with known build errors unless they are caused by an external requirement that I genuinely need to provide.

PHASE 23

CREATE FINAL DOCUMENTATION

Create:

AUDIT_REPORT.md
SETUP.md
.env.example

AUDIT_REPORT.md should contain:

Project status
Architecture summary
Problems discovered
Root cause of each important problem
Fixes applied
Security issues found and fixed
Integrations configured
Tests performed
Remaining limitations
Required external credentials
Production deployment requirements
Recommended next improvements

Do not expose secrets in the report.

SETUP.md should contain the exact setup procedure for me.

.env.example should contain all required environment variable names without real secret values.

IMPORTANT WORKING RULES

Do not repeatedly ask me questions when you can inspect the repository and determine the answer yourself.

Do not rebuild working functionality.

Do not randomly change architecture.

Do not remove features simply because they are difficult.

Do not hardcode API keys.

Do not expose secrets.

Do not claim an integration works unless you actually verify it.

Do not claim a test passed unless you actually ran it.

Do not leave obvious TODOs when they can be solved.

Do not silently perform destructive operations.

Do not use fake/mock services as a substitute for real integrations unless the feature is explicitly intended to be mocked.

When an external credential is genuinely required from me, add it to .env.example and SETUP.md and clearly identify it in the final report.

When possible, configure everything else yourself.

Start now.

First inspect the complete project.

Do not give me a high level plan and wait.

Begin the audit, fix the problems, configure what you can, test everything, and continue until HALT is in the best working state possible.
