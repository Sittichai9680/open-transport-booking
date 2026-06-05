/** Physical seat status reported by the provider. Persistent. */
export type SeatPhysicalStatus = 'available' | 'unavailable';
/** Runtime seat status after overlay from locks + bookings. Transient. */
export type SeatRuntimeStatus = 'available' | 'locked' | 'booked' | 'unavailable';
export interface Seat {
    /** e.g. "1A", "12B" */
    id: string;
    row: number;
    column: string;
    /** Bus-specific; extensible via metadata on Trip */
    deck: 'upper' | 'lower';
    /** Physical inventory only — use BookingService.getLiveSeatMap() for runtime state */
    status: SeatPhysicalStatus;
    metadata?: Record<string, unknown>;
}
/** Seat with runtime status overlay (returned by getLiveSeatMap) */
export interface LiveSeat extends Omit<Seat, 'status'> {
    status: SeatRuntimeStatus;
}
export type VehicleType = 'bus' | 'van' | 'train' | 'boat' | 'ferry';
/** Metadata-only — no seats array; use getSeatMap() for seat data */
export interface Trip {
    id: string;
    origin: string;
    destination: string;
    departureTime: Date;
    arrivalTime: Date;
    operator: string;
    vehicleType: VehicleType;
    metadata?: Record<string, unknown>;
}
export type BookingEvent = {
    type: 'BookingCreated';
    bookingId: string;
    tripId: string;
    seatIds: string[];
    userId: string;
    timestamp: Date;
} | {
    type: 'BookingConfirmed';
    bookingId: string;
    timestamp: Date;
} | {
    type: 'BookingCancelled';
    bookingId: string;
    reason?: string;
    timestamp: Date;
} | {
    type: 'SeatLocked';
    seatId: string;
    bookingId: string;
    expiresAt: Date;
    timestamp: Date;
} | {
    type: 'SeatReleased';
    seatId: string;
    bookingId: string;
    timestamp: Date;
};
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export interface Booking {
    id: string;
    tripId: string;
    seatIds: string[];
    userId: string;
    status: BookingStatus;
    events: BookingEvent[];
    createdAt: Date;
    updatedAt: Date;
}
export interface TripSearchQuery {
    origin?: string;
    destination?: string;
    departureDate?: Date;
    vehicleType?: VehicleType;
}
export interface TripSummary {
    id: string;
    origin: string;
    destination: string;
    departureTime: Date;
    arrivalTime: Date;
    operator: string;
    vehicleType: VehicleType;
    availableSeatCount: number;
}
export interface TripSearchResult {
    trips: TripSummary[];
    total: number;
}
export type BookingErrorCode = 'SEAT_UNAVAILABLE' | 'LOCK_EXPIRED' | 'BOOKING_NOT_FOUND' | 'INVALID_STATE_TRANSITION' | 'CONCURRENT_MODIFICATION' | 'RESOURCE_EXHAUSTED';
export declare class BookingError extends Error {
    code: BookingErrorCode;
    constructor(message: string, code: BookingErrorCode);
}
//# sourceMappingURL=types.d.ts.map