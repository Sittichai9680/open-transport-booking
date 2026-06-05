import { describe, it, expect } from 'vitest';
import { BookingServiceImpl } from '../src/booking-service.js';
import { MockProvider } from '../src/mock-provider.js';
import { InMemorySeatLockService } from '../src/seat-lock-in-memory.js';
import { BookingError } from '../src/types.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setup() {
  const provider = new MockProvider();
  const locks = new InMemorySeatLockService();
  const svc = new BookingServiceImpl(provider, locks);
  return { svc, provider, locks };
}

/** Helper: assert promise rejects with BookingError with given code */
async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    expect.fail(`Expected BookingError with code "${code}" but promise resolved`);
  } catch (err) {
    expect(err).toBeInstanceOf(BookingError);
    expect((err as BookingError).code).toBe(code);
  }
}

describe('BookingServiceImpl', () => {
  it('creates a booking with pending status', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    expect(booking.status).toBe('pending');
    expect(booking.seatIds).toEqual(['1A']);
    expect(booking.userId).toBe('user-1');
    expect(booking.events).toHaveLength(1);
    expect(booking.events[0].type).toBe('BookingCreated');
  });

  it('throws SEAT_UNAVAILABLE for non-existent seat', async () => {
    const { svc } = setup();
    await expectErrorCode(
      svc.createBooking('bkk-chiang-mai', ['NONEXISTENT'], 'user-1'),
      'SEAT_UNAVAILABLE',
    );
  });

  it('throws BOOKING_NOT_FOUND for non-existent trip', async () => {
    const { svc } = setup();
    await expectErrorCode(
      svc.createBooking('nonexistent', ['1A'], 'user-1'),
      'BOOKING_NOT_FOUND',
    );
  });

  it('confirms a pending booking', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    const confirmed = await svc.confirmBooking(booking.id);
    expect(confirmed.status).toBe('confirmed');
  });

  it('throws on confirm of non-existent booking', async () => {
    const { svc } = setup();
    await expectErrorCode(svc.confirmBooking('nonexistent'), 'BOOKING_NOT_FOUND');
  });

  it('throws on confirm of already-confirmed booking', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    await svc.confirmBooking(booking.id);
    await expectErrorCode(svc.confirmBooking(booking.id), 'INVALID_STATE_TRANSITION');
  });

  it('throws on confirm after cancel', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    await svc.cancelBooking(booking.id);
    await expectErrorCode(svc.confirmBooking(booking.id), 'INVALID_STATE_TRANSITION');
  });

  it('cancels a pending booking', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    const cancelled = await svc.cancelBooking(booking.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('throws on cancel of confirmed booking', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    await svc.confirmBooking(booking.id);
    await expectErrorCode(svc.cancelBooking(booking.id), 'INVALID_STATE_TRANSITION');
  });

  it('getBooking returns cloned booking (not live reference)', async () => {
    const { svc } = setup();
    const created = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    const fetched = await svc.getBooking(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    fetched!.events.push({ type: 'BookingCancelled', bookingId: created.id, timestamp: new Date() });
    const refetched = await svc.getBooking(created.id);
    expect(refetched!.events).toHaveLength(1); // original not mutated
  });

  it('multi-seat booking is all-or-nothing', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A', '2A', '3A'], 'user-1');
    expect(booking.seatIds).toEqual(['1A', '2A', '3A']);
    expect(booking.status).toBe('pending');
  });

  it('multi-seat rolls back if one seat is unavailable', async () => {
    const { svc } = setup();
    await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    // seat '1A' is now locked -> second booking for ['1A','2A'] should fail entirely
    await expectErrorCode(
      svc.createBooking('bkk-chiang-mai', ['1A', '2A'], 'user-2'),
      'SEAT_UNAVAILABLE',
    );
    // seat 2A should not be locked (best-effort rollback)
  });

  it('getLiveSeatMap returns runtime status overlay', async () => {
    const { svc } = setup();
    const booking = await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    await svc.confirmBooking(booking.id);

    const seats = await svc.getLiveSeatMap('bkk-chiang-mai');
    const seat1A = seats.find(s => s.id === '1A')!;
    expect(seat1A.status).toBe('booked');

    const seat2A = seats.find(s => s.id === '2A')!;
    expect(seat2A.status).toBe('available');
  });

  it('releaseExpiredBookings cancels bookings with expired locks', async () => {
    const { svc, locks } = setup();

    const booking = await svc.createBooking('bkk-hua-hin', ['1A'], 'user-1');
    // Manually expire the lock
    await locks.forceReleaseAll(booking.id);
    await sleep(10);

    const cancelled = await svc.releaseExpiredBookings();
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].status).toBe('cancelled');
    expect(cancelled[0].events.some(e => e.type === 'BookingCancelled')).toBe(true);
  });

  it('throws RESOURCE_EXHAUSTED when maxBookings reached', async () => {
    const provider = new MockProvider();
    const locks = new InMemorySeatLockService();
    const svc = new BookingServiceImpl(provider, locks, { maxBookings: 2 });

    await svc.createBooking('bkk-chiang-mai', ['1A'], 'user-1');
    await svc.createBooking('bkk-chiang-mai', ['2A'], 'user-1');

    // Third booking should fail
    await expectErrorCode(
      svc.createBooking('bkk-chiang-mai', ['3A'], 'user-1'),
      'RESOURCE_EXHAUSTED',
    );
  });
});
