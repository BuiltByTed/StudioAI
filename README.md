# Studio AI

Your personal AI workspace, built by Ted. Studio AI is an independently maintained
fork of [Open WebUI](https://github.com/open-webui/open-webui) with a React interface
built on [Homeframe](https://github.com/BuiltByTed/Homeframe).

Studio AI is deployed with the Homeframe React interface. See the
[release report](docs/homeframe/RELEASE-2026-10-19.md) for verification, migration
and remaining feature limitations.

## Development

The React application lives in [`homeframe-ui`](homeframe-ui/README.md). It targets
the existing 0.12.3 backend and preserves its data and API contracts. Read the
[Homeframe runbook](homeframe-ui/docs/HOMEFRAME_RUNBOOK.md) before changing the shell.

```sh
cd homeframe-ui
npm ci
npm run check
npm run test:e2e
```

## Upstream and licensing

Original backend and frontend sources remain available for compatibility and
upstream maintenance. See the preserved [upstream documentation](docs/upstream/README.md),
[LICENSE](LICENSE), and [LICENSE_HISTORY](LICENSE_HISTORY). The upstream branding
requirements and their stated exemptions still apply to deployments of this fork.
The Studio AI branding does not change those license terms.
