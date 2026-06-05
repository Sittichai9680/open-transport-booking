import { describe, it, expect } from 'vitest';
import { seatLayoutToFlat, flatToSeatLayout } from '../src/seat-layout.js';

describe('seatLayoutToFlat', () => {
  it('converts PRD layout to flat Seat[]', () => {
    // A1=pos0→A, A2=pos1→B, aisle(skip), A3=pos2→D, A4=pos3→E
    // But we set includeAisle at col 2 (A,B | C,D), which is pos 2 after A3's label...
    // Actually: cell labels "A1","A2" sit at pos 0,1 → cols A,B
    // "aisle" skips, then "A3","A4" at pos 2,3 → cols D,E
    const rows = [
      { row: 1, seats: ['A1', 'A2', 'aisle', 'A3', 'A4'] },
      { row: 2, seats: ['B1', 'B2', 'aisle', 'B3', 'B4'] },
    ];
    const seats = seatLayoutToFlat(rows, 'lower');
    expect(seats).toHaveLength(8);
    expect(seats[0]).toMatchObject({ id: 'A1', row: 1, column: 'A', deck: 'lower' });
    // "A4" is cell position 3 (after aisle skip at pos 2) → column E
    expect(seats[3]).toMatchObject({ id: 'A4', row: 1, column: 'E', deck: 'lower' });
  });

  it('handles single row with no aisle', () => {
    const rows = [{ row: 1, seats: ['1A', '1B', '1C'] }];
    const seats = seatLayoutToFlat(rows, 'upper');
    expect(seats).toHaveLength(3);
    expect(seats[2]).toMatchObject({ id: '1C', column: 'C' });
  });

  it('all seats default to available status', () => {
    const rows = [{ row: 1, seats: ['1A'] }];
    const seats = seatLayoutToFlat(rows, 'lower');
    expect(seats[0].status).toBe('available');
  });

  it('accepts custom status', () => {
    const rows = [{ row: 1, seats: ['1A'] }];
    const seats = seatLayoutToFlat(rows, 'lower', 'unavailable');
    expect(seats[0].status).toBe('unavailable');
  });
});

describe('flatToSeatLayout', () => {
  it('converts flat Seat[] to PRD rows with aisle', () => {
    const seats = [
      { id: '1A', row: 1, column: 'A', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '1B', row: 1, column: 'B', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '1C', row: 1, column: 'C', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '1D', row: 1, column: 'D', deck: 'lower' as const, status: 'available' as const, metadata: {} },
    ];
    const layout = flatToSeatLayout(seats, 2);
    expect(layout).toHaveLength(1);
    expect(layout[0].row).toBe(1);
    expect(layout[0].seats).toEqual(['1A', '1B', 'aisle', '1C', '1D']);
  });

  it('round-trips PRD layout through flat and back', () => {
    const input = [
      { row: 1, seats: ['A1', 'A2', 'aisle', 'A3', 'A4'] },
      { row: 2, seats: ['B1', 'B2', 'aisle', 'B3', 'B4'] },
    ];
    const flat = seatLayoutToFlat(input, 'lower');
    const output = flatToSeatLayout(flat, 2);
    // Verify structure matches
    expect(output).toHaveLength(2);
    expect(output[0].seats.filter(s => s !== 'aisle')).toHaveLength(4);
    expect(output[0].seats).toEqual(['A1', 'A2', 'aisle', 'A3', 'A4']);
    expect(output[1].seats).toEqual(['B1', 'B2', 'aisle', 'B3', 'B4']);
  });

  it('handles asymmetric seats per row', () => {
    const seats = [
      { id: '1A', row: 1, column: 'A', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '1B', row: 1, column: 'B', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '2A', row: 2, column: 'A', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '2B', row: 2, column: 'B', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '2C', row: 2, column: 'C', deck: 'lower' as const, status: 'available' as const, metadata: {} },
      { id: '2D', row: 2, column: 'D', deck: 'lower' as const, status: 'available' as const, metadata: {} },
    ];
    const layout = flatToSeatLayout(seats, 2);
    expect(layout[0].seats).toEqual(['1A', '1B']);
    expect(layout[1].seats).toEqual(['2A', '2B', 'aisle', '2C', '2D']);
  });
});
