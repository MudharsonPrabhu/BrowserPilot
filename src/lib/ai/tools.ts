/**
 * AI tool definitions for BrowserPilot.
 * Strict JSON schemas for function calling.
 */

import type { ToolDefinition } from './client';

export const AI_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'classify_page',
      description: 'Classify the current page type based on its content, structure, and interaction model.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          pageType: {
            type: 'string',
            enum: ['lesson', 'quiz', 'code_editor', 'video_lesson', 'document', 'assignment', 'dashboard', 'navigation', 'unknown'],
            description: 'The classified page type',
          },
          confidence: { type: 'number', description: 'Confidence score 0-1' },
          reasoning: { type: 'string', description: 'Brief explanation of classification' },
        },
        required: ['pageType', 'confidence', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_content',
      description: 'Generate a concise summary of web page content.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Concise summary of the content' },
          keyPoints: {
            type: 'array', items: { type: 'string' },
            description: 'Key takeaway points',
          },
          topics: {
            type: 'array', items: { type: 'string' },
            description: 'Main topics covered',
          },
        },
        required: ['summary', 'keyPoints', 'topics'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'answer_question',
      description: 'Analyze a decision context and select the best action or answer option.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          selectedOption: { type: 'string', description: 'The label of the best answer (e.g., "A", "B")' },
          confidence: { type: 'number', description: 'Confidence 0-1' },
          reasoning: { type: 'string', description: 'Step-by-step reasoning for the answer' },
          explanation: { type: 'string', description: 'Educational explanation of the concept' },
        },
        required: ['selectedOption', 'confidence', 'reasoning', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_notes',
      description: 'Generate structured session summaries and memory snapshots from web content.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Note title' },
          notes: { type: 'string', description: 'Structured markdown notes' },
          flashcards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string' },
                back: { type: 'string' },
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
              },
              required: ['front', 'back', 'difficulty'],
              additionalProperties: false,
            },
            description: 'Generated flashcards',
          },
        },
        required: ['title', 'notes', 'flashcards'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_next_action',
      description: 'Plan the next autonomous browser action based on current page state.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['navigate', 'click', 'extract', 'summarize', 'interact', 'wait', 'done'],
            description: 'The next action to take',
          },
          target: { type: 'string', description: 'Target URL, selector, or description' },
          reasoning: { type: 'string', description: 'Why this action is the best next step' },
        },
        required: ['action', 'target', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return AI_TOOLS.find((t) => t.function.name === name);
}
