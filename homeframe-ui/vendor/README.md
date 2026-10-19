# Pinned Homeframe compatibility build

`builtbyted-homeframe-0.1.18-studio.1.tgz` is an immutable build of Homeframe 0.1.18
with the accompanying source patch. It keeps viewport behavior inside Homeframe;
Studio AI does not implement a competing viewport controller. The package's MIT
license and source maps are included. Its SHA-256 is:

```
02418d2d81720841e9eb796cf4c85fe18412f6d12c3c3e63c019b8515fe1d7fa
```

The patch makes Homeframe counter iOS Safari's keyboard-related page panning, as
it already did in installed apps. It preserves user ownership of the route's
scroll position. The original regression displaced the header after a drag with
the software keyboard open. The corrected behavior passed a native iOS 27.0
Safari reproduction, 194 framework unit tests, and 68 framework browser tests.

Rebuild from the public Homeframe repository at the 0.1.18 release commit `adf3fb4`:

1. Apply `homeframe-ios-browser-pan.patch` at the repository root.
2. Run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run build`,
   `npm run test:e2e`, and `npm run check:package`.
3. Copy `packages/homeframe/dist`, its package metadata, README and MIT license
   into a packaging directory. Set that package version to `0.1.18-studio.1`.
4. Run `npm pack` there. Packaging timestamps or npm versions can affect the tar
   checksum; validate contents and source provenance before updating the lockfile.

This does not publish or change the global npm release of Homeframe. Replace the
compatibility package with an exact official version containing the fix after
repeating the device and update checks. Never silently modify the checked-in
archive without changing its version and lockfile integrity.
