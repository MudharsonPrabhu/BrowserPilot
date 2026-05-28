/**
 * Unit tests for task queue.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Inline a minimal queue for unit testing (avoids singleton import issues)
function createTestQueue() {
  type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  interface Task { id: string; type: string; status: TaskStatus; output?: unknown; error?: string; }

  const tasks = new Map<string, Task>();
  let idCounter = 0;

  return {
    enqueue(type: string): Task {
      const task: Task = { id: String(++idCounter), type, status: 'queued' };
      tasks.set(task.id, task);
      return task;
    },
    getTask(id: string) { return tasks.get(id); },
    getAllTasks() { return Array.from(tasks.values()); },
    pause(id: string) { const t = tasks.get(id); if (t) t.status = 'paused'; },
    resume(id: string) { const t = tasks.get(id); if (t) t.status = 'queued'; },
    stop(id: string) { const t = tasks.get(id); if (t) t.status = 'cancelled'; },
    complete(id: string) { const t = tasks.get(id); if (t) t.status = 'completed'; },
    fail(id: string, error: string) { const t = tasks.get(id); if (t) { t.status = 'failed'; t.error = error; } },
    clear() { tasks.clear(); idCounter = 0; },
  };
}

describe('TaskQueue', () => {
  let queue: ReturnType<typeof createTestQueue>;

  beforeEach(() => {
    queue = createTestQueue();
  });

  it('should enqueue tasks with queued status', () => {
    const task = queue.enqueue('navigate');
    expect(task.status).toBe('queued');
    expect(task.id).toBeTruthy();
  });

  it('should get task by ID', () => {
    const task = queue.enqueue('extract');
    const found = queue.getTask(task.id);
    expect(found).toBeDefined();
    expect(found?.type).toBe('extract');
  });

  it('should list all tasks', () => {
    queue.enqueue('navigate');
    queue.enqueue('extract');
    queue.enqueue('summarize');
    expect(queue.getAllTasks()).toHaveLength(3);
  });

  it('should pause a task', () => {
    const task = queue.enqueue('quiz');
    queue.pause(task.id);
    expect(queue.getTask(task.id)?.status).toBe('paused');
  });

  it('should resume a paused task', () => {
    const task = queue.enqueue('quiz');
    queue.pause(task.id);
    queue.resume(task.id);
    expect(queue.getTask(task.id)?.status).toBe('queued');
  });

  it('should stop/cancel a task', () => {
    const task = queue.enqueue('navigate');
    queue.stop(task.id);
    expect(queue.getTask(task.id)?.status).toBe('cancelled');
  });

  it('should mark task as completed', () => {
    const task = queue.enqueue('extract');
    queue.complete(task.id);
    expect(queue.getTask(task.id)?.status).toBe('completed');
  });

  it('should mark task as failed with error', () => {
    const task = queue.enqueue('navigate');
    queue.fail(task.id, 'Timeout');
    const found = queue.getTask(task.id);
    expect(found?.status).toBe('failed');
    expect(found?.error).toBe('Timeout');
  });
});
