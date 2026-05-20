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

// ========== Settings Types ==========

export interface AppSettings {
  key?: string;
  api: ApiSettings;
  apiMode: 'single' | 'dual';
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

export const DEFAULT_SETTINGS: AppSettings = {
  api: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    timeout: 60000,
    secondary: { enabled: true, baseUrl: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 8000 },
  },
  apiMode: 'dual',
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
