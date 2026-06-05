import type { Trip, TripSearchQuery, TripSearchResult, Seat } from './types.js';

export interface TripProvider {
  /** Lightweight search — returns TripSummary[], no seat arrays */
  searchTrips(query: TripSearchQuery): Promise<TripSearchResult>;
  /** Full detail with trip metadata (no seats — use getSeatMap for seats) */
  getTrip(tripId: string): Promise<Trip | null>;
  /** Physical inventory only — status is 'available' | 'unavailable' */
  getSeatMap(tripId: string): Promise<Seat[]>;
}
