import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RedisSeatLockService } from '../src/redis-seat-lock.js';
import { Redis } from 'ioredis';

// These tests require a running Redis instance.
// Set REDIS_URL env var to point to your test Redis, or use testcontainers.
// Default: redis://localhost:6379

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('RedisSeatLockService', () => {
  let redis: Redis;
  let svc: RedisSeatLockService;

  beforeAll(() => {
    redis = new Redis(REDIS_URL);
    svc = new RedisSeatLockService(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  // Clean up before each test
  beforeEach(async () => {
    const keys = await redis.keys('seat:*:lock');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it('acquires a lock successfully', async () => {
    const ok = await svc.acquireLock('1A', 'booking-1', 60_000);
    expect(ok).toBe(true);
  });

  it('prevents double acquire', async () => {
    await svc.acquireLock('1A', 'booking-1', 60_000);
    const ok = await svc.acquireLock('1A', 'booking-2', 60_000);
    expect(ok).toBe(false);
  });

  it('releases a lock only by owner', async () => {
    await svc.acquireLock('1A', 'booking-1', 60_000);
    await svc.releaseLock('1A', 'booking-2'); // wrong owner — should no-op
    const owner = await svc.getLockOwner('1A');
    expect(owner).toBe('booking-1');

    await svc.releaseLock('1A', 'booking-1'); // correct owner
    expect(await svc.getLockOwner('1A')).toBeNull();
  });

  it('renews a lock', async () => {
    await svc.acquireLock('1A', 'booking-1', 60_000);
    const ok = await svc.renewLock('1A', 'booking-1', 120_000);
    expect(ok).toBe(true);
  });

  it('renew fails for wrong owner', async () => {
    await svc.acquireLock('1A', 'booking-1', 60_000);
    const ok = await svc.renewLock('1A', 'booking-2', 60_000);
    expect(ok).toBe(false);
  });

  it('lock expires after TTL', async () => {
    await svc.acquireLock('1A', 'booking-1', 100);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(await svc.isLocked('1A')).toBe(false);
  });

  it('forceReleaseAll removes all locks for bookingId', async () => {
    await svc.acquireLock('1A', 'booking-1', 60_000);
    await svc.acquireLock('2B', 'booking-1', 60_000);
    await svc.acquireLock('3C', 'booking-2', 60_000);

    const count = await svc.forceReleaseAll('booking-1');
    expect(count).toBe(2);
    expect(await svc.isLocked('1A')).toBe(false);
    expect(await svc.isLocked('2B')).toBe(false);
    expect(await svc.isLocked('3C')).toBe(true);
  });

  it('forceReleaseAll returns 0 for unknown bookingId', async () => {
    const count = await svc.forceReleaseAll('nonexistent');
    expect(count).toBe(0);
  });

  it('isLocked returns true for active lock', async () => {
    await svc.acquireLock('5F', 'booking-1', 60_000);
    expect(await svc.isLocked('5F')).toBe(true);
    expect(await svc.isLocked('nonexistent')).toBe(false);
  });
});
