# 05 — Permission Engine

Nothing with a side effect runs without a matching grant. The engine is the single choke point between plugins/services and the outside world.

## Action taxonomy

`<domain>:<verb>[:<qualifier>]`

| Domain     | Examples                                                            |
|------------|---------------------------------------------------------------------|
| `files`    | `files:read`, `files:write`, `files:delete`                         |
| `email`    | `email:read`, `email:send`                                          |
| `calendar` | `calendar:read`, `calendar:write`                                   |
| `ai`       | `ai:complete`, `ai:embed`, `ai:transcribe`, `ai:image`              |
| `net`      | `net:fetch:<host>` (host-scoped outbound)                           |
| `device`   | `device:camera`, `device:mic`, `device:location`, `device:notify`   |
| `system`   | `system:shell`, `system:screenshot`, `system:clipboard`             |
| `data`     | `data:export`, `data:delete`                                        |
| `plugin`   | `plugin:install`, `plugin:enable`, `plugin:disable`                 |

## Grant model

A `PermissionGrant` is `(user, plugin, action, scope, expiresAt)`. Matching is:

```text
grant.action === request.action
&& scopeContains(grant.scope, request.scope)
&& !grant.revokedAt
&& (grant.expiresAt == null || grant.expiresAt > now)
```

Scopes are JSON documents interpreted per domain (e.g. `{ path: "/notes/**" }` for files, `{ folder: "INBOX" }` for email). A missing scope means "any".

## Prompt flow

```text
service.doThing()
   └─ PermissionEngine.request(user, "email:send", { to: "a@b.com" })
        ├─ match existing grant → allow
        ├─ policy denies         → deny + audit
        └─ else → open WS prompt to user:
             "Plugin AI-Chat wants to send an email to a@b.com. Allow?"
             [ Allow once ] [ Allow always for this recipient ] [ Deny ]
```

- Prompts are delivered over the authenticated WS channel; if the user is offline the action is denied and queued as a notification.
- "Allow always" creates a persistent grant with the appropriate scope.
- All decisions (allow/deny + who prompted, from where) go to `AuditLog`.

## Decorators (server)

```ts
@Post("send")
@RequiresPermission("email:send", (req) => ({ to: req.body.to }))
send(@Body() dto: SendEmailDto) { /* ... */ }
```

`PermissionGuard` reads metadata, calls the engine, and either proceeds or throws `403 PermissionRequiredError` — which the frontend translates into a prompt.

## Revocation & review

- Settings → Permissions shows every grant grouped by plugin, with revoke buttons.
- Every prompt shows: plugin name, human reason (from manifest), action, scope, and a link to audit history for that action.
- Emergency **Panic** button revokes every non-core grant instantly.

## Defaults

Newly installed plugins have **zero** grants. First use of any action triggers a prompt. Manifest declares what a plugin *may* request; the engine still asks the user.
