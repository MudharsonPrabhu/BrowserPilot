import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';
import { sessionManager } from '@/lib/session/manager';

export async function GET() {
  try {
    const browserState = await browserController.getState();
    const sessionId = sessionManager.getCurrentSessionId();
    return NextResponse.json({ success: true, sessionId, browser: browserState });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
