import type { SeatLockService } from '@bef/core';
import { Redis } from 'ioredis';

/**
 * Redis-backed SeatLockService.
 *
 * Atomicity:
 * - acquireLock: SET seat:{seatId}:lock {bookingId} NX PX {ttlMs}
 * - releaseLock: Lua script — check owner matches before DEL
 * - renewLock: PEXPIRE if owner matches
 * - forceReleaseAll: SCAN keys matching seat:*:lock, Lua check-and-delete
 *
 * All operations are atomic — safe for multi-process concurrent access.
 */
export class RedisSeatLockService implements SeatLockService {
  private redis: Redis;

  /** Lua: release lock only if the current owner matches */
  private readonly releaseLockScript = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  /** Lua: check owner and delete — returns 1 if released, 0 if skipped */
  private readonly releaseLockSha?: string;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async acquireLock(seatId: string, bookingId: string, ttlMs: number): Promise<boolean> {
    const key = this.lockKey(seatId);
    const result = await this.redis.set(key, bookingId, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(seatId: string, bookingId: string): Promise<void> {
    const key = this.lockKey(seatId);
    await this.redis.eval(
      this.releaseLockScript,
      1,
      key,
      bookingId,
    );
  }

  async renewLock(seatId: string, bookingId: string, ttlMs: number): Promise<boolean> {
    const key = this.lockKey(seatId);

    // Check-then-extend: only renew if we're the owner
    const lua = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      else
        return -1
      end
    `;
    const result = await this.redis.eval(lua, 1, key, bookingId, ttlMs.toString());
    return result === 1;
  }

  async isLocked(seatId: string): Promise<boolean> {
    const key = this.lockKey(seatId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async getLockOwner(seatId: string): Promise<string | null> {
    const key = this.lockKey(seatId);
    return this.redis.get(key);
  }

  async forceReleaseAll(bookingId: string): Promise<number> {
    let count = 0;
    let cursor = '0';

    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'seat:*:lock',
        'COUNT',
        100,
      );
      cursor = newCursor;

      for (const key of keys) {
        const result = await this.redis.eval(
          this.releaseLockScript,
          1,
          key,
          bookingId,
        );
        if (result === 1) count++;
      }
    } while (cursor !== '0');

    return count;
  }

  private lockKey(seatId: string): string {
    return `seat:${seatId}:lock`;
  }
}
