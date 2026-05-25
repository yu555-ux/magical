import type { ChatMessage, PresetBlock, Lorebook, InjectionAnchor } from './types';
import { INJECTION_ANCHOR_RULES } from './types';
import { scanLorebooks, formatMatchedEntries } from './lorebookEngine';
import type { ScanResult } from './lorebookEngine';
import { processMapForPrompt } from './map-filter';
import { resolvePath, formatVariablesForPrompt } from './variables';
import { filterCharacterGroup, formatCharacterGroup } from './character-filter';

// ── Types ──

export interface PromptSection {
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  content: string | null;
  source: 'preset' | 'lorebook' | 'chat';
  stage: string;
  tokens: number;
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
  mapTree?: Record<string, any>;
  currentLocation?: string;
  isDream?: boolean;
  characters?: Record<string, any>;
  fullVariables?: Record<string, any>;
  squashSystemMessages?: boolean;
  /** Max context tokens (from preset params) */
  maxContextTokens?: number;
  /** Max output tokens (reserved from context) */
  maxOutputTokens?: number;
}

export interface AssembleResult {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  systemPrompt: string;
  sections: PromptSection[];
  totalTokens: number;
  /** Per-stage token breakdown */
  stageTokens: Record<string, number>;
  /** Messages grouped by pipeline stage (exact order sent to AI) */
  stageMessages: Record<string, { role: 'system' | 'user' | 'assistant'; content: string }[]>;
}

// ── Message ──

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  identifier: string;
}

// ── MessageCollection ──

class MessageCollection {
  readonly name: string;
  private messages: Message[] = [];

  constructor(name: string) {
    this.name = name;
  }

  push(msg: Message): void {
    this.messages.push(msg);
  }

  unshift(msg: Message): void {
    this.messages.unshift(msg);
  }

  pushAll(msgs: Message[]): void {
    for (const m of msgs) this.messages.push(m);
  }

  getMessages(): Message[] {
    return this.messages;
  }

  get tokenCount(): number {
    return Math.round(this.messages.reduce((s, m) => s + m.content.length / 4, 0));
  }

  get isEmpty(): boolean {
    return this.messages.every(m => !m.content.trim());
  }
}

// ── Pipeline stage order (TTavern) ──

const PIPELINE_STAGES = [
  'worldInfoBefore',
  'main',
  'worldInfoAfter',
  'charDescription',
  'charPersonality',
  'scenario',
  'personaDescription',
  'systemBlocks',
  'userBlocks',
  'assistantBlocks',
  'enhanceDefinitions',
  'chatHistory',
  'postHistory',
  'userInput',
] as const;

type StageName = (typeof PIPELINE_STAGES)[number];

/** Known identifiers that map to specific stages */
const STAGE_IDENTITY_MAP: Record<string, StageName> = {
  worldinfobefore: 'worldInfoBefore',
  worldinfoafter: 'worldInfoAfter',
  main: 'main',
  chardescription: 'charDescription',
  charpersonality: 'charPersonality',
  scenario: 'scenario',
  personadescription: 'personaDescription',
  enhancedefinitions: 'enhanceDefinitions',
};

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

function resolveContent(
  content: string,
  presetVars: Record<string, string>,
  macroCtx: MacroContext,
): string {
  let result = content;
  result = result.replace(/\{\{\s*\/\/[^}]*\}\}/g, '');
  result = result.replace(/\{\{setvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    presetVars[name.trim()] = value;
    return '';
  });
  result = result.replace(/\{\{addvar::([^:}]+)::([^}]*)\}\}/g, (_, name: string, value: string) => {
    const key = name.trim();
    presetVars[key] = (presetVars[key] || '') + value;
    return '';
  });
  result = result.replace(/\{\{getvar::([^}]+)\}\}/g, (_, name: string) => {
    return presetVars[name.trim()] ?? '';
  });
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

// ── Anchor detection ──

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

const ANCHOR_LABELS: Record<string, string> = {};
for (const rule of INJECTION_ANCHOR_RULES) {
  ANCHOR_LABELS[rule.anchor] = rule.label;
}

// ── Main Pipeline ──

export function assemblePrompt(options: AssembleOptions): AssembleResult {
  const { userInput, history, presetBlocks, lorebooks, userName, characterName, playerDescription, characterDescription } = options;
  const maxContext = options.maxContextTokens ?? 2000000;
  const maxOutput = options.maxOutputTokens ?? 64000;
  const tokenBudget = maxContext - maxOutput;

  // ── Stage collections ──
  const stages = new Map<StageName, MessageCollection>();
  for (const s of PIPELINE_STAGES) {
    stages.set(s, new MessageCollection(s));
  }

  // ── Block lookup ──
  const blockMap = new Map<string, PresetBlock>();
  const assignedBlocks = new Set<string>();
  if (presetBlocks) {
    for (const b of presetBlocks) {
      blockMap.set(b.identifier.toLowerCase(), b);
    }
  }

  // ── Macro context ──
  const macroCtx: MacroContext = { userName, characterName, userInput, playerDescription, characterDescription };
  const presetVars: Record<string, string> = {};

  // ── Pre-compute map/character/vars text ──
  const contextStr = history.slice(-5).map(m => m.content).join('\n');
  if (options.mapTree) {
    macroCtx.mapText = processMapForPrompt(
      options.mapTree, options.currentLocation ?? '', options.isDream ?? false, contextStr,
    );
  }
  if (options.characters && options.mapTree) {
    const protagonistPath = options.currentLocation ? resolvePath(options.currentLocation, options.mapTree) : null;
    const isDream = options.isDream ?? false;
    macroCtx.femaleStrangerText = formatCharacterGroup(filterCharacterGroup(options.characters['女性']?.['异人'], protagonistPath, isDream, options.mapTree, 'female', 'stranger', contextStr));
    macroCtx.femaleNormalText = formatCharacterGroup(filterCharacterGroup(options.characters['女性']?.['普通人'], protagonistPath, isDream, options.mapTree, 'female', 'normal', contextStr));
    macroCtx.maleStrangerText = formatCharacterGroup(filterCharacterGroup(options.characters['男性']?.['异人'], protagonistPath, isDream, options.mapTree, 'male', 'stranger', contextStr));
    macroCtx.maleNormalText = formatCharacterGroup(filterCharacterGroup(options.characters['男性']?.['普通人'], protagonistPath, isDream, options.mapTree, 'male', 'normal', contextStr));
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

  const applyLorebookMacros = (content: string): string =>
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

  function getLorebookContent(anchor: InjectionAnchor): string {
    const entries = scanResult.groups[anchor];
    if (!entries || entries.length === 0) return '';
    return applyLorebookMacros(formatMatchedEntries(entries));
  }

  // ── Stage builder helpers ──

  const sections: PromptSection[] = [];

  function addSection(id: string, name: string, role: string, enabled: boolean, content: string | null, source: PromptSection['source'], stage: StageName) {
    sections.push({
      identifier: id, name, role, enabled, content, source, stage,
      tokens: content ? Math.round(content.length / 4) : 0,
    });
  }

  function buildMessage(role: 'system' | 'user' | 'assistant', content: string, identifier: string): Message | null {
    const trimmed = content.trim();
    if (!trimmed) return null;
    return { role, content: trimmed, identifier };
  }

  /** Process a preset block: resolve macros + inject lorebook content */
  function resolveBlock(block: PresetBlock, lorebookAnchor?: InjectionAnchor): string | null {
    // Check for personaDescription / charDescription injection
    const blockId = block.identifier.toLowerCase();
    if (blockId === 'personadescription' && playerDescription?.trim()) {
      return playerDescription;
    }
    if (blockId === 'chardescription' && characterDescription?.trim()) {
      return characterDescription;
    }

    // Check for lorebook injection at this anchor
    if (lorebookAnchor && !injected.has(lorebookAnchor)) {
      const lb = getLorebookContent(lorebookAnchor);
      if (lb.trim()) {
        injected.add(lorebookAnchor);
        return lb;
      }
    }

    const raw = block.content?.trim();
    return raw ? resolveContent(raw, presetVars, macroCtx) : null;
  }

  function processBlock(block: PresetBlock, stage: StageName, lorebookAnchor?: InjectionAnchor): void {
    const stageCol = stages.get(stage)!;
    const content = resolveBlock(block, lorebookAnchor);

    if (!content) {
      addSection(block.identifier, block.name, block.role, false, null, 'preset', stage);
      return;
    }

    const anchorLabel = lorebookAnchor && injected.has(lorebookAnchor) ? 'lorebook' as const : 'preset' as const;
    addSection(block.identifier, block.name, block.role, true, content, anchorLabel, stage);

    const msg = buildMessage(block.role, content, block.identifier);
    if (msg) stageCol.push(msg);
  }

  // ── PHASE 1: Assign blocks to stages by identifier ──

  if (presetBlocks) {
    for (const block of presetBlocks) {
      if (!block.enabled) {
        addSection(block.identifier, block.name, block.role, false, null, 'preset',
          STAGE_IDENTITY_MAP[block.identifier.toLowerCase()] ?? 'systemBlocks');
        continue;
      }

      // chatHistory marker → skip block content, will be replaced by chat history
      if (detectChatHistory(block)) {
        addSection(block.identifier, block.name, block.role, true, '[聊天记录占位]', 'preset', 'chatHistory');
        assignedBlocks.add(block.identifier.toLowerCase());
        continue;
      }

      // Known stage identifiers
      const stageName = STAGE_IDENTITY_MAP[block.identifier.toLowerCase()];
      if (stageName) {
        // Determine lorebook anchor
        let anchor: InjectionAnchor | undefined;
        if (stageName === 'worldInfoBefore') anchor = 'worldInfoBefore';
        else if (stageName === 'worldInfoAfter') anchor = 'worldInfoAfter';

        processBlock(block, stageName, anchor);
        assignedBlocks.add(block.identifier.toLowerCase());
        continue;
      }

      // Detect as lorebook anchor
      const anchor = detectAnchor(block);
      if (anchor) {
        const lbContent = getLorebookContent(anchor);
        if (lbContent.trim() && !injected.has(anchor)) {
          injected.add(anchor);
          const msg = buildMessage('system', lbContent, block.identifier);
          if (msg) {
            // Place at the appropriate stage based on anchor
            const targetStage: StageName = anchor === 'worldInfoBefore' ? 'worldInfoBefore'
              : anchor === 'worldInfoD2Before' ? 'worldInfoBefore'
              : 'worldInfoAfter';
            stages.get(targetStage)!.push(msg);
          }
          addSection(block.identifier, block.name, 'system', true, lbContent, 'lorebook', 'worldInfoAfter');
        }
        assignedBlocks.add(block.identifier.toLowerCase());
        continue;
      }

      // Unrecognized block → categorize by role
      const roleStage: StageName =
        block.role === 'user' ? 'userBlocks'
        : block.role === 'assistant' ? 'assistantBlocks'
        : 'systemBlocks';

      processBlock(block, roleStage);
    }
  }

  // ── PHASE 2: Inject remaining lorebook entries ──

  // worldInfoBefore: inject if not yet placed
  if (!injected.has('worldInfoBefore')) {
    const lb = getLorebookContent('worldInfoBefore');
    if (lb.trim()) {
      injected.add('worldInfoBefore');
      const msg = buildMessage('system', lb, 'worldInfoBefore');
      if (msg) stages.get('worldInfoBefore')!.push(msg);
      addSection('worldInfoBefore', '世界书（角色定位之前）', 'system', true, lb, 'lorebook', 'worldInfoBefore');
    }
  }
  if (!injected.has('worldInfoD2Before')) {
    const lb = getLorebookContent('worldInfoD2Before');
    if (lb.trim()) {
      injected.add('worldInfoD2Before');
      const msg = buildMessage('system', lb, 'worldInfoD2Before');
      if (msg) stages.get('worldInfoBefore')!.push(msg);
      addSection('worldInfoD2Before', '世界书（D2之前）', 'system', true, lb, 'lorebook', 'worldInfoBefore');
    }
  }

  // worldInfoAfter: inject if not yet placed
  if (!injected.has('worldInfoAfter')) {
    const lb = getLorebookContent('worldInfoAfter');
    if (lb.trim()) {
      injected.add('worldInfoAfter');
      const msg = buildMessage('system', lb, 'worldInfoAfter');
      if (msg) stages.get('worldInfoAfter')!.push(msg);
      addSection('worldInfoAfter', '世界书（角色定位之后）', 'system', true, lb, 'lorebook', 'worldInfoAfter');
    }
  }
  if (!injected.has('worldInfoD2After')) {
    const lb = getLorebookContent('worldInfoD2After');
    if (lb.trim()) {
      injected.add('worldInfoD2After');
      const msg = buildMessage('system', lb, 'worldInfoD2After');
      if (msg) stages.get('worldInfoAfter')!.push(msg);
      addSection('worldInfoD2After', '世界书（D2之后）', 'system', true, lb, 'lorebook', 'worldInfoAfter');
    }
  }

  // ── PHASE 3: Build chat history ──

  const recentHistory = buildRecentHistory(history.slice(0, -1), tokenBudget);
  const chatHistoryStage = stages.get('chatHistory')!;
  chatHistoryStage.pushAll(recentHistory);
  addSection('chatHistory', '对话历史', 'system', true, `[${recentHistory.length} 条]`, 'chat', 'chatHistory');

  // ── PHASE 4: User input ──

  const userMsg = buildMessage('user', userInput, 'userInput');
  if (userMsg) stages.get('userInput')!.push(userMsg);
  addSection('userInput', '用户输入', 'user', true, userInput, 'preset', 'userInput');

  // ── PHASE 5: Flatten stages into message array ──

  const assembledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  const stageMessages: Record<string, { role: 'system' | 'user' | 'assistant'; content: string }[]> = {};

  for (const stageName of PIPELINE_STAGES) {
    const col = stages.get(stageName)!;
    const msgs = col.getMessages();
    if (msgs.length > 0) {
      stageMessages[stageName] = msgs.map(m => ({ role: m.role, content: m.content }));
    }
    for (const msg of msgs) {
      assembledMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // ── PHASE 6: Post-process ──

  // Dedup: remove duplicate content blocks from system messages
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

  // Remove empty messages
  let final = assembledMessages.filter(m => m.content.trim());

  // Squash consecutive system messages
  if (options.squashSystemMessages) {
    const squashed: typeof final = [];
    for (let i = 0; i < final.length; i++) {
      const cur = final[i];
      if (cur.role === 'system' && squashed.length > 0 && squashed[squashed.length - 1].role === 'system') {
        squashed[squashed.length - 1] = {
          ...squashed[squashed.length - 1],
          content: squashed[squashed.length - 1].content + '\n\n' + cur.content,
        };
      } else {
        squashed.push({ ...cur });
      }
    }
    final = squashed;
  }

  // ── PHASE 7: Compute results ──

  const systemPrompt = final
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');

  const totalTokens = Math.round(final.reduce((sum, m) => sum + m.content.length / 4, 0));

  const stageTokens: Record<string, number> = {};
  for (const [name, col] of stages) {
    stageTokens[name] = col.tokenCount;
  }

  return { messages: final, systemPrompt, sections, totalTokens, stageTokens, stageMessages };
}

// ── History builder ──

function buildRecentHistory(
  history: ChatMessage[],
  budget: number = 3000,
): Message[] {
  let tokenBudget = budget;
  const recent: Message[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'system') continue;
    const t = Math.round(msg.content.length / 4);
    if (tokenBudget - t < 0) break;
    recent.unshift({ role: msg.role as 'user' | 'assistant', content: msg.content, identifier: msg.id });
    tokenBudget -= t;
  }
  return recent;
}

// ── Public API ──

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
