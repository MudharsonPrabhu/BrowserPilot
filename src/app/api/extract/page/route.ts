import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';
import { runExtractionPipeline } from '@/lib/extraction/pipeline';
import { breakers } from '@/lib/errors/circuit-breaker';
import { ExtractPageSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ExtractPageSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const page = browserController.getActivePage();

    const result = await breakers.extraction.execute(() =>
      runExtractionPipeline(page, {
        preferredMethod: parsed.data.method === 'auto' ? 'auto' : parsed.data.method as any,
        includeQuiz: true,
        includeNetwork: true,
      })
    );

    let screenshot: string | undefined;
    if (parsed.data.includeScreenshot) {
      const buffer = await browserController.screenshot({ quality: 50 });
      screenshot = buffer.toString('base64');
    }

    return NextResponse.json({ success: true, ...result, screenshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isCircuitOpen = message.includes('Circuit breaker');
    return NextResponse.json(
      { error: message, circuitOpen: isCircuitOpen },
      { status: isCircuitOpen ? 503 : 500 }
    );
  }
}
