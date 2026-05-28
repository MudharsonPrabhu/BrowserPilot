/**
 * Shared Zod schemas for BrowserPilot API validation.
 */

import { z } from 'zod';

// ─── Browser Action Schemas ───────────────────────────────────────

export const NavigateSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
    .default('domcontentloaded'),
  timeout: z.number().int().positive().default(30000),
});

export const ClickSchema = z.object({
  selector: z.string().optional(),
  text: z.string().optional(),
  role: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  button: z.enum(['left', 'right', 'middle']).default('left'),
  clickCount: z.number().int().positive().default(1),
  timeout: z.number().int().positive().default(10000),
}).refine(
  (data) => data.selector || data.text || data.role || (data.x !== undefined && data.y !== undefined),
  { message: 'Must provide selector, text, role, or coordinates' }
);

export const FillSchema = z.object({
  selector: z.string(),
  value: z.string(),
  clear: z.boolean().default(true),
  timeout: z.number().int().positive().default(10000),
});

export const ScrollSchema = z.object({
  selector: z.string().optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).default('down'),
  amount: z.number().int().positive().default(500),
});

export const ScreenshotSchema = z.object({
  fullPage: z.boolean().default(false),
  selector: z.string().optional(),
  quality: z.number().int().min(0).max(100).default(70),
});

export const KeyPressSchema = z.object({
  key: z.string(),
  modifiers: z.array(z.enum(['Control', 'Shift', 'Alt', 'Meta'])).default([]),
});

export const SelectSchema = z.object({
  selector: z.string(),
  value: z.string().optional(),
  label: z.string().optional(),
  index: z.number().int().optional(),
}).refine(
  (data) => data.value !== undefined || data.label !== undefined || data.index !== undefined,
  { message: 'Must provide value, label, or index' }
);

// ─── Session Schemas ──────────────────────────────────────────────

export const StartSessionSchema = z.object({
  profileName: z.string().default('default'),
  headless: z.boolean().default(false),
  viewport: z.object({
    width: z.number().int().positive().default(1280),
    height: z.number().int().positive().default(800),
  }).default({ width: 1280, height: 800 }),
});

export const RestoreSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

// ─── Extraction Schemas ───────────────────────────────────────────

export const ExtractPageSchema = z.object({
  method: z.enum(['dom', 'accessibility', 'network', 'ocr', 'auto']).default('auto'),
  includeScreenshot: z.boolean().default(false),
});

export const ExtractQuizSchema = z.object({
  method: z.enum(['dom', 'accessibility', 'ocr', 'auto']).default('auto'),
  includeScreenshot: z.boolean().default(true),
});

// ─── AI Schemas ───────────────────────────────────────────────────

export const PlanTaskSchema = z.object({
  objective: z.string(),
  currentContext: z.string().optional(),
});

export const SummarizeSchema = z.object({
  content: z.string(),
  maxLength: z.number().int().positive().default(500),
  style: z.enum(['brief', 'detailed', 'bullet-points']).default('bullet-points'),
});

export const AnswerQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.object({
    label: z.string(),
    text: z.string(),
  })),
  context: z.string().optional(),
  hints: z.array(z.string()).default([]),
});

// ─── Task Schemas ─────────────────────────────────────────────────

export const TaskStatusEnum = z.enum([
  'queued',
  'running',
  'paused',
  'waiting_for_user',
  'completed',
  'failed',
  'cancelled',
]);

export const TaskTypeEnum = z.enum([
  'navigate',
  'extract',
  'quiz',
  'summarize',
  'course_workflow',
  'custom',
]);

export const CreateTaskSchema = z.object({
  type: TaskTypeEnum,
  priority: z.number().int().min(0).max(10).default(5),
  input: z.record(z.string(), z.unknown()).default({}),
  description: z.string().optional(),
});

// ─── Page Classification ──────────────────────────────────────────

export const PageTypeEnum = z.enum([
  'lesson',
  'quiz',
  'code_editor',
  'video_lesson',
  'document',
  'assignment',
  'dashboard',
  'navigation',
  'unknown',
]);

export type NavigateInput = z.infer<typeof NavigateSchema>;
export type ClickInput = z.infer<typeof ClickSchema>;
export type FillInput = z.infer<typeof FillSchema>;
export type ScrollInput = z.infer<typeof ScrollSchema>;
export type ScreenshotInput = z.infer<typeof ScreenshotSchema>;
export type KeyPressInput = z.infer<typeof KeyPressSchema>;
export type SelectInput = z.infer<typeof SelectSchema>;
export type StartSessionInput = z.infer<typeof StartSessionSchema>;
export type RestoreSessionInput = z.infer<typeof RestoreSessionSchema>;
export type ExtractPageInput = z.infer<typeof ExtractPageSchema>;
export type ExtractQuizInput = z.infer<typeof ExtractQuizSchema>;
export type PlanTaskInput = z.infer<typeof PlanTaskSchema>;
export type SummarizeInput = z.infer<typeof SummarizeSchema>;
export type AnswerQuestionInput = z.infer<typeof AnswerQuestionSchema>;
export type TaskStatus = z.infer<typeof TaskStatusEnum>;
export type TaskType = z.infer<typeof TaskTypeEnum>;
export type PageType = z.infer<typeof PageTypeEnum>;
