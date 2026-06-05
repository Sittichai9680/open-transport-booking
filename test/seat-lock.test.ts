import { describe, it, expect } from 'vitest';
import { InMemorySeatLockService } from '../src/seat-lock-in-memory.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('InMemorySeatLockService', () => {
  it('acquires a lock successfully', async () => {
    const svc = new InMemorySeatLockService();
    const ok = await svc.acquireLock('1A', 'booking-1', 60_000);
    expect(ok).toBe(true);
  });

  it('prevents double acquire', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 60_000);
    const ok = await svc.acquireLock('1A', 'booking-2', 60_000);
    expect(ok).toBe(false);
  });

  it('releases a lock', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 60_000);
    await svc.releaseLock('1A', 'booking-1');
    const ok = await svc.acquireLock('1A', 'booking-2', 60_000);
    expect(ok).toBe(true);
  });

  it('only owner can release', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 60_000);
    await svc.releaseLock('1A', 'booking-2'); // wrong owner
    const owner = await svc.getLockOwner('1A');
    expect(owner).toBe('booking-1');
  });

  it('renews a lock', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 100);
    const renewed = await svc.renewLock('1A', 'booking-1', 60_000);
    expect(renewed).toBe(true);
    const locked = await svc.isLocked('1A');
    expect(locked).toBe(true);
  });

  it('renew fails for wrong owner', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 60_000);
    const ok = await svc.renewLock('1A', 'booking-2', 60_000);
    expect(ok).toBe(false);
  });

  it('lock expires after TTL', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 50);
    await sleep(100);
    const locked = await svc.isLocked('1A');
    expect(locked).toBe(false);
  });

  it('renew fails for expired lock', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 50);
    await sleep(100);
    const ok = await svc.renewLock('1A', 'booking-1', 60_000);
    expect(ok).toBe(false);
  });

  it('getLockOwner returns null for expired lock', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 50);
    await sleep(100);
    const owner = await svc.getLockOwner('1A');
    expect(owner).toBeNull();
  });

  it('forceReleaseAll releases all locks for a bookingId', async () => {
    const svc = new InMemorySeatLockService();
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
    const svc = new InMemorySeatLockService();
    const count = await svc.forceReleaseAll('nonexistent');
    expect(count).toBe(0);
  });

  it('acquire succeeds after expiry auto-cleanup', async () => {
    const svc = new InMemorySeatLockService();
    await svc.acquireLock('1A', 'booking-1', 50);
    await sleep(100);
    const ok = await svc.acquireLock('1A', 'booking-2', 60_000);
    expect(ok).toBe(true);
  });
});
