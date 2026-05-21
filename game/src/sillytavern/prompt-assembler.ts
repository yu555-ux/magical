import type { ChatMessage, PresetBlock, Lorebook } from './types';
import { INJECTION_ANCHORS } from './types';
import { formatVariablesForPrompt } from './variables';
import { scanLorebooks, formatMatchedEntries } from './lorebookEngine';
import type { ScanResult } from './lorebookEngine';

export interface PromptSection {
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  content: string | null;
  source: 'preset' | 'variables' | 'chat' | 'lorebook';
}

export interface AssembleOptions {
  userInput: string;
  history: ChatMessage[];
  presetBlocks?: PresetBlock[];
  lorebooks?: Lorebook[];
  userName: string;
  characterName: string;
  extraVariables?: Record<string, any>;
}

export interface AssembleResult {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  systemPrompt: string;
  sections: PromptSection[];
}

// ── Chaoxi-style variable macro engine ──

/**
 * Process Chaoxi preset macros in the correct order across all blocks.
 *
 * Order: strip comments → setvar → addvar → getvar → user/char/original → trim
 *
 * setvar::name::value  → sets presetVars[name] = value
 * addvar::name::value  → presetVars[name] += value
 * getvar::name         → replaced with presetVars[name]
 * {{// comment}}       → removed (Chaoxi inline comments)
 * {{trim}}             → removed (Chaoxi trimming)
 */
function resolveContent(
  content: string,
  presetVars: Record<string, string>,
  macroCtx: MacroContext,
): string {
  let result = content;

  // 1) Strip {{// comment}} — Chaoxi inline comments
  result = result.replace(/\{\{\s*\/\/[^}]*\}\}/g, '');

  // 2) Process {{setvar::name::value}} — set variable (overwrite)
  result = result.replace(/\{\{setvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    presetVars[name.trim()] = value;
    return '';
  });

  // 3) Process {{addvar::name::value}} — append to variable
  result = result.replace(/\{\{addvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    const key = name.trim();
    presetVars[key] = (presetVars[key] || '') + value;
    return '';
  });

  // 4) Process {{getvar::name}} — get variable value
  result = result.replace(/\{\{getvar::([^}]+)\}\}/g, (_, name: string) => {
    return presetVars[name.trim()] ?? '';
  });

  // 5) Standard macros: {{user}} {{char}} {{original}}
  result = result
    .replace(/\{\{user\}\}/g, macroCtx.userName)
    .replace(/\{\{char\}\}/g, macroCtx.characterName)
    .replace(/\{\{original\}\}/g, macroCtx.userInput);

  // 6) Strip {{trim}}
  result = result.replace(/\{\{trim\}\}/gi, '');

  return result;
}

// ── Main assembler ──

export function assemblePrompt(options: AssembleOptions): AssembleResult {
  const { userInput, history, presetBlocks, lorebooks, userName, characterName, extraVariables } = options;

  const sections: PromptSection[] = [];
  const assembledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  let systemAccumulator = '';
  let hasChatHistory = false;

  const macroCtx: MacroContext = { userName, characterName, userInput };
  const presetVars: Record<string, string> = {};

  // ── Scan lorebooks ──
  const historyText = history.slice(-6).map(m => m.content).join(' ');
  let scanResult: ScanResult = { before: [], after: [] };
  if (lorebooks && lorebooks.length > 0) {
    scanResult = scanLorebooks(lorebooks, userInput, historyText);
  }

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

      // Resolve content — first check if this is an injection anchor
      let content: string | null = null;
      let source: PromptSection['source'] = 'preset';

      if (INJECTION_ANCHORS.includes(block.identifier as typeof INJECTION_ANCHORS[number])) {
        // Injection anchor — replace empty content with matched lorebook entries
        const entries = block.identifier === 'worldInfoBefore' ? scanResult.before : scanResult.after;
        if (entries.length > 0) {
          content = formatMatchedEntries(entries);
          source = 'lorebook';
        }
      }

      // If no lorebook content was injected, use the block's own content
      if (!content) {
        const rawContent = block.content?.trim();
        content = rawContent ? resolveContent(rawContent, presetVars, macroCtx) : null;
      }

      // Still apply macro resolution to lorebook content (for {{user}} etc.)
      if (content && source === 'lorebook') {
        content = content
          .replace(/\{\{user\}\}/g, macroCtx.userName)
          .replace(/\{\{char\}\}/g, macroCtx.characterName)
          .replace(/\{\{original\}\}/g, macroCtx.userInput);
      }

      if (!content || !content.trim()) {
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
        source,
      });

      if (block.role === 'system') {
        systemAccumulator += (systemAccumulator ? '\n\n' : '') + content;
      } else {
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
  const presetVars: Record<string, string> = {};
  return resolveContent(template, presetVars, context);
}

export const SUPPORTED_MACROS = [
  { name: '{{user}}', description: '用户名' },
  { name: '{{char}}', description: 'AI角色名' },
  { name: '{{original}}', description: '用户原始输入' },
  { name: '{{setvar::name::value}}', description: '设置预设变量' },
  { name: '{{addvar::name::value}}', description: '追加预设变量' },
  { name: '{{getvar::name}}', description: '获取预设变量值' },
  { name: '{{// 注释}}', description: '潮汐注释（发送时移除）' },
  { name: '{{trim}}', description: '裁剪标记（发送时移除）' },
] as const;
