/**
 * Accessibility tree extractor for BrowserPilot.
 * Uses Playwright's accessibility snapshot for semantic content extraction.
 * Preferred for quiz pages and dynamic pages where DOM text is unreliable.
 */

import type { Page } from 'playwright';
import { createLogger } from '../logger';

const log = createLogger('a11y-extractor');

export interface A11yNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  children?: A11yNode[];
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  selected?: boolean;
  level?: number;
}

export interface A11yExtraction {
  tree: A11yNode | null;
  headings: { level: number; text: string }[];
  links: { text: string }[];
  buttons: { text: string; disabled: boolean }[];
  inputs: { role: string; name: string; value: string; checked?: boolean }[];
  textContent: string;
  formGroups: { legend: string; items: { text: string; role: string; checked?: boolean }[] }[];
  wordCount: number;
}

/**
 * Extract structured content from the accessibility tree.
 */
export async function extractAccessibilityTree(page: Page): Promise<A11yExtraction> {
  log.info('Starting accessibility tree extraction', { url: page.url() });

  // Build accessibility data from ARIA attributes and semantic HTML via in-page evaluation
  const snapshot = await page.evaluate(() => {
    function buildNode(el: Element): any {
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const name = el.getAttribute('aria-label') || el.getAttribute('title') || (el as HTMLElement).innerText?.split('\n')[0]?.trim()?.slice(0, 100) || '';
      const children: any[] = [];
      for (const child of el.children) {
        const cn = buildNode(child);
        if (cn) children.push(cn);
      }
      const node: any = { role, name };
      if (children.length > 0) node.children = children;
      if (el.hasAttribute('aria-checked')) node.checked = el.getAttribute('aria-checked') === 'true';
      if (el.hasAttribute('aria-disabled')) node.disabled = el.getAttribute('aria-disabled') === 'true';
      if (el.hasAttribute('aria-level')) node.level = parseInt(el.getAttribute('aria-level') || '0');
      if ((el as HTMLInputElement).type === 'radio') { node.role = 'radio'; node.checked = (el as HTMLInputElement).checked; }
      if ((el as HTMLInputElement).type === 'checkbox') { node.role = 'checkbox'; node.checked = (el as HTMLInputElement).checked; }
      if (/^h[1-6]$/i.test(el.tagName)) { node.role = 'heading'; node.level = parseInt(el.tagName[1]); }
      return node;
    }
    return buildNode(document.body);
  });

  const headings: A11yExtraction['headings'] = [];
  const links: A11yExtraction['links'] = [];
  const buttons: A11yExtraction['buttons'] = [];
  const inputs: A11yExtraction['inputs'] = [];
  const formGroups: A11yExtraction['formGroups'] = [];
  const textParts: string[] = [];

  function walk(node: A11yNode, depth = 0): void {
    if (!node) return;

    const role = node.role?.toLowerCase() || '';
    const name = node.name?.trim() || '';

    // Collect headings
    if (role === 'heading' && name) {
      headings.push({ level: node.level || depth, text: name });
      textParts.push(name);
    }

    // Collect links
    if (role === 'link' && name) {
      links.push({ text: name });
    }

    // Collect buttons
    if (role === 'button' && name) {
      buttons.push({ text: name, disabled: !!node.disabled });
    }

    // Collect form inputs (radio, checkbox, textbox, combobox)
    if (['radio', 'checkbox', 'textbox', 'combobox', 'spinbutton'].includes(role)) {
      inputs.push({
        role,
        name,
        value: node.value || '',
        checked: typeof node.checked === 'boolean' ? node.checked : undefined,
      });
    }

    // Collect form groups (question containers)
    if (role === 'group' || role === 'radiogroup') {
      const groupItems = (node.children || [])
        .filter((c) => ['radio', 'checkbox'].includes(c.role?.toLowerCase() || ''))
        .map((c) => ({
          text: c.name?.trim() || '',
          role: c.role?.toLowerCase() || '',
          checked: typeof c.checked === 'boolean' ? c.checked : undefined,
        }));

      if (groupItems.length > 0) {
        formGroups.push({ legend: name, items: groupItems });
      }
    }

    // Collect text content
    if (['text', 'statictext', 'paragraph'].includes(role) && name) {
      textParts.push(name);
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        walk(child as A11yNode, depth + 1);
      }
    }
  }

  if (snapshot) {
    walk(snapshot as A11yNode);
  }

  const textContent = textParts.join('\n');

  const result: A11yExtraction = {
    tree: snapshot as A11yNode | null,
    headings,
    links,
    buttons,
    inputs,
    formGroups,
    textContent,
    wordCount: textContent.split(/\s+/).filter(Boolean).length,
  };

  log.info('Accessibility extraction complete', {
    headings: headings.length,
    inputs: inputs.length,
    formGroups: formGroups.length,
    wordCount: result.wordCount,
  });

  return result;
}

/**
 * Extract quiz data specifically from the accessibility tree.
 * More reliable than DOM for dynamic/copy-protected quiz pages.
 */
export async function extractQuizFromA11y(page: Page): Promise<{
  questions: { text: string; options: { label: string; text: string; checked: boolean }[]; type: string }[];
}> {
  const a11y = await extractAccessibilityTree(page);
  const questions: { text: string; options: { label: string; text: string; checked: boolean }[]; type: string }[] = [];
  const labels = 'ABCDEFGHIJ';

  for (const group of a11y.formGroups) {
    const isMultiSelect = group.items.some((i) => i.role === 'checkbox');
    questions.push({
      text: group.legend || 'Question (from accessibility tree)',
      options: group.items.map((item, idx) => ({
        label: labels[idx] || String(idx + 1),
        text: item.text,
        checked: item.checked ?? false,
      })),
      type: isMultiSelect ? 'multi_select' : 'multiple_choice',
    });
  }

  // Fallback: if no form groups, try to build from loose radio/checkbox inputs
  if (questions.length === 0 && a11y.inputs.length > 0) {
    const radioInputs = a11y.inputs.filter((i) => i.role === 'radio' || i.role === 'checkbox');
    if (radioInputs.length >= 2) {
      questions.push({
        text: a11y.headings[0]?.text || 'Question detected via accessibility tree',
        options: radioInputs.map((r, idx) => ({
          label: labels[idx] || String(idx + 1),
          text: r.name || r.value,
          checked: r.checked ?? false,
        })),
        type: radioInputs[0].role === 'checkbox' ? 'multi_select' : 'multiple_choice',
      });
    }
  }

  return { questions };
}
