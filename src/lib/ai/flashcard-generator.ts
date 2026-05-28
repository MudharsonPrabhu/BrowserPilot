/**
 * Memory snapshot generator for BrowserPilot.
 * Generates spaced-repetition knowledge cards from extracted web content.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { flashcards } from '../db/schema';
import { generateNotes } from '../ai/summarizer';
import { createLogger } from '../logger';
import { eq } from 'drizzle-orm';

const log = createLogger('flashcard-generator');

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nextReview: string | null;
  reviewCount: number;
}

/**
 * Generate flashcards from content using AI.
 */
export async function generateFlashcards(
  content: string,
  lessonId?: string,
  courseId?: string
): Promise<Flashcard[]> {
  log.info('Generating flashcards', { contentLength: content.length, lessonId });

  const result = await generateNotes(content);
  const cards: Flashcard[] = [];

  for (const fc of result.flashcards) {
    const card: Flashcard = {
      id: uuid(),
      front: fc.front,
      back: fc.back,
      difficulty: fc.difficulty as 'easy' | 'medium' | 'hard',
      nextReview: new Date().toISOString(),
      reviewCount: 0,
    };

    // Persist to DB
    db.insert(flashcards).values({
      id: card.id,
      lessonId: lessonId || null,
      courseId: courseId || null,
      front: card.front,
      back: card.back,
      difficulty: card.difficulty,
      nextReview: card.nextReview,
      reviewCount: 0,
    }).run();

    cards.push(card);
  }

  log.info('Flashcards generated', { count: cards.length });
  return cards;
}

/**
 * Get flashcards due for review (spaced repetition).
 */
export function getDueFlashcards(courseId?: string, limit = 20): Flashcard[] {
  const now = new Date().toISOString();
  let query = db.select().from(flashcards);

  const rows = query.all().filter((fc) => {
    if (courseId && fc.courseId !== courseId) return false;
    if (!fc.nextReview) return true;
    return fc.nextReview <= now;
  }).slice(0, limit);

  return rows.map((r) => ({
    id: r.id,
    front: r.front,
    back: r.back,
    difficulty: (r.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
    nextReview: r.nextReview,
    reviewCount: r.reviewCount || 0,
  }));
}

/**
 * Record a flashcard review and schedule the next one.
 * Simple SM-2 inspired algorithm.
 */
export function reviewFlashcard(id: string, quality: 0 | 1 | 2 | 3 | 4 | 5): void {
  const card = db.select().from(flashcards).where(eq(flashcards.id, id)).get();
  if (!card) return;

  const count = (card.reviewCount || 0) + 1;
  let intervalDays: number;

  if (quality < 3) {
    // Failed — reset to 1 day
    intervalDays = 1;
  } else {
    // Success — exponential growth
    const base = quality === 5 ? 2.5 : quality === 4 ? 2.0 : 1.5;
    intervalDays = Math.round(Math.pow(base, Math.min(count, 8)));
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  const newDifficulty = quality <= 2 ? 'hard' : quality <= 3 ? 'medium' : 'easy';

  db.update(flashcards).set({
    reviewCount: count,
    nextReview: nextReview.toISOString(),
    difficulty: newDifficulty,
  }).where(eq(flashcards.id, id)).run();

  log.info('Flashcard reviewed', { id, quality, nextReviewDays: intervalDays });
}

/**
 * Get all flashcards for a course.
 */
export function getFlashcardsByCourse(courseId: string): Flashcard[] {
  return db.select().from(flashcards).where(eq(flashcards.courseId, courseId)).all().map((r) => ({
    id: r.id,
    front: r.front,
    back: r.back,
    difficulty: (r.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
    nextReview: r.nextReview,
    reviewCount: r.reviewCount || 0,
  }));
}
