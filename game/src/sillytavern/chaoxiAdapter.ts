/**
 * Chaoxi / SillyTavern preset adapter
 * Converts imported preset JSON to PresetBlock[]
 */
import type { PresetBlock } from './types';

interface PromptOrderEntry {
  identifier: string;
  name?: string;
  role?: 'system' | 'user' | 'assistant';
  enabled?: boolean;
  content?: string;
}

interface PromptEntry {
  identifier: string;
  role?: 'system' | 'user' | 'assistant';
  content?: string;
  name?: string;
}

interface ImportedPresetData {
  name?: string;
  description?: string;
  settings?: Record<string, any>;
  prompt_order?: PromptOrderEntry[] | { character_id: string; order: PromptOrderEntry[] };
  prompts?: PromptEntry[];
  data?: {
    prompt_order?: PromptOrderEntry[] | { character_id: string; order: PromptOrderEntry[] };
    prompts?: PromptEntry[];
  };
  character_description?: string;
  character_personality?: string;
  scenario?: string;
  persona_description?: string;
  dialogue_examples?: string;
  [key: string]: any;
}

export interface ImportResult {
  blocks: PresetBlock[];
  name: string;
  description: string;
}

export function importPresetFromJson(raw: Record<string, any>): ImportResult {
  // Unwrap nested settings
  const inner = raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings)
    ? raw.settings
    : null;

  // Unwrap Chaoxi character card data
  const cardData = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? raw.data
    : null;

  const merged: ImportedPresetData = { ...raw, ...(inner ?? {}), ...(cardData ?? {}) };

  // 1) Extract prompt_order
  let rawPromptOrder: any = merged.prompt_order ?? [];

  // If prompt_order is {character_id, order: [...]}, extract the inner array
  if (rawPromptOrder && !Array.isArray(rawPromptOrder) && rawPromptOrder.order) {
    rawPromptOrder = rawPromptOrder.order;
  }

  const promptOrder: PromptOrderEntry[] = Array.isArray(rawPromptOrder) ? rawPromptOrder : [];

  // 2) Extract prompts array
  const prompts: PromptEntry[] = Array.isArray(merged.prompts) ? merged.prompts : [];

  // 3) Resolve content for each prompt_order entry
  const blocks: PresetBlock[] = promptOrder.map((entry) => {
    const identifier = entry.identifier;
    const name = entry.name || identifier;
    const role: PresetBlock['role'] = entry.role || 'system';
    const enabled = entry.enabled !== false;

    let content = '';

    // a) Entry has inline content
    if (entry.content?.trim()) {
      content = entry.content;
    }
    // b) Look up in prompts array (Chaoxi-style)
    else {
      const matched = prompts.find(p => p.identifier === identifier);
      if (matched?.content?.trim()) {
        content = matched.content;
      }
      // c) Special identifier mappings
      else if (identifier === 'charDescription') {
        content = merged.character_description || '';
      } else if (identifier === 'charPersonality') {
        content = merged.character_personality || '';
      } else if (identifier === 'scenario') {
        content = merged.scenario || '';
      } else if (identifier === 'personaDescription') {
        content = merged.persona_description || '';
      } else if (identifier === 'dialogueExamples') {
        content = merged.dialogue_examples || '';
      }
    }

    return { identifier, name, role, enabled, content };
  });

  const name = merged.name || merged.preset || '导入的预设';
  const description = merged.description || '';

  return { blocks, name, description };
}
