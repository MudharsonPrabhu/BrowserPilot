import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';
import { sessionManager } from '@/lib/session/manager';
import { StartSessionSchema, RestoreSessionSchema } from '@/lib/validators';
import path from 'path';

// POST /api/session/start
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = StartSessionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { profileName, headless, viewport } = parsed.data;
    const profilePath = path.join(process.cwd(), 'data', 'profiles', profileName);

    await browserController.launch(profileName, { headless, viewport });
    const session = await sessionManager.startSession(profilePath);

    return NextResponse.json({ success: true, session });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
