/**
 * Variable System Utilities
 */

import type { ChatSession, ParsedTags, SavePoint } from './types';
import type { ParserEvent } from './stream-parser';
import { parseVarsBlock, applyVarsPatch } from './vars-merger';

export function extractVariables(text: string): { cleanedText: string; updates: Record<string, string | number> } {
  const updates: Record<string, string | number> = {};
  const regex = /<var\s+name="([^"]+)"\s+value="([^"]+)"\s*\/?>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, name, rawValue] = match;
    const num = Number(rawValue);
    updates[name] = Number.isNaN(num) ? rawValue : num;
  }
  const cleanedText = text.replace(regex, '').replace(/\n{2,}/g, '\n').trim();
  return { cleanedText, updates };
}

export function mergeVariables(
  base: Record<string, string | number> = {},
  updates: Record<string, string | number> = {}
): Record<string, string | number> {
  return { ...base, ...updates };
}

export function formatVariablesForPrompt(variables: Record<string, any>): string {
  if (!variables || Object.keys(variables).length === 0) return '';
  const lines: string[] = [];
  treeFormat(variables, lines, 0);
  return `[当前状态]\n${lines.join('\n')}`;
}

function treeFormat(obj: Record<string, any>, lines: string[], depth: number) {
  const indent = '  '.repeat(depth);
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${indent}${key}:`);
      treeFormat(value, lines, depth + 1);
    } else if (Array.isArray(value)) {
      lines.push(`${indent}${key}: [${value.join(', ')}]`);
    } else {
      lines.push(`${indent}${key}: ${value}`);
    }
  }
}

export const USER_ROLE = 'user' as const;

export function truncateChatAt(
  chat: ChatSession,
  index: number,
  variables?: Record<string, string | number>
): ChatSession {
  const truncated = chat.messages.slice(0, index);
  const restoredVars = variables ?? truncated[truncated.length - 1]?.variablesAfter ?? {};
  return { ...chat, messages: truncated, variables: restoredVars, updatedAt: Date.now() };
}

export function branchChat(
  source: ChatSession,
  index: number,
  options: {
    name: string;
    variables?: Record<string, string | number>;
  }
): ChatSession {
  return {
    id: crypto.randomUUID(),
    name: options.name,
    messages: source.messages.slice(0, index + 1).map(m => ({ ...m })),
    characterName: source.characterName,
    userName: source.userName,
    variables: options.variables ?? source.messages[index]?.variablesAfter ?? {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ========== v3: stream parser event aggregation ==========

export function parseHistoryBlock(raw: string): SavePoint | null {
  const parts = raw.trim().split('|');
  if (parts.length < 7) return null;
  return {
    date: parts[0]?.trim() ?? '',
    title: parts[1]?.trim() ?? '',
    location: parts[2]?.trim() ?? '',
    characters: parts[3]?.trim() ?? '',
    description: parts[4]?.trim() ?? '',
    relationships: parts[5]?.trim() ?? '',
    tags: (parts[6]?.split(',') ?? []).map(t => t.trim()).filter(Boolean),
    importantInfo: parts[7]?.trim() ?? '',
    hiddenClues: parts[8]?.trim() ?? '',
  };
}

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
      else if (ev.tag === 'vars') {
        parsed.varsRaw = ev.full;
        parsed.varsCommands = parseVarsBlock(ev.full);
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

import { getDatabase } from './database';

/**
 * Move an item between 仓库 and 主角.持有物品 in the latest chat's variables.
 * @param itemName   — item key name
 * @param category   — '灵宝' | '诡物' | '物品'
 * @param direction  — 'equip' (仓库→持有) or 'unequip' (持有→仓库)
 */
export async function moveItem(
  itemName: string,
  category: string,
  direction: 'equip' | 'unequip',
): Promise<boolean> {
  try {
    const db = getDatabase();
    const chats = await db.chats.toArray();
    const chat = chats[chats.length - 1];
    if (!chat) return false;

    const vars = JSON.parse(JSON.stringify(chat.variables ?? {}));
    const warehouse = vars.仓库 ?? {};
    const held = vars.主角?.持有物品 ?? {};

    const src = direction === 'equip' ? (warehouse[category] ?? {}) : (held[category] ?? {});
    const dst = direction === 'equip' ? (held[category] ?? {}) : (warehouse[category] ?? {});

    if (!src[itemName]) return false;

    // Move item
    dst[itemName] = src[itemName];
    delete src[itemName];

    // Write back
    if (direction === 'equip') {
      vars.仓库 = { ...warehouse, [category]: src };
      vars.主角 = { ...(vars.主角 ?? {}), 持有物品: { ...held, [category]: dst } };
    } else {
      vars.主角 = { ...(vars.主角 ?? {}), 持有物品: { ...held, [category]: src } };
      vars.仓库 = { ...warehouse, [category]: dst };
    }

    await db.chats.put({ ...chat, variables: vars, updatedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

// ========== map path resolution ==========

const MAP_META_KEYS = ['检索词', '方位', '现实', '梦境', '子地图'];

interface PathMatch {
  path: string[];
  priority: number;
  parentMatch: boolean;
}

/**
 * Search the map tree for a location string.
 *
 * When the target contains "-" (e.g. '11号楼-601室'), it is split into
 * parentHint + leafSearch. The leaf is matched exactly against key names
 * or 检索词, and matches whose parent key equals parentHint are preferred.
 *
 * Falls back to full-string fuzzy matching when the leaf isn't found,
 * preserving compatibility with suffix formats like '<user>家-客厅'.
 *
 * Returns the path array from root to the matched node, or null.
 */
export function resolvePath(
  currentLocation: string,
  mapTree: Record<string, any>,
): string[] | null {
  if (!currentLocation || !mapTree) return null;

  // ── parse "xx-xx" format ──
  const segments = currentLocation.split('-');
  const hasParentHint = segments.length >= 2;
  const leafSearch = hasParentHint ? segments[segments.length - 1] : currentLocation;
  const parentHint = hasParentHint ? segments[segments.length - 2] : undefined;

  const matches: PathMatch[] = [];

  function search(node: Record<string, any>, path: string[]): void {
    if (!node || typeof node !== 'object') return;

    const parentKey = path.length > 0 ? path[path.length - 1] : '';

    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;

      if (hasParentHint) {
        // ── split mode: exact match on leaf only ──
        // Priority 1: exact key name match
        if (key === leafSearch) {
          matches.push({ path: [...path, key], priority: 1, parentMatch: parentKey === parentHint });
          continue;
        }

        const terms = child['检索词'];
        if (Array.isArray(terms)) {
          // Priority 2: exact search term match
          if (terms.some((t: string) => t === leafSearch)) {
            matches.push({ path: [...path, key], priority: 2, parentMatch: parentKey === parentHint });
            continue;
          }
        }
      } else {
        // ── normal mode: exact → fuzzy ──
        // Priority 1: exact key name match
        if (key === currentLocation) {
          matches.push({ path: [...path, key], priority: 1, parentMatch: true });
          continue;
        }

        const terms = child['检索词'];
        if (Array.isArray(terms)) {
          // Priority 2: exact search term match
          if (terms.some((t: string) => t === currentLocation)) {
            matches.push({ path: [...path, key], priority: 2, parentMatch: true });
            continue;
          }
          // Priority 3: fuzzy search term match
          if (terms.some((t: string) => t.includes(currentLocation) || currentLocation.includes(t))) {
            matches.push({ path: [...path, key], priority: 3, parentMatch: true });
            continue;
          }
        }

        // Priority 4: fuzzy key name match
        if (key.includes(currentLocation) || currentLocation.includes(key)) {
          matches.push({ path: [...path, key], priority: 4, parentMatch: true });
          continue;
        }
      }
    }

    // Recurse into sub-maps
    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;
      const subMap = child['子地图'];
      if (subMap && typeof subMap === 'object') {
        search(subMap, [...path, key]);
      }
    }
  }

  search(mapTree, []);

  // ── split mode: fallback to full-string fuzzy if leaf not found ──
  if (hasParentHint && matches.length === 0) {
    return resolvePathFallback(currentLocation, mapTree);
  }

  if (matches.length === 0) return null;

  // Sort: parentMatch first, then by priority
  matches.sort((a, b) => {
    if (a.parentMatch !== b.parentMatch) return a.parentMatch ? -1 : 1;
    return a.priority - b.priority;
  });

  return matches[0].path;
}

/** Fallback: full-string fuzzy matching for suffix formats like '<user>家-客厅' */
function resolvePathFallback(
  target: string,
  mapTree: Record<string, any>,
): string[] | null {
  const matches: PathMatch[] = [];

  function search(node: Record<string, any>, path: string[]): void {
    if (!node || typeof node !== 'object') return;

    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;

      // Priority 2: exact search term match
      const terms = child['检索词'];
      if (Array.isArray(terms)) {
        if (terms.some((t: string) => t === target)) {
          matches.push({ path: [...path, key], priority: 2, parentMatch: true });
          continue;
        }
        // Priority 3: fuzzy
        if (terms.some((t: string) => t.includes(target) || target.includes(t))) {
          matches.push({ path: [...path, key], priority: 3, parentMatch: true });
          continue;
        }
      }

      // Priority 4: fuzzy key name
      if (key.includes(target) || target.includes(key)) {
        matches.push({ path: [...path, key], priority: 4, parentMatch: true });
        continue;
      }
    }

    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;
      const subMap = child['子地图'];
      if (subMap && typeof subMap === 'object') {
        search(subMap, [...path, key]);
      }
    }
  }

  search(mapTree, []);
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.priority - b.priority);
  return matches[0].path;
}

/**
 * Convert an AI-output location string into the parent-leaf concatenated
 * format for variable storage. E.g. '601室' → '11号楼-601室'.
 *
 * Falls back to the original string if the location cannot be resolved.
 */
export function formatLocation(
  raw: string,
  mapTree: Record<string, any>,
): string {
  if (!raw || !mapTree) return raw;
  const path = resolvePath(raw, mapTree);
  if (!path || path.length === 0) return raw;
  if (path.length === 1) return path[0];
  return path[path.length - 2] + '-' + path[path.length - 1];
}

/** Recursively normalize 当前位置 and 地点 string fields to parent-leaf format. */
function normalizeLocations(obj: Record<string, any>, mapTree: Record<string, any>): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if ((key === '当前位置' || key === '地点') && typeof val === 'string' && val.trim()) {
      obj[key] = formatLocation(val, mapTree);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      normalizeLocations(val, mapTree);
    }
  }
}

export function applyParsedToChat(
  current: Record<string, any>,
  parsed: ParsedTags,
): { nextVariables: Record<string, any>; snapshot: Record<string, any> } {
  const next = applyVarsPatch(current, parsed.varsCommands);
  const mapTree = next['地图'];
  if (mapTree) {
    normalizeLocations(next, mapTree);
  }
  const snapshot = JSON.parse(JSON.stringify(next));
  return { nextVariables: next, snapshot };
}
