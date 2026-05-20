import type { ChatMessage } from './types';
import { formatVariablesForPrompt } from './variables';

export interface PromptSection {
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  content: string | null;
  source: 'system' | 'variables' | 'chat';
}

export interface AssembleOptions {
  userInput: string;
  history: ChatMessage[];
  systemPrompt?: string;
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
  const { userInput, history, systemPrompt, userName, characterName, extraVariables } = options;

  const sections: PromptSection[] = [];
  let systemAccumulator = '';

  // System prompt (from preset main field)
  if (systemPrompt?.trim()) {
    const content = replaceMacros(systemPrompt, { userName, characterName, userInput });
    systemAccumulator = content;
    sections.push({ identifier: 'system', name: '系统指令', role: 'system', enabled: true, content, source: 'system' });
  }

  // Variables
  if (extraVariables && Object.keys(extraVariables).length > 0) {
    const varsBlock = formatVariablesForPrompt(extraVariables);
    if (varsBlock) {
      systemAccumulator += (systemAccumulator ? '\n\n' : '') + varsBlock;
      sections.push({ identifier: 'variables', name: '当前状态', role: 'system', enabled: true, content: varsBlock, source: 'variables' });
    }
  }

  // Build messages
  const assembledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  if (systemAccumulator) {
    assembledMessages.push({ role: 'system', content: systemAccumulator });
  }

  // Recent history (limit by rough token estimate)
  let tokenBudget = 3000;
  const recentHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'system') continue;
    const t = Math.round(msg.content.length / 4);
    if (tokenBudget - t < 0) break;
    recentHistory.unshift({ role: msg.role, content: msg.content });
    tokenBudget -= t;
  }
  if (recentHistory.length > 0) {
    assembledMessages.push(...recentHistory);
    sections.push({ identifier: 'chatHistory', name: '对话历史', role: 'system', enabled: true, content: `[${recentHistory.length} 条]`, source: 'chat' });
  }

  assembledMessages.push({ role: 'user', content: userInput });

  const sysPrompt = assembledMessages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');

  return { messages: assembledMessages, systemPrompt: sysPrompt, sections };
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
