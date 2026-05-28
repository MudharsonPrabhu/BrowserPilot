import { NextResponse } from 'next/server';
import { taskQueue } from '@/lib/tasks/queue';

export async function GET() {
  try {
    const tasks = taskQueue.getAllTasks();
    return NextResponse.json({ success: true, tasks, currentTaskId: taskQueue.getCurrentTaskId() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, taskId } = body;

    if (action === 'pause' && taskId) { taskQueue.pause(taskId); return NextResponse.json({ success: true }); }
    if (action === 'resume' && taskId) { taskQueue.resume(taskId); return NextResponse.json({ success: true }); }
    if (action === 'stop' && taskId) { taskQueue.stop(taskId); return NextResponse.json({ success: true }); }

    // Create a new task
    if (body.type) {
      const task = taskQueue.enqueue({ type: body.type, priority: body.priority, input: body.input, description: body.description });
      return NextResponse.json({ success: true, task });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
