import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';
import { ScreenshotSchema } from '@/lib/validators';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fullPage = searchParams.get('fullPage') === 'true';
    const selector = searchParams.get('selector') || undefined;
    const quality = parseInt(searchParams.get('quality') || '70');

    const buffer = await browserController.screenshot({ fullPage, selector, quality });
    return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
