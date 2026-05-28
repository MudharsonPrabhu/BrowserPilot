/**
 * Network response capture module for BrowserPilot.
 * Extracts useful JSON/XHR/GraphQL responses that contain course or quiz data.
 */

import type { Page, Response } from 'playwright';
import { createLogger } from '../logger';

const log = createLogger('network-capture');

export interface CapturedResponse {
  url: string;
  pathname: string;
  method: string;
  status: number;
  contentType: string;
  timestamp: string;
  body: unknown;
  size: number;
}

export interface NetworkCaptureResult {
  responses: CapturedResponse[];
  courseData: CapturedResponse[];
  quizData: CapturedResponse[];
  apiResponses: CapturedResponse[];
}

// Patterns that indicate course-related data
const COURSE_DATA_PATTERNS = [
  /course/i, /lesson/i, /module/i, /chapter/i, /curriculum/i,
  /syllabus/i, /content/i, /lecture/i, /progress/i, /enrollment/i,
];

// Patterns that indicate quiz data
const QUIZ_DATA_PATTERNS = [
  /quiz/i, /question/i, /answer/i, /assessment/i, /exam/i,
  /attempt/i, /submission/i, /grade/i, /score/i,
];

// Patterns for API endpoints
const API_PATTERNS = [
  /\/api\//i, /\/graphql/i, /\/v[0-9]+\//i, /\/rest\//i,
];

/**
 * Capture and classify network responses from the current page.
 * Uses already-captured responses from the browser controller.
 */
export function classifyNetworkResponses(responses: unknown[]): NetworkCaptureResult {
  const captured: CapturedResponse[] = [];
  const courseData: CapturedResponse[] = [];
  const quizData: CapturedResponse[] = [];
  const apiResponses: CapturedResponse[] = [];

  for (const raw of responses) {
    const resp = raw as { url?: string; timestamp?: string; body?: unknown };
    if (!resp.url) continue;

    let pathname = '';
    try { pathname = new URL(resp.url).pathname; } catch { continue; }

    const entry: CapturedResponse = {
      url: resp.url,
      pathname,
      method: 'GET',
      status: 200,
      contentType: 'application/json',
      timestamp: resp.timestamp || new Date().toISOString(),
      body: resp.body,
      size: JSON.stringify(resp.body || '').length,
    };

    captured.push(entry);

    const urlStr = resp.url.toLowerCase();

    if (COURSE_DATA_PATTERNS.some((p) => p.test(urlStr))) {
      courseData.push(entry);
    }
    if (QUIZ_DATA_PATTERNS.some((p) => p.test(urlStr))) {
      quizData.push(entry);
    }
    if (API_PATTERNS.some((p) => p.test(pathname))) {
      apiResponses.push(entry);
    }
  }

  log.info('Network responses classified', {
    total: captured.length,
    courseData: courseData.length,
    quizData: quizData.length,
    apiResponses: apiResponses.length,
  });

  return { responses: captured, courseData, quizData, apiResponses };
}

/**
 * Set up a live capture listener on a page for targeted response interception.
 * Returns a cleanup function.
 */
export function setupLiveCapture(page: Page, onCapture: (response: CapturedResponse) => void): () => void {
  const handler = async (response: Response) => {
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('application/json') && !contentType.includes('graphql')) return;
    if (response.status() !== 200) return;

    try {
      const body = await response.json();
      const url = response.url();
      let pathname = '';
      try { pathname = new URL(url).pathname; } catch { return; }

      const entry: CapturedResponse = {
        url,
        pathname,
        method: response.request().method(),
        status: response.status(),
        contentType,
        timestamp: new Date().toISOString(),
        body,
        size: JSON.stringify(body).length,
      };

      onCapture(entry);
    } catch {
      // Skip non-parseable responses
    }
  };

  page.on('response', handler);
  log.info('Live network capture started');

  return () => {
    page.off('response', handler);
    log.info('Live network capture stopped');
  };
}

/**
 * Extract course structure data from captured network responses.
 * Tries to find module/lesson lists in JSON payloads.
 */
export function extractCourseStructureFromNetwork(responses: CapturedResponse[]): {
  modules: { name: string; lessons: string[] }[];
  found: boolean;
} {
  const modules: { name: string; lessons: string[] }[] = [];

  for (const resp of responses) {
    const body = resp.body;
    if (!body || typeof body !== 'object') continue;

    // Try to find arrays of modules/lessons in the response
    const candidates = findArraysInObject(body as Record<string, unknown>, 3);
    for (const arr of candidates) {
      if (arr.length >= 2 && arr.every((item: unknown) => {
        const obj = item as Record<string, unknown>;
        return obj && typeof obj === 'object' && (obj.name || obj.title || obj.label);
      })) {
        const mod = {
          name: resp.pathname,
          lessons: arr.map((item: unknown) => {
            const obj = item as Record<string, unknown>;
            return String(obj.name || obj.title || obj.label || '');
          }).filter(Boolean),
        };
        if (mod.lessons.length > 0) modules.push(mod);
      }
    }
  }

  return { modules, found: modules.length > 0 };
}

/** Recursively find arrays in a nested object */
function findArraysInObject(obj: Record<string, unknown>, maxDepth: number, depth = 0): unknown[][] {
  if (depth > maxDepth) return [];
  const arrays: unknown[][] = [];

  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && value.length > 0) {
      arrays.push(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      arrays.push(...findArraysInObject(value as Record<string, unknown>, maxDepth, depth + 1));
    }
  }

  return arrays;
}
