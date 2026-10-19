# Upstream route inventory

Derived from v0.12.3 `src/routes/**/+page.svelte`. A mapped route is not a parity claim.
Interactive features, editor options, realtime behavior and administrative submenus still require their own validation.

| Upstream route | Source | React migration |
| --- | --- | --- |
| `/` | `src/routes/(app)/+page.svelte` | Real streaming/reload, file context, code tools, temporary chat, prompts, feedback and settings; browser and native shell checks |
| `/admin` | `src/routes/(app)/admin/+page.svelte` | Typed recursive config editor plus advanced JSON; staged route/config load; not every live setting mutated |
| `/admin/analytics` | `src/routes/(app)/admin/analytics/+page.svelte` | Real staging load of reports; feedback rating/comment save/reload verified |
| `/admin/analytics/[tab]` | `src/routes/(app)/admin/analytics/[tab]/+page.svelte` | Real staging load of reports; feedback rating/comment save/reload verified |
| `/admin/evaluations` | `src/routes/(app)/admin/evaluations/+page.svelte` | Real staging load of reports; feedback rating/comment save/reload verified |
| `/admin/evaluations/[tab]` | `src/routes/(app)/admin/evaluations/[tab]/+page.svelte` | Real staging load of reports; feedback rating/comment save/reload verified |
| `/admin/functions` | `src/routes/(app)/admin/functions/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/admin/functions/create` | `src/routes/(app)/admin/functions/create/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/admin/functions/edit` | `src/routes/(app)/admin/functions/edit/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/admin/settings` | `src/routes/(app)/admin/settings/+page.svelte` | Typed recursive config editor plus advanced JSON; staged route/config load; not every live setting mutated |
| `/admin/settings/[tab]` | `src/routes/(app)/admin/settings/[tab]/+page.svelte` | Typed recursive config editor plus advanced JSON; staged route/config load; not every live setting mutated |
| `/admin/users` | `src/routes/(app)/admin/users/+page.svelte` | Real isolated pending account/group CRUD; members/permissions/revoke implemented |
| `/admin/users/[tab]` | `src/routes/(app)/admin/users/[tab]/+page.svelte` | Real isolated pending account/group CRUD; members/permissions/revoke implemented |
| `/automations` | `src/routes/(app)/automations/+page.svelte` | Homeframe editor; paused weekly create/reload/delete; execution not exercised |
| `/automations/[id]` | `src/routes/(app)/automations/[id]/+page.svelte` | Homeframe editor; paused weekly create/reload/delete; execution not exercised |
| `/c/[id]` | `src/routes/(app)/c/[id]/+page.svelte` | Real streaming/reload, file context, code tools, temporary chat, prompts, feedback and settings; browser and native shell checks |
| `/calendar` | `src/routes/(app)/calendar/+page.svelte` | Real recurring all-day series create/edit/delete; calendar management implemented |
| `/channels/[id]` | `src/routes/(app)/channels/[id]/+page.svelte` | Disabled in deployed configuration; channel UI not migrated; explicit unavailable state, data preserved |
| `/channels/[id]/encrypted` | `src/routes/(app)/channels/[id]/encrypted/+page.svelte` | Disabled in deployed configuration; channel UI not migrated; explicit unavailable state, data preserved |
| `/folders/[folderId]` | `src/routes/(app)/folders/[folderId]/+page.svelte` | Real folder create/edit/new conversation; default model, instructions and membership verified |
| `/home` | `src/routes/(app)/home/+page.svelte` | Real streaming/reload, file context, code tools, temporary chat, prompts, feedback and settings; browser and native shell checks |
| `/notes` | `src/routes/(app)/notes/+page.svelte` | Homeframe Markdown editor; real save/reload and unsaved navigation/reload; rich collaborative editing not migrated |
| `/notes/[id]` | `src/routes/(app)/notes/[id]/+page.svelte` | Homeframe Markdown editor; real save/reload and unsaved navigation/reload; rich collaborative editing not migrated |
| `/notes/new` | `src/routes/(app)/notes/new/+page.svelte` | Homeframe Markdown editor; real save/reload and unsaved navigation/reload; rich collaborative editing not migrated |
| `/playground` | `src/routes/(app)/playground/+page.svelte` | Real SSE response and save as conversation; local draft checkpoints |
| `/playground/completions` | `src/routes/(app)/playground/completions/+page.svelte` | Real SSE response and save as conversation; local draft checkpoints |
| `/playground/images` | `src/routes/(app)/playground/images/+page.svelte` | Real prompt generation and reference-image edit, bounded restored image history |
| `/workspace` | `src/routes/(app)/workspace/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/functions/create` | `src/routes/(app)/workspace/functions/create/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/knowledge` | `src/routes/(app)/workspace/knowledge/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/knowledge/[id]` | `src/routes/(app)/workspace/knowledge/[id]/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/knowledge/create` | `src/routes/(app)/workspace/knowledge/create/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/models` | `src/routes/(app)/workspace/models/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/models/create` | `src/routes/(app)/workspace/models/create/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/models/edit` | `src/routes/(app)/workspace/models/edit/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/prompts` | `src/routes/(app)/workspace/prompts/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/prompts/[id]` | `src/routes/(app)/workspace/prompts/[id]/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/prompts/create` | `src/routes/(app)/workspace/prompts/create/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/skills` | `src/routes/(app)/workspace/skills/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/skills/create` | `src/routes/(app)/workspace/skills/create/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/skills/edit` | `src/routes/(app)/workspace/skills/edit/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/tools` | `src/routes/(app)/workspace/tools/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/tools/create` | `src/routes/(app)/workspace/tools/create/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/workspace/tools/edit` | `src/routes/(app)/workspace/tools/edit/+page.svelte` | Homeframe editors; real create/reload/delete for models, knowledge, prompts, skills, tools and functions |
| `/auth` | `src/routes/auth/+page.svelte` | Real sign-in and session restore; fixture expired/item-level 401 checks; MFA/OAuth UI implemented, provider roundtrip not tested |
| `/error` | `src/routes/error/+page.svelte` | Homeframe recovery route; offline/API-unavailable fixtures verified |
| `/s/[id]` | `src/routes/s/[id]/+page.svelte` | Real shared snapshot and clone into a conversation |
| `/watch` | `src/routes/watch/+page.svelte` | Video-context redirect to Homeframe composer; external-video retrieval not verified |

## Additional Studio AI routes

`/search`, `/archive`, `/folders`, `/settings`, `/settings/security`,
`/settings/memories`, `/__homeframe/recovery` are also rendered inside the same
persistent shell. Search/archive and settings have staging smoke coverage; security
controls that revoke sessions or require a second factor are implemented but are
not represented as end-to-end PASS. Native tests use an isolated account.

## Scope and remaining parity

The deployed workspace has channels and app integrations disabled. They are not
secretly enabled or represented as complete. The new Notes editor supports text
and Markdown; it preserves unrelated server fields but does not implement the old
rich collaborative editor. Chat supports one selected model per generation; the
upstream simultaneous multi-model comparison and realtime voice-call interface
are not migrated. Dictation and read-aloud are separate supported controls.
No source routing count is a claim that every upstream interaction was tested.
