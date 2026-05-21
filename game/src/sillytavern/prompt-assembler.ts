import type { ChatMessage, PresetBlock, Lorebook } from './types';
import { INJECTION_ANCHORS } from './types';
import { scanLorebooks, formatMatchedEntries } from './lorebookEngine';
import type { ScanResult } from './lorebookEngine';

export interface PromptSection {
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  content: string | null;
  source: 'preset' | 'lorebook' | 'chat';
}

export interface AssembleOptions {
  userInput: string;
  history: ChatMessage[];
  presetBlocks?: PresetBlock[];
  lorebooks?: Lorebook[];
  userName: string;
  characterName: string;
}

export interface AssembleResult {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  systemPrompt: string;
  sections: PromptSection[];
}

// ── Chaoxi-style variable macro engine ──

function resolveContent(
  content: string,
  presetVars: Record<string, string>,
  macroCtx: MacroContext,
): string {
  let result = content;

  // 1) Strip {{// comment}}
  result = result.replace(/\{\{\s*\/\/[^}]*\}\}/g, '');

  // 2) Process {{setvar::name::value}}
  result = result.replace(/\{\{setvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    presetVars[name.trim()] = value;
    return '';
  });

  // 3) Process {{addvar::name::value}}
  result = result.replace(/\{\{addvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    const key = name.trim();
    presetVars[key] = (presetVars[key] || '') + value;
    return '';
  });

  // 4) Process {{getvar::name}}
  result = result.replace(/\{\{getvar::([^}]+)\}\}/g, (_, name: string) => {
    return presetVars[name.trim()] ?? '';
  });

  // 5) Standard macros
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
  const { userInput, history, presetBlocks, lorebooks, userName, characterName } = options;

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

  // Track whether lorebook was injected via preset anchors
  let injectedBefore = false;
  let injectedAfter = false;

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
        // Inject worldInfoAfter lorebook if not already done via anchor
        if (!injectedAfter && scanResult.after.length > 0) {
          const lorebookContent = formatMatchedEntries(scanResult.after)
            .replace(/\{\{user\}\}/g, macroCtx.userName)
            .replace(/\{\{char\}\}/g, macroCtx.characterName);
          if (lorebookContent.trim()) {
            systemAccumulator += (systemAccumulator ? '\n\n' : '') + lorebookContent;
            sections.push({
              identifier: 'worldInfoAfter', name: '世界书（角色定位之后）',
              role: 'system', enabled: true, content: lorebookContent, source: 'lorebook',
            });
          }
          injectedAfter = true;
        }
        if (systemAccumulator.trim()) {
          assembledMessages.push({ role: 'system', content: systemAccumulator });
          systemAccumulator = '';
        }
        const recentHistory = buildRecentHistory(history);
        assembledMessages.push(...recentHistory);
        sections.push({
          identifier: 'chatHistory', name: block.name || '对话历史',
          role: 'system', enabled: true, content: `[${recentHistory.length} 条]`, source: 'chat',
        });
        continue;
      }

      // Resolve content — first check if this is an injection anchor
      let content: string | null = null;
      let source: PromptSection['source'] = 'preset';

      if (INJECTION_ANCHORS.includes(block.identifier as typeof INJECTION_ANCHORS[number])) {
        const entries = block.identifier === 'worldInfoBefore' ? scanResult.before : scanResult.after;
        if (entries.length > 0) {
          content = formatMatchedEntries(entries);
          source = 'lorebook';
          if (block.identifier === 'worldInfoBefore') injectedBefore = true;
          else injectedAfter = true;
        }
      }

      if (!content) {
        const rawContent = block.content?.trim();
        content = rawContent ? resolveContent(rawContent, presetVars, macroCtx) : null;
      }

      if (content && source === 'lorebook') {
        content = content
          .replace(/\{\{user\}\}/g, macroCtx.userName)
          .replace(/\{\{char\}\}/g, macroCtx.characterName)
          .replace(/\{\{original\}\}/g, macroCtx.userInput);
      }

      if (!content || !content.trim()) {
        sections.push({
          identifier: block.identifier, name: block.name, role: block.role,
          enabled: true, content: null, source: 'preset',
        });
        continue;
      }

      sections.push({ identifier: block.identifier, name: block.name, role: block.role, enabled: true, content, source });

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

  // ── Inject worldInfoBefore if not done via anchor ──
  if (!injectedBefore && scanResult.before.length > 0) {
    const beforeContent = formatMatchedEntries(scanResult.before)
      .replace(/\{\{user\}\}/g, macroCtx.userName)
      .replace(/\{\{char\}\}/g, macroCtx.characterName);
    if (beforeContent.trim()) {
      systemAccumulator = beforeContent + (systemAccumulator ? '\n\n' : '') + systemAccumulator;
      sections.unshift({
        identifier: 'worldInfoBefore', name: '世界书（角色定位之前）',
        role: 'system', enabled: true, content: beforeContent, source: 'lorebook',
      });
      injectedBefore = true;
    }
  }

  // ── Inject worldInfoAfter if not done via anchor ──
  if (!injectedAfter && scanResult.after.length > 0) {
    const afterContent = formatMatchedEntries(scanResult.after)
      .replace(/\{\{user\}\}/g, macroCtx.userName)
      .replace(/\{\{char\}\}/g, macroCtx.characterName);
    if (afterContent.trim()) {
      systemAccumulator += (systemAccumulator ? '\n\n' : '') + afterContent;
      sections.push({
        identifier: 'worldInfoAfter', name: '世界书（角色定位之后）',
        role: 'system', enabled: true, content: afterContent, source: 'lorebook',
      });
      injectedAfter = true;
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
        identifier: 'chatHistory', name: '对话历史',
        role: 'system', enabled: true, content: `[${recentHistory.length} 条]`, source: 'chat',
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
