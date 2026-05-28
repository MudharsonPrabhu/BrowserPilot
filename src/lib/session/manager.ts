/**
 * Session manager for BrowserPilot.
 * Manages session lifecycle, state persistence, and recovery.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { userSessions, memoryItems, browserTabs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../logger';
import { eventBus } from '../events/bus';

const log = createLogger('session-manager');

export interface SessionState {
  id: string;
  browserProfilePath: string;
  status: 'active' | 'paused' | 'closed';
  startedAt: string;
  lastActiveAt: string;
  memory: Record<string, string>;
}

class SessionManager {
  private currentSessionId: string | null = null;

  async startSession(profilePath: string): Promise<SessionState> {
    const id = uuid();
    const now = new Date().toISOString();

    db.insert(userSessions).values({
      id, browserProfilePath: profilePath, status: 'active', startedAt: now, lastActiveAt: now,
    }).run();

    this.currentSessionId = id;
    log.info('Session started', { sessionId: id });
    eventBus.emit('session:started', { sessionId: id });

    return { id, browserProfilePath: profilePath, status: 'active', startedAt: now, lastActiveAt: now, memory: {} };
  }

  async restoreSession(sessionId: string): Promise<SessionState | null> {
    const session = db.select().from(userSessions).where(eq(userSessions.id, sessionId)).get();
    if (!session) return null;

    const items = db.select().from(memoryItems).where(eq(memoryItems.sessionId, sessionId)).all();
    const memory: Record<string, string> = {};
    for (const item of items) { memory[item.key] = item.value; }

    this.currentSessionId = sessionId;
    db.update(userSessions).set({ status: 'active', lastActiveAt: new Date().toISOString() }).where(eq(userSessions.id, sessionId)).run();

    eventBus.emit('session:restored', { sessionId });
    return { ...session, memory } as SessionState;
  }

  async saveMemory(key: string, value: string, category: 'course_state' | 'browser_state' | 'user_preference' | 'progress' | 'error_context' = 'course_state'): Promise<void> {
    if (!this.currentSessionId) throw new Error('No active session');
    const id = uuid();
    const existing = db.select().from(memoryItems).where(eq(memoryItems.key, key)).get();
    if (existing) {
      db.update(memoryItems).set({ value, updatedAt: new Date().toISOString() }).where(eq(memoryItems.id, existing.id)).run();
    } else {
      db.insert(memoryItems).values({ id, sessionId: this.currentSessionId, key, value, category, updatedAt: new Date().toISOString() }).run();
    }
  }

  async getMemory(key: string): Promise<string | null> {
    const item = db.select().from(memoryItems).where(eq(memoryItems.key, key)).get();
    return item?.value ?? null;
  }

  async touchSession(): Promise<void> {
    if (!this.currentSessionId) return;
    db.update(userSessions).set({ lastActiveAt: new Date().toISOString() }).where(eq(userSessions.id, this.currentSessionId)).run();
  }

  async closeSession(): Promise<void> {
    if (!this.currentSessionId) return;
    db.update(userSessions).set({ status: 'closed', lastActiveAt: new Date().toISOString() }).where(eq(userSessions.id, this.currentSessionId)).run();
    log.info('Session closed', { sessionId: this.currentSessionId });
    this.currentSessionId = null;
  }

  getCurrentSessionId(): string | null { return this.currentSessionId; }

  async getStatus(): Promise<SessionState | null> {
    if (!this.currentSessionId) return null;
    return this.restoreSession(this.currentSessionId);
  }
}

export const sessionManager = new SessionManager();
