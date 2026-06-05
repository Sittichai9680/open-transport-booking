import type { Trip, TripSearchResult, TripSearchQuery, Seat } from './types.js';
import type { TripProvider } from './trip-provider.js';
export declare class MockProvider implements TripProvider {
    private trips;
    constructor();
    searchTrips(query: TripSearchQuery): Promise<TripSearchResult>;
    getTrip(tripId: string): Promise<Trip | null>;
    getSeatMap(tripId: string): Promise<Seat[]>;
}
//# sourceMappingURL=mock-provider.d.ts.map