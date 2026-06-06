/**
 * Variable System Utilities — barrel module.
 *
 * Split across:
 *   var-format.ts  — prompt formatting, variable list, path lookup
 *   var-map.ts     — map resolution, item movement, location normalization
 *   var-apply.ts   — parsed tag application, dream tagging, change diff
 *   var-clamp.ts   — equipment validation, numeric range clamping
 */

import type { ParsedTags, SavePoint, VarChange } from './types';
import type { ParserEvent } from './stream-parser';
import { parseVarsBlock } from './vars-merger';

// ── Re-export from sub-modules ──
export { formatVariablesForPrompt, getVariablePath, formatVarsList } from './var-format';
export { moveItem, resolvePath, formatLocation, normalizeLocations } from './var-map';
export { applyParsedToChat, autoTagDreamItems, buildVarChanges } from './var-apply';
export { validateEquipment, clampVariableRanges } from './var-clamp';

// ========== v3: stream parser event aggregation ==========

export function parseHistoryBlock(raw: string): SavePoint | null {
  const result: SavePoint = {
    sequence: 0,
    title: '',
    world: '',
    date: '',
    location: '',
    characters: '',
    description: '',
    keyInfo: [],
    foreshadowing: [],
  };

  const lines = raw.trim().split('\n');
  let currentListField: 'keyInfo' | 'foreshadowing' | null = null;

  const KEY_MAP: Record<string, keyof SavePoint> = {
    '序号': 'sequence',
    '标题': 'title',
    '世界': 'world',
    '日期': 'date',
    '地点': 'location',
    '相关人物': 'characters',
    '描述': 'description',
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { currentListField = null; continue; }

    const listMatch = trimmed.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      const item = listMatch[1].trim();
      if (currentListField) result[currentListField].push(item);
      continue;
    }

    const kvMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      if (key === '关键信息') {
        currentListField = 'keyInfo';
        if (value) result.keyInfo.push(value);
        continue;
      }
      if (key === '伏笔') {
        currentListField = 'foreshadowing';
        if (value) result.foreshadowing.push(value);
        continue;
      }

      const mapped = KEY_MAP[key];
      if (mapped) {
        currentListField = null;
        if (mapped === 'sequence') {
          result.sequence = parseInt(value, 10) || 0;
        } else {
          (result as any)[mapped] = value;
        }
        continue;
      }

      currentListField = null;
    }
  }

  if (!result.title) return null;
  return result;
}

/** Fill 世界/日期/地点 from current game variables, and resolve macros */
export function enrichHistory(sp: SavePoint, variables: Record<string, any>, userName?: string): SavePoint {
  const inDream = variables?.世界?.梦境定位?.位于梦境 === true;
  const source = inDream ? (variables?.世界?.梦境存档 ?? {}) : (variables?.世界?.现实 ?? {});
  const resolve = (s: string) => userName
    ? s.replace(/\{\{user\}\}/g, userName).replace(/<user>/g, userName)
    : s;
  return {
    ...sp,
    world: inDream ? '梦境' : '现实',
    date: (typeof source?.时间 === 'string' ? source.时间.split('-')[0] : '') || '',
    location: resolve(source?.地点 ?? sp.location ?? ''),
    characters: resolve(sp.characters),
    description: resolve(sp.description),
  };
}

/** Format a SavePoint as a YAML-style <history> block string */
export function aggregateEvents(events: ParserEvent[]): ParsedTags {
  const parsed: ParsedTags = {
    thinking: '',
    maintext: '',
    options: [],
    history: null,
    varsRaw: '',
    varsCommands: { merge: {} },
    unknown: {},
  };
  for (const ev of events) {
    if (ev.type === 'tag-close') {
      if (ev.tag === 'thinking' || ev.tag === 'think') parsed.thinking = ev.full;
      else if (ev.tag === 'maintext') parsed.maintext = ev.full;
      else if (ev.tag === 'history') parsed.history = parseHistoryBlock(ev.full);
      else if (ev.tag === 'JSONPatch') parsed.unknown['JSONPatch'] = ev.full;
      else if (ev.tag === 'vars') {
        parsed.varsRaw = ev.full;
        parsed.varsCommands = parseVarsBlock(parsed.unknown['JSONPatch'] || ev.full);
      } else if (ev.tag === 'option') {
        // option-line events accumulate options below
      } else {
        parsed.unknown[ev.tag] = ev.full;
      }
    } else if (ev.type === 'option-line') {
      parsed.options.push(ev.line);
    }
  }
  return parsed;
}
