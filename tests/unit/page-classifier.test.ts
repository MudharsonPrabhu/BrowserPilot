/**
 * Unit tests for page classifier.
 */

import { describe, it, expect } from 'vitest';

// Test the URL pattern matching logic directly
describe('Page Classifier URL Patterns', () => {
  const URL_PATTERNS = [
    { pattern: /\/quiz|\/assessment|\/exam|\/test\b/i, type: 'quiz' },
    { pattern: /\/lesson|\/lecture|\/learn|\/chapter|\/reading/i, type: 'lesson' },
    { pattern: /\/video|\/watch|\/play/i, type: 'video_lesson' },
    { pattern: /\/code|\/lab|\/sandbox|\/exercise|\/playground/i, type: 'code_editor' },
    { pattern: /\/assignment|\/submit|\/homework|\/project/i, type: 'assignment' },
    { pattern: /\/dashboard|\/home|\/overview|\/progress/i, type: 'dashboard' },
    { pattern: /\/module|\/syllabus|\/outline|\/contents/i, type: 'navigation' },
    { pattern: /\.pdf(\?|$)/i, type: 'document' },
  ];

  function matchURL(url: string): string[] {
    return URL_PATTERNS.filter((p) => p.pattern.test(url)).map((p) => p.type);
  }

  it('should classify quiz URLs', () => {
    expect(matchURL('https://coursera.org/learn/ml/quiz/abc123')).toContain('quiz');
    expect(matchURL('https://udemy.com/course/test-prep/assessment')).toContain('quiz');
  });

  it('should classify lesson URLs', () => {
    expect(matchURL('https://coursera.org/learn/ml/lesson/1')).toContain('lesson');
    expect(matchURL('https://edx.org/course/chapter/reading')).toContain('lesson');
  });

  it('should classify video URLs', () => {
    expect(matchURL('https://coursera.org/learn/ml/video/abc')).toContain('video_lesson');
    expect(matchURL('https://platform.com/watch/lesson-1')).toContain('video_lesson');
  });

  it('should classify code editor URLs', () => {
    expect(matchURL('https://codecademy.com/lab/python-basics')).toContain('code_editor');
    expect(matchURL('https://repl.it/sandbox/js')).toContain('code_editor');
  });

  it('should classify assignment URLs', () => {
    expect(matchURL('https://coursera.org/assignment/submit')).toContain('assignment');
    expect(matchURL('https://edx.org/homework/week-1')).toContain('assignment');
  });

  it('should classify dashboard URLs', () => {
    expect(matchURL('https://coursera.org/dashboard')).toContain('dashboard');
    expect(matchURL('https://edx.org/progress')).toContain('dashboard');
  });

  it('should classify PDF URLs', () => {
    expect(matchURL('https://example.com/files/notes.pdf')).toContain('document');
    expect(matchURL('https://example.com/files/notes.pdf?v=2')).toContain('document');
  });

  it('should return empty for unknown URLs', () => {
    expect(matchURL('https://google.com')).toHaveLength(0);
  });
});
