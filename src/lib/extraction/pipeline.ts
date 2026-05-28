/**
 * Layered extraction pipeline orchestrator for BrowserPilot.
 * Tries extraction methods in priority order: DOM → A11y → Network → OCR.
 * Each layer validates output quality before accepting.
 */

import type { Page } from 'playwright';
import { extractDOM, generateFingerprint, type ExtractedDOM } from './dom-extractor';
import { extractAccessibilityTree, extractQuizFromA11y, type A11yExtraction } from './a11y-extractor';
import { classifyNetworkResponses, type NetworkCaptureResult } from './network-capture';
import { extractTextFromImage, type OCRResult } from './ocr-fallback';
import { classifyPage } from '../classifier/page-classifier';
import { browserController } from '../browser/controller';
import { createLogger } from '../logger';
import { eventBus } from '../events/bus';
import type { PageType } from '../validators';

const log = createLogger('extraction-pipeline');

export type ExtractionMethod = 'dom' | 'accessibility' | 'network' | 'ocr' | 'vision';

export interface PipelineResult {
  url: string;
  title: string;
  pageType: PageType;
  pageTypeConfidence: number;
  content: {
    text: string;
    headings: { level: number; text: string }[];
    method: ExtractionMethod;
    confidence: number;
  };
  quiz?: {
    questions: { text: string; options: { label: string; text: string; checked: boolean }[]; type: string }[];
    isCopySensitive: boolean;
    method: ExtractionMethod;
  };
  networkData?: NetworkCaptureResult;
  fingerprint: string;
  extractionChain: { method: ExtractionMethod; success: boolean; duration: number; reason?: string }[];
}

/** Minimum word count to consider an extraction "useful" */
const MIN_USEFUL_WORDS = 20;
/** Minimum quiz options to consider quiz extraction valid */
const MIN_QUIZ_OPTIONS = 2;

/**
 * Run the full extraction pipeline on the active page.
 */
export async function runExtractionPipeline(page: Page, options: {
  preferredMethod?: ExtractionMethod | 'auto';
  includeQuiz?: boolean;
  includeNetwork?: boolean;
} = {}): Promise<PipelineResult> {
  const { preferredMethod = 'auto', includeQuiz = true, includeNetwork = true } = options;
  const url = page.url();
  const extractionChain: PipelineResult['extractionChain'] = [];
  let title = '';

  log.info('Starting extraction pipeline', { url, preferredMethod });
  eventBus.emit('extraction:started', { url, method: preferredMethod });

  // Step 1: Classify the page
  const classification = await classifyPage(page);
  const pageType = classification.pageType;
  const isQuizPage = pageType === 'quiz';

  // Step 2: Try extraction methods in priority order
  let extractedText = '';
  let headings: { level: number; text: string }[] = [];
  let successMethod: ExtractionMethod = 'dom';
  let confidence = 0;

  // ── DOM Extraction (always try first) ──
  if (preferredMethod === 'auto' || preferredMethod === 'dom') {
    const start = Date.now();
    try {
      const dom = await extractDOM(page);
      title = dom.title;
      headings = dom.headings;

      if (dom.wordCount >= MIN_USEFUL_WORDS) {
        extractedText = buildTextFromDOM(dom);
        successMethod = 'dom';
        confidence = Math.min(0.95, 0.5 + (dom.wordCount / 1000));
        extractionChain.push({ method: 'dom', success: true, duration: Date.now() - start });
        log.info('DOM extraction succeeded', { wordCount: dom.wordCount });
      } else {
        extractionChain.push({ method: 'dom', success: false, duration: Date.now() - start, reason: `Only ${dom.wordCount} words` });
      }
    } catch (err) {
      extractionChain.push({ method: 'dom', success: false, duration: Date.now() - start, reason: (err as Error).message });
    }
  }

  // ── Accessibility Tree (try if DOM was insufficient or for quiz pages) ──
  if (
    (extractedText.length === 0 || isQuizPage) &&
    (preferredMethod === 'auto' || preferredMethod === 'accessibility')
  ) {
    const start = Date.now();
    try {
      const a11y = await extractAccessibilityTree(page);
      if (!title) title = a11y.headings[0]?.text || '';
      if (headings.length === 0) headings = a11y.headings;

      if (a11y.wordCount >= MIN_USEFUL_WORDS || a11y.formGroups.length > 0) {
        if (a11y.wordCount > extractedText.split(/\s+/).length) {
          extractedText = a11y.textContent;
          successMethod = 'accessibility';
          confidence = Math.min(0.9, 0.4 + (a11y.wordCount / 800));
        }
        extractionChain.push({ method: 'accessibility', success: true, duration: Date.now() - start });
      } else {
        extractionChain.push({ method: 'accessibility', success: false, duration: Date.now() - start, reason: `Only ${a11y.wordCount} words, ${a11y.formGroups.length} groups` });
      }
    } catch (err) {
      extractionChain.push({ method: 'accessibility', success: false, duration: Date.now() - start, reason: (err as Error).message });
    }
  }

  // ── Network Response Capture ──
  let networkData: NetworkCaptureResult | undefined;
  if (includeNetwork && (preferredMethod === 'auto' || preferredMethod === 'network')) {
    const start = Date.now();
    try {
      const rawResponses = browserController.getNetworkResponses();
      networkData = classifyNetworkResponses(rawResponses);

      if (networkData.courseData.length > 0 || networkData.quizData.length > 0) {
        extractionChain.push({ method: 'network', success: true, duration: Date.now() - start });
      } else {
        extractionChain.push({ method: 'network', success: false, duration: Date.now() - start, reason: 'No relevant data found' });
      }
    } catch (err) {
      extractionChain.push({ method: 'network', success: false, duration: Date.now() - start, reason: (err as Error).message });
    }
  }

  // ── OCR Fallback (only when DOM + A11y both failed) ──
  if (
    extractedText.length === 0 &&
    (preferredMethod === 'auto' || preferredMethod === 'ocr')
  ) {
    const start = Date.now();
    try {
      log.info('Falling back to OCR extraction');
      const screenshot = await page.screenshot({ type: 'png', fullPage: false }) as Buffer;
      const ocrResult = await extractTextFromImage(screenshot);

      if (ocrResult.wordCount >= MIN_USEFUL_WORDS) {
        extractedText = ocrResult.text;
        successMethod = 'ocr';
        confidence = ocrResult.confidence / 100;
        extractionChain.push({ method: 'ocr', success: true, duration: Date.now() - start });
      } else {
        extractionChain.push({ method: 'ocr', success: false, duration: Date.now() - start, reason: `Only ${ocrResult.wordCount} words` });
      }
    } catch (err) {
      extractionChain.push({ method: 'ocr', success: false, duration: Date.now() - start, reason: (err as Error).message });
    }
  }

  // Step 3: Quiz extraction (if applicable)
  let quizResult: PipelineResult['quiz'] | undefined;
  if (includeQuiz && isQuizPage) {
    quizResult = await extractQuizData(page, extractionChain);
  }

  const fingerprint = generateFingerprint(extractedText);

  const result: PipelineResult = {
    url,
    title,
    pageType,
    pageTypeConfidence: classification.confidence,
    content: { text: extractedText, headings, method: successMethod, confidence },
    quiz: quizResult,
    networkData,
    fingerprint,
    extractionChain,
  };

  eventBus.emit('extraction:completed', {
    url,
    pageType,
    method: successMethod,
    confidence,
    wordCount: extractedText.split(/\s+/).filter(Boolean).length,
    hasQuiz: !!quizResult,
  });

  log.info('Extraction pipeline complete', {
    method: successMethod,
    confidence,
    chainLength: extractionChain.length,
    hasQuiz: !!quizResult,
  });

  return result;
}

/**
 * Dedicated quiz extraction trying multiple methods.
 */
async function extractQuizData(page: Page, chain: PipelineResult['extractionChain']): Promise<PipelineResult['quiz'] | undefined> {
  // Try DOM quiz extraction first
  const start1 = Date.now();
  try {
    const domQuiz = await page.evaluate(() => {
      let isCopySensitive = false;
      const bodyStyle = getComputedStyle(document.body);
      isCopySensitive = bodyStyle.userSelect === 'none' || !!document.querySelector('[oncopy]');

      const questions: { text: string; options: { label: string; text: string; checked: boolean }[]; type: string }[] = [];
      const labels = 'ABCDEFGHIJ';

      const qEls = document.querySelectorAll('[class*="question"], [data-testid*="question"], .quiz-question, [role="group"]');
      qEls.forEach((qEl) => {
        const el = qEl as HTMLElement;
        const heading = el.querySelector('h2, h3, h4, legend, [class*="question-text"]');
        let text = heading ? (heading as HTMLElement).innerText.trim() : el.innerText.split('\n')[0].trim();
        const opts: { label: string; text: string; checked: boolean }[] = [];
        el.querySelectorAll('label, [role="radio"], [role="checkbox"]').forEach((opt, i) => {
          const input = opt.querySelector('input') as HTMLInputElement;
          opts.push({ label: labels[i], text: (opt as HTMLElement).innerText.trim(), checked: input?.checked ?? false });
        });
        if (text && opts.length >= MIN_QUIZ_OPTIONS) {
          const hasCheckbox = !!el.querySelector('input[type="checkbox"]');
          questions.push({ text, options: opts, type: hasCheckbox ? 'multi_select' : 'multiple_choice' });
        }
      });

      return { questions, isCopySensitive };
    });

    if (domQuiz.questions.length > 0) {
      return { ...domQuiz, method: 'dom' as ExtractionMethod };
    }
  } catch { /* fall through */ }

  // Try A11y quiz extraction
  const start2 = Date.now();
  try {
    const a11yQuiz = await extractQuizFromA11y(page);
    if (a11yQuiz.questions.length > 0) {
      return { questions: a11yQuiz.questions, isCopySensitive: true, method: 'accessibility' as ExtractionMethod };
    }
  } catch { /* fall through */ }

  // OCR quiz fallback
  const start3 = Date.now();
  try {
    const screenshot = await page.screenshot({ type: 'png', fullPage: false }) as Buffer;
    const ocr = await extractTextFromImage(screenshot);
    if (ocr.wordCount > 5) {
      return {
        questions: [{ text: ocr.text, options: [], type: 'unknown' }],
        isCopySensitive: true,
        method: 'ocr' as ExtractionMethod,
      };
    }
  } catch { /* fall through */ }

  return undefined;
}

/** Build clean text from structured DOM extraction */
function buildTextFromDOM(dom: ExtractedDOM): string {
  const parts: string[] = [];

  for (const h of dom.headings) {
    parts.push(`${'#'.repeat(h.level)} ${h.text}`);
  }

  for (const p of dom.paragraphs) {
    parts.push(p);
  }

  for (const list of dom.lists) {
    for (const item of list.items) {
      parts.push(`• ${item}`);
    }
  }

  for (const code of dom.codeBlocks) {
    parts.push(`\`\`\`${code.language}\n${code.code}\n\`\`\``);
  }

  return parts.join('\n\n');
}
