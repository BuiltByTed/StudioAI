> **Deployment reverted to normal Open WebUI at Ted's request.** The public site
> uses the original backend-served interface directly. The Homeframe experiment
> below is retained as source history and is not deployed. Its build was cancelled;
> no automatic deployment is configured.

# Studio AI

Studio AI is Ted's independently maintained fork of
[Open WebUI](https://github.com/open-webui/open-webui). It keeps the original Svelte
interface and uses [Homeframe](https://github.com/BuiltByTed/Homeframe) for the
persistent application shell, viewport, keyboard handling, splash and PWA lifecycle.

The correction in `homeframe-bridge/` replaces the earlier React redesign. The
original composer, model picker, settings, navigation and feature screens remain.
Homeframe owns splash positioning. There is no top-of-sidebar close-menu button.

## Development

Use Node 20.19 or 22 for the original frontend, then Node 24 for the bridge:

```sh
CYPRESS_INSTALL_BINARY=0 npm ci
npm run crypto:verify
NODE_OPTIONS=--max-old-space-size=8192 npx vite build
# Switch to Node 24 before the next steps.
cd homeframe-bridge
npm ci
npm test
npm run build
npm run doctor
```

Build in this order: the bridge includes the original frontend's `build/` output.
The existing backend supplies `/static` and `/pyodide`. The deployable artifact is
`homeframe-bridge/dist`, not `homeframe-ui/dist`.

See the [bridge runbook](homeframe-bridge/README.md) and
[correction ledger](docs/homeframe/MINIMAL-INTEGRATION-PROGRESS.md) and
[release report](docs/homeframe/MINIMAL-INTEGRATION-RELEASE.md).
The earlier `homeframe-ui` implementation is retained for rollback/history; it is
not the current application source. Its deployment proxy remains shared.

## Upstream and licensing

See the preserved [upstream documentation](docs/upstream/README.md),
[LICENSE](LICENSE), and [LICENSE_HISTORY](LICENSE_HISTORY). Upstream branding
requirements and their exemptions still apply. Studio AI does not change them.
