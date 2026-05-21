/**
 * Chaoxi / SillyTavern preset adapter
 * Converts imported preset JSON to PresetBlock[]
 *
 * Real Chaoxi preset format (as used by 三明月/类脑社区):
 *   { temperature, ..., prompts: [{ identifier, name, enabled, role, content }, ...], regex: [...] }
 *
 * Other supported formats:
 *   - Standard ST: { settings: { prompt_order: [...], prompts: [...] } }
 *   - Character card: { data: { prompt_order: {...}, prompts: [...] } }
 */
import type { PresetBlock } from './types';

interface RawPromptEntry {
  identifier: string;
  name?: string;
  role?: string;
  enabled?: boolean;
  content?: string;
  system_prompt?: boolean;
  marker?: boolean;
  forbid_overrides?: boolean;
  injection_position?: number;
  injection_depth?: number;
  injection_order?: number;
  injection_trigger?: string[];
}

export interface ImportResult {
  blocks: PresetBlock[];
  name: string;
  description: string;
  source: 'prompts' | 'prompt_order';
}

export function importPresetFromJson(raw: Record<string, any>): ImportResult {
  // Step 1: Unwrap nesting layers
  const settings = raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings)
    ? raw.settings
    : null;
  const cardData = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? raw.data
    : null;
  const merged = { ...raw, ...(settings ?? {}), ...(cardData ?? {}) };

  // Step 2: Detect preset structure
  const hasPromptsArray = Array.isArray(merged.prompts) && merged.prompts.length > 0;
  const hasPromptOrder = Array.isArray(merged.prompt_order) ||
    (merged.prompt_order && !Array.isArray(merged.prompt_order) && Array.isArray(merged.prompt_order.order));

  let blocks: PresetBlock[] = [];
  let source: ImportResult['source'] = 'prompts';

  if (hasPromptsArray) {
    // ── Chaoxi/ST native format: prompts[] array ──
    const prompts: RawPromptEntry[] = merged.prompts;
    blocks = prompts
      .filter(p => p.identifier)
      .map(p => ({
        identifier: p.identifier,
        name: p.name || p.identifier,
        role: (p.role === 'user' || p.role === 'assistant' || p.role === 'system')
          ? p.role as PresetBlock['role']
          : 'system' as const,
        enabled: p.enabled !== false,
        content: p.content || '',
      }));
    source = 'prompts';
  } else if (hasPromptOrder) {
    // ── Legacy ST format: prompt_order + separate content ──
    let order: any[] = [];
    if (Array.isArray(merged.prompt_order)) {
      order = merged.prompt_order;
    } else if (merged.prompt_order?.order) {
      order = merged.prompt_order.order;
    }
    const prompts: RawPromptEntry[] = Array.isArray(merged.prompts) ? merged.prompts : [];
    blocks = order.map((item: any) => {
      let content = item.content?.trim() || '';
      if (!content) {
        const matched = prompts.find((p: any) => p.identifier === item.identifier);
        if (matched?.content?.trim()) content = matched.content;
      }
      return {
        identifier: item.identifier,
        name: item.name || item.identifier,
        role: (item.role === 'user' || item.role === 'assistant' || item.role === 'system')
          ? item.role as PresetBlock['role']
          : 'system' as const,
        enabled: item.enabled !== false,
        content,
      };
    });
    source = 'prompt_order';
  }

  const name = merged.name || merged.preset || '导入的预设';
  const description = merged.description || '';

  return { blocks, name, description, source };
}
