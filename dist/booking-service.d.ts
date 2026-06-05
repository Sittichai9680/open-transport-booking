import type { TripProvider } from './trip-provider.js';
import type { SeatLockService } from './seat-lock-service.js';
import type { Booking, LiveSeat } from './types.js';
export interface BookingService {
    createBooking(tripId: string, seatIds: string[], userId: string): Promise<Booking>;
    confirmBooking(bookingId: string): Promise<Booking>;
    cancelBooking(bookingId: string, reason?: string): Promise<Booking>;
    getBooking(bookingId: string): Promise<Booking | null>;
    /** Merges provider seat data + lock state + booking records with priority:
     *  bookings > locks > provider */
    getLiveSeatMap(tripId: string): Promise<LiveSeat[]>;
    /** Scans pending bookings, cancels any with expired locks. Consumer owns scheduling. */
    releaseExpiredBookings(): Promise<Booking[]>;
}
interface BookingServiceImplOptions {
    /** Maximum in-memory bookings. Default 10,000. Throws RESOURCE_EXHAUSTED if exceeded. */
    maxBookings?: number;
}
export declare class BookingServiceImpl implements BookingService {
    private tripProvider;
    private seatLockService;
    private bookings;
    private maxBookings;
    constructor(tripProvider: TripProvider, seatLockService: SeatLockService, options?: BookingServiceImplOptions);
    createBooking(tripId: string, seatIds: string[], userId: string): Promise<Booking>;
    confirmBooking(bookingId: string): Promise<Booking>;
    cancelBooking(bookingId: string, reason?: string): Promise<Booking>;
    getBooking(bookingId: string): Promise<Booking | null>;
    getLiveSeatMap(tripId: string): Promise<LiveSeat[]>;
    releaseExpiredBookings(): Promise<Booking[]>;
    private findBookingBySeat;
    private toLiveSeat;
    private cloneBooking;
}
export {};
//# sourceMappingURL=booking-service.d.ts.map