/**
 * AI summarizer for BrowserPilot.
 * Generates session summaries, contextual insights, and memory snapshots.
 */

import { chatCompletion, generateText, type ChatMessage } from './client';
import { AI_TOOLS } from './tools';
import { createLogger } from '../logger';
import { eventBus } from '../events/bus';

const log = createLogger('ai-summarizer');

const SYSTEM_PROMPT = `You are BrowserPilot, an autonomous web intelligence engine. You help users and AI agents understand web content by providing clear, structured summaries, contextual insights, and actionable analysis.

Guidelines:
- Be concise but thorough
- Use bullet points and structured formatting
- Highlight key concepts, entities, and data points
- Note any structured data, patterns, or important signals
- Use precise language without oversimplifying
- Generate persistent memory snapshots for spaced recall`;

/**
 * Summarize lesson content.
 */
export async function summarizeContent(content: string, style: 'brief' | 'detailed' | 'bullet-points' = 'bullet-points'): Promise<{
  summary: string;
  keyPoints: string[];
  topics: string[];
}> {
  log.info('Summarizing content', { contentLength: content.length, style });
  eventBus.emit('ai:thinking', { action: 'summarize' });

  const truncated = content.slice(0, 8000); // Keep within token limits

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Summarize the following web content in ${style} style. Use the summarize_content tool.\n\n---\n${truncated}`,
    },
  ];

  const result = await chatCompletion({
    messages,
    tools: AI_TOOLS.filter((t) => t.function.name === 'summarize_content'),
    maxTokens: 1500,
  });

  if (result.toolCalls.length > 0) {
    const args = JSON.parse(result.toolCalls[0].arguments);
    eventBus.emit('ai:response', { action: 'summarize', topics: args.topics });
    return args;
  }

  // Fallback: parse from text response
  const text = result.content || '';
  eventBus.emit('ai:response', { action: 'summarize' });
  return { summary: text, keyPoints: [], topics: [] };
}

/**
 * Generate an answer suggestion for a quiz question.
 */
export async function answerQuestion(
  question: string,
  options: { label: string; text: string }[],
  context?: string
): Promise<{
  selectedOption: string;
  confidence: number;
  reasoning: string;
  explanation: string;
}> {
  log.info('Answering question', { questionLength: question.length, optionCount: options.length });
  eventBus.emit('ai:thinking', { action: 'answer_question' });

  const optionText = options.map((o) => `${o.label}: ${o.text}`).join('\n');
  const contextSection = context ? `\nContext from lesson:\n${context.slice(0, 3000)}` : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analyze the following decision context. Evaluate each option carefully and use the answer_question tool.${contextSection}\n\nContext: ${question}\n\nOptions:\n${optionText}`,
    },
  ];

  const result = await chatCompletion({
    messages,
    tools: AI_TOOLS.filter((t) => t.function.name === 'answer_question'),
    maxTokens: 1000,
  });

  if (result.toolCalls.length > 0) {
    const args = JSON.parse(result.toolCalls[0].arguments);
    eventBus.emit('ai:response', { action: 'answer_question', confidence: args.confidence });
    return args;
  }

  eventBus.emit('ai:response', { action: 'answer_question' });
  return { selectedOption: '?', confidence: 0, reasoning: result.content || 'Unable to determine', explanation: '' };
}

/**
 * Generate study notes and flashcards from content.
 */
export async function generateNotes(content: string, lessonTitle?: string): Promise<{
  title: string;
  notes: string;
  flashcards: { front: string; back: string; difficulty: 'easy' | 'medium' | 'hard' }[];
}> {
  log.info('Generating notes', { contentLength: content.length });
  eventBus.emit('ai:thinking', { action: 'generate_notes' });

  const truncated = content.slice(0, 8000);

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Generate comprehensive session summary and memory snapshots for the following web content${lessonTitle ? ` from page "${lessonTitle}"` : ''}. Use the generate_notes tool.\n\n---\n${truncated}`,
    },
  ];

  const result = await chatCompletion({
    messages,
    tools: AI_TOOLS.filter((t) => t.function.name === 'generate_notes'),
    maxTokens: 2000,
  });

  if (result.toolCalls.length > 0) {
    const args = JSON.parse(result.toolCalls[0].arguments);
    eventBus.emit('ai:response', { action: 'generate_notes', flashcardCount: args.flashcards?.length });
    return args;
  }

  eventBus.emit('ai:response', { action: 'generate_notes' });
  return { title: lessonTitle || 'Notes', notes: result.content || '', flashcards: [] };
}

/**
 * Explain a topic or concept simply.
 */
export async function explainTopic(topic: string, context?: string): Promise<string> {
  log.info('Explaining topic', { topic });
  eventBus.emit('ai:thinking', { action: 'explain' });

  const prompt = context
    ? `Explain the following topic from this web context. Be clear and concise.\n\nTopic: ${topic}\nContext: ${context.slice(0, 3000)}`
    : `Explain the following topic clearly and concisely: ${topic}`;

  const result = await generateText(prompt, SYSTEM_PROMPT, { maxTokens: 1000 });
  eventBus.emit('ai:response', { action: 'explain' });
  return result;
}
