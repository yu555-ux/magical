import { DEFAULT_PRESET_BLOCKS } from './default-preset-blocks';

export { DEFAULT_PRESET_BLOCKS };

// ========== API Types ==========

export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  secondary?: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** Agent 模式配置 */
  agentMode?: boolean;
  /** Agent 模式启用的工具名称列表。空数组 = 不启用 Agent 模式 */
  enabledTools?: string[];
  /** Agent 模式每轮最大 tool loop 次数 */
  maxTurnsPerMessage?: number;
  /** Agent 模式缓存控制策略 */
  cacheControl?: 'auto' | 'enabled' | 'disabled';
}

// ========== Lorebook (World Book) Types ==========

/** ST position → preset injection anchor */
export const LOREBOOK_POSITION_MAP: Record<number, string> = {
  0: 'worldInfoBefore',      // before_char → 角色定义之前
  1: 'worldInfoAfter',       // after_char → 角色定义之后
  2: 'worldInfoD2Before',    // before_example → D2之前 (@D_before)
  3: 'worldInfoD2After',     // after_example → D2之后 (@D_after)
  4: 'worldInfoD2After',     // at_depth → 深度设定，走D2之后
  5: 'worldInfoAfter',       // example_msg_top → 回退
  6: 'worldInfoAfter',       // example_msg_bottom → 回退
  7: 'worldInfoAfter',       // outlet → 回退
};

/** Preset block identifiers that act as lorebook injection anchors */
export const INJECTION_ANCHORS = [
  'worldInfoBefore',
  'worldInfoAfter',
  'worldInfoD2Before',
  'worldInfoD2After',
] as const;

export type InjectionAnchor = (typeof INJECTION_ANCHORS)[number];

/** Detection rules for matching preset blocks to injection anchors */
export interface AnchorDetectionRule {
  anchor: InjectionAnchor;
  /** Block identifier matches (case-insensitive) */
  idPatterns: string[];
  /** Block name contains any of these (case-insensitive) */
  namePatterns: string[];
  /** Block content contains any of these markers */
  contentMarkers: string[];
  /** Display label for the anchor */
  label: string;
}

export const INJECTION_ANCHOR_RULES: AnchorDetectionRule[] = [
  {
    anchor: 'worldInfoBefore',
    idPatterns: ['worldinfobefore'],
    namePatterns: ['角色定位之前', '角色前', '角色定义之前', 'world info (before)'],
    contentMarkers: [],
    label: '角色定位之前',
  },
  {
    anchor: 'worldInfoAfter',
    idPatterns: ['worldinfoafter'],
    namePatterns: ['角色定位之后', '角色后', '角色定义之后', 'world info (after)'],
    contentMarkers: [],
    label: '角色定位之后',
  },
  {
    anchor: 'worldInfoD2Before',
    idPatterns: ['worldinfod2before'],
    namePatterns: ['d2之前', 'd2 before'],
    contentMarkers: ['<|@D_before|>'],
    label: 'D2之前',
  },
  {
    anchor: 'worldInfoD2After',
    idPatterns: ['worldinfod2after'],
    namePatterns: ['d2之后', 'd2 after'],
    contentMarkers: ['<|@D_after|>'],
    label: 'D2之后',
  },
];

export interface LorebookEntry {
  id: string;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  comment: string;
  enabled: boolean;
  position: number;
  order: number;
  constant: boolean;
  depth: number;
  selective: boolean;
  selectiveLogic: number;     // 0=AND, 1=OR
  excludeRecursion: boolean;  // content won't be scanned for further matches
  preventRecursion: boolean;  // won't be triggered by recursive scanning
  probability: number;        // trigger probability 0-100
  useProbability: boolean;    // whether to use probability
}

export interface Lorebook {
  id: string;
  name: string;
  entries: LorebookEntry[];
  recursive: boolean;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  createdAt: number;
}

// ========== Preset Types ==========

export interface PresetBlock {
  identifier: string;
  name: string;
  role: 'system' | 'user' | 'assistant';
  enabled: boolean;
  content: string;
  /** 0=RELATIVE (default), 1=ABSOLUTE, 2=ATTACH_EXISTING */
  injection_position?: number;
  /** Depth in chat history for ABSOLUTE injection */
  injection_depth?: number;
  /** Sort key within same depth for ABSOLUTE injection */
  injection_order?: number;
  /** Gen-type triggers: ['story','continue','impersonate','cycle'] */
  injection_trigger?: string[];
  /** Structural marker block (e.g. chatHistory) — content is not editable */
  marker?: boolean;
  /** Prevent character card from overriding this block */
  forbid_overrides?: boolean;
  /** ATTACH_EXISTING: target message role */
  attach_role?: 'system' | 'user' | 'assistant';
  /** ATTACH_EXISTING: 1-based message index */
  attach_index?: number;
  /** ATTACH_EXISTING: prepend or append */
  attach_side?: 'start' | 'end';
}

export const INJECTION_POSITION = {
  RELATIVE: 0,
  ABSOLUTE: 1,
  ATTACH_EXISTING: 2,
} as const;

export type InjectionPosition = (typeof INJECTION_POSITION)[keyof typeof INJECTION_POSITION];

export const INJECTION_TRIGGER_OPTIONS = ['story', 'continue', 'impersonate', 'cycle'] as const;
export type InjectionTrigger = (typeof INJECTION_TRIGGER_OPTIONS)[number];

// ========== Preset Parameters ==========

/** Sampling + context + template parameters extracted from a ST preset JSON */
export interface PresetParams {
  // Sampling
  temperature: number;
  frequency_penalty: number;
  presence_penalty: number;
  top_p: number;
  top_k: number;
  top_a: number;
  min_p: number;
  repetition_penalty: number;
  // Context
  openai_max_context: number;
  openai_max_tokens: number;
  // Options
  stream_openai: boolean;
  wrap_in_quotes: boolean;
  names_behavior: number;
  max_context_unlocked: boolean;
  // Templates
  impersonation_prompt: string;
  new_chat_prompt: string;
  new_group_chat_prompt: string;
  new_example_chat_prompt: string;
  continue_nudge_prompt: string;
  group_nudge_prompt: string;
  wi_format: string;
  scenario_format: string;
  personality_format: string;
  send_if_empty: string;
  bias_preset_selected: string;
}

export const DEFAULT_PRESET_PARAMS: PresetParams = {
  temperature: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  top_p: 0.9,
  top_k: 500,
  top_a: 0,
  min_p: 0,
  repetition_penalty: 1,
  openai_max_context: 2000000,
  openai_max_tokens: 64000,
  stream_openai: true,
  wrap_in_quotes: false,
  names_behavior: 0,
  max_context_unlocked: true,
  impersonation_prompt: "[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't describe actions of {{char}}.]",
  new_chat_prompt: '',
  new_group_chat_prompt: '[Start a new group chat. Group members: {{group}}]',
  new_example_chat_prompt: '[Example Chat]',
  continue_nudge_prompt: '[Continue your last message without repeating its original content.]',
  group_nudge_prompt: '[Write the next reply only as {{char}}.]',
  wi_format: '{0}',
  scenario_format: '{{scenario}}',
  personality_format: '{{personality}}',
  send_if_empty: '',
  bias_preset_selected: 'Default (none)',
};

// ========== Frontend / Rich Text Types ==========

export interface RichTextSymbolConfig {
  enabled: boolean;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface RichTextConfig {
  quotes: RichTextSymbolConfig;
  cornerBrackets: RichTextSymbolConfig;   // 【】
  angleBrackets: RichTextSymbolConfig;    // 「」
  italic: RichTextSymbolConfig;           // *text*
  bold: RichTextSymbolConfig;             // **text**
}

export const DEFAULT_RICH_TEXT_CONFIG: RichTextConfig = {
  quotes:           { enabled: false, color: '#a78bfa', bold: false, italic: true },
  cornerBrackets:   { enabled: true,  color: '#00f2ff', bold: true,  italic: false },
  angleBrackets:    { enabled: true,  color: '#f0a43c', bold: false, italic: false },
  italic:           { enabled: true,  color: '#ffffff', bold: false, italic: true },
  bold:             { enabled: true,  color: '#ffffff', bold: true,  italic: false },
};

// ========== Settings Types ==========

export interface SavedPreset {
  id: string;
  name: string;
  source?: string;
  description?: string;
  type: 'story' | 'vars';
  blocks: PresetBlock[];
  params?: PresetParams;
  createdAt: number;
}

export interface AppSettings {
  key?: string;
  api: ApiSettings;
  apiMode: 'single' | 'dual';
  presetParams?: PresetParams;
  presetBlocks: PresetBlock[];
  presets: SavedPreset[];
  activePresetId: string | null;
  activeVarsPresetId: string | null;
  lorebooks: Lorebook[];
  userName: string;
  characterName: string;
  theme: 'dark' | 'light';
  language: 'zh' | 'en';
  autoSave: boolean;
  autoSaveInterval: number;
  uiMode: 'game' | 'chat';
  customTags: string[];
  thinkingDisplay: 'fold' | 'hide' | 'inline';
  playerTitle?: string;
  playerDescription?: string;
  characterDescription?: string;
  scenario?: string;
  /** Merge consecutive system messages into one */
  squashSystemMessages: boolean;
  /** Frontend: message area width percentage (50-100) */
  messageWidthPercent: number;
  /** Frontend: rich text symbol formatting config */
  richTextConfig: RichTextConfig;
  /** Frontend: recent message count to include in chat history (0 = unlimited) */
  recentMessageCount: number;
  /** Frontend: process map tree with location filter for {{MAP}} macro */
  useProcessedMap: boolean;
  /** Frontend: process character groups with location filter for character macros */
  useProcessedCharacters: boolean;
  /** Agent 模式开关（默认 false） */
  agentMode: boolean;
}

export const DEFAULT_TAGS = ['maintext', 'option', 'history', 'vars', 'thinking', 'think', 'Analysis', 'JSONPatch'] as const;
export const DEFAULT_OPAQUE_TAGS = ['thinking', 'think', 'Analysis'] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  api: {
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-v4-flash',
    timeout: 60000,
    secondary: { enabled: true, baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-v4-flash', temperature: 0.7, maxTokens: 8000 },
    agentMode: false,
    enabledTools: [
      'get_status', 'lookup_character', 'lookup_location', 'lookup_world',
      'pipeline_phase', 'end_phase', 'roll_dice', 'finish_reply',
      'plan_reply', 'draft_maintext', 'review_draft', 'revise_draft',
      'update_resource', 'advance_time', 'change_location', 'change_weather', 'toggle_dream',
      'commit_turn', 'update_map',
      'add_condition', 'remove_condition', 'update_social',
      'upsert_actor', 'update_ability', 'update_outfit', 'update_body_development', 'update_npc_info',
      'add_item', 'remove_item',
    ],
    maxTurnsPerMessage: 20,
    cacheControl: 'auto',
  },
  apiMode: 'dual',
  presetBlocks: DEFAULT_PRESET_BLOCKS,
  presets: [],
  activePresetId: null,
  activeVarsPresetId: null,
  lorebooks: [],
  userName: '周清玉',
  characterName: 'AI',
  theme: 'dark',
  language: 'zh',
  autoSave: true,
  autoSaveInterval: 30,
  uiMode: 'game',
  customTags: ['maintext', 'option', 'history', 'vars', 'thinking', 'think'],
  thinkingDisplay: 'fold',
  squashSystemMessages: false,
  messageWidthPercent: 90,
  richTextConfig: DEFAULT_RICH_TEXT_CONFIG,
  recentMessageCount: 0,
  useProcessedMap: true,
  useProcessedCharacters: true,
  agentMode: false,
};

// ========== Chat Types ==========

// ── Dream anchor for code-managed countdowns ──

export interface DreamAnchor {
  /** 世界.现实.时间 at the moment the player last woke from a dream */
  lastWokeAt?: string;
  /** 世界.梦境存档.时间 at the moment the player last entered a dream */
  lastEnteredAt?: string;
}

export interface VarChange {
  path: string;
  op: 'replace' | 'add' | 'remove';
  category: 'numeric' | 'text' | 'add' | 'remove';
  label: string;
  oldValue?: any;
  newValue?: any;
  delta?: number;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  parsed?: ParsedTags;
  variablesAfter?: Record<string, any>;
  dreamAnchorAfter?: DreamAnchor;
  plotHistoryAfter?: HistoryTimeline;
  apiUsed?: ApiTarget;
  varChanges?: VarChange[];
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  characterName: string;
  userName: string;
  variables: Record<string, any>;
  plotHistory?: HistoryTimeline;
  dreamAnchor?: DreamAnchor;
  createdAt: number;
  updatedAt: number;
}

// ========== v3 Game Mode Types ==========

export interface SavePoint {
  sequence: number;
  title: string;
  world: string;
  date: string;
  location: string;
  characters: string;
  description: string;
  keyInfo: string[];
  foreshadowing: string[];
}

export interface HistoryTimeline {
  reality: SavePoint[];
  dream: SavePoint[];
}

export interface ParsedTags {
  thinking: string;
  maintext: string;
  options: string[];
  history: SavePoint | null;
  varsRaw: string;
  varsCommands: VarsPatch;
  unknown: Record<string, string>;
}

export interface JsonPatchOp {
  op: 'replace' | 'delta' | 'insert' | 'remove';
  path: string;
  value?: any;
}

export interface VarsPatch {
  merge: Record<string, any>;
  patches?: JsonPatchOp[];
}

export type Task = 'story' | 'summary' | 'vars';
export type ApiTarget = 'primary' | 'secondary' | 'dual';

// ========== Cache Monitor Types ==========

export interface PromptMessage {
  role: string;
  /** 仅存储前 200 字用于列表预览，完整内容通过 requestId 查询 */
  preview: string;
  charCount: number;
}

export interface CacheUsageRecord {
  requestId: string;
  timestamp: number;
  model: string;
  chatId: string;
  /** 缓存命中 tokens */
  hit: number;
  /** 缓存未命中 tokens */
  miss: number;
  /** 总 prompt tokens */
  total: number;
  /** 命中率 0-100 */
  hitRate: number;
  /** 估算费用（元） */
  cost: number;
  /** 生成 tokens */
  generated: number;
  /** 请求消息摘要列表（用于 diff 选择） */
  messages?: PromptMessage[];
  /** 总字符数 */
  totalChars?: number;
  /** 本轮玩家输入（用于快速识别请求） */
  userInput?: string;
  /** Agent 模式：同一次用户回复的所有 turn 共享同一个 groupId */
  replyGroupId?: string;
}

// ========== Agent Types ==========

/** 工具执行记录 */
export interface ToolExecutionRecord {
  /** 工具调用唯一 ID（来自 LLM tool_call.id） */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具显示名（中文） */
  label: string;
  /** LLM 传入的参数 JSON */
  arguments: string;
  /** 执行结果文本 */
  result: string;
  /** 是否执行出错 */
  isError: boolean;
  /** 执行耗时 ms */
  duration: number;
}

/** Agent tool loop 事件 */
export type AgentStreamEvent =
  | { type: 'text_start' }
  | { type: 'text_delta'; chunk: string }
  | { type: 'text_end' }
  | { type: 'thinking_start' }
  | { type: 'thinking_delta'; chunk: string }
  | { type: 'thinking_end' }
  | { type: 'toolcall_start'; id: string; name: string }
  | { type: 'toolcall_delta'; id: string; argumentsChunk: string }
  | { type: 'toolcall_end'; id: string; name: string; arguments: string }
  | { type: 'tool_result'; record: ToolExecutionRecord }
  | { type: 'turn_usage'; hit: number; miss: number; generated: number; turnIndex: number }
  | { type: 'done'; text: string; thinking: string }
  | { type: 'error'; message: string };

/** Agent 单轮 turn 结果 */
export interface AgentTurnResult {
  /** 累积的叙事文本 */
  text: string;
  /** thinking 内容 */
  thinking: string;
  /** 本轮执行的工具调用 */
  toolCalls: ToolExecutionRecord[];
  /** Turn 编号（从 1 开始） */
  turnIndex: number;
}

// ── OpenAI-compatible message types for agent loop ──

/** Tool call block within an assistant message */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** Assistant message that may contain tool_calls */
export interface OpenAIAssistantMessage {
  role: 'assistant';
  content?: string;
  tool_calls?: OpenAIToolCall[];
}

/** Tool result message */
export interface OpenAIToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

/** Union of all message types that can appear in the agent loop context */
export type OpenAIContextMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | OpenAIAssistantMessage
  | OpenAIToolMessage;
