# Pinned Homeframe runtime

`builtbyted-homeframe-0.1.18-studio.5.tgz` is Homeframe 0.1.18 with tested iOS keyboard corrections:

- Counter Safari page panning without reclaiming the user's thread scroll.
- Keep keyboard avoidance constant during compensated viewport panning.
- Avoid double-counting browser toolbar movement.
- Route vertical drags beginning on dock controls to the existing conversation
  scroller, preserving taps and preventing Safari from moving the whole page.

Source: BuiltByTed/Homeframe `d8971fd`, based on `adf3fb4` (0.1.18).
The cumulative source patch, MIT license and source maps are included. The public
npm release is unchanged. SHA-256:

```
6f5a14a91425b6c4725269935cbbd9cb5c62511f30be1706444508f98feef758
```

Rebuild: apply `homeframe-ios-keyboard.patch` to `adf3fb4`; run Homeframe's
`typecheck`, `test:unit`, `build`, `test:e2e` and `check:package` scripts. Copy
`packages/homeframe/dist`, `package.json`, README and LICENSE into an isolated
packaging directory, set its version to `0.1.18-studio.5`, and run `npm pack`.
Never change this archive without a new version and lockfile entry.

Validation: 197 unit tests, 68 browser tests, typecheck, build and package-contract
checks passed. Both new regressions failed before their fixes. Native application
verification and its limits are recorded in the application release report.
