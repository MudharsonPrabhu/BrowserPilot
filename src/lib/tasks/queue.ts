/**
 * In-process task queue for BrowserPilot.
 */

import { v4 as uuid } from 'uuid';
import { createLogger } from '../logger';
import { eventBus } from '../events/bus';
import type { TaskStatus, TaskType } from '../validators';

const log = createLogger('task-queue');

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  description?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  steps: TaskStep[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskStep {
  id: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  duration?: number;
  order: number;
}

type TaskHandler = (task: Task, addStep: (action: string, fn: () => Promise<unknown>) => Promise<unknown>) => Promise<void>;

class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private handlers: Map<TaskType, TaskHandler> = new Map();
  private isProcessing = false;
  private isPaused = false;
  private currentTaskId: string | null = null;
  private abortController: AbortController | null = null;

  registerHandler(type: TaskType, handler: TaskHandler): void {
    this.handlers.set(type, handler);
  }

  enqueue(options: { type: TaskType; priority?: number; input?: Record<string, unknown>; description?: string }): Task {
    const task: Task = {
      id: uuid(), type: options.type, status: 'queued', priority: options.priority ?? 5,
      description: options.description, input: options.input ?? {}, steps: [], createdAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    eventBus.emit('task:created', { taskId: task.id, type: task.type, description: task.description });
    if (!this.isProcessing && !this.isPaused) this.processNext();
    return task;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.isPaused) return;
    const queued = Array.from(this.tasks.values()).filter((t) => t.status === 'queued').sort((a, b) => b.priority - a.priority);
    if (queued.length === 0) return;

    const task = queued[0];
    const handler = this.handlers.get(task.type);
    if (!handler) {
      task.status = 'failed';
      task.error = `No handler for: ${task.type}`;
      eventBus.emit('task:failed', { taskId: task.id, error: task.error });
      this.processNext();
      return;
    }

    this.isProcessing = true;
    this.currentTaskId = task.id;
    this.abortController = new AbortController();
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    eventBus.emit('task:started', { taskId: task.id, type: task.type });

    try {
      const addStep = async (action: string, fn: () => Promise<unknown>): Promise<unknown> => {
        if (this.abortController?.signal.aborted) throw new Error('Task cancelled');
        const step: TaskStep = { id: uuid(), action, status: 'running', order: task.steps.length };
        task.steps.push(step);
        eventBus.emit('task:step', { taskId: task.id, stepId: step.id, action, status: 'running' });
        const start = Date.now();
        try {
          while (this.isPaused) await new Promise((r) => setTimeout(r, 500));
          const result = await fn();
          step.status = 'completed';
          step.output = typeof result === 'object' ? result as Record<string, unknown> : { value: result };
          step.duration = Date.now() - start;
          eventBus.emit('task:step', { taskId: task.id, stepId: step.id, action, status: 'completed', duration: step.duration });
          return result;
        } catch (err) {
          step.status = 'failed';
          step.error = err instanceof Error ? err.message : String(err);
          step.duration = Date.now() - start;
          eventBus.emit('task:step', { taskId: task.id, stepId: step.id, action, status: 'failed', error: step.error });
          throw err;
        }
      };
      await handler(task, addStep);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      eventBus.emit('task:completed', { taskId: task.id });
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : String(err);
      task.completedAt = new Date().toISOString();
      eventBus.emit('task:failed', { taskId: task.id, error: task.error });
    } finally {
      this.isProcessing = false;
      this.currentTaskId = null;
      this.abortController = null;
      this.processNext();
    }
  }

  pause(taskId?: string): void {
    if (taskId && taskId !== this.currentTaskId) {
      const task = this.tasks.get(taskId);
      if (task && task.status === 'queued') { task.status = 'paused'; eventBus.emit('task:paused', { taskId }); }
      return;
    }
    this.isPaused = true;
    if (this.currentTaskId) {
      const task = this.tasks.get(this.currentTaskId);
      if (task) task.status = 'paused';
      eventBus.emit('task:paused', { taskId: this.currentTaskId });
    }
  }

  resume(taskId?: string): void {
    if (taskId) { const task = this.tasks.get(taskId); if (task?.status === 'paused') { task.status = 'queued'; eventBus.emit('task:resumed', { taskId }); } }
    this.isPaused = false;
    if (this.currentTaskId) { const task = this.tasks.get(this.currentTaskId); if (task) task.status = 'running'; eventBus.emit('task:resumed', { taskId: this.currentTaskId }); }
    if (!this.isProcessing) this.processNext();
  }

  stop(taskId: string): void {
    if (taskId === this.currentTaskId) this.abortController?.abort();
    const task = this.tasks.get(taskId);
    if (task) { task.status = 'cancelled'; task.completedAt = new Date().toISOString(); eventBus.emit('task:cancelled', { taskId }); }
  }

  getTask(taskId: string): Task | undefined { return this.tasks.get(taskId); }

  getAllTasks(status?: TaskStatus): Task[] {
    const all = Array.from(this.tasks.values());
    if (status) return all.filter((t) => t.status === status);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getCurrentTaskId(): string | null { return this.currentTaskId; }

  clearFinished(): number {
    let cleared = 0;
    for (const [id, task] of this.tasks) {
      if (['completed', 'failed', 'cancelled'].includes(task.status)) { this.tasks.delete(id); cleared++; }
    }
    return cleared;
  }
}

export const taskQueue = new TaskQueue();
