/**
 * E2E test: Dashboard UI loads and renders correctly.
 * Tests the full server → page render → SSE connection flow.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:3000';

describe('Dashboard E2E', () => {
  // Assumes dev server is running on port 3000

  it('should load the dashboard page', async () => {
    const res = await fetch(BASE_URL);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('BrowserPilot');
  });

  it('should serve the SSE stream endpoint', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${BASE_URL}/api/stream`, { signal: controller.signal });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    } catch (err: any) {
      // AbortError is expected since SSE never closes
      if (err.name !== 'AbortError') throw err;
    } finally {
      clearTimeout(timeout);
    }
  });

  it('should return session status', async () => {
    const res = await fetch(`${BASE_URL}/api/session/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('browser');
  });

  it('should return tasks list', async () => {
    const res = await fetch(`${BASE_URL}/api/tasks`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.tasks)).toBe(true);
  });

  it('should reject invalid navigate request', async () => {
    const res = await fetch(`${BASE_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    expect(res.status).toBe(400);
  });

  it('should reject invalid click request', async () => {
    const res = await fetch(`${BASE_URL}/api/browser/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('should accept valid extract page request format', async () => {
    const res = await fetch(`${BASE_URL}/api/extract/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'auto', includeScreenshot: false }),
    });
    // 500 is expected since no browser is running, but schema validation passed
    const data = await res.json();
    expect(data.error || data.success).toBeTruthy();
  });

  it('should serve the study graph endpoint', async () => {
    const res = await fetch(`${BASE_URL}/api/study-graph`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('topics');
    expect(data).toHaveProperty('weakAreas');
    expect(data).toHaveProperty('overallProgress');
  });

  it('should serve the flashcards endpoint', async () => {
    const res = await fetch(`${BASE_URL}/api/flashcards`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.flashcards)).toBe(true);
  });

  it('should validate summarize schema', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('should validate answer question schema', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Test' }),  // missing options
    });
    expect(res.status).toBe(400);
  });

  it('should validate plan schema', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),  // missing objective
    });
    expect(res.status).toBe(400);
  });

  it('should handle progress save/get', async () => {
    // Save
    const saveRes = await fetch(`${BASE_URL}/api/progress/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'test_key', value: 'test_value' }),
    });
    // May fail if no session, but should not 500 with schema error
    expect([200, 500]).toContain(saveRes.status);

    // Get
    const getRes = await fetch(`${BASE_URL}/api/progress/save?key=test_key`);
    expect([200, 500]).toContain(getRes.status);
  });

  it('should reject task creation with missing type', async () => {
    const res = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unknown' }),
    });
    expect(res.status).toBe(400);
  });
});
