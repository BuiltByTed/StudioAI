# Upstream execution sandbox

`pyodideSandboxHost.ts` is copied without semantic changes from
`src/lib/pyodide/pyodideSandboxHost.ts` at Open WebUI v0.12.3. It remains covered by
the repository's upstream LICENSE and notices. Keeping this self-contained module
here avoids requiring Svelte's generated TypeScript configuration to build the
React client. Compare this file when upgrading the backend baseline.

It runs Python inside an iframe with `sandbox="allow-scripts"`, without
`allow-same-origin`, so generated code cannot access this application's session
storage or cookies. `../python.ts` adds serialized execution, bounded timeouts,
authenticated attachment loading, and cleanup on account change.
