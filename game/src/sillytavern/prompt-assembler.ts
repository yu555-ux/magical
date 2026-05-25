import type { ChatMessage, PresetBlock, Lorebook, InjectionAnchor } from './types';
import { INJECTION_ANCHOR_RULES } from './types';
import { scanLorebooks, formatMatchedEntries } from './lorebookEngine';
import type { ScanResult } from './lorebookEngine';
import { processMapForPrompt } from './map-filter';
import { resolvePath, formatVariablesForPrompt } from './variables';
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
  squashSystemMessages?: boolean;
  maxContextTokens?: number;
  maxOutputTokens?: number;
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
    .replace(/\{\{trim\}\}/gi, '');
  return result;
}

// ── Main assembler ──
// The preset block array IS the send order.
// Each block's position in the array determines where its content appears.
// World book anchors, chatHistory marker, and identity blocks inject content at their position.

export function assemblePrompt(options: AssembleOptions): AssembleResult {
  const { userInput, history, presetBlocks, lorebooks, userName, characterName, playerDescription, characterDescription } = options;
  const maxContext = options.maxContextTokens ?? 2000000;
  const maxOutput = options.maxOutputTokens ?? 64000;
  const tokenBudget = maxContext - maxOutput;

  // ── Macro context ──
  const macroCtx: MacroContext = { userName, characterName, userInput, playerDescription, characterDescription };
  const presetVars: Record<string, string> = {};

  // ── Pre-compute map/character/vars text ──
  const contextStr = history.slice(-5).map(m => m.content).join('\n');
  if (options.mapTree) {
    macroCtx.mapText = processMapForPrompt(options.mapTree, options.currentLocation ?? '', options.isDream ?? false, contextStr);
  }
  if (options.characters && options.mapTree) {
    const pp = options.currentLocation ? resolvePath(options.currentLocation, options.mapTree) : null;
    const id = options.isDream ?? false;
    macroCtx.femaleStrangerText = formatCharacterGroup(filterCharacterGroup(options.characters['女性']?.['异人'], pp, id, options.mapTree, 'female', 'stranger', contextStr));
    macroCtx.femaleNormalText = formatCharacterGroup(filterCharacterGroup(options.characters['女性']?.['普通人'], pp, id, options.mapTree, 'female', 'normal', contextStr));
    macroCtx.maleStrangerText = formatCharacterGroup(filterCharacterGroup(options.characters['男性']?.['异人'], pp, id, options.mapTree, 'male', 'stranger', contextStr));
    macroCtx.maleNormalText = formatCharacterGroup(filterCharacterGroup(options.characters['男性']?.['普通人'], pp, id, options.mapTree, 'male', 'normal', contextStr));
  }
  if (options.fullVariables) {
    macroCtx.varsListText = formatVariablesForPrompt(options.fullVariables);
  }

  // ── Lorebook scan ──
  const historyText = history.slice(-6).map(m => m.content).join(' ');
  let scanResult: ScanResult = { groups: {} };
  if (lorebooks && lorebooks.length > 0) {
    scanResult = scanLorebooks(lorebooks, userInput, historyText);
  }
  const injected = new Set<InjectionAnchor>();

  const applyLorebookMacros = (c: string): string =>
    c.replace(/\{\{user\}\}/g, macroCtx.userName)
     .replace(/\{\{char\}\}/g, macroCtx.characterName)
     .replace(/\{\{original\}\}/g, macroCtx.userInput)
     .replace(/\{\{player_description\}\}/g, macroCtx.playerDescription ?? '')
     .replace(/\{\{char_description\}\}/g, macroCtx.characterDescription ?? '')
     .replace(/\{\{MAP\}\}/g, macroCtx.mapText ?? '')
     .replace(/\{\{FEMALE_STRANGER\}\}/g, macroCtx.femaleStrangerText ?? '')
     .replace(/\{\{FEMALE_NORMAL\}\}/g, macroCtx.femaleNormalText ?? '')
     .replace(/\{\{MALE_STRANGER\}\}/g, macroCtx.maleStrangerText ?? '')
     .replace(/\{\{MALE_NORMAL\}\}/g, macroCtx.maleNormalText ?? '');

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

      // ── chatHistory marker → insert chat messages (including user input, per Ttavern semantics) ──
      if (detectChatHistory(block) && !hasChatHistory) {
        hasChatHistory = true;
        const historyMsgs = buildRecentHistory(history, tokenBudget);
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
    const historyMsgs = buildRecentHistory(history, tokenBudget);
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
  // Remaining lorebook anchors
  for (const entry of remainingMsgs) {
    if (!stageNames[entry.id]) {
      const rule = INJECTION_ANCHOR_RULES.find(r => r.anchor === entry.id);
      stageNames[entry.id] = rule?.label ?? entry.id;
    }
  }

  return { messages: finalMsgs, systemPrompt, totalTokens, stageTokens, stageMessages, stageOrder, stageNames };
}

// ── History builder ──

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildRecentHistory(history: ChatMessage[], budget: number): HistoryMessage[] {
  let remaining = budget;
  const recent: HistoryMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'system') continue;
    // For assistant messages, only keep <maintext> to avoid polluting context with XML tags
    const text = msg.role === 'assistant' && msg.parsed?.maintext
      ? msg.parsed.maintext.trim()
      : msg.content;
    if (!text) continue;
    const t = Math.round(text.length / 4);
    if (remaining - t < 0) break;
    recent.unshift({ role: msg.role as 'user' | 'assistant', content: text });
    remaining -= t;
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
  { name: '{{setvar::name::value}}', description: '设置预设变量' },
  { name: '{{addvar::name::value}}', description: '追加预设变量' },
  { name: '{{getvar::name}}', description: '获取预设变量值' },
  { name: '{{// 注释}}', description: '潮汐注释（发送时移除）' },
  { name: '{{trim}}', description: '裁剪标记（发送时移除）' },
] as const;
