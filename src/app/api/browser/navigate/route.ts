import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';
import { NavigateSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = NavigateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const result = await browserController.navigate(parsed.data.url, {
      waitUntil: parsed.data.waitUntil,
      timeout: parsed.data.timeout,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
