/**
 * Unit tests for the logger module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '@/lib/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a logger with component name', () => {
    const log = createLogger('test-component');
    expect(log).toBeDefined();
    expect(log.info).toBeTypeOf('function');
    expect(log.warn).toBeTypeOf('function');
    expect(log.error).toBeTypeOf('function');
    expect(log.debug).toBeTypeOf('function');
  });

  it('should log info messages as JSON', () => {
    const log = createLogger('test');
    log.info('Hello world', { key: 'value' });

    expect(console.info).toHaveBeenCalled();
    const output = (console.info as any).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Hello world');
    expect(parsed.component).toBe('test');
    expect(parsed.context.key).toBe('value');
  });

  it('should log warning messages', () => {
    const log = createLogger('test');
    log.warn('Warning!');
    expect(console.warn).toHaveBeenCalled();
  });

  it('should log error messages with error object', () => {
    const log = createLogger('test');
    const err = new Error('Test error');
    log.error('Something failed', {}, err);
    expect(console.error).toHaveBeenCalled();
  });

  it('should include timestamp in log output', () => {
    const log = createLogger('test');
    log.info('Timestamped message');
    const output = (console.info as any).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.timestamp).toBeTruthy();
    expect(new Date(parsed.timestamp).getTime()).toBeGreaterThan(0);
  });
});
