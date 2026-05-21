import type { ChatMessage, PresetBlock } from './types';
import { formatVariablesForPrompt } from './variables';

export interface PromptSection {
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  content: string | null;
  source: 'preset' | 'variables' | 'chat';
}

export interface AssembleOptions {
  userInput: string;
  history: ChatMessage[];
  presetBlocks?: PresetBlock[];
  userName: string;
  characterName: string;
  extraVariables?: Record<string, any>;
}

export interface AssembleResult {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  systemPrompt: string;
  sections: PromptSection[];
}

export function assemblePrompt(options: AssembleOptions): AssembleResult {
  const { userInput, history, presetBlocks, userName, characterName, extraVariables } = options;

  const sections: PromptSection[] = [];
  const assembledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  let systemAccumulator = '';
  let hasChatHistory = false;

  const macroCtx: MacroContext = { userName, characterName, userInput };

  // Process preset blocks in order
  if (presetBlocks && presetBlocks.length > 0) {
    for (const block of presetBlocks) {
      if (!block.enabled) {
        sections.push({
          identifier: block.identifier,
          name: block.name,
          role: block.role,
          enabled: false,
          content: null,
          source: 'preset',
        });
        continue;
      }

      // Handle chatHistory insertion
      if (block.identifier === 'chatHistory') {
        hasChatHistory = true;
        if (systemAccumulator.trim()) {
          assembledMessages.push({ role: 'system', content: systemAccumulator });
          systemAccumulator = '';
        }
        const recentHistory = buildRecentHistory(history);
        assembledMessages.push(...recentHistory);
        sections.push({
          identifier: 'chatHistory',
          name: block.name || '对话历史',
          role: 'system',
          enabled: true,
          content: `[${recentHistory.length} 条]`,
          source: 'chat',
        });
        continue;
      }

      // Replace macros in content
      let content = block.content?.trim() ? replaceMacros(block.content, macroCtx) : null;

      if (!content) {
        sections.push({
          identifier: block.identifier,
          name: block.name,
          role: block.role,
          enabled: true,
          content: null,
          source: 'preset',
        });
        continue;
      }

      sections.push({
        identifier: block.identifier,
        name: block.name,
        role: block.role,
        enabled: true,
        content,
        source: 'preset',
      });

      if (block.role === 'system') {
        systemAccumulator += (systemAccumulator ? '\n\n' : '') + content;
      } else {
        // Flush system accumulator before non-system message
        if (systemAccumulator.trim()) {
          assembledMessages.push({ role: 'system', content: systemAccumulator });
          systemAccumulator = '';
        }
        assembledMessages.push({ role: block.role, content });
      }
    }
  }

  // Variables (always appended to system accumulator for context)
  if (extraVariables && Object.keys(extraVariables).length > 0) {
    const varsBlock = formatVariablesForPrompt(extraVariables);
    if (varsBlock) {
      systemAccumulator += (systemAccumulator ? '\n\n' : '') + varsBlock;
      sections.push({
        identifier: 'variables',
        name: '当前状态',
        role: 'system',
        enabled: true,
        content: varsBlock,
        source: 'variables',
      });
    }
  }

  // Flush remaining system accumulator
  if (systemAccumulator.trim()) {
    assembledMessages.unshift({ role: 'system', content: systemAccumulator });
  }

  // Chat history (if not already inserted by a chatHistory preset block)
  if (!hasChatHistory) {
    const recentHistory = buildRecentHistory(history);
    if (recentHistory.length > 0) {
      assembledMessages.push(...recentHistory);
      sections.push({
        identifier: 'chatHistory',
        name: '对话历史',
        role: 'system',
        enabled: true,
        content: `[${recentHistory.length} 条]`,
        source: 'chat',
      });
    }
  }

  // User input
  assembledMessages.push({ role: 'user', content: userInput });

  const systemPrompt = assembledMessages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');

  return { messages: assembledMessages, systemPrompt, sections };
}

function buildRecentHistory(history: ChatMessage[]): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  let tokenBudget = 3000;
  const recent: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'system') continue;
    const t = Math.round(msg.content.length / 4);
    if (tokenBudget - t < 0) break;
    recent.unshift({ role: msg.role, content: msg.content });
    tokenBudget -= t;
  }
  return recent;
}

interface MacroContext {
  userName: string;
  characterName: string;
  userInput: string;
}

export function replaceMacros(template: string, context: MacroContext): string {
  return template
    .replace(/\{\{user\}\}/g, context.userName)
    .replace(/\{\{char\}\}/g, context.characterName)
    .replace(/\{\{original\}\}/g, context.userInput)
    .replace(/\{\{\s*\/\/[^}]*\}\}/g, '')
    .replace(/\{\{trim\}\}/gi, '');
}

export const SUPPORTED_MACROS = [
  { name: '{{user}}', description: '用户名' },
  { name: '{{char}}', description: 'AI角色名' },
  { name: '{{original}}', description: '用户原始输入' },
] as const;
