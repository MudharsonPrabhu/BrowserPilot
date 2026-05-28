/**
 * Event bus for BrowserPilot real-time updates.
 * Uses EventEmitter pattern — swappable to Redis pub/sub later.
 */

import { EventEmitter } from 'events';

export type EventType =
  | 'task:created'
  | 'task:started'
  | 'task:step'
  | 'task:paused'
  | 'task:resumed'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  | 'browser:navigated'
  | 'browser:screenshot'
  | 'browser:tab_changed'
  | 'browser:closed'
  | 'extraction:started'
  | 'extraction:completed'
  | 'extraction:failed'
  | 'quiz:detected'
  | 'quiz:extracted'
  | 'quiz:answered'
  | 'ai:thinking'
  | 'ai:response'
  | 'ai:error'
  | 'session:started'
  | 'session:restored'
  | 'session:saved'
  | 'session:error'
  | 'progress:updated'
  | 'error:occurred'
  | 'log:entry';

export interface BusEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

class BrowserPilotEventBus {
  private emitter: EventEmitter;
  private history: BusEvent[] = [];
  private maxHistory = 500;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  emit(type: EventType, data: Record<string, unknown> = {}): void {
    const event: BusEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    this.emitter.emit('event', event);
    this.emitter.emit(type, event);
  }

  /** Subscribe to all events (for SSE streaming) */
  onAny(handler: (event: BusEvent) => void): () => void {
    this.emitter.on('event', handler);
    return () => this.emitter.off('event', handler);
  }

  /** Subscribe to a specific event type */
  on(type: EventType, handler: (event: BusEvent) => void): () => void {
    this.emitter.on(type, handler);
    return () => this.emitter.off(type, handler);
  }

  /** Get recent event history */
  getHistory(limit = 50): BusEvent[] {
    return this.history.slice(-limit);
  }

  /** Clear event history */
  clearHistory(): void {
    this.history = [];
  }
}

// Singleton
export const eventBus = new BrowserPilotEventBus();
