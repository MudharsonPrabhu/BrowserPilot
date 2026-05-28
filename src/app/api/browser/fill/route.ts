import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';
import { FillSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = FillSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await browserController.fill(parsed.data.selector, parsed.data.value, { clear: parsed.data.clear, timeout: parsed.data.timeout });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
