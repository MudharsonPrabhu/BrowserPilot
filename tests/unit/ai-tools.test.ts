/**
 * Unit tests for the AI tools definitions.
 */

import { describe, it, expect } from 'vitest';
import { AI_TOOLS, getToolByName } from '@/lib/ai/tools';

describe('AI Tools', () => {
  it('should define 5 tools', () => {
    expect(AI_TOOLS).toHaveLength(5);
  });

  it('should have valid structure for all tools', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.required).toBeDefined();
      expect(tool.function.strict).toBe(true);
    }
  });

  it('should get tool by name', () => {
    const tool = getToolByName('summarize_content');
    expect(tool).toBeDefined();
    expect(tool!.function.name).toBe('summarize_content');
  });

  it('should return undefined for unknown tool', () => {
    expect(getToolByName('nonexistent')).toBeUndefined();
  });

  it('classify_page should have correct schema', () => {
    const tool = getToolByName('classify_page')!;
    const props = tool.function.parameters.properties as Record<string, any>;
    expect(props.pageType.enum).toContain('lesson');
    expect(props.pageType.enum).toContain('quiz');
    expect(props.confidence.type).toBe('number');
  });

  it('answer_question should have correct schema', () => {
    const tool = getToolByName('answer_question')!;
    const props = tool.function.parameters.properties as Record<string, any>;
    expect(props.selectedOption.type).toBe('string');
    expect(props.confidence.type).toBe('number');
    expect(props.reasoning.type).toBe('string');
  });

  it('generate_notes should include flashcards', () => {
    const tool = getToolByName('generate_notes')!;
    const props = tool.function.parameters.properties as Record<string, any>;
    expect(props.flashcards.type).toBe('array');
    expect(props.flashcards.items.properties.front).toBeDefined();
    expect(props.flashcards.items.properties.back).toBeDefined();
  });

  it('plan_next_action should have valid action enum', () => {
    const tool = getToolByName('plan_next_action')!;
    const props = tool.function.parameters.properties as Record<string, any>;
    expect(props.action.enum).toContain('navigate');
    expect(props.action.enum).toContain('extract');
    expect(props.action.enum).toContain('quiz');
    expect(props.action.enum).toContain('done');
  });
});
