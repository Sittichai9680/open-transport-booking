export interface SeatLockService {
    acquireLock(seatId: string, bookingId: string, ttlMs: number): Promise<boolean>;
    releaseLock(seatId: string, bookingId: string): Promise<void>;
    renewLock(seatId: string, bookingId: string, ttlMs: number): Promise<boolean>;
    isLocked(seatId: string): Promise<boolean>;
    getLockOwner(seatId: string): Promise<string | null>;
    /** Emergency cleanup — releases all locks held by bookingId. Returns count released. */
    forceReleaseAll(bookingId: string): Promise<number>;
}
//# sourceMappingURL=seat-lock-service.d.ts.map