> Historical React redesign: superseded by the original-interface correction in
> `homeframe-bridge/`. Its verification results do not establish coverage of the corrected UI.

# Studio AI · Homeframe frontend

React interface for the Open WebUI 0.12.3 backend. The upstream backend, original
frontend and license notices remain in this repository for maintenance and
rollback. This frontend uses `@builtbyted/homeframe@0.1.18-studio.1` for viewport, keyboard,
safe-area, routing, shell and PWA ownership.

The initial deployment is complete. See the
[release report](../docs/homeframe/RELEASE-2026-10-19.md) and
[deployment runbook](deploy/README.md) before promoting another release.

```sh
cd homeframe-ui
npm ci
STUDIO_BACKEND=http://127.0.0.1:8080 npm run dev
npm run check
npm run test:e2e
```

The development proxy forwards API, Socket.IO, uploads and the existing Python
sandbox assets to the backend. No API keys or deployment credentials belong in
the frontend bundle. Authentication uses Open WebUI's existing session contract.

`npm run check` runs logic regression tests, strict TypeScript, the production
build and Homeframe doctor. The browser suite uses deterministic API fixtures for
shell and navigation invariants. It supplements, rather than replaces,
authenticated integration testing against an isolated backend and real-device
keyboard/PWA testing.

The mobile sidebar intentionally has `mobileSidebarDismiss={false}`. Do not add a
close-menu row. Backdrop, Escape and link activation dismiss the mobile drawer.

Read [AGENTS.md](AGENTS.md) and [the framework runbook](docs/HOMEFRAME_RUNBOOK.md)
before changing layout ownership. Preserve the original Open WebUI LICENSE and
LICENSE_HISTORY, and review their branding terms for each deployment.
