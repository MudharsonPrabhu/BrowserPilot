import { NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/ai/summarizer';
import { AnswerQuestionSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AnswerQuestionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const result = await answerQuestion(parsed.data.question, parsed.data.options, parsed.data.context);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
