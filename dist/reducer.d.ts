import type { BookingStatus, BookingEvent } from './types.js';
/**
 * Pure function: given an event stream, derive the current booking status.
 * No side effects. No I/O. Deterministic.
 *
 * State machine:
 *   (none) --BookingCreated--> pending
 *   pending --BookingConfirmed--> confirmed
 *   pending --BookingCancelled--> cancelled
 *
 * Invalid transitions (e.g. confirming cancelled) are NOT handled here —
 * they are prevented by BookingService before appending the event.
 * This reducer assumes a valid event sequence.
 */
export declare function reduceBooking(events: BookingEvent[]): BookingStatus;
//# sourceMappingURL=reducer.d.ts.map