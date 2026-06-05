# hotcache — open-transport-booking

**Last updated:** 2026-06-05 14:01 UTC+7
**Session:** Design review → grill-me → implementation → publish prep

## Files changed
- `src/` — 9 files (types, trip-provider, booking-service, seat-lock-service, seat-lock-in-memory, reducer, mock-provider, seat-layout, index)
- `test/` — 6 files (56 tests, all passing)
- `DESIGN.md` — approved, 20 decisions logged
- `README.md`, `CHANGELOG.md`, `LICENSE`, `jsr.json`, `package.json`, `tsconfig.json`, `pnpm-workspace.yaml`, `.gitignore`
- `packages/seat-lock-redis/` — scaffolded, not merged

## Next step
- `npm login` then `npm publish --access public` (blocked on auth)
- `npx jsr publish` (blocked on auth)
- Redis tests need Docker: `docker run -d -p 6379:6379 redis:7` then `cd packages/seat-lock-redis && pnpm test`
