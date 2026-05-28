import { NextResponse } from 'next/server';
import { generateFlashcards, getDueFlashcards, reviewFlashcard, getFlashcardsByCourse } from '@/lib/ai/flashcard-generator';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Review a flashcard
    if (body.action === 'review' && body.id && body.quality !== undefined) {
      reviewFlashcard(body.id, body.quality);
      return NextResponse.json({ success: true });
    }

    // Generate flashcards from content
    if (body.content) {
      const cards = await generateFlashcards(body.content, body.lessonId, body.courseId);
      return NextResponse.json({ success: true, flashcards: cards });
    }

    return NextResponse.json({ error: 'Provide content to generate flashcards or action=review' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const due = searchParams.get('due') === 'true';

    if (due) {
      const cards = getDueFlashcards(courseId || undefined);
      return NextResponse.json({ success: true, flashcards: cards });
    }

    if (courseId) {
      const cards = getFlashcardsByCourse(courseId);
      return NextResponse.json({ success: true, flashcards: cards });
    }

    const cards = getDueFlashcards(undefined, 50);
    return NextResponse.json({ success: true, flashcards: cards });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
