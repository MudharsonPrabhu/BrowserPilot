/**
 * Page classifier for BrowserPilot.
 * Classifies pages using URL patterns, DOM signals, and text heuristics.
 */

import type { Page } from 'playwright';
import type { PageType } from '../validators';
import { createLogger } from '../logger';

const log = createLogger('page-classifier');

interface ClassificationResult {
  pageType: PageType;
  confidence: number;
  signals: string[];
}

// URL pattern matchers
const URL_PATTERNS: { pattern: RegExp; type: PageType; weight: number }[] = [
  { pattern: /\/quiz|\/assessment|\/exam|\/test\b/i, type: 'quiz', weight: 0.7 },
  { pattern: /\/lesson|\/lecture|\/learn|\/chapter|\/reading/i, type: 'lesson', weight: 0.6 },
  { pattern: /\/video|\/watch|\/play/i, type: 'video_lesson', weight: 0.6 },
  { pattern: /\/code|\/lab|\/sandbox|\/exercise|\/playground/i, type: 'code_editor', weight: 0.6 },
  { pattern: /\/assignment|\/submit|\/homework|\/project/i, type: 'assignment', weight: 0.6 },
  { pattern: /\/dashboard|\/home|\/overview|\/progress/i, type: 'dashboard', weight: 0.5 },
  { pattern: /\/module|\/syllabus|\/outline|\/contents/i, type: 'navigation', weight: 0.5 },
  { pattern: /\.pdf(\?|$)/i, type: 'document', weight: 0.8 },
];

/**
 * Classify a page by analyzing URL, DOM structure, and content signals.
 */
export async function classifyPage(page: Page): Promise<ClassificationResult> {
  const url = page.url();
  const signals: string[] = [];
  const scores: Record<PageType, number> = {
    lesson: 0, quiz: 0, code_editor: 0, video_lesson: 0,
    document: 0, assignment: 0, dashboard: 0, navigation: 0, unknown: 0,
  };

  // 1. URL pattern matching
  for (const { pattern, type, weight } of URL_PATTERNS) {
    if (pattern.test(url)) {
      scores[type] += weight;
      signals.push(`URL matches ${type} pattern`);
    }
  }

  // 2. DOM-based signals
  const domSignals = await page.evaluate(() => {
    const result: Record<string, boolean | number> = {};

    // Quiz signals
    result.hasRadioButtons = document.querySelectorAll('input[type="radio"]').length > 0;
    result.hasCheckboxes = document.querySelectorAll('input[type="checkbox"]').length > 0;
    result.radioCount = document.querySelectorAll('input[type="radio"]').length;
    result.hasSubmitButton = !!document.querySelector('button[type="submit"], input[type="submit"], [class*="submit"]');
    result.hasQuestionText = !!document.querySelector('[class*="question"], [class*="quiz"], [data-testid*="question"]');

    // Video signals
    result.hasVideo = document.querySelectorAll('video').length > 0;
    result.hasYouTube = !!document.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]');

    // Code editor signals
    result.hasCodeMirror = !!document.querySelector('.CodeMirror, .cm-editor, [class*="monaco"]');
    result.hasPreCode = document.querySelectorAll('pre code').length > 0;

    // Lesson signals
    result.hasArticleContent = !!document.querySelector('article, [role="article"], .lesson-content, .reading-content');
    result.paragraphCount = document.querySelectorAll('article p, main p, .content p').length;
    result.headingCount = document.querySelectorAll('h1, h2, h3').length;

    // Navigation signals
    result.hasModuleList = !!document.querySelector('[class*="module-list"], [class*="syllabus"], [class*="curriculum"]');
    result.linkCount = document.querySelectorAll('main a, .content a').length;

    // Assignment signals
    result.hasFileUpload = !!document.querySelector('input[type="file"]');
    result.hasTextArea = document.querySelectorAll('textarea').length > 0;

    // Dashboard signals
    result.hasProgressBar = !!document.querySelector('[role="progressbar"], .progress-bar, [class*="progress"]');
    result.hasStats = !!document.querySelector('[class*="stats"], [class*="metric"], [class*="score"]');

    return result;
  });

  // Score quiz
  if (domSignals.hasRadioButtons || domSignals.hasQuestionText) {
    scores.quiz += 0.4;
    signals.push('Has radio buttons or question elements');
  }
  if ((domSignals.radioCount as number) >= 3 && domSignals.hasSubmitButton) {
    scores.quiz += 0.3;
    signals.push('Multiple radio buttons + submit button');
  }

  // Score video
  if (domSignals.hasVideo || domSignals.hasYouTube) {
    scores.video_lesson += 0.6;
    signals.push('Contains video element');
  }

  // Score code editor
  if (domSignals.hasCodeMirror) {
    scores.code_editor += 0.7;
    signals.push('Has code editor (CodeMirror/Monaco)');
  }

  // Score lesson
  if (domSignals.hasArticleContent && (domSignals.paragraphCount as number) > 3) {
    scores.lesson += 0.5;
    signals.push('Has article content with multiple paragraphs');
  }
  if ((domSignals.headingCount as number) >= 2 && (domSignals.paragraphCount as number) > 5) {
    scores.lesson += 0.3;
    signals.push('Rich text structure (headings + paragraphs)');
  }

  // Score navigation
  if (domSignals.hasModuleList) {
    scores.navigation += 0.5;
    signals.push('Has module/syllabus list');
  }
  if ((domSignals.linkCount as number) > 15 && (domSignals.paragraphCount as number) < 3) {
    scores.navigation += 0.3;
    signals.push('Many links, few paragraphs');
  }

  // Score assignment
  if (domSignals.hasFileUpload || (domSignals.hasTextArea && domSignals.hasSubmitButton)) {
    scores.assignment += 0.5;
    signals.push('Has file upload or text submission');
  }

  // Score dashboard
  if (domSignals.hasProgressBar || domSignals.hasStats) {
    scores.dashboard += 0.4;
    signals.push('Has progress bars or stats');
  }

  // 3. Find highest scoring type
  let bestType: PageType = 'unknown';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as PageType;
    }
  }

  // Minimum confidence threshold
  if (bestScore < 0.3) {
    bestType = 'unknown';
    bestScore = 0;
    signals.push('No classification met minimum confidence');
  }

  const confidence = Math.min(bestScore, 1.0);

  log.info('Page classified', { url, pageType: bestType, confidence, signalCount: signals.length });

  return { pageType: bestType, confidence, signals };
}
