# Original interface / Homeframe bridge

This is a small React host for the original Svelte application. Svelte retains
ownership of its components, events, state and SvelteKit routing. React does not
reimplement those screens or install a competing router.

`src/main.tsx` mounts one Homeframe provider, viewport and persistent AppShell.
Svelte's `frameRegion` action registers its existing header, sidebar, body, dock,
scroll container and modal nodes. The bridge moves those nodes into supported
Homeframe regions. AppScrollView attaches to the existing primary scroller through
its polymorphic element API, so it does not nest another scroll container.

Homeframe generates the manifest, icons, Apple startup images, startup splash,
viewport runtime and service worker. There is no application splash offset or
positioning CSS. `shell.css` only adapts original application geometry and colors.
The original menu control opens the sidebar; Homeframe's additional trigger and
close control are disabled through public options. Backdrop/Escape/navigation
still dismiss the sidebar.

Build the root Svelte app first (Node 20.19 or 22), then run `npm ci`, `npm test`,
`npm run build` and `npm run doctor` here under Node 24. See the root README.
The exact Homeframe compatibility package and source patch are in `vendor/`.

## Staging verification

The browser suite requires an authorized, isolated Open WebUI staging backend and
Playwright storage state for that exact staging origin:

```sh
STUDIO_TEST_URL=http://127.0.0.1:5177 \
STUDIO_TEST_STORAGE=/private/path/staging-state.json npm run test:e2e
```

Do not commit that file. Browser emulation does not validate the iOS keyboard.
`tests/ios` is an XcodeGen/XCUITest harness for real Simulator Safari and installed
Home Screen apps. Supply `STUDIO_TEST_URL` for a deterministic long conversation
and `STUDIO_TEST_ACCOUNT_FILE` for a private staging-only account JSON file. Build
with XcodeGen, discover a supported iPhone simulator, and use `xcodebuild test`.
Never print its raw logs: system typing diagnostics can contain credentials.

For local geometry debugging only, `VITE_STUDIO_QA_TRACE=true npm run build`
includes anonymous viewport/touch measurements on localhost. Production builds
must omit this flag; no trace module or endpoint should appear in their output.

## Deployment and data

Use the shared `../homeframe-ui/deploy/server.ts` under Node 24 with
`STUDIO_ORIGINAL_UI=1`, an immutable release directory and the existing backend.
This serves Svelte chunks locally and falls back to the backend for legacy chunks.
It forwards APIs, uploads, model streams and WebSockets unchanged. The original UI
keeps upstream content-security behavior required by its existing Python/previews.

The correction changes no backend schema. Keep the live database, uploads,
accounts, model settings and tokens in place. Preserve manifest ID, scope,
start URL and worker URL, plus prior immutable releases for existing tabs. Deploy
new server code beside the running version and switch the existing reverse proxy
gracefully; don't interrupt active generation streams by restarting the old server.

Worker updates prompt and wait for a safe point: no active generation, unsent
chat draft or open note editor. Notes defer conservatively until navigation away.
