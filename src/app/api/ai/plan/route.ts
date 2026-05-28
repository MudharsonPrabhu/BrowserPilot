import { NextResponse } from 'next/server';
import { chatCompletion, type ChatMessage } from '@/lib/ai/client';
import { AI_TOOLS } from '@/lib/ai/tools';
import { PlanTaskSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PlanTaskSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are BrowserPilot, an autonomous web agent planner. Given the agent's objective and current browser context, plan the next best autonomous action. Use the plan_next_action tool.`,
      },
      {
        role: 'user',
        content: `Objective: ${parsed.data.objective}\n${parsed.data.currentContext ? `\nCurrent context: ${parsed.data.currentContext}` : ''}`,
      },
    ];

    const result = await chatCompletion({
      messages,
      tools: AI_TOOLS.filter((t) => t.function.name === 'plan_next_action'),
    });

    if (result.toolCalls.length > 0) {
      const plan = JSON.parse(result.toolCalls[0].arguments);
      return NextResponse.json({ success: true, ...plan, usage: result.usage });
    }

    return NextResponse.json({ success: true, action: 'done', target: '', reasoning: result.content || 'No plan generated', usage: result.usage });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
