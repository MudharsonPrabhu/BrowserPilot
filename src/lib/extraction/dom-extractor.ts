/**
 * DOM content extractor for BrowserPilot.
 * Extracts clean, readable content from web pages by removing noise.
 */

import type { Page } from 'playwright';
import { createLogger } from '../logger';

const log = createLogger('dom-extractor');

export interface ExtractedDOM {
  title: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  lists: { type: 'ul' | 'ol'; items: string[] }[];
  codeBlocks: { language: string; code: string }[];
  tables: { headers: string[]; rows: string[][] }[];
  links: { text: string; href: string }[];
  rawText: string;
  wordCount: number;
}

/**
 * Extract clean content from a page's DOM.
 * Removes navigation, footer, ads, cookie banners, and irrelevant UI.
 */
export async function extractDOM(page: Page): Promise<ExtractedDOM> {
  log.info('Starting DOM extraction', { url: page.url() });

  const result = await page.evaluate(() => {
    // Selectors for noise elements to remove
    const NOISE_SELECTORS = [
      'nav', 'footer', 'header',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.cookie-banner', '.cookie-consent', '#cookie-banner',
      '.ad', '.ads', '.advertisement', '[class*="advert"]',
      '.sidebar-nav', '.breadcrumb', '.pagination',
      '[aria-hidden="true"]',
      'script', 'style', 'noscript', 'iframe',
      '.modal', '.popup', '.overlay',
      '[class*="cookie"]', '[id*="cookie"]',
      '[class*="gdpr"]', '[id*="gdpr"]',
      '[class*="consent"]', '[id*="consent"]',
    ];

    // Clone body to avoid mutating the actual page
    const clone = document.body.cloneNode(true) as HTMLElement;

    // Remove noise elements
    for (const selector of NOISE_SELECTORS) {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    }

    // Extract title
    const title = document.title || '';

    // Extract headings
    const headings: { level: number; text: string }[] = [];
    clone.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const level = parseInt(h.tagName[1]);
      const text = (h as HTMLElement).innerText.trim();
      if (text) headings.push({ level, text });
    });

    // Extract paragraphs
    const paragraphs: string[] = [];
    clone.querySelectorAll('p').forEach((p) => {
      const text = (p as HTMLElement).innerText.trim();
      if (text && text.length > 10) paragraphs.push(text);
    });

    // Extract lists
    const lists: { type: 'ul' | 'ol'; items: string[] }[] = [];
    clone.querySelectorAll('ul, ol').forEach((list) => {
      const type = list.tagName.toLowerCase() as 'ul' | 'ol';
      const items: string[] = [];
      list.querySelectorAll(':scope > li').forEach((li) => {
        const text = (li as HTMLElement).innerText.trim();
        if (text) items.push(text);
      });
      if (items.length > 0) lists.push({ type, items });
    });

    // Extract code blocks
    const codeBlocks: { language: string; code: string }[] = [];
    clone.querySelectorAll('pre, code').forEach((el) => {
      const code = (el as HTMLElement).innerText.trim();
      if (code && code.length > 5) {
        const lang = el.className
          .split(/\s+/)
          .find((c) => c.startsWith('language-') || c.startsWith('lang-'))
          ?.replace(/^(language-|lang-)/, '') || '';
        codeBlocks.push({ language: lang, code });
      }
    });

    // Extract tables
    const tables: { headers: string[]; rows: string[][] }[] = [];
    clone.querySelectorAll('table').forEach((table) => {
      const headers: string[] = [];
      table.querySelectorAll('thead th, thead td').forEach((th) => {
        headers.push((th as HTMLElement).innerText.trim());
      });
      const rows: string[][] = [];
      table.querySelectorAll('tbody tr').forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll('td, th').forEach((td) => {
          cells.push((td as HTMLElement).innerText.trim());
        });
        if (cells.length > 0) rows.push(cells);
      });
      if (headers.length > 0 || rows.length > 0) {
        tables.push({ headers, rows });
      }
    });

    // Extract links
    const links: { text: string; href: string }[] = [];
    clone.querySelectorAll('a[href]').forEach((a) => {
      const text = (a as HTMLAnchorElement).innerText.trim();
      const href = (a as HTMLAnchorElement).href;
      if (text && href && !href.startsWith('javascript:')) {
        links.push({ text, href });
      }
    });

    // Get raw text content
    const rawText = clone.innerText.trim();

    return {
      title,
      headings,
      paragraphs,
      lists,
      codeBlocks,
      tables,
      links,
      rawText: rawText.slice(0, 15000),
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
    };
  });

  log.info('DOM extraction complete', {
    headings: result.headings.length,
    paragraphs: result.paragraphs.length,
    wordCount: result.wordCount,
  });

  return result;
}

/**
 * Generate a fingerprint hash for content deduplication.
 */
export function generateFingerprint(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
