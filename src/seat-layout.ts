import type { Seat, SeatPhysicalStatus, SeatRuntimeStatus } from './types.js';

/**
 * PRD-compatible seat layout row.
 * Matches the FR-002 format: rows[{row, seats:["A1","A2","aisle","A3","A4"]}]
 */
export interface SeatRow {
  row: number;
  seats: string[]; // seat IDs like "1A", "2B" — "aisle" represents an aisle gap
}

/**
 * Convert PRD-style layout rows into flat Seat[] for internal use.
 * Useful when implementing a TripProvider from a layout descriptor.
 */
export function seatLayoutToFlat(
  rows: SeatRow[],
  deck: 'upper' | 'lower',
  status: SeatPhysicalStatus = 'available',
): Seat[] {
  const seats: Seat[] = [];
  for (const row of rows) {
    let colIndex = 0;
    for (const cell of row.seats) {
      if (cell === 'aisle') {
        colIndex++;
        continue;
      }
      const col = String.fromCharCode(65 + colIndex); // A, B, C, D...
      seats.push({
        id: cell,
        row: row.row,
        column: col,
        deck,
        status,
        metadata: {},
      });
      colIndex++;
    }
  }
  return seats;
}

/**
 * Convert flat Seat[] to PRD-style layout rows for frontend rendering.
 * Groups seats by row, inserts "aisle" markers where column gaps exist.
 */
export function flatToSeatLayout(
  seats: Seat[],
  includeAisleAt: number = 2, // default: aisle between columns 2 and 3 (A,B | C,D)
): SeatRow[] {
  const rowMap = new Map<number, Seat[]>();
  for (const s of seats) {
    const list = rowMap.get(s.row) || [];
    list.push(s);
    rowMap.set(s.row, list);
  }

  const result: SeatRow[] = [];
  const sortedRows = [...rowMap.keys()].sort((a, b) => a - b);

  for (const row of sortedRows) {
    const seatsInRow = rowMap.get(row)!.sort((a, b) =>
      a.column.localeCompare(b.column),
    );
    const cells: string[] = [];
    for (let i = 0; i < seatsInRow.length; i++) {
      if (i === includeAisleAt) {
        cells.push('aisle');
      }
      cells.push(seatsInRow[i].id);
    }
    result.push({ row, seats: cells });
  }

  return result;
}

/**
 * Convert LiveSeat[] (with runtime status) to a render-ready layout
 * with status annotations alongside seat IDs.
 */
export function liveSeatLayoutToRender(
  seats: { id: string; row: number; column: string; status: SeatRuntimeStatus }[],
  includeAisleAt: number = 2,
): { row: number; seats: { id: string; status: SeatRuntimeStatus }[] }[] {
  const layout = flatToSeatLayout(
    seats as Seat[],
    includeAisleAt,
  );

  return layout.map(row => ({
    row: row.row,
    seats: row.seats.map(cell => {
      if (cell === 'aisle') return { id: 'aisle', status: 'unavailable' as const };
      const seat = seats.find(s => s.id === cell)!;
      return { id: cell, status: seat.status };
    }),
  }));
}
