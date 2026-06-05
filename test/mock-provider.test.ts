import { describe, it, expect } from 'vitest';
import { MockProvider } from '../src/mock-provider.js';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('searchTrips({}) returns all 6 fixtures', async () => {
    const result = await provider.searchTrips({});
    expect(result.trips).toHaveLength(6);
    expect(result.total).toBe(6);
  });

  it('searchTrips filters by origin', async () => {
    const result = await provider.searchTrips({ origin: 'Bangkok' });
    expect(result.trips).toHaveLength(5);
    expect(result.trips.every(t => t.origin === 'Bangkok')).toBe(true);
  });

  it('searchTrips filters by destination', async () => {
    const result = await provider.searchTrips({ destination: 'Chiang Mai' });
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].id).toBe('bkk-chiang-mai');
  });

  it('searchTrips filters by vehicleType', async () => {
    const result = await provider.searchTrips({ vehicleType: 'van' });
    expect(result.trips).toHaveLength(2);
    expect(result.trips.every(t => t.vehicleType === 'van')).toBe(true);
  });

  it('searchTrips returns TripSummary with availableSeatCount', async () => {
    const result = await provider.searchTrips({});
    const chiangMai = result.trips.find(t => t.id === 'bkk-chiang-mai')!;
    expect(chiangMai.availableSeatCount).toBe(35);
  });

  it('getTrip returns metadata-only (no seats)', async () => {
    const trip = await provider.getTrip('bkk-chiang-mai');
    expect(trip).not.toBeNull();
    expect(trip!.id).toBe('bkk-chiang-mai');
    expect(trip!.origin).toBe('Bangkok');
    expect(trip!.destination).toBe('Chiang Mai');
    expect((trip as any).seats).toBeUndefined();
  });

  it('getTrip returns null for unknown id', async () => {
    const trip = await provider.getTrip('unknown');
    expect(trip).toBeNull();
  });

  it('getSeatMap returns seats with physical status only', async () => {
    const seats = await provider.getSeatMap('bkk-chiang-mai');
    expect(seats).toHaveLength(40);
    // All statuses are SeatPhysicalStatus
    for (const s of seats) {
      expect(['available', 'unavailable']).toContain(s.status);
    }
    expect(seats.filter(s => s.status === 'unavailable')).toHaveLength(5);
    expect(seats.filter(s => s.status === 'available')).toHaveLength(35);
  });

  it('sold-out fixture: all seats unavailable', async () => {
    const seats = await provider.getSeatMap('bkk-pattaya');
    expect(seats).toHaveLength(12);
    expect(seats.every(s => s.status === 'unavailable')).toBe(true);
  });

  it('single-seat fixture: exactly 1 available', async () => {
    const seats = await provider.getSeatMap('hat-yai-padang-besar');
    expect(seats.filter(s => s.status === 'available')).toHaveLength(1);
    expect(seats.filter(s => s.status === 'unavailable')).toHaveLength(11);
  });

  it('van fixture demonstrates non-bus vehicle type', async () => {
    const trip = await provider.getTrip('bkk-hua-hin');
    expect(trip!.vehicleType).toBe('van');
    const seats = await provider.getSeatMap('bkk-hua-hin');
    expect(seats).toHaveLength(12);
  });

  it('double-decker has upper and lower deck seats', async () => {
    const seats = await provider.getSeatMap('bkk-phuket');
    const upper = seats.filter(s => s.deck === 'upper');
    const lower = seats.filter(s => s.deck === 'lower');
    expect(upper.length).toBeGreaterThan(0);
    expect(lower.length).toBeGreaterThan(0);
  });
});
