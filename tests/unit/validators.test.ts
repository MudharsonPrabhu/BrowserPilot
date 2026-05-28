/**
 * Unit tests for Zod validators.
 */

import { describe, it, expect } from 'vitest';
import {
  NavigateSchema, ClickSchema, FillSchema, StartSessionSchema,
  ExtractPageSchema, SummarizeSchema, AnswerQuestionSchema,
  CreateTaskSchema, PageTypeEnum,
} from '@/lib/validators';

describe('NavigateSchema', () => {
  it('should accept valid URL', () => {
    const result = NavigateSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid URL', () => {
    const result = NavigateSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should apply defaults', () => {
    const result = NavigateSchema.parse({ url: 'https://example.com' });
    expect(result.waitUntil).toBe('domcontentloaded');
    expect(result.timeout).toBe(30000);
  });
});

describe('ClickSchema', () => {
  it('should accept selector', () => {
    const result = ClickSchema.safeParse({ selector: '#btn' });
    expect(result.success).toBe(true);
  });

  it('should accept text', () => {
    const result = ClickSchema.safeParse({ text: 'Click me' });
    expect(result.success).toBe(true);
  });

  it('should accept coordinates', () => {
    const result = ClickSchema.safeParse({ x: 100, y: 200 });
    expect(result.success).toBe(true);
  });

  it('should reject empty click', () => {
    const result = ClickSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('FillSchema', () => {
  it('should accept valid input', () => {
    const result = FillSchema.safeParse({ selector: '#input', value: 'hello' });
    expect(result.success).toBe(true);
  });

  it('should require selector', () => {
    const result = FillSchema.safeParse({ value: 'hello' });
    expect(result.success).toBe(false);
  });
});

describe('StartSessionSchema', () => {
  it('should apply defaults', () => {
    const result = StartSessionSchema.parse({});
    expect(result.profileName).toBe('default');
    expect(result.headless).toBe(false);
    expect(result.viewport).toBeDefined();
  });
});

describe('SummarizeSchema', () => {
  it('should accept valid input', () => {
    const result = SummarizeSchema.safeParse({ content: 'Some lesson content' });
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = SummarizeSchema.parse({ content: 'test' });
    expect(result.style).toBe('bullet-points');
    expect(result.maxLength).toBe(500);
  });
});

describe('AnswerQuestionSchema', () => {
  it('should accept valid quiz input', () => {
    const result = AnswerQuestionSchema.safeParse({
      question: 'What is 2+2?',
      options: [
        { label: 'A', text: '3' },
        { label: 'B', text: '4' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should require question and options', () => {
    const result = AnswerQuestionSchema.safeParse({ question: 'test' });
    expect(result.success).toBe(false);
  });
});

describe('PageTypeEnum', () => {
  it('should accept valid page types', () => {
    expect(PageTypeEnum.parse('lesson')).toBe('lesson');
    expect(PageTypeEnum.parse('quiz')).toBe('quiz');
    expect(PageTypeEnum.parse('unknown')).toBe('unknown');
  });

  it('should reject invalid types', () => {
    const result = PageTypeEnum.safeParse('invalid_type');
    expect(result.success).toBe(false);
  });
});
