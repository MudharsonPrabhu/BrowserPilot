import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });
    const tabId = await browserController.openTab(url);
    return NextResponse.json({ success: true, tabId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
