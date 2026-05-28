/**
 * Unit tests for circuit breaker.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '@/lib/errors/circuit-breaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ name: 'test', failureThreshold: 3, resetTimeout: 100, successThreshold: 2 });
  });

  it('should start in closed state', () => {
    expect(cb.getState().state).toBe('closed');
  });

  it('should execute successfully in closed state', async () => {
    const result = await cb.execute(async () => 42);
    expect(result).toBe(42);
    expect(cb.getState().state).toBe('closed');
  });

  it('should open after failure threshold', async () => {
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
    }
    expect(cb.getState().state).toBe('open');
  });

  it('should reject calls when open', async () => {
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
    }
    await expect(cb.execute(async () => 'ok')).rejects.toThrow('Circuit breaker');
  });

  it('should transition to half_open after reset timeout', async () => {
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
    }
    expect(cb.getState().state).toBe('open');

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 150));
    // Next call should go through (half_open)
    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('should close after success threshold in half_open', async () => {
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
    }
    await new Promise((r) => setTimeout(r, 150));

    await cb.execute(async () => 'ok1');
    await cb.execute(async () => 'ok2');
    expect(cb.getState().state).toBe('closed');
  });

  it('should re-open on failure in half_open', async () => {
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
    }
    await new Promise((r) => setTimeout(r, 150));

    try { await cb.execute(async () => { throw new Error('fail again'); }); } catch {}
    expect(cb.getState().state).toBe('open');
  });

  it('should reset manually', async () => {
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
    }
    expect(cb.getState().state).toBe('open');
    cb.reset();
    expect(cb.getState().state).toBe('closed');
  });
});
