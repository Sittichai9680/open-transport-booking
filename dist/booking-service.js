import { BookingError } from './types.js';
import { reduceBooking } from './reducer.js';
export class BookingServiceImpl {
    tripProvider;
    seatLockService;
    bookings = new Map();
    maxBookings;
    constructor(tripProvider, seatLockService, options) {
        this.tripProvider = tripProvider;
        this.seatLockService = seatLockService;
        this.maxBookings = options?.maxBookings ?? 10_000;
    }
    async createBooking(tripId, seatIds, userId) {
        // Bounded storage check
        if (this.bookings.size >= this.maxBookings) {
            throw new BookingError(`Maximum bookings (${this.maxBookings}) exceeded`, 'RESOURCE_EXHAUSTED');
        }
        // Verify trip exists
        const trip = await this.tripProvider.getTrip(tripId);
        if (!trip) {
            throw new BookingError(`Trip ${tripId} not found`, 'BOOKING_NOT_FOUND');
        }
        // Verify all seats physically exist
        const seatMap = await this.tripProvider.getSeatMap(tripId);
        const seatMapIds = new Set(seatMap.map(s => s.id));
        for (const seatId of seatIds) {
            if (!seatMapIds.has(seatId)) {
                throw new BookingError(`Seat ${seatId} does not exist on trip ${tripId}`, 'SEAT_UNAVAILABLE');
            }
        }
        // Sort lexicographically for deterministic lock ordering (prevents deadlock)
        const sorted = [...seatIds].sort();
        const locked = [];
        try {
            // All-or-nothing lock acquire
            for (const seatId of sorted) {
                const acquired = await this.seatLockService.acquireLock(seatId, 'pending', 600_000); // 10 min default
                if (!acquired) {
                    throw new BookingError(`Seat ${seatId} is unavailable`, 'SEAT_UNAVAILABLE');
                }
                locked.push(seatId);
            }
        }
        catch (err) {
            // Best-effort rollback in inverse sorted order
            if (err instanceof BookingError) {
                for (let i = locked.length - 1; i >= 0; i--) {
                    try {
                        await this.seatLockService.releaseLock(locked[i], 'pending');
                    }
                    catch {
                        // Logged in production; leaked locks expire after TTL
                    }
                }
            }
            throw err;
        }
        // Update locks to use real bookingId (we need to create the booking first)
        // We used 'pending' as placeholder during acquire; re-lock with real ID
        const bookingId = crypto.randomUUID();
        const timestamp = new Date();
        // Release placeholder locks and re-acquire with real bookingId
        for (const seatId of sorted) {
            await this.seatLockService.releaseLock(seatId, 'pending');
            const acquired = await this.seatLockService.acquireLock(seatId, bookingId, 600_000);
            if (!acquired) {
                // Race condition: someone grabbed the seat between release and re-acquire
                // Best-effort cleanup
                for (const s of sorted) {
                    try {
                        await this.seatLockService.forceReleaseAll(bookingId);
                    }
                    catch { /* ignore */ }
                }
                throw new BookingError(`Seat ${seatId} was taken during booking`, 'SEAT_UNAVAILABLE');
            }
        }
        const event = {
            type: 'BookingCreated',
            bookingId,
            tripId,
            seatIds: sorted,
            userId,
            timestamp,
        };
        const booking = {
            id: bookingId,
            tripId,
            seatIds: sorted,
            userId,
            status: 'pending',
            events: [event],
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.bookings.set(bookingId, booking);
        return this.cloneBooking(booking);
    }
    async confirmBooking(bookingId) {
        const booking = this.bookings.get(bookingId);
        if (!booking) {
            throw new BookingError(`Booking ${bookingId} not found`, 'BOOKING_NOT_FOUND');
        }
        if (booking.status !== 'pending') {
            throw new BookingError(`Cannot confirm booking in status '${booking.status}'`, 'INVALID_STATE_TRANSITION');
        }
        // Verify locks still held
        for (const seatId of booking.seatIds) {
            const owner = await this.seatLockService.getLockOwner(seatId);
            if (owner !== bookingId) {
                throw new BookingError(`Lock on seat ${seatId} has expired or been taken`, 'LOCK_EXPIRED');
            }
        }
        const event = {
            type: 'BookingConfirmed',
            bookingId,
            timestamp: new Date(),
        };
        booking.events.push(event);
        booking.status = reduceBooking(booking.events);
        booking.updatedAt = event.timestamp;
        return this.cloneBooking(booking);
    }
    async cancelBooking(bookingId, reason) {
        const booking = this.bookings.get(bookingId);
        if (!booking) {
            throw new BookingError(`Booking ${bookingId} not found`, 'BOOKING_NOT_FOUND');
        }
        if (booking.status !== 'pending') {
            throw new BookingError(`Cannot cancel booking in status '${booking.status}'`, 'INVALID_STATE_TRANSITION');
        }
        // Release all locks
        for (const seatId of booking.seatIds) {
            try {
                await this.seatLockService.releaseLock(seatId, bookingId);
            }
            catch {
                // Best-effort; lock expires on its own
            }
        }
        const event = {
            type: 'BookingCancelled',
            bookingId,
            reason,
            timestamp: new Date(),
        };
        booking.events.push(event);
        booking.status = reduceBooking(booking.events);
        booking.updatedAt = event.timestamp;
        return this.cloneBooking(booking);
    }
    async getBooking(bookingId) {
        const booking = this.bookings.get(bookingId);
        return booking ? this.cloneBooking(booking) : null;
    }
    async getLiveSeatMap(tripId) {
        const seats = await this.tripProvider.getSeatMap(tripId);
        return Promise.all(seats.map(async (seat) => {
            // Check bookings for this seat (booked seats are immutable)
            const booked = this.findBookingBySeat(seat.id);
            if (booked && booked.status === 'confirmed') {
                return this.toLiveSeat(seat, 'booked');
            }
            // Check locks (pessimistic reservation)
            const locked = await this.seatLockService.isLocked(seat.id);
            if (locked) {
                // Don't mark as locked if there's a pending booking that owns it
                const owner = await this.seatLockService.getLockOwner(seat.id);
                if (owner && this.bookings.has(owner)) {
                    return this.toLiveSeat(seat, 'locked');
                }
                return this.toLiveSeat(seat, 'locked');
            }
            // Baseline from provider
            return this.toLiveSeat(seat, seat.status);
        }));
    }
    async releaseExpiredBookings() {
        const cancelled = [];
        for (const booking of this.bookings.values()) {
            if (booking.status !== 'pending')
                continue;
            // Check if any seat lock has expired
            let expired = false;
            for (const seatId of booking.seatIds) {
                const locked = await this.seatLockService.isLocked(seatId);
                const owner = await this.seatLockService.getLockOwner(seatId);
                if (!locked || owner !== booking.id) {
                    expired = true;
                    break;
                }
            }
            if (expired) {
                const copy = await this.cancelBooking(booking.id, 'Lock expired');
                cancelled.push(copy);
            }
        }
        return cancelled;
    }
    // ---- private helpers ----
    findBookingBySeat(seatId) {
        for (const booking of this.bookings.values()) {
            if (booking.seatIds.includes(seatId))
                return booking;
        }
    }
    toLiveSeat(seat, status) {
        const { status: _, ...rest } = seat;
        return { ...rest, status };
    }
    cloneBooking(booking) {
        return {
            ...booking,
            events: booking.events.map(e => ({ ...e })),
        };
    }
}
//# sourceMappingURL=booking-service.js.map