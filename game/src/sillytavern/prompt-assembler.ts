import type { ChatMessage, PresetBlock, Lorebook, InjectionAnchor, SavePoint, HistoryTimeline, DreamAnchor } from './types';
import { INJECTION_ANCHOR_RULES } from './types';
import { scanLorebooks, formatMatchedEntries } from './lorebookEngine';
import type { ScanResult } from './lorebookEngine';
import { processMapForPrompt } from './map-filter';
import { resolvePath, formatVariablesForPrompt, getVariablePath } from './variables';
import { injectCountdown } from './countdown';
import { filterCharacterGroup, formatCharacterGroup } from './character-filter';

// ── Types ──

export interface AssembleOptions {
  userInput: string;
  history: ChatMessage[];
  presetBlocks?: PresetBlock[];
  lorebooks?: Lorebook[];
  userName: string;
  characterName: string;
  playerDescription?: string;
  characterDescription?: string;
  mapTree?: Record<string, any>;
  currentLocation?: string;
  isDream?: boolean;
  characters?: Record<string, any>;
  fullVariables?: Record<string, any>;
  plotHistory?: HistoryTimeline;
  dreamAnchor?: DreamAnchor;
  squashSystemMessages?: boolean;
  recentMessageCount?: number;
}

export interface AssembleResult {
  /** Final flat message array sent to AI */
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  /** All system messages joined (for display) */
  systemPrompt: string;
  /** Total estimated tokens */
  totalTokens: number;
  /** Token count per block identifier */
  stageTokens: Record<string, number>;
  /** Messages grouped by block identifier, in send order */
  stageMessages: Record<string, { role: 'system' | 'user' | 'assistant'; content: string }[]>;
  /** Block identifiers in send order */
  stageOrder: string[];
  /** Display names keyed by identifier */
  stageNames: Record<string, string>;
}

// ── Internal Message ──

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ── Chat history detection ──

const CHAT_HISTORY_PATTERNS = {
  idPatterns: ['chathistory'],
  namePatterns: ['chat history'],
};

function detectChatHistory(block: PresetBlock): boolean {
  const id = block.identifier.toLowerCase();
  const name = block.name.toLowerCase();
  if (CHAT_HISTORY_PATTERNS.idPatterns.some(p => id === p || id.includes(p))) return true;
  if (CHAT_HISTORY_PATTERNS.namePatterns.some(p => name.includes(p))) return true;
  return false;
}

// ── Anchor detection ──

function detectAnchor(block: PresetBlock): InjectionAnchor | null {
  const id = block.identifier.toLowerCase();
  const name = block.name.toLowerCase();
  const content = block.content || '';
  for (const rule of INJECTION_ANCHOR_RULES) {
    if (rule.idPatterns.some(p => id === p)) return rule.anchor;
    if (rule.namePatterns.some(p => name.includes(p))) return rule.anchor;
    if (rule.contentMarkers.some(m => content.includes(m))) return rule.anchor;
  }
  return null;
}

// ── Variable macro resolver ──
// Recursively resolve {{user}} / <user> / {{char}} in all string values & keys.
// Returns a new object; does not mutate the original.

export function deepResolveMacros(obj: any, userName: string, characterName: string): any {
  if (typeof obj === 'string') {
    return obj.replace(/\{\{user\}\}/g, userName).replace(/<user>/g, userName).replace(/\{\{char\}\}/g, characterName);
  }
  if (Array.isArray(obj)) {
    return obj.map(v => deepResolveMacros(v, userName, characterName));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const resolvedKey = key.replace(/\{\{user\}\}/g, userName).replace(/<user>/g, userName).replace(/\{\{char\}\}/g, characterName);
      result[resolvedKey] = deepResolveMacros(value, userName, characterName);
    }
    return result;
  }
  return obj;
}

// ── Macro engine ──

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
  lastMaintext?: string;
  fullVars?: Record<string, any>;
}

function resolveContent(content: string, presetVars: Record<string, string>, macroCtx: MacroContext): string {
  let result = content;
  result = result.replace(/\{\{\s*\/\/[^}]*\}\}/g, '');
  result = result.replace(/\{\{setvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    presetVars[name.trim()] = value; return '';
  });
  result = result.replace(/\{\{addvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    const key = name.trim(); presetVars[key] = (presetVars[key] || '') + value; return '';
  });
  result = result.replace(/\{\{getvar::([^}]+)\}\}/g, (_, name: string) => presetVars[name.trim()] ?? '');
  result = result
    .replace(/\{\{user\}\}/g, macroCtx.userName)
    .replace(/<user>/g, macroCtx.userName)
    .replace(/\{\{char\}\}/g, macroCtx.characterName)
    .replace(/\{\{original\}\}/g, macroCtx.userInput)
    .replace(/\{\{player_description\}\}/g, macroCtx.playerDescription ?? '')
    .replace(/\{\{char_description\}\}/g, macroCtx.characterDescription ?? '')
    .replace(/\{\{MAP\}\}/g, macroCtx.mapText ?? '')
    .replace(/\{\{FEMALE_STRANGER\}\}/g, macroCtx.femaleStrangerText ?? '')
    .replace(/\{\{FEMALE_NORMAL\}\}/g, macroCtx.femaleNormalText ?? '')
    .replace(/\{\{MALE_STRANGER\}\}/g, macroCtx.maleStrangerText ?? '')
    .replace(/\{\{MALE_NORMAL\}\}/g, macroCtx.maleNormalText ?? '')
    .replace(/\{\{VARS_LIST\}\}/g, macroCtx.varsListText ?? '')
    .replace(/\{\{LAST_MAINTEXT\}\}/g, macroCtx.lastMaintext ?? '')
    .replace(/\{\{GET_VAR::([^}]+)\}\}/g, (_, path: string) => {
      const trimmedPath = path.trim();
      console.log('[GET_VAR-MACRO] 匹配到 {{GET_VAR::' + trimmedPath + '}}, fullVars 是否存在:', !!macroCtx.fullVars);
      if (!macroCtx.fullVars) {
        console.log('[GET_VAR-MACRO] ❌ fullVars 为空, 返回空字符串');
        return '';
      }
      const result = getVariablePath(macroCtx.fullVars, trimmedPath);
      console.log('[GET_VAR-MACRO] 结果长度:', result.length, '结果前100字符:', result.substring(0, 100));
      return result;
    })
    .replace(/\{\{LOREBY::([^}]+)\}\}/g, '')
    .replace(/\{\{trim\}\}/gi, '');
  return result;
}

// ── Main assembler ──
// The preset block array IS the send order.
// Each block's position in the array determines where its content appears.
// World book anchors, chatHistory marker, and identity blocks inject content at their position.

export function assemblePrompt(options: AssembleOptions): AssembleResult {
  const { userInput, history, presetBlocks, lorebooks, userName, characterName, playerDescription, characterDescription, plotHistory, recentMessageCount } = options;

  // ── Resolve {{user}}/<user>/{{char}} in all variable values at the source ──
  const resolvedVars = options.fullVariables
    ? deepResolveMacros(options.fullVariables, userName, characterName)
    : undefined;
  const mapTree: any = resolvedVars?.['地图'] ?? (options.mapTree as any);
  const characters: any = resolvedVars?.['主要人物'] ?? (options.characters as any);
  const currentLocation: string = (resolvedVars?.['世界']?.['现实']?.['地点'] ?? options.currentLocation ?? '') as string;
  const isDream: boolean = (resolvedVars?.['世界']?.['现实']?.['是否梦境'] ?? options.isDream ?? false) as boolean;

  // ── Macro context ──
  // Extract last assistant maintext for {{LAST_MAINTEXT}} macro
  let lastMaintext: string | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant' && history[i].parsed?.maintext) {
      lastMaintext = history[i].parsed!.maintext;
      break;
    }
  }
  const macroCtx: MacroContext = { userName, characterName, userInput, playerDescription, characterDescription, lastMaintext, fullVars: resolvedVars };
  const presetVars: Record<string, string> = {};

  // ── Pre-compute map/character/vars text ──
  const contextStr = history.slice(-5).map(m => m.content).join('\n');
  if (mapTree) {
    macroCtx.mapText = processMapForPrompt(mapTree, currentLocation, isDream, contextStr);
  }
  if (characters && mapTree) {
    const pp = currentLocation ? resolvePath(currentLocation, mapTree) : null;
    macroCtx.femaleStrangerText = formatCharacterGroup(filterCharacterGroup(characters['女性']?.['异人'], pp, isDream, mapTree, 'female', 'stranger', contextStr));
    macroCtx.femaleNormalText = formatCharacterGroup(filterCharacterGroup(characters['女性']?.['普通人'], pp, isDream, mapTree, 'female', 'normal', contextStr));
    macroCtx.maleStrangerText = formatCharacterGroup(filterCharacterGroup(characters['男性']?.['异人'], pp, isDream, mapTree, 'male', 'stranger', contextStr));
    macroCtx.maleNormalText = formatCharacterGroup(filterCharacterGroup(characters['男性']?.['普通人'], pp, isDream, mapTree, 'male', 'normal', contextStr));
  }
  if (resolvedVars) {
    // 注入代码计算的倒计时（覆盖任何 AI 写入的旧值）
    if (options.dreamAnchor) {
      injectCountdown(resolvedVars, options.dreamAnchor);
    }
    macroCtx.varsListText = formatVariablesForPrompt(resolvedVars);
  }

  // ── Lorebook scan ──
  // Check for {{LOREBY::pattern}} in any block — filter lorebooks by title match
  let effectiveLorebooks = lorebooks;
  const lorebyPatterns: string[] = [];
  if (presetBlocks && lorebooks && lorebooks.length > 0) {
    for (const block of presetBlocks) {
      if (!block.enabled || !block.content) continue;
      const re = /\{\{LOREBY::([^}]+)\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(block.content)) !== null) {
        lorebyPatterns.push(m[1].trim());
      }
    }
    if (lorebyPatterns.length > 0) {
      effectiveLorebooks = lorebooks.filter(lb =>
        lorebyPatterns.some(p => lb.name.includes(p)),
      );
    }
  }
  const historyText = history.slice(-6).map(m => m.content).join(' ');
  let scanResult: ScanResult = { groups: {} };
  if (effectiveLorebooks && effectiveLorebooks.length > 0) {
    scanResult = scanLorebooks(effectiveLorebooks, userInput, historyText);
  }
  const injected = new Set<InjectionAnchor>();

  const applyLorebookMacros = (c: string): string =>
    c.replace(/\{\{user\}\}/g, macroCtx.userName)
     .replace(/<user>/g, macroCtx.userName)
     .replace(/\{\{char\}\}/g, macroCtx.characterName)
     .replace(/\{\{original\}\}/g, macroCtx.userInput)
     .replace(/\{\{player_description\}\}/g, macroCtx.playerDescription ?? '')
     .replace(/\{\{char_description\}\}/g, macroCtx.characterDescription ?? '')
     .replace(/\{\{MAP\}\}/g, macroCtx.mapText ?? '')
     .replace(/\{\{FEMALE_STRANGER\}\}/g, macroCtx.femaleStrangerText ?? '')
     .replace(/\{\{FEMALE_NORMAL\}\}/g, macroCtx.femaleNormalText ?? '')
     .replace(/\{\{MALE_STRANGER\}\}/g, macroCtx.maleStrangerText ?? '')
     .replace(/\{\{MALE_NORMAL\}\}/g, macroCtx.maleNormalText ?? '')
     .replace(/\{\{LAST_MAINTEXT\}\}/g, macroCtx.lastMaintext ?? '')
     .replace(/\{\{GET_VAR::([^}]+)\}\}/g, '')
     .replace(/\{\{LOREBY::([^}]+)\}\}/g, '');

  function getLorebook(anchor: InjectionAnchor): string {
    const entries = scanResult.groups[anchor];
    if (!entries || entries.length === 0) return '';
    return applyLorebookMacros(formatMatchedEntries(entries));
  }

  function makeMsg(role: 'system' | 'user' | 'assistant', content: string): Message | null {
    const t = content.trim();
    return t ? { role, content: t } : null;
  }

  // ── Build messages by iterating blocks in array order ──

  const ordered: { id: string; msgs: Message[] }[] = [];  // preserves block order
  const messageList: Message[] = [];
  let hasChatHistory = false;

  if (presetBlocks) {
    for (const block of presetBlocks) {
      if (!block.enabled) continue;

      const blockId = block.identifier.toLowerCase();
      const blockMsgs: Message[] = [];

      // ── chatHistory marker → inject plot history above, then chat messages ──
      if (detectChatHistory(block) && !hasChatHistory) {
        hasChatHistory = true;

        // 剧情历史板块（独立条目，位于 chatHistory 上方）
        const { realityText, dreamText } = formatHistoryForPrompt(
          plotHistory ?? { reality: [], dream: [] },
          userName,
        );
        const plotMsgs: Message[] = [];
        if (realityText) {
          plotMsgs.push({ role: 'system', content: realityText });
        }
        if (dreamText) {
          plotMsgs.push({ role: 'system', content: dreamText });
        }
        if (plotMsgs.length > 0) {
          ordered.push({ id: 'plotHistory', msgs: plotMsgs });
        }

        // 聊天记录
        const historyMsgs = buildRecentHistory(history, recentMessageCount);
        for (const hm of historyMsgs) {
          blockMsgs.push({ role: hm.role, content: hm.content });
        }
        ordered.push({ id: block.identifier, msgs: blockMsgs });
        continue;
      }

      // ── personaDescription / charDescription → inject from IdentityTab ──
      if (blockId === 'personadescription' && playerDescription?.trim()) {
        const m = makeMsg('system', playerDescription);
        if (m) blockMsgs.push(m);
        ordered.push({ id: block.identifier, msgs: blockMsgs });
        continue;
      }
      if (blockId === 'chardescription' && characterDescription?.trim()) {
        const m = makeMsg('system', characterDescription);
        if (m) blockMsgs.push(m);
        ordered.push({ id: block.identifier, msgs: blockMsgs });
        continue;
      }

      // ── Try lorebook injection at this anchor ──
      const anchor = detectAnchor(block);
      if (anchor) {
        const lb = getLorebook(anchor);
        if (lb.trim() && !injected.has(anchor)) {
          injected.add(anchor);
          const blockContent = block.content?.trim() ? resolveContent(block.content, presetVars, macroCtx) : '';
          const merged = [blockContent, lb.trim()].filter(Boolean).join('\n\n');
          const m = makeMsg('system', merged);
          if (m) blockMsgs.push(m);
          ordered.push({ id: block.identifier, msgs: blockMsgs });
          continue;
        }
      }

      // ── Regular block: use its own content ──
      if (block.content?.trim()) {
        const resolved = resolveContent(block.content, presetVars, macroCtx);
        const m = makeMsg(block.role, resolved);
        if (m) blockMsgs.push(m);
      }
      ordered.push({ id: block.identifier, msgs: blockMsgs });
    }
  }

  // ── Fallback: if no chatHistory block exists, add history at end ──
  if (!hasChatHistory) {
    const historyMsgs = buildRecentHistory(history, recentMessageCount);
    const fallbackMsgs: Message[] = [];
    for (const hm of historyMsgs) {
      fallbackMsgs.push({ role: hm.role, content: hm.content });
    }
    ordered.push({ id: 'chatHistory', msgs: fallbackMsgs });
  }

  // ── Inject remaining lorebook entries ──
  // Place them next to related anchor blocks if possible, otherwise prepend

  const remainingAnchors: InjectionAnchor[] = ['worldInfoBefore', 'worldInfoD2Before', 'worldInfoAfter', 'worldInfoD2After'];
  const remainingMsgs: { id: string; msgs: Message[] }[] = [];

  for (const anchor of remainingAnchors) {
    if (injected.has(anchor)) continue;
    const lb = getLorebook(anchor);
    if (!lb.trim()) continue;
    injected.add(anchor);
    const m = makeMsg('system', lb);
    if (m) remainingMsgs.push({ id: anchor, msgs: [m] });
  }

  // Insert remaining lorebook entries before the first non-worldInfo block,
  // or prepend if no such block exists
  if (remainingMsgs.length > 0) {
    let insertIdx = 0;
    for (let i = 0; i < ordered.length; i++) {
      const id = ordered[i].id.toLowerCase();
      if (!id.includes('worldinfo') && id !== 'worldinfobefore' && id !== 'worldinfoafter') {
        insertIdx = i;
        break;
      }
    }
    ordered.splice(insertIdx, 0, ...remainingMsgs);
  }

  // ── Build flat message list (preserves ordered array sequence) ──

  for (const entry of ordered) {
    for (const msg of entry.msgs) {
      messageList.push(msg);
    }
  }

  // ── Dedup system message blocks ──
  const seenBlocks = new Set<string>();
  for (let i = 0; i < messageList.length; i++) {
    const m = messageList[i];
    if (m.role === 'system') {
      const blocks = m.content.split('\n\n');
      const unique = blocks.filter(b => { const t = b.trim(); if (!t || seenBlocks.has(t)) return false; seenBlocks.add(t); return true; });
      messageList[i] = { ...m, content: unique.join('\n\n') };
    }
  }

  // ── Remove empty messages ──
  let final = messageList.filter(m => m.content.trim());

  // ── Squash consecutive system messages ──
  if (options.squashSystemMessages) {
    const squashed: Message[] = [];
    for (const cur of final) {
      if (cur.role === 'system' && squashed.length > 0 && squashed[squashed.length - 1].role === 'system') {
        squashed[squashed.length - 1] = { ...squashed[squashed.length - 1], content: squashed[squashed.length - 1].content + '\n\n' + cur.content };
      } else {
        squashed.push({ ...cur });
      }
    }
    final = squashed;
  }

  // ── Build stageMessages: map from block id → messages ──
  const stageMessages: Record<string, Message[]> = {};
  for (const entry of ordered) {
    if (entry.msgs.length > 0) {
      stageMessages[entry.id] = entry.msgs.map(m => ({ role: m.role, content: m.content }));
    }
  }
  // ── Compute stage tokens ──
  const stageTokens: Record<string, number> = {};
  for (const [id, msgs] of Object.entries(stageMessages)) {
    stageTokens[id] = Math.round(msgs.reduce((s, m) => s + m.content.length / 4, 0));
  }

  // ── Results ──
  const finalMsgs = final.map(m => ({ role: m.role, content: m.content }));
  const systemPrompt = finalMsgs.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const totalTokens = Math.round(final.reduce((s, m) => s + m.content.length / 4, 0));

  const stageOrder = ordered.map(e => e.id);

  // ── Build stageNames: display name for each identifier ──
  const stageNames: Record<string, string> = {};
  // From preset blocks
  if (presetBlocks) {
    for (const block of presetBlocks) {
      stageNames[block.identifier] = block.name || block.identifier;
    }
  }
  // Fallback chatHistory name
  if (!stageNames['chatHistory']) {
    stageNames['chatHistory'] = '聊天记录';
  }
  if (!stageNames['plotHistory']) {
    stageNames['plotHistory'] = '历史剧情';
  }
  // Remaining lorebook anchors
  for (const entry of remainingMsgs) {
    if (!stageNames[entry.id]) {
      const rule = INJECTION_ANCHOR_RULES.find(r => r.anchor === entry.id);
      stageNames[entry.id] = rule?.label ?? entry.id;
    }
  }

  return { messages: finalMsgs, systemPrompt, totalTokens, stageTokens, stageMessages, stageOrder, stageNames };
}

// ── Plot history formatter ──

function formatSavePointYaml(sp: SavePoint): string {
  const lines: string[] = [];
  lines.push(`  序号: ${sp.sequence}`);
  lines.push(`  标题: ${sp.title}`);
  lines.push(`  世界: ${sp.world}`);
  lines.push(`  日期: ${sp.date}`);
  lines.push(`  地点: ${sp.location}`);
  lines.push(`  相关人物: ${sp.characters}`);
  lines.push(`  描述: ${sp.description}`);
  if (sp.keyInfo.length > 0) {
    lines.push('  关键信息:');
    for (const item of sp.keyInfo) lines.push(`    - ${item}`);
  }
  if (sp.foreshadowing.length > 0) {
    lines.push('  伏笔:');
    for (const item of sp.foreshadowing) lines.push(`    - ${item}`);
  }
  return lines.join('\n');
}

function formatHistoryForPrompt(
  timeline: HistoryTimeline,
  userName: string,
): { realityText: string; dreamText: string } {
  const buildSection = (tag: string, label: string, list: SavePoint[]): string => {
    if (list.length === 0) return '';
    const header = `以下为${userName}在${label}中经历的历史剧情:`;
    const body = list.map(sp => formatSavePointYaml(sp)).join('\n\n');
    return `<${tag}>\n${header}\n${body}\n</${tag}>`;
  };

  return {
    realityText: buildSection('现实历史剧情', '现实', timeline.reality),
    dreamText: buildSection('梦境历史剧情', '梦境', timeline.dream),
  };
}

// ── History builder ──

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildRecentHistory(history: ChatMessage[], maxMessages?: number): HistoryMessage[] {
  const limit = maxMessages ?? 0;
  const recent: HistoryMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'system') continue;
    const text = msg.role === 'assistant' && msg.parsed?.maintext
      ? msg.parsed.maintext.trim()
      : msg.content;
    if (!text) continue;
    recent.unshift({ role: msg.role as 'user' | 'assistant', content: text });
    if (limit > 0 && recent.length >= limit) break;
  }
  return recent;
}

// ── Public API ──

interface MacroContextExport {
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
  lastMaintext?: string;
  fullVars?: Record<string, any>;
}

export function replaceMacros(template: string, context: MacroContextExport): string {
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
  { name: '{{LAST_MAINTEXT}}', description: '上一次AI回复的正文内容' },
  { name: '{{GET_VAR::路径}}', description: '提取变量子树（如{{GET_VAR::主角.资源}}），格式化为缩进文本' },
  { name: '{{LOREBY::关键词}}', description: '仅插入标题含关键词的世界书条目（如{{LOREBY::【异常】}}），发送时移除' },
  { name: '{{setvar::name::value}}', description: '设置预设变量' },
  { name: '{{addvar::name::value}}', description: '追加预设变量' },
  { name: '{{getvar::name}}', description: '获取预设变量值' },
  { name: '{{// 注释}}', description: '注释（发送时移除）' },
  { name: '{{trim}}', description: '裁剪标记（发送时移除）' },
] as const;
