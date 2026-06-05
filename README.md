# @bef/core

Framework-agnostic, zero-dependency TypeScript booking engine for transport booking systems.

```bash
npm install @bef/core
```

## Quickstart

```typescript
import { BookingServiceImpl, MockProvider, InMemorySeatLockService } from '@bef/core';

const provider = new MockProvider();
const locks = new InMemorySeatLockService();
const bookings = new BookingServiceImpl(provider, locks);

// Search trips
const { trips } = await provider.searchTrips({ origin: 'Bangkok' });

// Book seats
const booking = await bookings.createBooking('bkk-chiang-mai', ['1A', '1B'], 'user-123');

// Confirm
const confirmed = await bookings.confirmBooking(booking.id);
console.log(confirmed.status); // 'confirmed'

// Live seat map (locks + bookings overlaid on physical inventory)
const seats = await bookings.getLiveSeatMap('bkk-chiang-mai');
for (const s of seats) {
  console.log(`${s.id}: ${s.status}`); // 'available' | 'locked' | 'booked' | 'unavailable'
}
```

## Architecture

```
TripProvider (adapter)          SeatLockService (locking)
       |                                |
       v                                v
          BookingServiceImpl (core)
                  |
                  v
       Booking (event-sourced, events[])
                  |
                  v
       reduceBooking() (pure reducer)
```

Three interfaces, three implementations:

| Interface | Built-in | Production |
|---|---|---|
| `TripProvider` | `MockProvider` (6 fixtures) | You implement for your operator |
| `SeatLockService` | `InMemorySeatLockService` | `@bef/seat-lock-redis` (coming soon) |
| `BookingService` | `BookingServiceImpl` | Same class, pluggable adapters |

## Features

- **Event-sourced booking** — `BookingCreated → BookingConfirmed | BookingCancelled`
- **Seat locking** — 15-minute pessimistic reservation lock, all-or-nothing multi-seat atomicity, deterministic lock ordering (deadlock-free)
- **Provider abstraction** — `TripProvider` interface with `searchTrips()`, `getTrip()`, `getSeatMap()`
- **Seat status overlay** — `getLiveSeatMap()` merges provider physical inventory + runtime locks + confirmed bookings
- **Bounded storage** — configurable `maxBookings` (default 10,000), `RESOURCE_EXHAUSTED` safety valve
- **Concurrency tested** — 10-way race on last seat, lock expiry mid-checkout, idempotent confirm
- **Seat layout converter** — bidirectional `Seat[]` ↔ PRD rows format (with aisle markers)

## API

### TripProvider

```typescript
interface TripProvider {
  searchTrips(query: TripSearchQuery): Promise<TripSearchResult>;
  getTrip(tripId: string): Promise<Trip | null>;
  getSeatMap(tripId: string): Promise<Seat[]>;  // physical inventory only
}
```

### BookingService

```typescript
interface BookingService {
  createBooking(tripId, seatIds, userId): Promise<Booking>;
  confirmBooking(bookingId): Promise<Booking>;
  cancelBooking(bookingId, reason?): Promise<Booking>;
  getBooking(bookingId): Promise<Booking | null>;
  getLiveSeatMap(tripId): Promise<LiveSeat[]>;    // runtime overlay
  releaseExpiredBookings(): Promise<Booking[]>;     // consumer-owned scheduling
}
```

### SeatLockService

```typescript
interface SeatLockService {
  acquireLock(seatId, bookingId, ttlMs): Promise<boolean>;
  releaseLock(seatId, bookingId): Promise<void>;
  renewLock(seatId, bookingId, ttlMs): Promise<boolean>;
  isLocked(seatId): Promise<boolean>;
  getLockOwner(seatId): Promise<string | null>;
  forceReleaseAll(bookingId): Promise<number>;     // emergency cleanup
}
```

## MockProvider Fixtures

| ID | Trip | Seats |
|---|---|---|
| `bkk-chiang-mai` | BKK→Chiang Mai, 40 seats | 35 available, 5 unavailable |
| `bkk-pattaya` | BKK→Pattaya, 12 seats | All unavailable (sold-out) |
| `bkk-phuket` | BKK→Phuket, 48 seats | Double-decker |
| `bkk-koh-samui` | BKK→Koh Samui, 240 seats | Multi-segment (bus+ferry) |
| `bkk-hua-hin` | BKK→Hua Hin, 12 seats | Van |
| `hat-yai-padang-besar` | Hat Yai→Padang Besar, 12 seats | 1 seat remaining |

## Requirements

- Node.js 18+
- TypeScript 5.x (if importing types directly)
- Zero runtime dependencies

## License

MIT

## Links

- [GitHub](https://github.com/Sittichai9680/open-transport-booking)
- [Changelog](CHANGELOG.md)
- [Design Doc](DESIGN.md)
- [PRD](PRD.md)
