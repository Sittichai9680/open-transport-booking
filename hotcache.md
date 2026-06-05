# hotcache — open-transport-booking

**Last updated:** 2026-06-05 23:25 UTC+14:27
**Session:** Design review → grill-me → implementation → publish attempts

## Files changed
- `src/` — 9 files (876 lines) — types, trip-provider, booking-service, seat-lock-service, seat-lock-in-memory, reducer, mock-provider, seat-layout, index
- `test/` — 6 files (584 lines) — 56 tests, all passing
- `DESIGN.md` — reviewed 8/10, APPROVED, 20 decisions logged
- `PRD.md` — gap-analyzed, 2 gaps fixed
- `README.md`, `CHANGELOG.md`, `LICENSE`, `jsr.json`, `package.json`, `tsconfig.json`, `pnpm-workspace.yaml`, `.gitignore`, `hotcache.md`

## Next step
- npm publish: needs browser OAuth (`npm login` in your terminal, then `npm publish --access public`)
- JSR publish: needs browser OAuth (`npx jsr publish`)
- Redis package: `feature/seat-lock-redis-scaffold` has full source, needs `docker run redis:7` for tests
