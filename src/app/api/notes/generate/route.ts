import { NextResponse } from 'next/server';
import { generateNotes } from '@/lib/ai/summarizer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, lessonTitle } = body;
    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });

    const result = await generateNotes(content, lessonTitle);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
