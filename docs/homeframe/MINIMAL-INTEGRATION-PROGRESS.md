# Original-interface correction

The separate React redesign was rejected. Studio AI now builds the original Open
WebUI Svelte interface inside a minimal Homeframe React host. The original screens,
controls, styling, SvelteKit routing and backend remain authoritative.

## Completed implementation and verification

- Root Svelte source builds; original frontend dependencies are unchanged.
- Homeframe alone owns viewport, keyboard avoidance, persistent shell, splash,
  generated startup images, manifest and service-worker lifecycle. No custom
  application splash-position CSS. No top-of-sidebar close control.
- Svelte actions attach existing header, sidebar, composer, scroll and modal nodes
  to Homeframe regions without reimplementing their content.
- Browser regression: six tests pass across desktop/mobile, covering the original
  composer/model picker, sidebar, draft, Notes, Workspace, Playground, Automations,
  Calendar, back/forward, persistent shell/scroller and original Settings dialog.
- Three proxy tests pass, including existing streams during release promotion,
  raw WebSocket forwarding, API/auth/upload boundaries, retained chunks, PDF module
  MIME types, WebAssembly and exact unknown static-file bytes.
- Strict bridge Homeframe doctor: zero issues. This validates the bridge and its
  output; it is not a claim that the checker statically audits every Svelte file.
- Crypto verification passes. Existing upstream Svelte compiler warnings remain.
- Real isolated staging chat completion persisted and rendered after reload.
- Native iPhone 18 Pro / iOS 27.0 Safari: final artifact passes ten alternating
  software-keyboard-open drags, including floating dock controls; draft retained,
  header/composer usable, Notes navigation and sidebar dismissal work.
- Installed Home Screen app: keyboard scrolling, Notes, landscape and cold relaunch
  pass; actual screenshots inspected. Installation name is Studio AI and assets
  come from Homeframe. A distinct label was used only for the QA shortcut.
- Final runtime package: Homeframe 0.1.18-studio.5, source patch included. Framework
  checks pass: 197 unit tests, 68 browser tests, typecheck/build/package contract.
- Final artifact: `20261020014104-bc8d92cb`. Production output contains no optional
  viewport trace code. All 1,019 precached resources passed exact byte verification.
- Fresh staging worker installation passed in 2,229 ms (one local observation,
  not a performance distribution). Optional emoji artwork loads on demand instead
  of adding 3,838 requests to initial worker installation.
- Prior deployed React UI -> corrected Svelte UI upgrade passed at one origin:
  activation deferred with an unsent draft; after safe navigation the final worker
  activated and the original composer restored the same draft.

## Defects found and repaired

Early native accessibility assertions passed even while screenshots showed the
composer slipping behind keyboard controls. Actual visual inspection and viewport
traces exposed the defect; those early assertion-only runs are not counted as proof.

Homeframe now keeps keyboard avoidance constant during Safari panning, avoids
counting toolbar movement twice, and routes dock-control drags to the conversation
instead of Safari's document. Nested SVG hit targets are covered too. A measured
Safari run contained 287 samples with page scroll/header top both exactly zero and
zero composer-bottom error while thread scroll ranged from 393 to 781 px.

The deploy proxy previously treated unknown static extensions as document routes.
This broke worker integrity and module workers. It now serves exact asset bytes and
correct media/module types. The bridge omits the conflicting upstream manifest and
unneeded public documentation. Worker activation is verified, not inferred from
registration alone.

## Data, deployment and boundaries

No backend schema change or database migration is required. The existing SQLite
schema remains `0bd252b206fb`; the backend, uploads and server configuration remain
in place. The earlier React UI already mirrors drafts to the original session shape;
that compatibility was tested during the actual worker upgrade.

Deploy a separate frontend listener and change the existing reverse proxy
upstream gracefully. Retain the old listener and immutable releases for in-flight
connections and rollback. The public cutover is recorded in the release report.
No Unraid storage or Docker resources were created or modified.

This is focused shell/integration validation, not exhaustive testing of every
original Open WebUI feature. Real-device keyboards, third-party OAuth, live voice,
all accessibility modes and all custom themes remain outside this campaign.
Private operator artifacts contain screenshots, logs and xcresult bundles; raw
native logs can include typing diagnostics and must not be published.
