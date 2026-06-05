/**
 * End-to-end test plan — validates booking system from API layer through business logic.
 *
 * Architecture under test:
 *   MockProvider (6 fixtures) → BookingServiceImpl + InMemorySeatLockService
 *
 * Flow tested: search → select trip → select seats → book → confirm
 * Plus: cancel, expiry, live seat map, edge cases, concurrent bookings
 *
 * Zero external dependencies — pure in-memory tests, fast startup.
 * Run as part of vitest suite alongside unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  BookingServiceImpl,
  InMemorySeatLockService,
  MockProvider,
  BookingError,
} from "../src/index";

// ── helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function expectErrorCode(p: Promise<unknown>, code: string) {
  try {
    await p;
    expect.unreachable(`Expected BookingError code "${code}" but resolved`);
  } catch (err) {
    expect(err).toBeInstanceOf(BookingError);
    expect((err as BookingError).code).toBe(code);
  }
}

// ── setup ───────────────────────────────────────────────────────────

function fresh() {
  const provider = new MockProvider();
  const locks = new InMemorySeatLockService();
  const bookings = new BookingServiceImpl(provider, locks);
  return { provider, locks, bookings };
}

// ── E2E: Core Booking Flow ──────────────────────────────────────────

describe("E2E: booking flow", () => {
  it("search → select trip → book seat → confirm", async () => {
    const { provider, bookings } = fresh();

    // 1. Search trips from Bangkok
    const { trips } = await provider.searchTrips({ origin: "Bangkok" });
    expect(trips.length).toBeGreaterThanOrEqual(1);
    const cmTrip = trips.find((t) => t.id === "bkk-chiang-mai")!;
    expect(cmTrip).toBeDefined();
    expect(cmTrip.availableSeatCount).toBe(35);

    // 2. Get trip detail
    const trip = await provider.getTrip(cmTrip.id);
    expect(trip!.origin).toBe("Bangkok");
    expect(trip!.destination).toBe("Chiang Mai");

    // 3. View seat map with live status
    const seats = await bookings.getLiveSeatMap(cmTrip.id);
    const available = seats.filter((s) => s.status === "available");
    expect(available.length).toBe(35);

    // 4. Book seat 1A
    const booking = await bookings.createBooking(cmTrip.id, ["1A"], "passenger-1");
    expect(booking.status).toBe("pending");
    expect(booking.seatIds).toEqual(["1A"]);

    // 5. Confirm
    const confirmed = await bookings.confirmBooking(booking.id);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.events.length).toBeGreaterThanOrEqual(2);

    // 6. Seat now shows as booked
    const afterSeats = await bookings.getLiveSeatMap(cmTrip.id);
    const seat1A = afterSeats.find((s) => s.id === "1A")!;
    expect(seat1A.status).toBe("booked");
  });

  it("cancel a pending booking releases seats", async () => {
    const { bookings } = fresh();

    const booking = await bookings.createBooking("bkk-chiang-mai", ["1A"], "p-1");
    await bookings.cancelBooking(booking.id);

    // Seat should be available again
    const seats = await bookings.getLiveSeatMap("bkk-chiang-mai");
    const seat1A = seats.find((s) => s.id === "1A")!;
    expect(seat1A.status).toBe("available");
  });
});

// ── E2E: Concurrency ────────────────────────────────────────────────

describe("E2E: concurrency", () => {
  it("two users race for the last seat — exactly one wins", async () => {
    const { bookings, provider } = fresh();

    // Find single remaining seat
    const seats = await provider.getSeatMap("hat-yai-padang-besar");
    const last = seats.find((s) => s.status === "available")!;
    expect(last).toBeDefined();

    const results = await Promise.allSettled([
      bookings.createBooking("hat-yai-padang-besar", [last.id], "user-a"),
      bookings.createBooking("hat-yai-padang-besar", [last.id], "user-b"),
    ]);

    const won = results.filter((r) => r.status === "fulfilled").length;
    const lost = results.filter((r) => r.status === "rejected").length;
    expect(won).toBe(1);
    expect(lost).toBe(1);

    if (results[1].status === "rejected") {
      expect(results[1].reason).toBeInstanceOf(BookingError);
      expect((results[1].reason as BookingError).code).toBe("SEAT_UNAVAILABLE");
    }
  });

  it("10 concurrent attempts → exactly 1 succeeds", async () => {
    const { bookings, provider } = fresh();
    const seats = await provider.getSeatMap("hat-yai-padang-besar");
    const last = seats.find((s) => s.status === "available")!;

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        bookings.createBooking("hat-yai-padang-besar", [last.id], `racer-${i}`)
      )
    );
    const won = results.filter((r) => r.status === "fulfilled").length;
    expect(won).toBe(1);
  });
});

// ── E2E: Lock Expiry ────────────────────────────────────────────────

describe("E2E: lock expiry", () => {
  it("confirm fails after lock expires", async () => {
    const { bookings, locks } = fresh();

    const booking = await bookings.createBooking("bkk-hua-hin", ["1A"], "p-1");

    // Simulate lock expiry
    await locks.forceReleaseAll(booking.id);
    await sleep(10);

    await expectErrorCode(bookings.confirmBooking(booking.id), "LOCK_EXPIRED");
  });

  it("releaseExpiredBookings sweeps pending bookings with dead locks", async () => {
    const { bookings, locks } = fresh();

    const b = await bookings.createBooking("bkk-hua-hin", ["1A"], "p-1");
    await locks.forceReleaseAll(b.id);
    await sleep(10);

    const expired = await bookings.releaseExpiredBookings();
    expect(expired.length).toBe(1);
    expect(expired[0].status).toBe("cancelled");
  });
});

// ── E2E: Edge Cases ─────────────────────────────────────────────────

describe("E2E: edge cases", () => {
  it("multi-seat booking all-or-nothing", async () => {
    const { bookings } = fresh();

    // Book 1A first — lock it
    await bookings.createBooking("bkk-chiang-mai", ["1A"], "holder");

    // Try booking [1A,2A] — should fail, even though 2A is free
    await expectErrorCode(
      bookings.createBooking("bkk-chiang-mai", ["1A", "2A"], "p-2"),
      "SEAT_UNAVAILABLE"
    );

    // 2A should NOT be locked (rollback)
    const seats = await bookings.getLiveSeatMap("bkk-chiang-mai");
    const seat2A = seats.find((s) => s.id === "2A")!;
    expect(seat2A.status).toBe("available");
  });

  it("double confirm throws INVALID_STATE_TRANSITION", async () => {
    const { bookings } = fresh();
    const b = await bookings.createBooking("bkk-chiang-mai", ["1A"], "p-1");
    await bookings.confirmBooking(b.id);
    await expectErrorCode(bookings.confirmBooking(b.id), "INVALID_STATE_TRANSITION");
  });

  it("confirm after cancel throws INVALID_STATE_TRANSITION", async () => {
    const { bookings } = fresh();
    const b = await bookings.createBooking("bkk-chiang-mai", ["1A"], "p-1");
    await bookings.cancelBooking(b.id);
    await expectErrorCode(bookings.confirmBooking(b.id), "INVALID_STATE_TRANSITION");
  });

  it("cancel confirmed throws INVALID_STATE_TRANSITION", async () => {
    const { bookings } = fresh();
    const b = await bookings.createBooking("bkk-chiang-mai", ["1A"], "p-1");
    await bookings.confirmBooking(b.id);
    await expectErrorCode(bookings.cancelBooking(b.id), "INVALID_STATE_TRANSITION");
  });

  it("sold-out trip: search returns trip but getLiveSeatMap shows zero available", async () => {
    const { bookings, provider } = fresh();

    const { trips } = await provider.searchTrips({});
    const soldOut = trips.find((t) => t.id === "bkk-pattaya")!;
    expect(soldOut.availableSeatCount).toBe(0);

    const seats = await bookings.getLiveSeatMap("bkk-pattaya");
    expect(seats.every((s) => s.status === "unavailable")).toBe(true);
  });

  it("van fixture shows non-bus vehicleType", async () => {
    const { provider } = fresh();
    const trip = await provider.getTrip("bkk-hua-hin");
    expect(trip!.vehicleType).toBe("van");
  });

  it("multi-segment trip has 240 seats (bus 40 + ferry 200)", async () => {
    const { provider } = fresh();
    const seats = await provider.getSeatMap("bkk-koh-samui");
    expect(seats.length).toBe(240);
  });

  it("RESOURCE_EXHAUSTED when maxBookings reached", async () => {
    const { bookings } = (() => {
      const p = new MockProvider();
      const l = new InMemorySeatLockService();
      const b = new BookingServiceImpl(p, l, { maxBookings: 3 });
      return { bookings: b };
    })();

    // Fill all 3 slots
    for (let i = 0; i < 3; i++) {
      const seatId = `${i + 1}A`;
      const b = await bookings.createBooking("bkk-chiang-mai", [seatId], `p-${i}`);
      await bookings.confirmBooking(b.id);
    }

    // 4th should fail
    await expectErrorCode(
      bookings.createBooking("bkk-chiang-mai", ["4A"], "p-overflow"),
      "RESOURCE_EXHAUSTED"
    );
  });
});

// ── E2E: LiveSeatMap Overlay ────────────────────────────────────────

describe("E2E: live seat map overlay", () => {
  it("bookings > locks > provider priority", async () => {
    const { provider, locks, bookings } = fresh();

    // 1. Provider baseline: seat 2A is available (not in the unavailable set)
    const baseline = await bookings.getLiveSeatMap("bkk-chiang-mai");
    const seat2A = baseline.find((s) => s.id === "2A")!;
    expect(seat2A.status).toBe("available");

    // 2. Lock 2A externally (simulates another session holding a lock)
    await locks.acquireLock("2A", "other-session", 600_000);
    const afterLock = await bookings.getLiveSeatMap("bkk-chiang-mai");
    const locked = afterLock.find((s) => s.id === "2A")!;
    expect(locked.status).toBe("locked");

    // Release lock so booking can proceed
    await locks.releaseLock("2A", "other-session");
    await sleep(10);

    // 3. Book 2A — pending booking with lock
    const booking = await bookings.createBooking("bkk-chiang-mai", ["2A"], "p-1");
    const afterBook = await bookings.getLiveSeatMap("bkk-chiang-mai");
    const booked = afterBook.find((s) => s.id === "2A")!;
    expect(booked.status).toBe("locked");

    // 4. Confirm booking — should show booked
    await bookings.confirmBooking(booking.id);
    const afterConfirm = await bookings.getLiveSeatMap("bkk-chiang-mai");
    const confirmed = afterConfirm.find((s) => s.id === "2A")!;
    expect(confirmed.status).toBe("booked");
  });
});
