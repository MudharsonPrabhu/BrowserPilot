/**
 * Drizzle ORM schema for BrowserPilot.
 * SQLite with better-sqlite3 — designed to migrate to Postgres/Supabase.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ─── User Session ─────────────────────────────────────────────────

export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  browserProfilePath: text('browser_profile_path').notNull(),
  status: text('status', { enum: ['active', 'paused', 'closed'] }).notNull().default('active'),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  lastActiveAt: text('last_active_at').notNull().default(sql`(datetime('now'))`),
  metadata: text('metadata'), // JSON string for flexible data
});

// ─── Browser Tab ──────────────────────────────────────────────────

export const browserTabs = sqliteTable('browser_tabs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => userSessions.id),
  url: text('url').notNull(),
  title: text('title').default(''),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  openedAt: text('opened_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Course ───────────────────────────────────────────────────────

export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  platform: text('platform').default('unknown'),
  totalModules: integer('total_modules').default(0),
  completedModules: integer('completed_modules').default(0),
  status: text('status', { enum: ['not_started', 'in_progress', 'completed'] }).default('not_started'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Module ───────────────────────────────────────────────────────

export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull().references(() => courses.id),
  name: text('name').notNull(),
  order: integer('order').notNull().default(0),
  status: text('status', { enum: ['not_started', 'in_progress', 'completed'] }).default('not_started'),
});

// ─── Lesson ───────────────────────────────────────────────────────

export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => modules.id),
  name: text('name').notNull(),
  url: text('url'),
  order: integer('order').notNull().default(0),
  pageType: text('page_type', {
    enum: ['lesson', 'quiz', 'code_editor', 'video_lesson', 'document', 'assignment', 'dashboard', 'navigation', 'unknown'],
  }).default('unknown'),
  status: text('status', { enum: ['not_started', 'in_progress', 'completed'] }).default('not_started'),
  duration: integer('duration'), // estimated minutes
});

// ─── Page Snapshot ────────────────────────────────────────────────

export const pageSnapshots = sqliteTable('page_snapshots', {
  id: text('id').primaryKey(),
  lessonId: text('lesson_id').references(() => lessons.id),
  url: text('url').notNull(),
  title: text('title'),
  fingerprint: text('fingerprint'), // content hash for cache dedup
  screenshotPath: text('screenshot_path'),
  extractedAt: text('extracted_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Extracted Content ────────────────────────────────────────────

export const extractedContents = sqliteTable('extracted_contents', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull().references(() => pageSnapshots.id),
  contentType: text('content_type', { enum: ['text', 'quiz', 'code', 'video_transcript', 'table'] }).notNull(),
  content: text('content').notNull(),
  method: text('method', { enum: ['dom', 'accessibility', 'network', 'ocr', 'vision'] }).notNull(),
  confidence: real('confidence').default(1.0),
});

// ─── Quiz Question ────────────────────────────────────────────────

export const quizQuestions = sqliteTable('quiz_questions', {
  id: text('id').primaryKey(),
  lessonId: text('lesson_id').references(() => lessons.id),
  snapshotId: text('snapshot_id').references(() => pageSnapshots.id),
  questionText: text('question_text').notNull(),
  questionType: text('question_type', {
    enum: ['multiple_choice', 'true_false', 'fill_blank', 'multi_select', 'code', 'unknown'],
  }).default('multiple_choice'),
  hints: text('hints'), // JSON array
  isCopySensitive: integer('is_copy_sensitive', { mode: 'boolean' }).default(false),
  extractedAt: text('extracted_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Quiz Option ──────────────────────────────────────────────────

export const quizOptions = sqliteTable('quiz_options', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull().references(() => quizQuestions.id),
  label: text('label').notNull(), // A, B, C, D
  text: text('text').notNull(),
  isSelected: integer('is_selected', { mode: 'boolean' }).default(false),
  isCorrect: integer('is_correct', { mode: 'boolean' }),
});

// ─── Quiz Attempt ─────────────────────────────────────────────────

export const quizAttempts = sqliteTable('quiz_attempts', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull().references(() => quizQuestions.id),
  selectedOptionId: text('selected_option_id').references(() => quizOptions.id),
  aiAnswer: text('ai_answer'),
  confidence: real('confidence'),
  reasoning: text('reasoning'),
  wasCorrect: integer('was_correct', { mode: 'boolean' }),
  submittedAt: text('submitted_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Task ─────────────────────────────────────────────────────────

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => userSessions.id),
  type: text('type', {
    enum: ['navigate', 'extract', 'interact', 'summarize', 'agent_workflow', 'custom'],
  }).notNull(),
  status: text('status', {
    enum: ['queued', 'running', 'paused', 'waiting_for_user', 'completed', 'failed', 'cancelled'],
  }).notNull().default('queued'),
  priority: integer('priority').default(5),
  description: text('description'),
  input: text('input'), // JSON
  output: text('output'), // JSON
  error: text('error'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

// ─── Task Step ────────────────────────────────────────────────────

export const taskSteps = sqliteTable('task_steps', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  action: text('action').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
  }).notNull().default('pending'),
  input: text('input'), // JSON
  output: text('output'), // JSON
  error: text('error'),
  duration: integer('duration'), // ms
  order: integer('order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Note ─────────────────────────────────────────────────────────

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  lessonId: text('lesson_id').references(() => lessons.id),
  courseId: text('course_id').references(() => courses.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type', { enum: ['summary', 'key_points', 'explanation', 'custom'] }).default('summary'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Flashcard ────────────────────────────────────────────────────

export const flashcards = sqliteTable('flashcards', {
  id: text('id').primaryKey(),
  lessonId: text('lesson_id').references(() => lessons.id),
  courseId: text('course_id').references(() => courses.id),
  front: text('front').notNull(),
  back: text('back').notNull(),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).default('medium'),
  nextReview: text('next_review'),
  reviewCount: integer('review_count').default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Memory Item ──────────────────────────────────────────────────

export const memoryItems = sqliteTable('memory_items', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => userSessions.id),
  key: text('key').notNull(),
  value: text('value').notNull(),
  category: text('category', {
    enum: ['agent_state', 'browser_state', 'user_preference', 'progress', 'error_context'],
  }).default('agent_state'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Error Event ──────────────────────────────────────────────────

export const errorEvents = sqliteTable('error_events', {
  id: text('id').primaryKey(),
  taskStepId: text('task_step_id').references(() => taskSteps.id),
  errorType: text('error_type', {
    enum: [
      'element_not_found', 'stale_selector', 'navigation_timeout', 'page_reload',
      'login_expired', 'iframe_blocked', 'dynamic_dom', 'action_blocked',
      'ocr_failure', 'llm_timeout', 'malformed_output', 'network_failure',
      'browser_crash', 'unknown',
    ],
  }).notNull(),
  message: text('message').notNull(),
  context: text('context'), // JSON
  recoverable: integer('recoverable', { mode: 'boolean' }).default(true),
  resolved: integer('resolved', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Relations ────────────────────────────────────────────────────

export const userSessionsRelations = relations(userSessions, ({ many }) => ({
  tabs: many(browserTabs),
  tasks: many(tasks),
  memoryItems: many(memoryItems),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  modules: many(modules),
  notes: many(notes),
  flashcards: many(flashcards),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, { fields: [modules.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  module: one(modules, { fields: [lessons.moduleId], references: [modules.id] }),
  snapshots: many(pageSnapshots),
  quizQuestions: many(quizQuestions),
  notes: many(notes),
  flashcards: many(flashcards),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  session: one(userSessions, { fields: [tasks.sessionId], references: [userSessions.id] }),
  steps: many(taskSteps),
}));

export const taskStepsRelations = relations(taskSteps, ({ one, many }) => ({
  task: one(tasks, { fields: [taskSteps.taskId], references: [tasks.id] }),
  errors: many(errorEvents),
}));
