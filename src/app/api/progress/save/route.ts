import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session/manager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value, category } = body;
    if (!key || value === undefined) return NextResponse.json({ error: 'Key and value required' }, { status: 400 });

    await sessionManager.saveMemory(key, typeof value === 'string' ? value : JSON.stringify(value), category);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });

    const value = await sessionManager.getMemory(key);
    return NextResponse.json({ success: true, key, value });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
