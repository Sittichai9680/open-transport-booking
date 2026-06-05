# hotcache — open-transport-booking

**Last updated:** 2026-06-05 17:25 UTC+7
**Session:** Design review → grill-me → implementation → E2E tests → npm publish (unresolved)

## Files
- `src/` — 9 files — types, trip-provider, booking-service, seat-lock-service, seat-lock-in-memory, reducer, mock-provider, seat-layout, index
- `test/` — 7 files — 65 unit + 15 E2E = 80 tests passing
- `packages/seat-lock-redis/` — merged, 9 tests passing (Redis)
- `packages/bef-api/` — scaffolded (empty, ready for NestJS implementation)
- `DESIGN.md` — APPROVED, 20 decisions logged
- `PRD.md` — updated with implementation status, arch decision, package names
- `README.md`, `CHANGELOG.md`, `LICENSE`, `jsr.json`, `.gitignore`, `hotcache.md`

## State
- 80/80 tests passing, 8 test files, build clean (`tsc --strict`)
- Redis running via `brew services start redis`
- package.json: `@sittichai/bef-core` (npm account: sittichai)
- npm tokens cleared from ~/.npmrc — rate-limited from repeated publish attempts

## Next
- npm publish: needs `npm login` from YOUR terminal, then `npm publish --access public`
- JSR publish: needs browser OAuth (`npx jsr publish`)
- bef-api: implement NestJS controllers for REST endpoints (FR-001 search, FR-004 booking)
- publish @sittichai/seat-lock-redis separately after bef-core is published
