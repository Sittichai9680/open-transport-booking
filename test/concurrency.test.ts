import { describe, it, expect } from 'vitest';
import { BookingServiceImpl } from '../src/booking-service.js';
import { MockProvider } from '../src/mock-provider.js';
import { InMemorySeatLockService } from '../src/seat-lock-in-memory.js';
import { BookingError } from '../src/types.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    expect.fail(`Expected BookingError with code "${code}" but promise resolved`);
  } catch (err) {
    expect(err).toBeInstanceOf(BookingError);
    expect((err as BookingError).code).toBe(code);
  }
}

describe('Concurrency', () => {
  // Scenario 1: N-way race on last seat
  it('exactly 1 booking succeeds when 10 race for the last seat', async () => {
    const provider = new MockProvider();
    const locks = new InMemorySeatLockService();
    const svc = new BookingServiceImpl(provider, locks);

    const tripId = 'hat-yai-padang-besar';
    const seats = await provider.getSeatMap(tripId);
    const lastSeat = seats.find(s => s.status === 'available')!;
    expect(lastSeat).toBeDefined();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        svc.createBooking(tripId, [lastSeat.id], `user-${i}`),
      ),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;

    expect(fulfilled).toBe(1);
    expect(rejected).toBe(9);

    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(BookingError);
        expect(r.reason.code).toBe('SEAT_UNAVAILABLE');
      }
    }
  });

  // Scenario 2: Lock expiry mid-checkout
  it('throws LOCK_EXPIRED when confirming after lock expires', async () => {
    const provider = new MockProvider();
    const locks = new InMemorySeatLockService();
    const svc = new BookingServiceImpl(provider, locks);

    const booking = await svc.createBooking('bkk-hua-hin', ['1A'], 'user-1');
    await locks.forceReleaseAll(booking.id);
    await sleep(10);

    await expectErrorCode(svc.confirmBooking(booking.id), 'LOCK_EXPIRED');
  });

  // Scenario 3: Confirm after cancel
  it('throws INVALID_STATE_TRANSITION when confirming a cancelled booking', async () => {
    const provider = new MockProvider();
    const locks = new InMemorySeatLockService();
    const svc = new BookingServiceImpl(provider, locks);

    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    await svc.cancelBooking(booking.id);
    await expectErrorCode(svc.confirmBooking(booking.id), 'INVALID_STATE_TRANSITION');
  });

  // Scenario 4: Idempotent confirm
  it('throws INVALID_STATE_TRANSITION on double confirm', async () => {
    const provider = new MockProvider();
    const locks = new InMemorySeatLockService();
    const svc = new BookingServiceImpl(provider, locks);

    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    await svc.confirmBooking(booking.id);
    await expectErrorCode(svc.confirmBooking(booking.id), 'INVALID_STATE_TRANSITION');
  });
});
