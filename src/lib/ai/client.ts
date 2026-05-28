/**
 * OpenAI client wrapper for BrowserPilot.
 * Handles API calls with retry, streaming, and tool calling.
 */

import OpenAI from 'openai';
import { createLogger } from '../logger';
import { withRetry } from '../errors/handler';

const log = createLogger('ai-client');

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set. Add it to .env.local');
    client = new OpenAI({ apiKey });
  }
  return client;
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

/**
 * Send a chat completion request with optional tool calling.
 */
export async function chatCompletion(options: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{
  content: string | null;
  toolCalls: { id: string; name: string; arguments: string }[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const { messages, tools, model = DEFAULT_MODEL, temperature = 0.3, maxTokens = 2000 } = options;

  log.info('Chat completion request', { model, messageCount: messages.length, hasTools: !!tools });

  const result = await withRetry(
    async () => {
      const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens,
      };

      if (tools && tools.length > 0) {
        params.tools = tools as OpenAI.ChatCompletionTool[];
        params.tool_choice = 'auto';
      }

      return getClient().chat.completions.create(params);
    },
    { maxRetries: 2, baseDelay: 2000, label: 'openai-chat' }
  );

  const choice = result.choices[0];
  const toolCalls = choice.message.tool_calls?.map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  })) || [];

  const usage = {
    promptTokens: result.usage?.prompt_tokens ?? 0,
    completionTokens: result.usage?.completion_tokens ?? 0,
    totalTokens: result.usage?.total_tokens ?? 0,
  };

  log.info('Chat completion response', { usage, hasContent: !!choice.message.content, toolCallCount: toolCalls.length });

  return {
    content: choice.message.content,
    toolCalls,
    usage,
  };
}

/**
 * Simple text generation (no tools).
 */
export async function generateText(prompt: string, systemPrompt?: string, options?: {
  model?: string; temperature?: number; maxTokens?: number;
}): Promise<string> {
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const result = await chatCompletion({ messages, ...options });
  return result.content || '';
}
