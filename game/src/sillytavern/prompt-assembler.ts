/**
 * Prompt Assembler
 */

import type { ChatPreset, Lorebook, ChatMessage, MatchedEntry } from './types';
import { createLorebookEngine } from './lorebook-engine';
import { formatVariablesForPrompt } from './variables';

export interface AssembleOptions {
  userInput: string;
  history: ChatMessage[];
  preset: ChatPreset;
  lorebooks: Lorebook[];
  userName: string;
  characterName: string;
  variables?: Record<string, string | number>;
  extraVariables?: Record<string, any>;
}

export interface PromptSection {
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  content: string | null;
  source: 'preset' | 'lorebook' | 'variables' | 'custom';
}

export interface AssembleResult {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  matchedEntries: MatchedEntry[];
  systemPrompt: string;
  sections: PromptSection[];
}

export function assemblePrompt(options: AssembleOptions): AssembleResult {
  const { userInput, history, preset, lorebooks, userName, characterName, variables, extraVariables } = options;

  const allMatchedEntries: MatchedEntry[] = [];
  const scanText = userInput + ' ' + history.slice(-3).map(m => m.content).join(' ');

  for (const book of lorebooks) {
    const engine = createLorebookEngine(book);
    const matches = engine.recursiveScan(scanText, 3);
    allMatchedEntries.push(...matches);
  }

  const uniqueEntries = Array.from(
    new Map(allMatchedEntries.map(e => [e.entry.id, e])).values()
  ).sort((a, b) => a.score - b.score);

  const maxContextTokens = preset.settings.openai_max_context || preset.settings.max_length || 4096;
  let currentTokens = 0;

  const recentHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'system') continue;
    const msgTokens = msg.content.length / 4;
    if (currentTokens + msgTokens > maxContextTokens * 0.8) break;
    recentHistory.unshift({ role: msg.role, content: msg.content });
    currentTokens += msgTokens;
  }

  // prompt_order can be an array or {character_id, order: [...]} (Chaoxi format)
  const rawPromptOrder = (preset.settings.prompt_order || preset.settings.prompts || []) as any;
  const promptOrder: Array<{
    identifier: string;
    name?: string;
    role?: 'system' | 'user' | 'assistant';
    enabled?: boolean;
    content?: string;
  }> = Array.isArray(rawPromptOrder) ? rawPromptOrder
    : Array.isArray(rawPromptOrder?.order) ? rawPromptOrder.order
    : [];

  const prompts = (preset.settings.prompts || []) as Array<{
    identifier: string;
    role?: 'system' | 'user' | 'assistant';
    content?: string;
  }>;

  function resolvePromptContent(identifier: string): string | null {
    // 1) prompt_order entry inline content
    const orderEntry = promptOrder.find(p => p.identifier === identifier);
    if (orderEntry?.content?.trim()) return orderEntry.content;

    // 2) Dynamic lorebook injection (must run BEFORE prompts lookup)
    if (identifier === 'worldInfoBefore' || identifier === 'worldInfoAfter') {
      const content = uniqueEntries.map(e => e.entry.content).join('\n\n');
      return content || null;
    }

    // 3) Chaoxi-style: content in prompts array
    const customPrompt = prompts.find(p => p.identifier === identifier);
    if (customPrompt?.content?.trim()) return customPrompt.content;

    // 4) Character card / scenario placeholders
    if (identifier === 'charDescription') return preset.settings.character_description || null;
    if (identifier === 'charPersonality') return preset.settings.character_personality || null;
    if (identifier === 'scenario') return preset.settings.scenario || null;
    if (identifier === 'personaDescription') return preset.settings.persona_description || null;
    if (identifier === 'dialogueExamples') return preset.settings.dialogue_examples || null;

    // 5) Direct preset.settings field
    const direct = preset.settings[identifier];
    if (typeof direct === 'string' && direct.trim()) return direct;
    return null;
  }

  const assembledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  const sections: PromptSection[] = [];
  let systemAccumulator = '';
  let hasChatHistory = false;

  for (const item of promptOrder) {
    if (item.enabled === false) {
      sections.push({ identifier: item.identifier, name: item.name || item.identifier, role: item.role || 'system', enabled: false, content: null, source: 'preset' });
      continue;
    }

    if (item.identifier === 'chatHistory') {
      hasChatHistory = true;
      sections.push({ identifier: 'chatHistory', name: '对话历史', role: 'system', enabled: true, content: `[${recentHistory.length} 条历史消息]`, source: 'preset' });
      if (systemAccumulator) {
        assembledMessages.push({ role: 'system', content: systemAccumulator });
        systemAccumulator = '';
      }
      assembledMessages.push(...recentHistory);
      continue;
    }

    const rawContent = resolvePromptContent(item.identifier);
    let source: PromptSection['source'] = 'preset';
    if (item.identifier === 'worldInfoBefore' || item.identifier === 'worldInfoAfter') {
      source = 'lorebook';
    }

    if (!rawContent) {
      sections.push({ identifier: item.identifier, name: item.name || item.identifier, role: item.role || 'system', enabled: true, content: null, source });
      continue;
    }

    let content = replaceMacros(rawContent, { userName, characterName, userInput, variables });
    if (!content.trim()) {
      sections.push({ identifier: item.identifier, name: item.name || item.identifier, role: item.role || 'system', enabled: true, content: null, source });
      continue;
    }

    sections.push({ identifier: item.identifier, name: item.name || item.identifier, role: item.role || 'system', enabled: true, content, source });

    const role = item.role || 'system';
    if (role === 'system') {
      systemAccumulator += (systemAccumulator ? '\n\n' : '') + content;
    } else {
      if (systemAccumulator) {
        assembledMessages.push({ role: 'system', content: systemAccumulator });
        systemAccumulator = '';
      }
      assembledMessages.push({ role, content });
    }
  }

  const variablesBlock = formatVariablesForPrompt(variables || {});
  if (variablesBlock) {
    systemAccumulator += (systemAccumulator ? '\n\n' : '') + variablesBlock;
    sections.push({ identifier: 'variables', name: '当前状态', role: 'system', enabled: true, content: variablesBlock, source: 'variables' });
  }

  if (extraVariables && Object.keys(extraVariables).length > 0) {
    const extraBlock = formatVariablesForPrompt(extraVariables);
    if (extraBlock) {
      systemAccumulator += (systemAccumulator ? '\n\n' : '') + extraBlock;
    }
  }

  if (systemAccumulator) {
    assembledMessages.unshift({ role: 'system', content: systemAccumulator });
  }

  if (!hasChatHistory) {
    assembledMessages.push(...recentHistory);
  }

  assembledMessages.push({ role: 'user', content: userInput });

  const systemPrompt = assembledMessages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');

  return {
    messages: assembledMessages,
    matchedEntries: uniqueEntries,
    systemPrompt,
    sections,
  };
}

interface MacroContext {
  userName: string;
  characterName: string;
  userInput: string;
  variables?: Record<string, string | number>;
}

export function replaceMacros(template: string, context: MacroContext): string {
  let result = template
    .replace(/\{\{user\}\}/g, context.userName)
    .replace(/\{\{char\}\}/g, context.characterName)
    .replace(/\{\{original\}\}/g, context.userInput);

  // Chaoxi/ST special macros
  result = result.replace(/\{\{\s*\/\/[^}]*\}\}/g, ''); // {{// comment}} → remove
  result = result.replace(/\{\{trim\}\}/gi, '');          // {{trim}} → remove

  if (context.variables) {
    result = result.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
      const value = context.variables?.[key.trim()];
      return value !== undefined ? String(value) : match;
    });
  }

  return result;
}

export const SUPPORTED_MACROS = [
  { name: '{{user}}', description: '用户名' },
  { name: '{{char}}', description: 'AI角色名' },
  { name: '{{original}}', description: '用户原始输入' },
  { name: '{{变量名}}', description: '自定义变量（例如 {{hp}}）' },
] as const;
