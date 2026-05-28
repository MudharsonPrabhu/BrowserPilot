import { NextResponse } from 'next/server';
import { buildStudyGraph } from '@/lib/session/study-graph';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const graph = buildStudyGraph(courseId);
    return NextResponse.json({ success: true, ...graph });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
