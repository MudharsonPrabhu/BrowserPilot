/**
 * Recovery strategies for BrowserPilot.
 * Handles browser crashes, login expiry, and session restoration.
 */

import { browserController } from '../browser/controller';
import { sessionManager } from '../session/manager';
import { classifyError, type ErrorType } from './handler';
import { createLogger } from '../logger';
import { eventBus } from '../events/bus';

const log = createLogger('recovery');

export interface RecoveryResult {
  recovered: boolean;
  strategy: string;
  message: string;
  duration: number;
}

/**
 * Attempt to recover from a classified error.
 */
export async function attemptRecovery(error: Error): Promise<RecoveryResult> {
  const classified = classifyError(error);
  const start = Date.now();

  log.info('Attempting recovery', { errorType: classified.type });
  eventBus.emit('error:occurred', {
    errorType: classified.type,
    message: classified.message,
    recoverable: classified.recoverable,
  });

  const strategy = RECOVERY_STRATEGIES[classified.type];
  if (!strategy) {
    return {
      recovered: false,
      strategy: 'none',
      message: `No recovery strategy for error type: ${classified.type}`,
      duration: Date.now() - start,
    };
  }

  try {
    const result = await strategy();
    log.info('Recovery succeeded', { strategy: result.strategy, duration: result.duration });
    return result;
  } catch (recoveryErr) {
    log.error('Recovery failed', {}, recoveryErr instanceof Error ? recoveryErr : undefined);
    return {
      recovered: false,
      strategy: 'failed',
      message: `Recovery failed: ${recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)}`,
      duration: Date.now() - start,
    };
  }
}

/** Map of error types to recovery functions */
const RECOVERY_STRATEGIES: Partial<Record<ErrorType, () => Promise<RecoveryResult>>> = {
  browser_crash: async () => {
    const start = Date.now();
    log.info('Recovering from browser crash — restarting browser');

    // Close any stale references
    await browserController.close().catch(() => {});

    // Wait a beat
    await new Promise((r) => setTimeout(r, 2000));

    // Re-launch with same profile
    const lastProfile = (await sessionManager.getMemory('browser_profile')) || 'default';
    await browserController.launch(lastProfile);

    // Restore last URL
    const lastUrl = await sessionManager.getMemory('last_url');
    if (lastUrl) {
      await browserController.navigate(lastUrl).catch(() => {});
    }

    return {
      recovered: true,
      strategy: 'browser_restart',
      message: 'Browser restarted and session restored',
      duration: Date.now() - start,
    };
  },

  navigation_timeout: async () => {
    const start = Date.now();
    log.info('Recovering from navigation timeout — waiting for network idle');

    try {
      const page = browserController.getActivePage();
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      return {
        recovered: true,
        strategy: 'wait_for_load',
        message: 'Page eventually loaded',
        duration: Date.now() - start,
      };
    } catch {
      return {
        recovered: false,
        strategy: 'wait_for_load',
        message: 'Page still not loaded after extended wait',
        duration: Date.now() - start,
      };
    }
  },

  element_not_found: async () => {
    const start = Date.now();
    log.info('Recovering from element not found — waiting for DOM stability');

    try {
      const page = browserController.getActivePage();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      return {
        recovered: true,
        strategy: 'wait_for_dom',
        message: 'DOM stabilized, ready to retry',
        duration: Date.now() - start,
      };
    } catch {
      return {
        recovered: false,
        strategy: 'wait_for_dom',
        message: 'DOM still unstable',
        duration: Date.now() - start,
      };
    }
  },

  stale_selector: async () => {
    const start = Date.now();
    // Stale selectors usually resolve by just re-querying — signal caller to retry
    await new Promise((r) => setTimeout(r, 500));
    return {
      recovered: true,
      strategy: 're_query',
      message: 'Ready to re-query selector',
      duration: Date.now() - start,
    };
  },

  network_failure: async () => {
    const start = Date.now();
    log.info('Recovering from network failure — waiting for connectivity');

    // Wait and check if page can load
    await new Promise((r) => setTimeout(r, 5000));

    try {
      const page = browserController.getActivePage();
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      return {
        recovered: true,
        strategy: 'page_reload',
        message: 'Page reloaded after network recovery',
        duration: Date.now() - start,
      };
    } catch {
      return {
        recovered: false,
        strategy: 'page_reload',
        message: 'Network still unavailable',
        duration: Date.now() - start,
      };
    }
  },

  login_expired: async () => {
    const start = Date.now();
    // Cannot auto-recover login — signal user
    eventBus.emit('error:occurred', {
      errorType: 'login_expired',
      requiresUser: true,
      message: 'Login session expired. Please log in again in the browser.',
    });
    return {
      recovered: false,
      strategy: 'user_required',
      message: 'Login expired — user action required',
      duration: Date.now() - start,
    };
  },
};

/**
 * Detect if the current page shows a login prompt (common sign of session expiry).
 */
export async function detectLoginRequired(): Promise<boolean> {
  try {
    const page = browserController.getActivePage();
    const url = page.url().toLowerCase();
    const hasLoginUrl = /login|signin|sign-in|auth|sso|cas/.test(url);

    if (hasLoginUrl) return true;

    const hasLoginForm = await page.evaluate(() => {
      return !!(
        document.querySelector('input[type="password"]') &&
        (document.querySelector('input[type="email"]') || document.querySelector('input[type="text"]'))
      );
    });

    return hasLoginForm;
  } catch {
    return false;
  }
}

/**
 * Save a checkpoint of the current state for recovery.
 */
export async function saveCheckpoint(): Promise<void> {
  try {
    const page = browserController.getActivePage();
    await sessionManager.saveMemory('last_url', page.url(), 'browser_state');
    await sessionManager.saveMemory('last_title', await page.title(), 'browser_state');
    await sessionManager.saveMemory('checkpoint_time', new Date().toISOString(), 'browser_state');
    await sessionManager.touchSession();
    log.info('Checkpoint saved', { url: page.url() });
  } catch (err) {
    log.warn('Failed to save checkpoint', { error: err instanceof Error ? err.message : String(err) });
  }
}
