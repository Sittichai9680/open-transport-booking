import type { SeatLockService } from './seat-lock-service.js';
export declare class InMemorySeatLockService implements SeatLockService {
    private locks;
    private timers;
    acquireLock(seatId: string, bookingId: string, ttlMs: number): Promise<boolean>;
    releaseLock(seatId: string, bookingId: string): Promise<void>;
    renewLock(seatId: string, bookingId: string, ttlMs: number): Promise<boolean>;
    isLocked(seatId: string): Promise<boolean>;
    getLockOwner(seatId: string): Promise<string | null>;
    forceReleaseAll(bookingId: string): Promise<number>;
    private clearLock;
}
//# sourceMappingURL=seat-lock-in-memory.d.ts.map