> **Withdrawn at the user's request.** Normal Open WebUI is restored directly from
> the existing backend. No backend/database rollback was needed. A narrowly scoped
> retirement worker unregisters the former Homeframe worker, clears its own caches
> and reloads the original interface. Homeframe frontend services are disabled.

# Studio AI — original interface restored

This correction preserves Open WebUI's original Svelte interface, renames the
product Studio AI, and delegates its platform shell to Homeframe. It replaces the
separate React redesign. There is no extra sidebar close-menu control and no
application-owned splash positioning.

See the [verification ledger](MINIMAL-INTEGRATION-PROGRESS.md) and
[build/deployment runbook](../../homeframe-bridge/README.md).

Verified release artifact: `20261020014104-bc8d92cb`.
The final original Svelte build, bridge typecheck/build, strict Homeframe doctor,
crypto check, six browser tests and three proxy tests passed. Framework validation
passed 197 unit and 68 browser tests. Native Safari software-keyboard scrolling
passed on the final artifact; installed-app keyboard, landscape, navigation and
cold relaunch screenshots were inspected. The old UI's service-worker update
preserved an unsent draft and respected its update guard.

This is a frontend-only release. The existing backend and its database stay in
place, with no schema migration. Generated resources and the exact byte identity
of all 1,019 worker-cache entries were verified. Optional emoji artwork is fetched
on demand. No temporary geometry instrumentation is present in the release.

Public cutover verification is pending the promotion step. The previous listener
and immutable assets remain available for existing connections and rollback.

Limitations: simulator checks are not physical-iPhone certification; this campaign
verifies the Homeframe integration and representative original workflows, not every
Open WebUI feature, custom theme or external integration. Existing upstream build
warnings remain. No blanket claim of full application coverage is made.
