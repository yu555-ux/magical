/**
 * SillyTavern preset importer
 * Converts imported preset JSON to PresetBlock[]
 *
 * Supported formats:
 *   - ST native: { prompts: [{ identifier, name, enabled, role, content }, ...], ... }
 *   - Legacy ST: { settings: { prompt_order: [...], prompts: [...] } }
 *   - Character card: { data: { prompt_order: {...}, prompts: [...] } }
 */
import type { PresetBlock, PresetParams } from './types';
import { DEFAULT_PRESET_PARAMS } from './types';

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
  params: PresetParams;
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
    // ── ST native format: prompts[] array ──
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
        marker: p.marker ?? undefined,
        forbid_overrides: p.forbid_overrides ?? undefined,
        injection_position: p.injection_position ?? undefined,
        injection_trigger: p.injection_trigger ?? undefined,
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

  const name = merged.name || merged.preset || '';
  const description = merged.description || '';

  // ── Extract preset parameters ──
  const params: PresetParams = {
    temperature: Number(merged.temperature ?? DEFAULT_PRESET_PARAMS.temperature),
    frequency_penalty: Number(merged.frequency_penalty ?? DEFAULT_PRESET_PARAMS.frequency_penalty),
    presence_penalty: Number(merged.presence_penalty ?? DEFAULT_PRESET_PARAMS.presence_penalty),
    top_p: Number(merged.top_p ?? DEFAULT_PRESET_PARAMS.top_p),
    top_k: Number(merged.top_k ?? DEFAULT_PRESET_PARAMS.top_k),
    top_a: Number(merged.top_a ?? DEFAULT_PRESET_PARAMS.top_a),
    min_p: Number(merged.min_p ?? DEFAULT_PRESET_PARAMS.min_p),
    repetition_penalty: Number(merged.repetition_penalty ?? DEFAULT_PRESET_PARAMS.repetition_penalty),
    openai_max_context: Number(merged.openai_max_context ?? DEFAULT_PRESET_PARAMS.openai_max_context),
    openai_max_tokens: Number(merged.openai_max_tokens ?? DEFAULT_PRESET_PARAMS.openai_max_tokens),
    stream_openai: merged.stream_openai ?? DEFAULT_PRESET_PARAMS.stream_openai,
    wrap_in_quotes: merged.wrap_in_quotes ?? DEFAULT_PRESET_PARAMS.wrap_in_quotes,
    names_behavior: Number(merged.names_behavior ?? DEFAULT_PRESET_PARAMS.names_behavior),
    max_context_unlocked: merged.max_context_unlocked ?? DEFAULT_PRESET_PARAMS.max_context_unlocked,
    impersonation_prompt: String(merged.impersonation_prompt ?? DEFAULT_PRESET_PARAMS.impersonation_prompt),
    new_chat_prompt: String(merged.new_chat_prompt ?? DEFAULT_PRESET_PARAMS.new_chat_prompt),
    new_group_chat_prompt: String(merged.new_group_chat_prompt ?? DEFAULT_PRESET_PARAMS.new_group_chat_prompt),
    new_example_chat_prompt: String(merged.new_example_chat_prompt ?? DEFAULT_PRESET_PARAMS.new_example_chat_prompt),
    continue_nudge_prompt: String(merged.continue_nudge_prompt ?? DEFAULT_PRESET_PARAMS.continue_nudge_prompt),
    group_nudge_prompt: String(merged.group_nudge_prompt ?? DEFAULT_PRESET_PARAMS.group_nudge_prompt),
    wi_format: String(merged.wi_format ?? DEFAULT_PRESET_PARAMS.wi_format),
    scenario_format: String(merged.scenario_format ?? DEFAULT_PRESET_PARAMS.scenario_format),
    personality_format: String(merged.personality_format ?? DEFAULT_PRESET_PARAMS.personality_format),
    send_if_empty: String(merged.send_if_empty ?? DEFAULT_PRESET_PARAMS.send_if_empty),
    bias_preset_selected: String(merged.bias_preset_selected ?? DEFAULT_PRESET_PARAMS.bias_preset_selected),
  };

  return { blocks, name, description, source, params };
}
