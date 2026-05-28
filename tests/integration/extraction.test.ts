/**
 * Integration tests for the extraction pipeline helpers.
 * Tests fingerprinting and error classification without a real browser.
 */

import { describe, it, expect } from 'vitest';
import { generateFingerprint } from '@/lib/extraction/dom-extractor';
import { classifyError } from '@/lib/errors/handler';

describe('generateFingerprint', () => {
  it('should produce consistent hash for same input', () => {
    const a = generateFingerprint('hello world');
    const b = generateFingerprint('hello world');
    expect(a).toBe(b);
  });

  it('should produce different hash for different input', () => {
    const a = generateFingerprint('hello');
    const b = generateFingerprint('world');
    expect(a).not.toBe(b);
  });

  it('should handle empty string', () => {
    const result = generateFingerprint('');
    expect(result).toBe('0');
  });

  it('should handle long strings', () => {
    const long = 'a'.repeat(100000);
    const result = generateFingerprint(long);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('Error classifier patterns', () => {
  it('should classify navigation timeout', () => {
    const result = classifyError(new Error('Timeout 30000ms exceeded: waiting for navigation to finish'));
    expect(result.type).toBe('navigation_timeout');
    expect(result.recoverable).toBe(true);
  });

  it('should classify element not found', () => {
    const result = classifyError(new Error('Timeout: waiting for selector "#btn" to be visible'));
    expect(result.type).toBe('element_not_found');
    expect(result.recoverable).toBe(true);
  });

  it('should classify stale element', () => {
    const result = classifyError(new Error('Element is detached from DOM'));
    expect(result.type).toBe('stale_selector');
    expect(result.recoverable).toBe(true);
  });

  it('should classify network failure', () => {
    const result = classifyError(new Error('net::ERR_CONNECTION_REFUSED'));
    expect(result.type).toBe('network_failure');
    expect(result.recoverable).toBe(true);
  });

  it('should classify browser crash', () => {
    const result = classifyError(new Error('Browser closed unexpectedly'));
    expect(result.type).toBe('browser_crash');
    expect(result.recoverable).toBe(true);
  });

  it('should classify iframe blocked', () => {
    const result = classifyError(new Error('Frame detached'));
    expect(result.type).toBe('iframe_blocked');
    expect(result.recoverable).toBe(false);
  });

  it('should default to unknown for unrecognized errors', () => {
    const result = classifyError(new Error('Something weird happened'));
    expect(result.type).toBe('unknown');
  });
});
