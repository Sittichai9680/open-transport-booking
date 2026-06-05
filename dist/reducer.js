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
export function reduceBooking(events) {
    let status = 'pending'; // default if empty (shouldn't happen in practice)
    let created = false;
    for (const event of events) {
        switch (event.type) {
            case 'BookingCreated':
                if (!created) {
                    status = 'pending';
                    created = true;
                }
                break;
            case 'BookingConfirmed':
                status = 'confirmed';
                break;
            case 'BookingCancelled':
                status = 'cancelled';
                break;
            // SeatLocked/SeatReleased don't affect booking status
        }
    }
    return created ? status : 'pending';
}
//# sourceMappingURL=reducer.js.map