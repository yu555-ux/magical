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

// ========== Preset Types ==========

export interface PresetBlock {
  identifier: string;
  name: string;
  role: 'system' | 'user' | 'assistant';
  enabled: boolean;
  content: string;
}

// ========== Settings Types ==========

export interface AppSettings {
  key?: string;
  api: ApiSettings;
  apiMode: 'single' | 'dual';
  presetBlocks: PresetBlock[];
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
}

export const DEFAULT_TAGS = ['maintext', 'option', 'history', 'vars', 'thinking', 'think'] as const;
export const DEFAULT_OPAQUE_TAGS = ['thinking', 'think'] as const;

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
<history>日期|标题|地点|登场角色|剧情概要|人际关系变化|剧情标签</history>
<option>1|选项一</option>
<option>2|选项二</option>

规则：
- 每个标签必须单独成行，不能嵌套
- 叙事要生动，注重细节和环境描写
- 推进剧情的同时更新vars标签中的变量状态
- history标签使用|分隔各字段，记录关键剧情节点
- option标签提供2-5个玩家可选的行动方向`,
  },
  {
    identifier: 'charDescription',
    name: 'AI角色描述',
    role: 'system',
    enabled: false,
    content: '你是{{char}}，一个存在于梦境与现实交界处的存在。你拥有丰富的知识和敏锐的洞察力，能够引导{{user}}探索这个充满异常的世界。',
  },
  {
    identifier: 'scenario',
    name: '场景设定',
    role: 'system',
    enabled: false,
    content: '故事发生在一个看似普通的世界，但当{{user}}入睡后，会进入一个与现实对应的梦境世界。梦境中充满了各种异常和危险，但也隐藏着改变现实的力量。',
  },
  {
    identifier: 'personaDescription',
    name: '玩家人设',
    role: 'system',
    enabled: false,
    content: '{{user}}是一名普通的高三学生，拥有"梦境行走"的特殊能力。在现实世界中，{{user}}面临着学业压力和复杂的人际关系；在梦境世界中，{{user}}需要探索未知、对抗异常、保护自己和身边的人。',
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
  userName: '用户',
  characterName: 'AI',
  theme: 'dark',
  language: 'zh',
  autoSave: true,
  autoSaveInterval: 30,
  uiMode: 'game',
  customTags: ['maintext', 'option', 'history', 'vars', 'thinking', 'think'],
  thinkingDisplay: 'fold',
};

// ========== Chat Types ==========

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  parsed?: ParsedTags;
  variablesAfter?: Record<string, any>;
  apiUsed?: ApiTarget;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  characterName: string;
  userName: string;
  variables: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

// ========== v3 Game Mode Types ==========

export interface SavePoint {
  date: string;
  title: string;
  location: string;
  characters: string;
  description: string;
  relationships: string;
  tags: string[];
  importantInfo: string;
  hiddenClues: string;
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

export interface VarsPatch {
  merge: Record<string, any>;
}

export type Task = 'story' | 'summary' | 'vars';
export type ApiTarget = 'primary' | 'secondary' | 'dual';
