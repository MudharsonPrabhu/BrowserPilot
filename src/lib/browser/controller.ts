/**
 * Core Playwright browser controller for BrowserPilot.
 * Manages browser lifecycle, persistent profiles, and page state.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../logger';
import { eventBus } from '../events/bus';

const log = createLogger('browser-controller');

const PROFILES_DIR = path.join(process.cwd(), 'data', 'profiles');

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
}

export interface BrowserState {
  isRunning: boolean;
  tabs: TabInfo[];
  activeTabId: string | null;
  currentUrl: string | null;
  currentTitle: string | null;
}

class BrowserController {
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private activePageId: string | null = null;
  private tabNames: Map<string, string> = new Map();
  private networkResponses: Map<string, unknown[]> = new Map();

  get isRunning(): boolean {
    return this.context !== null;
  }

  /**
   * Launch Chromium with a persistent user profile.
   */
  async launch(profileName = 'default', options: {
    headless?: boolean;
    viewport?: { width: number; height: number };
  } = {}): Promise<void> {
    if (this.context) {
      log.warn('Browser already running, closing existing instance');
      await this.close();
    }

    const profilePath = path.join(PROFILES_DIR, profileName);
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    const { headless = false, viewport = { width: 1280, height: 800 } } = options;

    log.info('Launching browser', { profileName, headless, viewport });

    this.context = await chromium.launchPersistentContext(profilePath, {
      headless,
      viewport,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      bypassCSP: true,
    });

    // Register existing pages
    const existingPages = this.context.pages();
    if (existingPages.length > 0) {
      for (const page of existingPages) {
        const id = uuid();
        this.pages.set(id, page);
        this.activePageId = id;
        this.setupPageListeners(id, page);
      }
    }

    // Listen for new pages
    this.context.on('page', (page) => {
      const id = uuid();
      this.pages.set(id, page);
      this.activePageId = id;
      this.setupPageListeners(id, page);
      eventBus.emit('browser:tab_changed', {
        tabId: id,
        url: page.url(),
        action: 'opened',
      });
    });

    this.context.on('close', () => {
      log.info('Browser context closed');
      this.context = null;
      this.pages.clear();
      this.activePageId = null;
      eventBus.emit('browser:closed', {});
    });

    eventBus.emit('session:started', { profileName });
    log.info('Browser launched successfully', { tabCount: this.pages.size });
  }

  private setupPageListeners(id: string, page: Page): void {
    page.on('close', () => {
      this.pages.delete(id);
      this.tabNames.delete(id);
      if (this.activePageId === id) {
        const remaining = Array.from(this.pages.keys());
        this.activePageId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
      eventBus.emit('browser:tab_changed', { tabId: id, action: 'closed' });
    });

    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        eventBus.emit('browser:navigated', {
          tabId: id,
          url: page.url(),
          title: '',
        });
      }
    });

    // Capture network responses for course data extraction
    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'] || '';
      const url = response.url();
      if (
        (contentType.includes('application/json') || contentType.includes('graphql')) &&
        response.status() === 200
      ) {
        try {
          const body = await response.json();
          const key = new URL(url).pathname;
          if (!this.networkResponses.has(key)) {
            this.networkResponses.set(key, []);
          }
          this.networkResponses.get(key)!.push({
            url,
            timestamp: new Date().toISOString(),
            body,
          });
          // Keep only last 20 responses per path
          const responses = this.networkResponses.get(key)!;
          if (responses.length > 20) {
            this.networkResponses.set(key, responses.slice(-20));
          }
        } catch {
          // Ignore non-JSON responses
        }
      }
    });
  }

  /**
   * Get the active page, or throw if no browser is running.
   */
  getActivePage(): Page {
    if (!this.context || !this.activePageId) {
      throw new Error('No active browser page. Launch browser first.');
    }
    const page = this.pages.get(this.activePageId);
    if (!page) {
      throw new Error('Active page reference is stale.');
    }
    return page;
  }

  /**
   * Get a specific page by tab ID.
   */
  getPage(tabId: string): Page {
    const page = this.pages.get(tabId);
    if (!page) {
      throw new Error(`Tab ${tabId} not found.`);
    }
    return page;
  }

  /**
   * Open a new tab and navigate to URL.
   */
  async openTab(url?: string): Promise<string> {
    if (!this.context) throw new Error('Browser not running');

    const page = await this.context.newPage();
    const id = uuid();
    this.pages.set(id, page);
    this.activePageId = id;
    this.setupPageListeners(id, page);

    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    log.info('Opened new tab', { tabId: id, url });
    return id;
  }

  /**
   * Close a specific tab.
   */
  async closeTab(tabId: string): Promise<void> {
    const page = this.pages.get(tabId);
    if (!page) throw new Error(`Tab ${tabId} not found`);

    await page.close();
    log.info('Closed tab', { tabId });
  }

  /**
   * Switch to a specific tab.
   */
  switchTab(tabId: string): void {
    if (!this.pages.has(tabId)) throw new Error(`Tab ${tabId} not found`);
    this.activePageId = tabId;
    const page = this.pages.get(tabId)!;
    page.bringToFront();
    eventBus.emit('browser:tab_changed', {
      tabId,
      url: page.url(),
      action: 'switched',
    });
  }

  /**
   * Rename a tab (cosmetic label).
   */
  renameTab(tabId: string, name: string): void {
    if (!this.pages.has(tabId)) throw new Error(`Tab ${tabId} not found`);
    this.tabNames.set(tabId, name);
  }

  /**
   * Navigate the active page to a URL.
   */
  async navigate(url: string, options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
  } = {}): Promise<{ url: string; title: string }> {
    const page = this.getActivePage();
    const { waitUntil = 'domcontentloaded', timeout = 30000 } = options;

    log.info('Navigating', { url, waitUntil, timeout });

    await page.goto(url, { waitUntil, timeout });
    const title = await page.title();

    eventBus.emit('browser:navigated', {
      tabId: this.activePageId,
      url: page.url(),
      title,
    });

    return { url: page.url(), title };
  }

  /**
   * Click an element by selector, text, role, or coordinates.
   */
  async click(options: {
    selector?: string;
    text?: string;
    role?: string;
    x?: number;
    y?: number;
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    timeout?: number;
  }): Promise<void> {
    const page = this.getActivePage();
    const { selector, text, role, x, y, button = 'left', clickCount = 1, timeout = 10000 } = options;

    if (selector) {
      await page.click(selector, { button, clickCount, timeout });
      log.info('Clicked selector', { selector });
    } else if (text) {
      await page.getByText(text, { exact: false }).click({ button, clickCount, timeout });
      log.info('Clicked text', { text });
    } else if (role) {
      await page.getByRole(role as any).first().click({ button, clickCount, timeout });
      log.info('Clicked role', { role });
    } else if (x !== undefined && y !== undefined) {
      await page.mouse.click(x, y, { button, clickCount });
      log.info('Clicked coordinates', { x, y });
    } else {
      throw new Error('Must provide selector, text, role, or coordinates');
    }
  }

  /**
   * Fill an input element.
   */
  async fill(selector: string, value: string, options: {
    clear?: boolean;
    timeout?: number;
  } = {}): Promise<void> {
    const page = this.getActivePage();
    const { clear = true, timeout = 10000 } = options;

    if (clear) {
      await page.fill(selector, value, { timeout });
    } else {
      await page.locator(selector).pressSequentially(value, { timeout });
    }

    log.info('Filled input', { selector, valueLength: value.length });
  }

  /**
   * Select a dropdown option.
   */
  async select(selector: string, options: {
    value?: string;
    label?: string;
    index?: number;
  }): Promise<void> {
    const page = this.getActivePage();

    if (options.value) {
      await page.selectOption(selector, { value: options.value });
    } else if (options.label) {
      await page.selectOption(selector, { label: options.label });
    } else if (options.index !== undefined) {
      await page.selectOption(selector, { index: options.index });
    }

    log.info('Selected option', { selector, ...options });
  }

  /**
   * Press a keyboard key with optional modifiers.
   */
  async keyPress(key: string, modifiers: string[] = []): Promise<void> {
    const page = this.getActivePage();
    const combo = [...modifiers, key].join('+');
    await page.keyboard.press(combo);
    log.info('Key press', { key: combo });
  }

  /**
   * Scroll to an element or by amount.
   */
  async scroll(options: {
    selector?: string;
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: number;
  } = {}): Promise<void> {
    const page = this.getActivePage();
    const { selector, direction = 'down', amount = 500 } = options;

    if (selector) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      log.info('Scrolled to element', { selector });
    } else {
      const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
      const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
      await page.mouse.wheel(deltaX, deltaY);
      log.info('Scrolled', { direction, amount });
    }
  }

  /**
   * Wait for a selector, network idle, or custom state.
   */
  async waitFor(options: {
    selector?: string;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
    networkIdle?: boolean;
    timeout?: number;
  }): Promise<void> {
    const page = this.getActivePage();
    const { selector, state = 'visible', networkIdle = false, timeout = 30000 } = options;

    if (selector) {
      await page.waitForSelector(selector, { state, timeout });
    }
    if (networkIdle) {
      await page.waitForLoadState('networkidle', { timeout });
    }
  }

  /**
   * Take a screenshot (full page or element).
   */
  async screenshot(options: {
    fullPage?: boolean;
    selector?: string;
    quality?: number;
  } = {}): Promise<Buffer> {
    const page = this.getActivePage();
    const { fullPage = false, selector, quality = 70 } = options;

    let buffer: Buffer;
    if (selector) {
      buffer = await page.locator(selector).screenshot({ type: 'jpeg', quality }) as Buffer;
    } else {
      buffer = await page.screenshot({ type: 'jpeg', quality, fullPage }) as Buffer;
    }

    eventBus.emit('browser:screenshot', {
      tabId: this.activePageId,
      size: buffer.length,
    });

    return buffer;
  }

  /**
   * Get current browser state.
   */
  async getState(): Promise<BrowserState> {
    const tabs: TabInfo[] = [];
    for (const [id, page] of this.pages) {
      try {
        tabs.push({
          id,
          url: page.url(),
          title: await page.title(),
          isActive: id === this.activePageId,
        });
      } catch {
        tabs.push({ id, url: 'about:blank', title: 'Error', isActive: id === this.activePageId });
      }
    }

    const activePage = this.activePageId ? this.pages.get(this.activePageId) : null;

    return {
      isRunning: this.isRunning,
      tabs,
      activeTabId: this.activePageId,
      currentUrl: activePage ? activePage.url() : null,
      currentTitle: activePage ? await activePage.title().catch(() => null) : null,
    };
  }

  /**
   * Get captured network responses.
   */
  getNetworkResponses(pathFilter?: string): unknown[] {
    if (pathFilter) {
      return this.networkResponses.get(pathFilter) || [];
    }
    const all: unknown[] = [];
    for (const responses of this.networkResponses.values()) {
      all.push(...responses);
    }
    return all;
  }

  /**
   * Get DOM snapshot metadata of the active page.
   */
  async getDOMSnapshot(): Promise<{ url: string; title: string; bodyText: string; html: string }> {
    const page = this.getActivePage();

    const [title, bodyText, html] = await Promise.all([
      page.title(),
      page.innerText('body').catch(() => ''),
      page.content(),
    ]);

    return {
      url: page.url(),
      title,
      bodyText: bodyText.slice(0, 10000), // Cap for memory
      html: html.slice(0, 50000),
    };
  }

  /**
   * Get the accessibility tree snapshot.
   */
  async getAccessibilityTree(): Promise<unknown> {
    const page = this.getActivePage();
    // Use aria snapshot for Playwright v1.50+
    const snapshot = await page.locator('body').ariaSnapshot();
    return snapshot;
  }

  /**
   * Close the browser completely.
   */
  async close(): Promise<void> {
    if (this.context) {
      log.info('Closing browser');
      await this.context.close().catch(() => {});
      this.context = null;
      this.pages.clear();
      this.activePageId = null;
      this.networkResponses.clear();
    }
  }
}

// Singleton instance
export const browserController = new BrowserController();
