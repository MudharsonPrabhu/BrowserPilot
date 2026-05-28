/**
 * Unit tests for network capture module.
 */

import { describe, it, expect } from 'vitest';
import { classifyNetworkResponses, extractCourseStructureFromNetwork } from '@/lib/extraction/network-capture';

describe('classifyNetworkResponses', () => {
  it('should classify course-related responses', () => {
    const responses = [
      { url: 'https://api.coursera.org/api/v1/course/ml-101/lessons', timestamp: '2024-01-01', body: { lessons: [] } },
      { url: 'https://example.com/api/v1/users/me', timestamp: '2024-01-01', body: { id: 1 } },
    ];

    const result = classifyNetworkResponses(responses);
    expect(result.responses).toHaveLength(2);
    expect(result.courseData).toHaveLength(1);
    expect(result.apiResponses).toHaveLength(2);
  });

  it('should classify quiz-related responses', () => {
    const responses = [
      { url: 'https://edx.org/api/quiz/123/questions', timestamp: '2024-01-01', body: { questions: [] } },
      { url: 'https://edx.org/api/submission/grade', timestamp: '2024-01-01', body: { score: 80 } },
    ];

    const result = classifyNetworkResponses(responses);
    expect(result.quizData).toHaveLength(2);
  });

  it('should handle empty responses', () => {
    const result = classifyNetworkResponses([]);
    expect(result.responses).toHaveLength(0);
    expect(result.courseData).toHaveLength(0);
    expect(result.quizData).toHaveLength(0);
  });

  it('should skip responses without URL', () => {
    const result = classifyNetworkResponses([{ body: {} }, { timestamp: '2024' }]);
    expect(result.responses).toHaveLength(0);
  });
});

describe('extractCourseStructureFromNetwork', () => {
  it('should find module/lesson arrays in responses', () => {
    const responses = [
      {
        url: 'https://api.example.com/course/modules',
        pathname: '/course/modules',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        timestamp: '2024-01-01',
        body: {
          data: [
            { title: 'Introduction', order: 1 },
            { title: 'Variables', order: 2 },
            { title: 'Functions', order: 3 },
          ],
        },
        size: 100,
      },
    ];

    const result = extractCourseStructureFromNetwork(responses);
    expect(result.found).toBe(true);
    expect(result.modules.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for responses without arrays', () => {
    const responses = [
      {
        url: 'https://api.example.com/user',
        pathname: '/user',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        timestamp: '2024-01-01',
        body: { id: 1, name: 'Test' },
        size: 50,
      },
    ];

    const result = extractCourseStructureFromNetwork(responses);
    expect(result.found).toBe(false);
  });
});
