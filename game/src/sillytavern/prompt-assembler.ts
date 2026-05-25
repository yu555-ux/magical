import type { ChatMessage, PresetBlock, Lorebook, InjectionAnchor } from './types';
import { INJECTION_ANCHORS, INJECTION_ANCHOR_RULES } from './types';
import { scanLorebooks, formatMatchedEntries } from './lorebookEngine';
import type { ScanResult, MatchedEntry } from './lorebookEngine';
import { processMapForPrompt } from './map-filter';
import { resolvePath, formatVariablesForPrompt } from './variables';
import { filterCharacterGroup, formatCharacterGroup } from './character-filter';

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
  playerDescription?: string;
  characterDescription?: string;
  /** Full map tree from chat variables (stat_data.地图) */
  mapTree?: Record<string, any>;
  /** Current location string (e.g. '601室') */
  currentLocation?: string;
  /** Whether the player is currently in dream world */
  isDream?: boolean;
  /** Full character tree from chat variables (主要人物) */
  characters?: Record<string, any>;
  /** Full variable tree for {{VARS_LIST}} macro */
  fullVariables?: Record<string, any>;
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
    .replace(/\{\{original\}\}/g, macroCtx.userInput)
    .replace(/\{\{player_description\}\}/g, macroCtx.playerDescription ?? '')
    .replace(/\{\{char_description\}\}/g, macroCtx.characterDescription ?? '');

  // 6) {{MAP}} → map context
  result = result.replace(/\{\{MAP\}\}/g, macroCtx.mapText ?? '');

  // 6b) Character macros
  result = result.replace(/\{\{FEMALE_STRANGER\}\}/g, macroCtx.femaleStrangerText ?? '');
  result = result.replace(/\{\{FEMALE_NORMAL\}\}/g, macroCtx.femaleNormalText ?? '');
  result = result.replace(/\{\{MALE_STRANGER\}\}/g, macroCtx.maleStrangerText ?? '');
  result = result.replace(/\{\{MALE_NORMAL\}\}/g, macroCtx.maleNormalText ?? '');

  // 6c) {{VARS_LIST}} → full variable tree with values
  result = result.replace(/\{\{VARS_LIST\}\}/g, macroCtx.varsListText ?? '');

  // 7) Strip {{trim}}
  result = result.replace(/\{\{trim\}\}/gi, '');

  return result;
}

// ── Anchor detection ──

/** Match a preset block to an injection anchor using layered detection rules */
function detectAnchor(block: PresetBlock): InjectionAnchor | null {
  const id = block.identifier.toLowerCase();
  const name = block.name.toLowerCase();
  const content = block.content || '';

  for (const rule of INJECTION_ANCHOR_RULES) {
    // 1) Exact identifier match
    if (rule.idPatterns.some(p => id === p)) return rule.anchor;
    // 2) Name contains keyword
    if (rule.namePatterns.some(p => name.includes(p))) return rule.anchor;
    // 3) Content contains marker token
    if (rule.contentMarkers.some(m => content.includes(m))) return rule.anchor;
  }
  return null;
}

/** Match a preset block to chatHistory insertion point */
const CHAT_HISTORY_PATTERNS = {
  idPatterns: ['chathistory'],
  namePatterns: ['chat history', '对话历史', '聊天记录', 'chat'],
};

function detectChatHistory(block: PresetBlock): boolean {
  const id = block.identifier.toLowerCase();
  const name = block.name.toLowerCase();
  if (CHAT_HISTORY_PATTERNS.idPatterns.some(p => id === p || id.includes(p))) return true;
  if (CHAT_HISTORY_PATTERNS.namePatterns.some(p => name.includes(p))) return true;
  return false;
}

/** Anchor labels for section display */
const ANCHOR_LABELS: Record<string, string> = {};
for (const rule of INJECTION_ANCHOR_RULES) {
  ANCHOR_LABELS[rule.anchor] = rule.label;
}

// ── Main assembler ──

export function assemblePrompt(options: AssembleOptions): AssembleResult {
  const { userInput, history, presetBlocks, lorebooks, userName, characterName, playerDescription, characterDescription } = options;

  const sections: PromptSection[] = [];
  const assembledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  let systemAccumulator = '';
  let hasChatHistory = false;

  const macroCtx: MacroContext = { userName, characterName, userInput, playerDescription, characterDescription };
  const presetVars: Record<string, string> = {};

  // Build context string from last 5 chat messages (for isMentioned checks)
  const contextStr = history.slice(-5).map(m => m.content).join('\n');

  // ── Pre-compute map text for {{MAP}} macro ──
  if (options.mapTree) {
    macroCtx.mapText = processMapForPrompt(
      options.mapTree,
      options.currentLocation ?? '',
      options.isDream ?? false,
      contextStr,
    );
  }

  // ── Pre-compute character texts for {{FEMALE_STRANGER}} etc. ──
  if (options.characters && options.mapTree) {
    const protagonistPath = options.currentLocation
      ? resolvePath(options.currentLocation, options.mapTree)
      : null;
    const isDream = options.isDream ?? false;

    const fs = filterCharacterGroup(options.characters['女性']?.['异人'], protagonistPath, isDream, options.mapTree, 'female', 'stranger', contextStr);
    macroCtx.femaleStrangerText = formatCharacterGroup(fs);

    const fn = filterCharacterGroup(options.characters['女性']?.['普通人'], protagonistPath, isDream, options.mapTree, 'female', 'normal', contextStr);
    macroCtx.femaleNormalText = formatCharacterGroup(fn);

    const ms = filterCharacterGroup(options.characters['男性']?.['异人'], protagonistPath, isDream, options.mapTree, 'male', 'stranger', contextStr);
    macroCtx.maleStrangerText = formatCharacterGroup(ms);

    const mn = filterCharacterGroup(options.characters['男性']?.['普通人'], protagonistPath, isDream, options.mapTree, 'male', 'normal', contextStr);
    macroCtx.maleNormalText = formatCharacterGroup(mn);
  }

  // ── Pre-compute vars list for {{VARS_LIST}} macro ──
  if (options.fullVariables) {
    macroCtx.varsListText = formatVariablesForPrompt(options.fullVariables);
  }

  // ── Scan lorebooks ──
  const historyText = history.slice(-6).map(m => m.content).join(' ');
  let scanResult: ScanResult = { groups: {} };
  if (lorebooks && lorebooks.length > 0) {
    scanResult = scanLorebooks(lorebooks, userInput, historyText);
  }

  // Track which anchors have been injected via preset blocks
  const injected = new Set<InjectionAnchor>();

  // ── Helpers for macro replacement on lorebook content ──
  const applyMacros = (content: string): string =>
    content
      .replace(/\{\{user\}\}/g, macroCtx.userName)
      .replace(/\{\{char\}\}/g, macroCtx.characterName)
      .replace(/\{\{original\}\}/g, macroCtx.userInput)
      .replace(/\{\{player_description\}\}/g, macroCtx.playerDescription ?? '')
      .replace(/\{\{char_description\}\}/g, macroCtx.characterDescription ?? '')
      .replace(/\{\{MAP\}\}/g, macroCtx.mapText ?? '')
      .replace(/\{\{FEMALE_STRANGER\}\}/g, macroCtx.femaleStrangerText ?? '')
      .replace(/\{\{FEMALE_NORMAL\}\}/g, macroCtx.femaleNormalText ?? '')
      .replace(/\{\{MALE_STRANGER\}\}/g, macroCtx.maleStrangerText ?? '')
      .replace(/\{\{MALE_NORMAL\}\}/g, macroCtx.maleNormalText ?? '');

  const pushSection = (anchor: InjectionAnchor, content: string) => {
    sections.push({
      identifier: anchor,
      name: `世界书（${ANCHOR_LABELS[anchor] || anchor}）`,
      role: 'system',
      enabled: true,
      content,
      source: 'lorebook',
    });
    injected.add(anchor);
  };

  /** Get formatted + macro-replaced content for an anchor group */
  const getGroupContent = (anchor: InjectionAnchor): string => {
    const entries = scanResult.groups[anchor];
    if (!entries || entries.length === 0) return '';
    return applyMacros(formatMatchedEntries(entries));
  };

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

      // Handle chatHistory insertion — detected by identifier or name
      const isChatHistory = detectChatHistory(block);
      if (isChatHistory && !hasChatHistory) {
        hasChatHistory = true;
        // Inject remaining "after" type lorebook anchors not yet placed
        const afterAnchors: InjectionAnchor[] = ['worldInfoAfter', 'worldInfoD2After'];
        for (const anchor of afterAnchors) {
          if (!injected.has(anchor)) {
            const c = getGroupContent(anchor);
            if (c.trim()) {
              systemAccumulator += (systemAccumulator ? '\n\n' : '') + c;
              pushSection(anchor, c);
            }
          }
        }
        if (systemAccumulator.trim()) {
          assembledMessages.push({ role: 'system', content: systemAccumulator });
          systemAccumulator = '';
        }
        const recentHistory = buildRecentHistory(history.slice(0, -1));
        assembledMessages.push(...recentHistory);
        sections.push({
          identifier: 'chatHistory', name: block.name || '对话历史',
          role: 'system', enabled: true, content: `[${recentHistory.length} 条]`, source: 'chat',
        });
        continue;
      }

      // Resolve content — first check if this block is an injection anchor
      let content: string | null = null;
      let source: PromptSection['source'] = 'preset';

      // personaDescription / charDescription: inject from IdentityTab settings
      const blockId = block.identifier.toLowerCase();
      if (blockId === 'personadescription' && playerDescription?.trim()) {
        content = playerDescription;
      } else if (blockId === 'chardescription' && characterDescription?.trim()) {
        content = characterDescription;
      }

      if (!content) {
        const matchedAnchor = detectAnchor(block);
        if (matchedAnchor && !injected.has(matchedAnchor)) {
          const groupContent = getGroupContent(matchedAnchor);
          if (groupContent.trim()) {
            content = groupContent;
            source = 'lorebook';
            pushSection(matchedAnchor, groupContent);
          }
        }
      }

      if (!content) {
        const rawContent = block.content?.trim();
        content = rawContent ? resolveContent(rawContent, presetVars, macroCtx) : null;
      }

      const hasContent = content && content.trim();

      if (!hasContent) {
        sections.push({
          identifier: block.identifier, name: block.name, role: block.role,
          enabled: true, content: null, source: 'preset',
        });
        continue;
      }

      // Only push a section if pushSection hasn't already added one for this anchor
      if (source !== 'lorebook') {
        sections.push({ identifier: block.identifier, name: block.name, role: block.role, enabled: true, content, source });
      }

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

  // Flush remaining system accumulator
  if (systemAccumulator.trim()) {
    if (hasChatHistory) {
      // Post-history system content goes after history, before user input
      assembledMessages.push({ role: 'system', content: systemAccumulator });
    } else {
      assembledMessages.unshift({ role: 'system', content: systemAccumulator });
    }
  }

  // Chat history (if not already inserted by a chatHistory preset block)
  if (!hasChatHistory) {
    const recentHistory = buildRecentHistory(history.slice(0, -1));
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

  // ── Dedup: remove duplicate content blocks from system messages ──
  const seenBlocks = new Set<string>();
  for (let i = 0; i < assembledMessages.length; i++) {
    const m = assembledMessages[i];
    if (m.role === 'system') {
      const blocks = m.content.split('\n\n');
      const unique = blocks.filter(b => {
        const trimmed = b.trim();
        if (!trimmed || seenBlocks.has(trimmed)) return false;
        seenBlocks.add(trimmed);
        return true;
      });
      assembledMessages[i] = { ...m, content: unique.join('\n\n') };
    }
  }
  // Remove empty system messages
  const deduped = assembledMessages.filter(m => m.content.trim());

  const systemPrompt = deduped
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');

  return { messages: deduped, systemPrompt, sections };
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
  playerDescription?: string;
  characterDescription?: string;
  mapText?: string;
  femaleStrangerText?: string;
  femaleNormalText?: string;
  maleStrangerText?: string;
  maleNormalText?: string;
  varsListText?: string;
}

export function replaceMacros(template: string, context: MacroContext): string {
  const presetVars: Record<string, string> = {};
  return resolveContent(template, presetVars, context);
}

export const SUPPORTED_MACROS = [
  { name: '{{user}}', description: '用户名' },
  { name: '{{char}}', description: 'AI角色名' },
  { name: '{{original}}', description: '用户原始输入' },
  { name: '{{player_description}}', description: '玩家设定（IdentityTab）' },
  { name: '{{char_description}}', description: '角色设定（IdentityTab）' },
  { name: '{{MAP}}', description: '地图上下文（自动按位置距离过滤）' },
  { name: '{{FEMALE_STRANGER}}', description: '女性异人信息（按位置距离过滤）' },
  { name: '{{FEMALE_NORMAL}}', description: '女性普通人信息（按位置距离过滤）' },
  { name: '{{MALE_STRANGER}}', description: '男性异人信息（按位置距离过滤）' },
  { name: '{{MALE_NORMAL}}', description: '男性普通人信息（按位置距离过滤）' },
  { name: '{{VARS_LIST}}', description: '当前全部变量及值（树形缩进）' },
  { name: '{{setvar::name::value}}', description: '设置预设变量' },
  { name: '{{addvar::name::value}}', description: '追加预设变量' },
  { name: '{{getvar::name}}', description: '获取预设变量值' },
  { name: '{{// 注释}}', description: '潮汐注释（发送时移除）' },
  { name: '{{trim}}', description: '裁剪标记（发送时移除）' },
] as const;
