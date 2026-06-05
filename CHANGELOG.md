# Changelog

## 0.1.0 — 2026-06-05

Initial release. Framework-agnostic, zero-dependency TypeScript booking engine for transport booking systems.

### Core

- **`TripProvider` interface** — `searchTrips`, `getTrip`, `getSeatMap`
- **`BookingService` interface** — `createBooking`, `confirmBooking`, `cancelBooking`, `getBooking`, `getLiveSeatMap`, `releaseExpiredBookings`
- **`SeatLockService` interface** — `acquireLock`, `releaseLock`, `renewLock`, `isLocked`, `getLockOwner`, `forceReleaseAll`
- **`BookingServiceImpl`** — event-sourced booking with all-or-nothing multi-seat atomicity, deterministic lock ordering (lexicographic sort), bounded in-memory storage (default 10k), 15-minute reservation lock TTL
- **`InMemorySeatLockService`** — Map-based pessimistic locking with `setTimeout` expiry, emergency `forceReleaseAll`
- **`MockProvider`** — 6 fixtures (standard bus, sold-out, double-decker, multi-segment, van, single-seat remaining)
- **`reduceBooking()`** — pure function: `BookingEvent[]` → `BookingStatus`
- **`seatLayoutToFlat()` / `flatToSeatLayout()`** — bidirectional converter between PRD `rows[{row,seats:[]}]` format and flat `Seat[]` data format

### Domain Types

- `Seat` with `SeatPhysicalStatus` ('available' | 'unavailable')
- `LiveSeat` with `SeatRuntimeStatus` ('available' | 'locked' | 'booked' | 'unavailable')
- `Trip` (metadata-only, no seats array)
- `TripSummary` (lightweight search result with `availableSeatCount`)
- `Booking` with `BookingEvent[]` (event-sourced)
- `BookingError` with typed error codes

### Tests — 56 passing

- 6 reducer (pure function)
- 12 seat-lock (acquire/release/renew/expiry/forceReleaseAll)
- 12 mock-provider (search filters, physical inventory edge cases)
- 15 booking-service (CRUD, state machine, all-or-nothing, expiry, exhaustion)
- 4 concurrency (10-way race, lock expiry, idempotency, cancel→confirm)
- 7 seat-layout (round-trip, aisle, asymmetric rows)

### Build & Config

- TypeScript 5.x, `strict` mode, ESM-only
- `tsc` build → `dist/` with `.d.ts` + source maps
- `vitest` for testing
- pnpm workspace monorepo
- Zero runtime dependencies
- MIT license
