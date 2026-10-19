# Studio AI frontend releases

Use Node 24 or newer. The server has no npm runtime dependencies. Keep the existing
Open WebUI 0.12.3 backend running; this release changes frontend assets only.

## Prepare and verify

```sh
cd homeframe-ui
npm ci
npm run check
npm run test:e2e
```

Copy `dist/` into a new immutable directory named for the `buildId` in
`dist/homeframe-build.json`. Retain previous releases. Point a `current` symlink at
the candidate only after staging, authenticated API, streaming, update and native
browser checks. Promote the exact tested files rather than rebuilding at cutover.

Run this server behind your existing HTTPS reverse proxy:

```sh
STUDIO_FRONTEND_CURRENT=/absolute/path/current \
STUDIO_FRONTEND_RELEASES=/absolute/path/releases \
STUDIO_UPSTREAM=http://127.0.0.1:8080 \
HOST=127.0.0.1 PORT=18082 node deploy/server.ts
```

`/__studio_health` reports the active frontend build. API requests, authentication,
Socket.IO, uploads, provider proxies, Python assets and legacy Svelte assets pass
through to the original backend. Keep proxy buffering off, upload limits and long
response timeouts consistent with the existing deployment. Use a supervisor to
restart the frontend process and retain its exact launch environment.

## Document security and caching

The proxy applies a Content Security Policy with hashes for Homeframe's generated
inline scripts. The application document does not allow arbitrary inline scripts
or JavaScript evaluation. Python executes in a separate opaque-origin sandbox;
its evaluator permissions never apply to the main application. Preserve both the
iframe sandbox and the sandbox document's response policy.

Configure the outermost HTML response with `Cache-Control: no-cache, no-transform`.
Homeframe verifies precached bytes. CDN-injected analytics or challenge scripts
change those bytes and can leave an apparently working online app without an
active worker. Cloudflare documents this header for
[JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)
and [automatic analytics injection](https://developers.cloudflare.com/web-analytics/faq/).
Verify the public URL, not only a localhost staging server:

```sh
STUDIO_TEST_URL=https://your-studio.example npm run test:deployment
```

The read-only probe compares public HTML with the built artifact, checks the API
boundary and waits for an activated, controlling worker. With Nginx Proxy Manager,
`add_header` at server scope can be shadowed by location-level HSTS headers. Verify
the response; a supported headers-more directive scoped to `text/html` avoids that
inheritance issue without modifying backend streams or immutable asset caching.

Versioned JavaScript and CSS are immutable. HTML, the worker and both manifest
URLs revalidate, including manifest URLs with revision queries. Unknown API routes
return JSON errors instead of the upstream SPA; real HTML file downloads retain
their original content and headers.

## Data and browser migration

No Alembic migration is introduced. Make a consistent SQLite online backup before
the first cutover and record integrity, revision and table counts privately. Do
not copy a live WAL database with a plain file copy. Keep uploads in place.

Browser migrations are additive: session tokens and upstream preferences remain;
new account-scoped drafts retain attachments and tool choices, and mirror the old
session draft format for rollback. Theme preferences migrate once. Private browser
checkpoints are purged on sign-out. Temporary conversation content is not persisted.

Preserve app identity, scope, start URL and `/sw.js`. The frontend's manifest alias
keeps `/manifest.json` working. Authenticated API responses never enter the worker's
shell cache. Unsent work and running tasks guard worker activation.

## Cutover and rollback

1. Start the frontend alongside the backend and verify its health and API paths.
2. Snapshot the exact reverse-proxy model and generated configuration privately.
3. Change only this hostname's upstream port through the proxy manager's supported
   persistent API. Validate nginx configuration and use a graceful reload.
4. Monitor HTTP status, an existing stream/WebSocket, new connections, sign-in,
   asset delivery and model availability throughout the switch.
5. Keep the previous backend target and all release assets available.

For subsequent frontend rollback, atomically replace `current` with a symlink to
the previous release. The worker at the same URL then advertises that release;
activate at a safe point. Do not clear user browser data or invent a new app ID.

For emergency rollback of the initial migration, restore this hostname's previous
proxy target and gracefully reload. Existing Homeframe workers can still serve an
old shell while backend APIs continue working, so the preferred browser rollback
is a compatible repaired worker, not removing `/sw.js`.

## Validation boundaries

See [the route inventory](../../docs/homeframe/ROUTE_INVENTORY.md) and
[progress evidence](../../docs/homeframe/PROGRESS.md). A frontend migration does not
certify every backend integration or every upstream feature. Channels, simultaneous
multi-model comparison, realtime voice calls and collaborative rich-note editing
are not implemented by this interface. Existing data and upstream sources remain.
