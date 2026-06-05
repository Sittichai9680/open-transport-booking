// Types
export type {
  Seat,
  SeatPhysicalStatus,
  SeatRuntimeStatus,
  LiveSeat,
  Trip,
  TripSummary,
  TripSearchQuery,
  TripSearchResult,
  VehicleType,
  Booking,
  BookingStatus,
  BookingEvent,
  BookingErrorCode,
} from './types.js';
export { BookingError } from './types.js';

// Interfaces
export type { TripProvider } from './trip-provider.js';
export type { SeatLockService } from './seat-lock-service.js';
export type { BookingService } from './booking-service.js';

// Implementations
export { BookingServiceImpl } from './booking-service.js';
export { InMemorySeatLockService } from './seat-lock-in-memory.js';
export { MockProvider } from './mock-provider.js';

// Utilities
export { reduceBooking } from './reducer.js';
export {
  seatLayoutToFlat,
  flatToSeatLayout,
  liveSeatLayoutToRender,
} from './seat-layout.js';
export type { SeatRow } from './seat-layout.js';
