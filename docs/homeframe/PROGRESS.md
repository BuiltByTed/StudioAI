# Homeframe migration

## Contract

- Maintain Open WebUI 0.12.3 backend/API compatibility and all upstream license notices.
- New React frontend lives in `homeframe-ui`; upstream sources remain available for merges and rollback.
- Pin the Homeframe 0.1.18-studio.1 compatibility build (see `homeframe-ui/vendor`). Exactly one persistent shell, header, router and primary scroller.
- No close-menu button at the top of the sidebar. Use Homeframe's supported `mobileSidebarDismiss={false}`; retain backdrop, Escape, and navigation dismissal.
- Preserve installed identity (`/` start URL, effective `/` scope and identity). Preserve existing session storage, chats, uploads and preferences.
- No database schema change is needed for a frontend-only release. Validate the existing Alembic revision, a consistent SQLite backup and backward compatibility before cutover.
- Keep API, model generation, Socket.IO and uploads on the original backend throughout the cutover. Do not restart a running generation to deploy frontend assets.

## Baseline

- Fork: BuiltByTed/StudioAI, branch `homeframe`, based on upstream v0.12.3 / `91ea4e342`.
- Homeframe: exact vendored compatibility package `@builtbyted/homeframe@0.1.18-studio.1`; see its source patch and provenance in `homeframe-ui/vendor`.
- Upstream frontend: Svelte; replacement: React/TypeScript/Vite.
- Existing worker: upstream unregisters workers and ships no active service worker. Never copy that unregister behavior into the new client.
- Product name is Studio AI, including sign-in, document title and installed-app metadata. Preserve upstream attribution in About and repository licensing. Installed identity is unchanged.

## Execution ledger — 2026-10-19

Production has **not** been switched. The existing backend and data remain unchanged.
The replacement has substantial working coverage but is not yet certified for all
upstream features or all Homeframe device scenarios.

| Work | Verified status |
| --- | --- |
| Fork, baseline and Studio AI branding | Repository created; product title, login, manifest, splash, icon and README renamed; license notices retained |
| Persistent Homeframe shell | Desktop/mobile fixture checks: one shell/header/scroller, 16px inputs, no sidebar close-menu button |
| Authentication | Real staging sign-in; fixture checks for expired sessions versus item-level permission failures; real MFA enrollment/TOTP confirmation/recovery sign-in and remaining-code status passed; OAuth callback fixture passed |
| Chat | Real streaming/reload, file context, Python tool execution, temporary response without history persistence |
| Images | Real prompt generation and reference-image editing; each about 9.4 seconds for one 512px sample, not a benchmark distribution |
| Workspace | Notes/prompts save/reload; knowledge and skills CRUD; model/tool/function create/reload/delete round trips passed |
| Organization | Folders/instructions save/reload, shared conversation and clone, recurring all-day calendar series create/edit/delete |
| Administration | Isolated pending account/group CRUD; analytics/evaluations/functions/security/memories routes opened; complete control coverage pending |
| Scheduled tasks | Isolated paused weekly task create/reload/delete; no live task execution |
| Playground | Real streaming completion and save as conversation |
| Storage and privacy | User-scoped draft migration including attachments/tools; logout purges private framework checkpoints; temporary drafts not persisted |
| Browser updates | Built A→B promotion retained draft, deferred activation until safe route, offline recovery, preserved identity and API cache exclusion |
| Proxy | Automated open-SSE release promotion, authenticated cookies, multipart-sized body, raw WebSocket and static traversal/asset failure checks |
| Native iOS | Native Safari software-keyboard pan regression passed after framework fix; installed iPhone software keyboard, Notes, landscape and cold draft restore passed; native opening/cold-launch recordings inspected; desktop Safari, installed macOS Chrome and iPad portrait/landscape tests passed |
| Automated tests | Latest full run: 20 unit + 2 proxy tests, 17 browser tests, strict typecheck/build/doctor; all passed |
| Production cutover | Pending final parity, device/update/rollback and live continuity gates |

## Evidence and measured changes

Private operator artifacts contain executable integration scripts, logs, screenshots
and native xcresult bundles. They contain private conversation data and are not published.
Each check above states what it tested; implementation alone is not a PASS.

- Strict TypeScript, production build and Homeframe doctor passed before the latest
  prompt-picker and temporary-chat additions. The final source must be checked again.
- Initial bundled JavaScript decreased from 889.53 KB (263.80 KB gzip) to 289.52 KB
  (91.13 KB gzip) by deferring editors and rich Markdown/math rendering. This is a
  build-size comparison, not a measured startup-latency claim.
- Fixed verified compatibility defects: folder metadata must be an object instead
  of null; conversation exports use NDJSON; calendar instances edit their original
  series anchor; tool questions reject empty/unsupported answers; stale requests
  cannot insert responses into a different conversation; saved image state is bounded
  and validated; note saves preserve unrelated fields and detect stale edits.
- Native iOS Safari testing reproduced a header moving out of view during keyboard
  panning. The fix belongs to Homeframe's viewport runtime and is delivered with
  an exact vendored compatibility package and source patch. Framework validation:
  194 unit tests, 68 browser tests, typecheck, build and package-contract checks.
  Native reproduction passes after the fix. Installed iPhone tests also pass
  software-letter-key input, header/dock bounds, portrait/landscape navigation and
  terminated-app draft restoration. Physical device validation remains distinct.
- Real feedback testing found that the shared async action component discarded
  accessible labels and pressed states. It now forwards native button attributes
  and defaults to type=button so actions inside the composer cannot submit a chat.

## Next executable actions

1. Complete final-artifact installed-app and keyboard
   recordings against the final artifact.
2. Finish web-link retrieval, downloads/imports, sharing permissions,
   image workspace restoration and remaining enabled admin controls.
3. Complete the route/feature inventory; explicitly classify disabled deployment
   features and unresolved parity rather than silently omitting them.
4. Run final source checks and browser regressions; commit/publish reviewed changes.
5. Rehearse active-generation, multi-tab and rollback updates; measure final startup.
6. Promote the tested immutable artifact with a graceful proxy change, preserving
   the existing backend, active requests and previous frontend assets. Monitor and
   report the deployed revision and remaining validation limits.

## Dependency review

KaTeX and all nested copies are pinned to 0.18.2, addressing
[GHSA-238p-pmpm-9mq7](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7).
The remaining audit alerts are Homeframe's build-time `sharp` dependency:
[libheif](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c)
and [librsvg](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
It processes the checked-in branding asset during the build; it is not installed
or imported by the production static/proxy server. No untrusted uploaded image is
processed by that deployment process. Keep build inputs trusted and track an
upstream patched image-tool release.

## Final authentication and performance checks

A disposable staging user completed real MFA enrollment, TOTP confirmation,
recovery-code sign-in and security-status refresh. Its account was removed and
the staging-only policy restored. An OAuth callback regression test verifies
that the one-use MFA cookie is consumed once, stale Authorization headers are
cleared, and the verified session reaches the workspace. No external identity
provider was used in that fixture.

Five cold and five warm Chromium runs per frontend used the same isolated backend,
1440×980 viewport, a fresh browser context per cold run and service workers blocked.
Timing ends when the editable composer becomes visible; warm runs revisit the
same route in that context. These are local browser measurements, not WAN latency
or model response latency. Baseline selector was upstream `#chat-input`.

| Frontend | Cold median (range), ms | Warm median (range), ms | Median requests until composer |
| --- | --- | --- | --- |
| Upstream 0.12.3 | 1040 (995–1052) | 444 (415–454) | 222 |
| Studio AI | 156 (154–164) | 123 (91–124) | 17 |

The staging update rehearsal retained a real 120-item Qwen response during
promotion, blocked activation requested by another tab until generation finished,
updated both tabs, rolled back at the same worker identity and restored the
candidate. Production switching remains a separate gate.
