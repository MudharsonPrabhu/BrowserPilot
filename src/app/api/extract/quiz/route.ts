import { NextResponse } from 'next/server';
import { browserController } from '@/lib/browser/controller';
import { ExtractQuizSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ExtractQuizSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const page = browserController.getActivePage();

    // Extract quiz data from DOM
    const quizData = await page.evaluate(() => {
      const result: {
        questions: { text: string; options: { label: string; text: string; isSelected: boolean }[]; type: string }[];
        isCopySensitive: boolean;
      } = { questions: [], isCopySensitive: false };

      // Detect copy-sensitive pages
      const bodyStyle = getComputedStyle(document.body);
      result.isCopySensitive =
        bodyStyle.userSelect === 'none' ||
        bodyStyle.webkitUserSelect === 'none' ||
        !!document.querySelector('[oncopy]') ||
        !!document.querySelector('[onselectstart]');

      // Find question containers
      const questionEls = document.querySelectorAll(
        '[class*="question"], [data-testid*="question"], .quiz-question, .assessment-question, [role="group"]'
      );

      if (questionEls.length > 0) {
        questionEls.forEach((qEl, idx) => {
          const el = qEl as HTMLElement;
          // Get question text from heading or first significant text
          let questionText = '';
          const heading = el.querySelector('h2, h3, h4, legend, [class*="question-text"], [class*="prompt"]');
          if (heading) questionText = (heading as HTMLElement).innerText.trim();
          if (!questionText) questionText = el.innerText.split('\n')[0].trim();

          // Get options
          const options: { label: string; text: string; isSelected: boolean }[] = [];
          const optionEls = el.querySelectorAll('label, [role="radio"], [role="checkbox"], .answer-option, [class*="option"]');
          const labels = 'ABCDEFGHIJ';

          optionEls.forEach((opt, i) => {
            const optEl = opt as HTMLElement;
            const input = optEl.querySelector('input[type="radio"], input[type="checkbox"]') as HTMLInputElement;
            options.push({
              label: labels[i] || String(i + 1),
              text: optEl.innerText.trim(),
              isSelected: input?.checked ?? false,
            });
          });

          // Determine type
          const hasCheckbox = !!el.querySelector('input[type="checkbox"]');
          const hasRadio = !!el.querySelector('input[type="radio"]');
          const type = hasCheckbox ? 'multi_select' : hasRadio ? 'multiple_choice' : 'unknown';

          if (questionText) {
            result.questions.push({ text: questionText, options, type });
          }
        });
      } else {
        // Fallback: try to find radio/checkbox groups
        const radioGroups = new Map<string, HTMLInputElement[]>();
        document.querySelectorAll('input[type="radio"]').forEach((r) => {
          const radio = r as HTMLInputElement;
          const name = radio.name || 'default';
          if (!radioGroups.has(name)) radioGroups.set(name, []);
          radioGroups.get(name)!.push(radio);
        });

        const labels = 'ABCDEFGHIJ';
        radioGroups.forEach((radios) => {
          const options = radios.map((r, i) => {
            const label = r.closest('label');
            return { label: labels[i], text: label?.innerText.trim() || r.value, isSelected: r.checked };
          });
          result.questions.push({ text: 'Question detected (see screenshot)', options, type: 'multiple_choice' });
        });
      }

      return result;
    });

    let screenshot: string | undefined;
    if (parsed.data.includeScreenshot) {
      const buffer = await browserController.screenshot({ quality: 60 });
      screenshot = buffer.toString('base64');
    }

    return NextResponse.json({
      success: true,
      url: page.url(),
      ...quizData,
      screenshot,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
