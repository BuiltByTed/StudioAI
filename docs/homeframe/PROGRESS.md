# Homeframe migration

## Contract

- Maintain Open WebUI 0.12.3 backend/API compatibility and all upstream license notices.
- New React frontend lives in `homeframe-ui`; upstream sources remain available for merges and rollback.
- Pin Homeframe 0.1.18. Exactly one persistent shell, header, router and primary scroller.
- No close-menu button at the top of the sidebar. Use Homeframe's supported `mobileSidebarDismiss={false}`; retain backdrop, Escape, and navigation dismissal.
- Preserve installed identity (`/` start URL, effective `/` scope and identity). Preserve existing session storage, chats, uploads and preferences.
- No database schema change is needed for a frontend-only release. Validate the existing Alembic revision, a consistent SQLite backup and backward compatibility before cutover.
- Keep API, model generation, Socket.IO and uploads on the original backend throughout the cutover. Do not restart a running generation to deploy frontend assets.

## Baseline

- Fork: BuiltByTed/StudioAI, branch `homeframe`, based on upstream v0.12.3 / `91ea4e342`.
- Homeframe: npm `@builtbyted/homeframe@0.1.18`.
- Upstream frontend: Svelte; replacement: React/TypeScript/Vite.
- Existing worker: upstream unregisters workers and ships no active service worker. Never copy that unregister behavior into the new client.
- Keep Open WebUI name/logo attribution visible; retain LICENSE and LICENSE_HISTORY.

## Execution ledger

| Work | Status |
| --- | --- |
| Fork and baseline inventory | Complete |
| Homeframe shell and responsive sidebar | Implemented; desktop/mobile browser invariants pass |
| Auth, sessions, MFA and account settings | Sign-in tested against isolated backend; remaining controls in review |
| Chat history, branching, streaming and tools | Real streaming reply and reload verified; further tool/branch tests pending |
| Image generation/editing and file attachments | Implemented; integration tests pending |
| Notes, knowledge, prompts, models, tools, skills | Note/prompt save and reload verified; remaining editors in review |
| Search, folders, sharing and archives | Folder save and reload verified; remaining paths in review |
| Admin and enabled integrations | Basic settings implemented; parity review pending |
| Browser-storage migration and offline/update behavior | Pending |
| API/visual/functional regression tests | 6 logic tests and 4 browser invariant tests pass; campaign continuing |
| Staging, consistent backup and cutover rehearsal | Isolated database backup passes integrity check; cutover rehearsal pending |
| Graceful production switch and monitoring | Pending |

Do not call pending features complete or deploy a partial replacement as full parity. Runtime evidence and private deployment details belong in ignored artifacts, not this public repository.

## Verified development pass

- Strict TypeScript and production build pass. Homeframe doctor reports zero errors and zero warnings.
- Authenticated desktop home, mobile home, open mobile drawer, image studio and model workspace screenshots were inspected.
- One real model response arrived in approximately seven seconds; the saved conversation reloaded correctly. This is an integration smoke measurement, not a benchmark distribution.
- Notes, prompts and folders survive save and reload against the isolated backend.
- Browser fixture tests cover one persistent shell/header/scroller, sidebar dismissal without a close-menu row, 16px mobile controls, draft reload and recoverable request errors.
- No production cutover has occurred. No production schema or data has been modified.

## Next executable checks

1. Finish calendar and sandbox execution integration tests.
2. Complete upstream draft migration (attachments, selected tools and per-chat options), privacy boundaries and pending-input handling.
3. Test image generation/edit, file context, web search and code execution with real backends.
4. Complete the route/feature parity review in ROUTE_INVENTORY.md, including sharing, account/security, admin, advanced chat and currently enabled integrations.
5. Exercise production-built metadata, service worker update/rollback, offline behavior, dark mode and device keyboard scenarios.
6. Prepare and rehearse a frontend-only graceful proxy cutover while preserving in-flight backend requests. Deploy only after these gates pass.
