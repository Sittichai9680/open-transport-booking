# hotcache — open-transport-booking

**Last updated:** 2026-06-05 14:55 UTC+7
**Session:** Design review → grill-me → implementation

## Files
- `src/` — 9 files — types, trip-provider, booking-service, seat-lock-service, seat-lock-in-memory, reducer, mock-provider, seat-layout, index
- `test/` — 6 files — 56 core tests
- `packages/seat-lock-redis/` — merged, 9 tests passing (Redis)
- `DESIGN.md` — APPROVED, 20 decisions
- `README.md`, `CHANGELOG.md`, `LICENSE`, `jsr.json`, `.gitignore`, `hotcache.md`

## State
- 65/65 tests passing, 7 test files, build clean (`tsc --strict`)
- Redis running via `brew services start redis`

## Next
- npm publish: needs browser OAuth (`npm login`, `npm publish --access public`)
- JSR publish: needs browser OAuth (`npx jsr publish`)
