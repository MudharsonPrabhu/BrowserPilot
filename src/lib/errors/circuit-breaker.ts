/**
 * Circuit breaker for BrowserPilot.
 * Prevents repeated calls to failing services.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery).
 */

import { createLogger } from '../logger';
import { eventBus } from '../events/bus';

const log = createLogger('circuit-breaker');

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitBreakerOptions {
  failureThreshold: number;   // Number of failures before opening
  resetTimeout: number;       // ms before transitioning from open → half_open
  successThreshold: number;   // Successes in half_open to close again
  name: string;
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> & { name: string }) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 30000,
      successThreshold: options.successThreshold ?? 2,
      name: options.name,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'half_open';
        this.successCount = 0;
        log.info(`Circuit ${this.options.name} transitioning to half_open`);
      } else {
        const err = new Error(`Circuit breaker ${this.options.name} is OPEN. Service unavailable.`);
        log.warn(`Circuit ${this.options.name} is open, rejecting call`);
        throw err;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        log.info(`Circuit ${this.options.name} closed (recovered)`);
        eventBus.emit('error:occurred', {
          circuit: this.options.name,
          action: 'circuit_closed',
        });
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open') {
      this.state = 'open';
      log.warn(`Circuit ${this.options.name} re-opened from half_open`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
      log.error(`Circuit ${this.options.name} opened after ${this.failureCount} failures`);
      eventBus.emit('error:occurred', {
        circuit: this.options.name,
        action: 'circuit_opened',
        failures: this.failureCount,
      });
    }
  }

  getState(): { state: CircuitState; failures: number; name: string } {
    return { state: this.state, failures: this.failureCount, name: this.options.name };
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    log.info(`Circuit ${this.options.name} manually reset`);
  }
}

// Pre-configured breakers for key services
export const breakers = {
  browser: new CircuitBreaker({ name: 'browser', failureThreshold: 3, resetTimeout: 15000 }),
  extraction: new CircuitBreaker({ name: 'extraction', failureThreshold: 5, resetTimeout: 20000 }),
  ai: new CircuitBreaker({ name: 'ai', failureThreshold: 3, resetTimeout: 60000 }),
  ocr: new CircuitBreaker({ name: 'ocr', failureThreshold: 3, resetTimeout: 30000 }),
};

export { CircuitBreaker };
