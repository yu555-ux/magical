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

/** Sampling + context + template parameters extracted from a Chaoxi/ST preset JSON */
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
}

export interface RichTextConfig {
  quotes: RichTextSymbolConfig;
  cornerBrackets: RichTextSymbolConfig;   // 【】
  angleBrackets: RichTextSymbolConfig;    // 「」
  italic: RichTextSymbolConfig;           // *text*
  bold: RichTextSymbolConfig;             // **text**
}

export const DEFAULT_RICH_TEXT_CONFIG: RichTextConfig = {
  quotes:           { enabled: false, color: '#a78bfa' },
  cornerBrackets:   { enabled: true,  color: '#00f2ff' },
  angleBrackets:    { enabled: true,  color: '#f0a43c' },
  italic:           { enabled: true,  color: '#ffffff' },
  bold:             { enabled: true,  color: '#ffffff' },
};

// ========== Settings Types ==========

export interface SavedPreset {
  id: string;
  name: string;
  source?: string;
  description?: string;
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
}

export const DEFAULT_TAGS = ['maintext', 'option', 'history', 'vars', 'thinking', 'think', 'Analysis', 'JSONPatch'] as const;
export const DEFAULT_OPAQUE_TAGS = ['thinking', 'think', 'Analysis'] as const;

export const DEFAULT_PRESET_BLOCKS: PresetBlock[] = [
  {
    identifier: 'main',
    name: '系统指令',
    role: 'system',
    enabled: true,
    content: `你是一个互动叙事AI。你必须严格按照以下XML格式输出，不要输出任何XML之外的文本：

<thinking>在这里写你的思考过程，角色用第一人称内心独白，叙述者用第三人称分析剧情走向</thinking>
<maintext>在这里写叙事正文，纯文字叙述，禁止使用markdown格式</maintext>
<vars>
{{角色名}}:
  状态: 更新角色当前状态
</vars>
<history>
标题: 剧情节点标题
相关人物: 角色A；角色B
描述: 简要描述发生了什么
关键信息:
  - 关键信息1
伏笔:
- 埋下的伏笔
</history>
<option>1|选项一</option>
<option>2|选项二</option>

规则：
- 每个标签必须单独成行，不能嵌套
- 叙事要生动，注重细节和环境描写
- 推进剧情的同时更新vars标签中的变量状态
- history标签使用YAML风格键值对，记录关键剧情节点。关键信息和伏笔为列表字段
- 序号、世界、日期、地点由系统自动填写，无需手动写出
- option标签提供2-5个玩家可选的行动方向`,
  },
  {
    identifier: 'worldInfoBefore',
    name: '世界书（角色定位之前）',
    role: 'system',
    enabled: true,
    content: '',
  },
  {
    identifier: 'charDescription',
    name: 'AI角色描述',
    role: 'system',
    enabled: false,
    content: '你是{{char}}，一个存在于梦境与现实交界处的存在。',
  },
  {
    identifier: 'scenario',
    name: '场景设定',
    role: 'system',
    enabled: false,
    content: '故事发生在一个看似普通的世界。',
  },
  {
    identifier: 'personaDescription',
    name: '玩家人设',
    role: 'system',
    enabled: false,
    content: '{{user}}是一名普通的高三学生，拥有特殊能力。',
  },
  {
    identifier: 'worldInfoAfter',
    name: '世界书（角色定位之后）',
    role: 'system',
    enabled: true,
    content: '',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  api: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    timeout: 60000,
    secondary: { enabled: true, baseUrl: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 8000 },
  },
  apiMode: 'dual',
  presetBlocks: DEFAULT_PRESET_BLOCKS,
  presets: [],
  activePresetId: null,
  lorebooks: [],
  userName: '用户',
  characterName: 'AI',
  theme: 'dark',
  language: 'zh',
  autoSave: true,
  autoSaveInterval: 30,
  uiMode: 'game',
  customTags: ['maintext', 'option', 'history', 'vars', 'thinking', 'think'],
  thinkingDisplay: 'fold',
  squashSystemMessages: false,
  messageWidthPercent: 80,
  richTextConfig: DEFAULT_RICH_TEXT_CONFIG,
};

// ========== Chat Types ==========

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  parsed?: ParsedTags;
  variablesAfter?: Record<string, any>;
  plotHistoryAfter?: HistoryTimeline;
  apiUsed?: ApiTarget;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  characterName: string;
  userName: string;
  variables: Record<string, any>;
  plotHistory?: HistoryTimeline;
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
