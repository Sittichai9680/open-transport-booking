import type { Trip, TripSummary, TripSearchResult, TripSearchQuery, Seat } from './types.js';
import type { TripProvider } from './trip-provider.js';

function seat(id: string, row: number, col: string, deck: 'upper' | 'lower', status: 'available' | 'unavailable'): Seat {
  return { id, row, column: col, deck, status, metadata: {} };
}

function makeSeats(count: number, deck: 'upper' | 'lower', cols: string[], unavailable: Set<string>): Seat[] {
  const seats: Seat[] = [];
  let seatIdx = 0;
  for (let row = 1; seatIdx < count; row++) {
    for (const col of cols) {
      if (seatIdx >= count) break;
      const id = `${row}${col}`;
      seats.push(seat(id, row, col, deck, unavailable.has(id) ? 'unavailable' : 'available'));
      seatIdx++;
    }
  }
  return seats;
}

const d = (s: string) => new Date(s);

interface Fixture {
  trip: Trip;
  seats: Seat[];
}

const fixtures: Fixture[] = [
  // 0: Standard bus
  {
    trip: {
      id: 'bkk-chiang-mai',
      origin: 'Bangkok',
      destination: 'Chiang Mai',
      departureTime: d('2026-06-10T08:00:00+07:00'),
      arrivalTime: d('2026-06-10T17:00:00+07:00'),
      operator: 'Sombat Tour',
      vehicleType: 'bus',
      metadata: {},
    },
    seats: makeSeats(40, 'lower', ['A', 'B', 'C', 'D'], new Set(['5A', '5B', '8C', '10D', '3D'])),
  },
  // 1: Sold-out
  {
    trip: {
      id: 'bkk-pattaya',
      origin: 'Bangkok',
      destination: 'Pattaya',
      departureTime: d('2026-06-10T10:00:00+07:00'),
      arrivalTime: d('2026-06-10T12:30:00+07:00'),
      operator: 'Roong Reuang Coach',
      vehicleType: 'bus',
      metadata: {},
    },
    seats: makeSeats(12, 'lower', ['A', 'B', 'C'], new Set(['1A','1B','1C','2A','2B','2C','3A','3B','3C','4A','4B','4C'])),
  },
  // 2: Double-decker
  {
    trip: {
      id: 'bkk-phuket',
      origin: 'Bangkok',
      destination: 'Phuket',
      departureTime: d('2026-06-10T19:00:00+07:00'),
      arrivalTime: d('2026-06-11T07:00:00+07:00'),
      operator: 'Transport Co.',
      vehicleType: 'bus',
      metadata: {},
    },
    seats: [
      ...makeSeats(24, 'upper', ['A', 'B', 'C'], new Set(['3B', '5A', '6C', '8A'])),
      ...makeSeats(24, 'lower', ['A', 'B', 'C'], new Set(['2A', '4B', '7C'])),
    ],
  },
  // 3: Multi-segment (bus + ferry)
  {
    trip: {
      id: 'bkk-koh-samui',
      origin: 'Bangkok',
      destination: 'Koh Samui',
      departureTime: d('2026-06-10T06:00:00+07:00'),
      arrivalTime: d('2026-06-10T18:00:00+07:00'),
      operator: 'Lomprayah',
      vehicleType: 'ferry',
      metadata: { segments: ['bus', 'ferry'] },
    },
    seats: [
      ...makeSeats(40, 'lower', ['A', 'B', 'C', 'D'], new Set(['3C', '7A', '10D'])),
      ...makeSeats(200, 'lower', ['A', 'B', 'C', 'D'], new Set()),
    ],
  },
  // 4: Van
  {
    trip: {
      id: 'bkk-hua-hin',
      origin: 'Bangkok',
      destination: 'Hua Hin',
      departureTime: d('2026-06-10T14:00:00+07:00'),
      arrivalTime: d('2026-06-10T17:00:00+07:00'),
      operator: 'JP Van',
      vehicleType: 'van',
      metadata: {},
    },
    seats: makeSeats(12, 'lower', ['A', 'B', 'C'], new Set(['1A', '4C'])),
  },
  // 5: Single-seat remaining
  {
    trip: {
      id: 'hat-yai-padang-besar',
      origin: 'Hat Yai',
      destination: 'Padang Besar',
      departureTime: d('2026-06-10T09:00:00+07:00'),
      arrivalTime: d('2026-06-10T10:00:00+07:00'),
      operator: 'Local Van',
      vehicleType: 'van',
      metadata: {},
    },
    seats: makeSeats(12, 'lower', ['A', 'B', 'C'], new Set(['1A','1B','1C','2A','2B','2C','3A','3B','3C','4B','4C'])),
  },
];

export class MockProvider implements TripProvider {
  private trips: Map<string, { trip: Trip; seats: Seat[] }>;

  constructor() {
    this.trips = new Map(fixtures.map(f => [f.trip.id, f]));
  }

  async searchTrips(query: TripSearchQuery): Promise<TripSearchResult> {
    let results: TripSummary[] = [];

    for (const { trip, seats } of this.trips.values()) {
      if (query.origin && trip.origin !== query.origin) continue;
      if (query.destination && trip.destination !== query.destination) continue;
      if (query.departureDate) {
        const qDate = query.departureDate.toDateString();
        const tDate = trip.departureTime.toDateString();
        if (qDate !== tDate) continue;
      }
      if (query.vehicleType && trip.vehicleType !== query.vehicleType) continue;

      const availableSeatCount = seats.filter(s => s.status === 'available').length;
      results.push({
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        operator: trip.operator,
        vehicleType: trip.vehicleType,
        availableSeatCount,
      });
    }

    return { trips: results, total: results.length };
  }

  async getTrip(tripId: string): Promise<Trip | null> {
    const fixture = this.trips.get(tripId);
    return fixture ? { ...fixture.trip, metadata: { ...fixture.trip.metadata } } : null;
  }

  async getSeatMap(tripId: string): Promise<Seat[]> {
    const fixture = this.trips.get(tripId);
    return fixture ? fixture.seats.map(s => ({ ...s, metadata: { ...s.metadata } })) : [];
  }
}
