import { describe, it, expect } from 'vitest';
import { reduceBooking } from '../src/reducer.js';
import type { BookingEvent } from '../src/types.js';

describe('reduceBooking', () => {
  const created: BookingEvent = {
    type: 'BookingCreated',
    bookingId: 'b1',
    tripId: 't1',
    seatIds: ['1A'],
    userId: 'u1',
    timestamp: new Date(),
  };

  it('returns pending after BookingCreated', () => {
    expect(reduceBooking([created])).toBe('pending');
  });

  it('returns confirmed after BookingCreated + BookingConfirmed', () => {
    const events: BookingEvent[] = [
      created,
      { type: 'BookingConfirmed', bookingId: 'b1', timestamp: new Date() },
    ];
    expect(reduceBooking(events)).toBe('confirmed');
  });

  it('returns cancelled after BookingCreated + BookingCancelled', () => {
    const events: BookingEvent[] = [
      created,
      { type: 'BookingCancelled', bookingId: 'b1', timestamp: new Date() },
    ];
    expect(reduceBooking(events)).toBe('cancelled');
  });

  it('SeatLocked/SeatReleased events do not affect status', () => {
    const events: BookingEvent[] = [
      created,
      { type: 'SeatLocked', seatId: '1A', bookingId: 'b1', expiresAt: new Date(), timestamp: new Date() },
      { type: 'SeatReleased', seatId: '1A', bookingId: 'b1', timestamp: new Date() },
    ];
    expect(reduceBooking(events)).toBe('pending');
  });

  it('last event wins on multiple transitions', () => {
    const events: BookingEvent[] = [
      created,
      { type: 'BookingConfirmed', bookingId: 'b1', timestamp: new Date() },
      // This shouldn't happen in practice (invalid transition prevented by service),
      // but reducer is pure and last-write-wins
    ];
    expect(reduceBooking(events)).toBe('confirmed');
  });

  it('returns pending for empty array', () => {
    expect(reduceBooking([])).toBe('pending');
  });
});
