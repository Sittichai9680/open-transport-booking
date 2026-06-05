export class InMemorySeatLockService {
    locks = new Map();
    timers = new Map();
    async acquireLock(seatId, bookingId, ttlMs) {
        const existing = this.locks.get(seatId);
        const now = Date.now();
        // Expired lock → auto-clear and allow acquire
        if (existing && existing.expiresAt <= now) {
            this.clearLock(seatId);
        }
        else if (existing) {
            return false; // still held by someone
        }
        this.locks.set(seatId, { bookingId, expiresAt: now + ttlMs });
        this.timers.set(seatId, setTimeout(() => this.clearLock(seatId), ttlMs));
        return true;
    }
    async releaseLock(seatId, bookingId) {
        const existing = this.locks.get(seatId);
        if (!existing || existing.bookingId !== bookingId)
            return;
        this.clearLock(seatId);
    }
    async renewLock(seatId, bookingId, ttlMs) {
        const existing = this.locks.get(seatId);
        if (!existing || existing.bookingId !== bookingId)
            return false;
        if (existing.expiresAt <= Date.now())
            return false;
        existing.expiresAt = Date.now() + ttlMs;
        this.locks.set(seatId, existing);
        // Reset timer
        const prev = this.timers.get(seatId);
        if (prev)
            clearTimeout(prev);
        this.timers.set(seatId, setTimeout(() => this.clearLock(seatId), ttlMs));
        return true;
    }
    async isLocked(seatId) {
        const existing = this.locks.get(seatId);
        if (!existing)
            return false;
        if (existing.expiresAt <= Date.now()) {
            this.clearLock(seatId);
            return false;
        }
        return true;
    }
    async getLockOwner(seatId) {
        const existing = this.locks.get(seatId);
        if (!existing)
            return null;
        if (existing.expiresAt <= Date.now()) {
            this.clearLock(seatId);
            return null;
        }
        return existing.bookingId;
    }
    async forceReleaseAll(bookingId) {
        let count = 0;
        for (const [seatId, entry] of this.locks) {
            if (entry.bookingId === bookingId) {
                this.clearLock(seatId);
                count++;
            }
        }
        return count;
    }
    clearLock(seatId) {
        this.locks.delete(seatId);
        const timer = this.timers.get(seatId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(seatId);
        }
    }
}
//# sourceMappingURL=seat-lock-in-memory.js.map