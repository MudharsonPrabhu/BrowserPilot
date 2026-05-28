/**
 * Error types and handler for BrowserPilot.
 */

import { createLogger } from '../logger';

const log = createLogger('error-handler');

export type ErrorType =
  | 'element_not_found' | 'stale_selector' | 'navigation_timeout' | 'page_reload'
  | 'login_expired' | 'iframe_blocked' | 'dynamic_dom' | 'action_blocked'
  | 'ocr_failure' | 'llm_timeout' | 'malformed_output' | 'network_failure'
  | 'browser_crash' | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  recoverable: boolean;
  suggestedAction: string;
  originalError: Error;
}

export function classifyError(error: Error): ClassifiedError {
  const msg = error.message.toLowerCase();

  if (msg.includes('timeout') && (msg.includes('navigation') || msg.includes('goto'))) {
    return { type: 'navigation_timeout', message: error.message, recoverable: true, suggestedAction: 'Retry navigation with longer timeout', originalError: error };
  }
  if (msg.includes('waiting for selector') || msg.includes('element not found')) {
    return { type: 'element_not_found', message: error.message, recoverable: true, suggestedAction: 'Wait and retry with alternative selector', originalError: error };
  }
  if (msg.includes('frame') && msg.includes('detached')) {
    return { type: 'iframe_blocked', message: error.message, recoverable: false, suggestedAction: 'Cannot access iframe content', originalError: error };
  }
  if (msg.includes('detached') || msg.includes('stale')) {
    return { type: 'stale_selector', message: error.message, recoverable: true, suggestedAction: 'Re-query the element', originalError: error };
  }
  if (msg.includes('net::err') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
    return { type: 'network_failure', message: error.message, recoverable: true, suggestedAction: 'Wait and retry', originalError: error };
  }
  if (msg.includes('browser') && (msg.includes('closed') || msg.includes('crash'))) {
    return { type: 'browser_crash', message: error.message, recoverable: true, suggestedAction: 'Restart browser and restore session', originalError: error };
  }

  return { type: 'unknown', message: error.message, recoverable: false, suggestedAction: 'Manual investigation required', originalError: error };
}

export async function withRetry<T>(fn: () => Promise<T>, options: {
  maxRetries?: number; baseDelay?: number; maxDelay?: number; label?: string;
} = {}): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, label = 'operation' } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const classified = classifyError(err instanceof Error ? err : new Error(String(err)));
      if (attempt === maxRetries || !classified.recoverable) {
        log.error(`${label} failed after ${attempt + 1} attempts`, { errorType: classified.type }, err instanceof Error ? err : undefined);
        throw err;
      }
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      log.warn(`${label} attempt ${attempt + 1} failed, retrying in ${delay}ms`, { errorType: classified.type, delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}
