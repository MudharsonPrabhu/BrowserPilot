/**
 * Study graph / weak areas tracker for BrowserPilot.
 * Tracks topics, quiz performance, and identifies weak areas.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { quizAttempts, quizQuestions, notes, lessons, modules, courses } from '../db/schema';
import { sessionManager } from '../session/manager';
import { createLogger } from '../logger';
import { eq } from 'drizzle-orm';

const log = createLogger('study-graph');

export interface TopicNode {
  id: string;
  name: string;
  category: 'topic' | 'module' | 'lesson';
  strength: number;      // 0-1, how well the user knows this
  quizAttempts: number;
  correctAnswers: number;
  totalQuestions: number;
  lastStudied: string | null;
  relatedTopics: string[];
}

export interface StudyGraphData {
  topics: TopicNode[];
  weakAreas: TopicNode[];
  strongAreas: TopicNode[];
  overallProgress: number;
  totalStudyTime: number;
  recommendations: string[];
}

/**
 * Build the study graph from DB data.
 */
export function buildStudyGraph(courseId?: string): StudyGraphData {
  log.info('Building study graph', { courseId });

  const topics: TopicNode[] = [];

  // Get all lessons and their quiz data
  const allLessons = courseId
    ? db.select().from(lessons).all().filter((l) => {
        const mod = db.select().from(modules).where(eq(modules.id, l.moduleId)).get();
        return mod?.courseId === courseId;
      })
    : db.select().from(lessons).all();

  for (const lesson of allLessons) {
    const questions = db.select().from(quizQuestions).where(eq(quizQuestions.lessonId, lesson.id)).all();
    let correctCount = 0;
    let totalAttempts = 0;

    for (const q of questions) {
      const attempts = db.select().from(quizAttempts).where(eq(quizAttempts.questionId, q.id)).all();
      totalAttempts += attempts.length;
      correctCount += attempts.filter((a) => a.wasCorrect).length;
    }

    const strength = questions.length > 0
      ? (totalAttempts > 0 ? correctCount / totalAttempts : 0)
      : (lesson.status === 'completed' ? 0.7 : 0);

    topics.push({
      id: lesson.id,
      name: lesson.name,
      category: 'lesson',
      strength,
      quizAttempts: totalAttempts,
      correctAnswers: correctCount,
      totalQuestions: questions.length,
      lastStudied: null,
      relatedTopics: [],
    });
  }

  // Classify weak and strong areas
  const weakAreas = topics
    .filter((t) => t.strength < 0.5 && (t.totalQuestions > 0 || t.quizAttempts > 0))
    .sort((a, b) => a.strength - b.strength);

  const strongAreas = topics
    .filter((t) => t.strength >= 0.8)
    .sort((a, b) => b.strength - a.strength);

  // Overall progress
  const completedLessons = allLessons.filter((l) => l.status === 'completed').length;
  const overallProgress = allLessons.length > 0 ? completedLessons / allLessons.length : 0;

  // Recommendations
  const recommendations: string[] = [];
  if (weakAreas.length > 0) {
    recommendations.push(`Review: ${weakAreas.slice(0, 3).map((t) => t.name).join(', ')}`);
  }
  if (weakAreas.length > 3) {
    recommendations.push(`You have ${weakAreas.length} weak topics. Focus on quiz practice.`);
  }
  const unstudied = topics.filter((t) => t.strength === 0 && t.totalQuestions === 0);
  if (unstudied.length > 0) {
    recommendations.push(`${unstudied.length} lessons not yet studied.`);
  }
  if (strongAreas.length > topics.length * 0.5) {
    recommendations.push('Great progress! Consider moving to the next module.');
  }

  const result: StudyGraphData = {
    topics,
    weakAreas,
    strongAreas,
    overallProgress,
    totalStudyTime: 0, // TODO: track actual study time
    recommendations,
  };

  log.info('Study graph built', {
    topics: topics.length,
    weakAreas: weakAreas.length,
    strongAreas: strongAreas.length,
    overallProgress: Math.round(overallProgress * 100),
  });

  return result;
}

/**
 * Save a study progress snapshot to session memory.
 */
export async function saveStudyProgress(courseId: string): Promise<void> {
  const graph = buildStudyGraph(courseId);
  await sessionManager.saveMemory(
    `study_graph_${courseId}`,
    JSON.stringify({
      overallProgress: graph.overallProgress,
      weakCount: graph.weakAreas.length,
      strongCount: graph.strongAreas.length,
      topicCount: graph.topics.length,
      updatedAt: new Date().toISOString(),
    }),
    'progress'
  );
}
