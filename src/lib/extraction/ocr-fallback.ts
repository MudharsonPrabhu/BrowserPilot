/**
 * OCR fallback extractor for BrowserPilot.
 * Uses Tesseract.js to extract text from screenshots when DOM/a11y extraction fails.
 * Only used as a fallback — never as default.
 */

import { createLogger } from '../logger';
import { eventBus } from '../events/bus';

const log = createLogger('ocr-fallback');

export interface OCRResult {
  text: string;
  confidence: number;
  lines: { text: string; confidence: number; bbox: { x: number; y: number; width: number; height: number } }[];
  wordCount: number;
  processingTime: number;
}

let worker: any = null;

/**
 * Initialize the Tesseract worker (lazy, only when OCR is actually needed).
 */
async function getWorker(): Promise<any> {
  if (worker) return worker;

  log.info('Initializing Tesseract OCR worker');
  const Tesseract = await import('tesseract.js');
  worker = await Tesseract.createWorker('eng', undefined, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        eventBus.emit('extraction:started', {
          method: 'ocr',
          progress: Math.round(m.progress * 100),
        });
      }
    },
  });

  log.info('Tesseract worker initialized');
  return worker;
}

/**
 * Extract text from an image buffer using OCR.
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<OCRResult> {
  const start = Date.now();
  log.info('Starting OCR extraction', { imageSize: imageBuffer.length });

  try {
    const w = await getWorker();
    const { data } = await w.recognize(imageBuffer);

    const lines = (data.lines || []).map((line: any) => ({
      text: line.text.trim(),
      confidence: line.confidence,
      bbox: {
        x: line.bbox.x0,
        y: line.bbox.y0,
        width: line.bbox.x1 - line.bbox.x0,
        height: line.bbox.y1 - line.bbox.y0,
      },
    })).filter((l: any) => l.text.length > 0);

    const result: OCRResult = {
      text: data.text.trim(),
      confidence: data.confidence,
      lines,
      wordCount: data.text.split(/\s+/).filter(Boolean).length,
      processingTime: Date.now() - start,
    };

    log.info('OCR extraction complete', {
      confidence: result.confidence,
      wordCount: result.wordCount,
      lineCount: result.lines.length,
      processingTime: result.processingTime,
    });

    return result;
  } catch (err) {
    log.error('OCR extraction failed', {}, err instanceof Error ? err : undefined);
    throw err;
  }
}

/**
 * Extract text from a specific region of a screenshot.
 * Crops the image before OCR to improve speed and accuracy.
 */
export async function extractTextFromRegion(
  fullScreenshot: Buffer,
  region: { x: number; y: number; width: number; height: number }
): Promise<OCRResult> {
  log.info('Extracting text from region', { region });

  // Tesseract.js supports rectangle parameter for region extraction
  const w = await getWorker();
  const start = Date.now();

  const { data } = await w.recognize(fullScreenshot, {
    rectangle: {
      top: region.y,
      left: region.x,
      width: region.width,
      height: region.height,
    },
  });

  const lines = (data.lines || []).map((line: any) => ({
    text: line.text.trim(),
    confidence: line.confidence,
    bbox: {
      x: line.bbox.x0,
      y: line.bbox.y0,
      width: line.bbox.x1 - line.bbox.x0,
      height: line.bbox.y1 - line.bbox.y0,
    },
  })).filter((l: any) => l.text.length > 0);

  return {
    text: data.text.trim(),
    confidence: data.confidence,
    lines,
    wordCount: data.text.split(/\s+/).filter(Boolean).length,
    processingTime: Date.now() - start,
  };
}

/**
 * Terminate the OCR worker to free memory.
 */
export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    log.info('Tesseract worker terminated');
  }
}
