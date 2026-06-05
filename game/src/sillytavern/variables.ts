/**
 * Variable System Utilities
 */

import type { ParsedTags, SavePoint, VarChange } from './types';
import type { ParserEvent } from './stream-parser';
import { parseVarsBlock, applyVarsPatch, applyJsonPatch } from './vars-merger';

export function formatVariablesForPrompt(variables: Record<string, any>): string {
  if (!variables || Object.keys(variables).length === 0) return '';
  const lines: string[] = [];
  treeFormat(variables, lines, 0);
  return lines.join('\n');
}

function isObj(v: any): v is Record<string, any> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function treeFormat(obj: Record<string, any>, lines: string[], depth: number) {
  const indent = '  '.repeat(depth);
  for (const [key, value] of Object.entries(obj)) {
    if (isObj(value)) {
      lines.push(`${indent}${key}:`);
      treeFormat(value, lines, depth + 1);
    } else if (Array.isArray(value)) {
      if (value.length > 0 && isObj(value[0])) {
        // 对象数组：逐条展示结构
        for (const item of value) {
          if (!isObj(item)) continue;
          const flat = Object.entries(item)
            .map(([k, v]) => `${k}: ${isObj(v) || Array.isArray(v) ? JSON.stringify(v) : v}`)
            .join(', ');
          lines.push(`${indent}${key}:`);
          lines.push(`${indent}  - ${flat}`);
        }
      } else {
        lines.push(`${indent}${key}: [${value.join(', ')}]`);
      }
    } else {
      lines.push(`${indent}${key}: ${value}`);
    }
  }
}

/** 按点分隔路径提取变量子树并格式化为缩进文本 */
export function getVariablePath(variables: Record<string, any>, path: string): string {
  console.log('[GET_VAR] ── 入口 ──');
  console.log('[GET_VAR] 路径:', path);
  console.log('[GET_VAR] variables 是否为 null/undefined:', !variables);
  console.log('[GET_VAR] variables 顶层 keys:', variables ? Object.keys(variables) : '(无)');

  if (!variables || !path) {
    console.log('[GET_VAR] ❌ 提前返回空: variables=' + !!variables + ' path=' + !!path);
    return '无';
  }

  const parts = path.split('.');
  console.log('[GET_VAR] 路径分段:', parts);

  let node: any = variables;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    console.log('[GET_VAR]   step ' + i + ' 查找 key="' + part + '", node 类型=' + typeof node + ', node keys=' + (node && typeof node === 'object' ? Object.keys(node) : '(非对象)'));

    if (!node || typeof node !== 'object') {
      console.log('[GET_VAR] ❌ step ' + i + ' 失败: node 不是有效对象');
      return '无';
    }
    if (!(part in node)) {
      console.log('[GET_VAR] ❌ step ' + i + ' 失败: key "' + part + '" 不存在于 node, 可用 keys=' + Object.keys(node));
      return '无';
    }
    node = node[part];
    console.log('[GET_VAR]   step ' + i + ' 找到, 值类型=' + typeof node + ', 是否为 null=' + (node === null));
  }

  if (node === undefined || node === null) {
    console.log('[GET_VAR] ❌ 最终值为 null/undefined');
    return '无';
  }

  if (typeof node !== 'object') {
    console.log('[GET_VAR] ✅ 标量结果: ' + String(node));
    return String(node);
  }

  const lines: string[] = [];
  treeFormat(node, lines, 1);
  const result = lines.join('\n');
  if (!result) {
    console.log('[GET_VAR] ✅ 子树为空对象, 返回"无"');
    return '无';
  }
  console.log('[GET_VAR] ✅ 子树结果 (' + lines.length + ' 行):\n' + result);
  return result;
}

// ── Variable list (type reference for AI) ──

const SKIP_INTERNAL = new Set(['检索词', '梦境NPC', '方位']);

function leafType(v: any): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'string[]';
  switch (typeof v) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    default: return 'object';
  }
}

export function formatVarsList(variables: Record<string, any>): string {
  if (!variables || Object.keys(variables).length === 0) return '';
  const lines: string[] = [];
  varsListWalk(variables, lines, 0);
  return lines.join('\n');
}

function varsListWalk(obj: Record<string, any>, lines: string[], depth: number): void {
  const indent = '  '.repeat(depth);

  for (const key of Object.keys(obj)) {
    if (SKIP_INTERNAL.has(key)) continue;
    const value = obj[key];

    if (value === null) {
      lines.push(`${indent}${key}: null`);
    } else if (Array.isArray(value)) {
      if (value.length > 0 && isObj(value[0])) {
        // 对象数组：展开内部结构
        lines.push(`${indent}${key}:`);
        varsListWalk(value[0], lines, depth + 1);
      } else {
        lines.push(`${indent}${key}: ${leafType(value)}[]`);
      }
    } else if (typeof value === 'object') {
      const visibleKeys = Object.keys(value).filter(k => !SKIP_INTERNAL.has(k));
      if (visibleKeys.length === 0) {
        lines.push(`${indent}${key}: object`);
      } else {
        lines.push(`${indent}${key}:`);
        varsListWalk(value, lines, depth + 1);
      }
    } else {
      lines.push(`${indent}${key}: ${leafType(value)}`);
    }
  }
}

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

    // List item: "- value" or "  - value"
    const listMatch = trimmed.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      const item = listMatch[1].trim();
      if (currentListField) {
        result[currentListField].push(item);
      }
      continue;
    }

    // Key-value: "key: value" or "key:"
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

      // Unknown key — ignore, reset list context
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

    // Plane check: only allow equipping items matching current plane
    if (direction === 'equip') {
      const inDream = vars?.世界?.梦境定位?.位于梦境 === true;
      const isDreamItem = src[itemName]?.梦境物品 === true;
      if ((inDream && !isDreamItem) || (!inDream && isDreamItem)) {
        return false;
      }
    }

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
  if (path.length === 2) return path[0] + '-' + path[1];
  return path[path.length - 3] + '-' + path[path.length - 2] + '-' + path[path.length - 1];
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

/**
 * Auto-unequip items that don't match the current plane.
 * Call after variables change to ensure equipment consistency.
 * - In dream (位于梦境=true): unequip 梦境物品=false items
 * - In reality (位于梦境=false): unequip 梦境物品=true items
 */
export function validateEquipment(vars: Record<string, any>): void {
  const inDream = vars?.世界?.梦境定位?.位于梦境 === true;
  const held = vars?.主角?.持有物品;
  const warehouse = vars?.仓库;
  if (!held || !warehouse) return;

  for (const cat of ['灵宝', '诡物', '物品'] as const) {
    const catHeld = held[cat] ?? {};
    const catWh = warehouse[cat] ?? {};
    for (const [name, item] of Object.entries(catHeld) as [string, any][]) {
      const isDreamItem = item?.梦境物品 === true;
      // Mismatch: dream item in reality, or reality item in dream
      if ((inDream && !isDreamItem) || (!inDream && isDreamItem)) {
        // Move back to warehouse
        if (catWh[name]) {
          catWh[name].数量 = (catWh[name].数量 ?? 0) + (item.数量 ?? 1);
        } else {
          catWh[name] = item;
        }
        delete catHeld[name];
      }
    }
    held[cat] = catHeld;
    warehouse[cat] = catWh;
  }
}

export function applyParsedToChat(
  current: Record<string, any>,
  parsed: ParsedTags,
): { nextVariables: Record<string, any>; snapshot: Record<string, any> } {
  // 快照旧倒计时 — AI 不允许修改倒计时（完全由代码接管）
  const oldCountdown = current?.['世界']?.['倒计时']
    ? JSON.parse(JSON.stringify(current['世界']['倒计时']))
    : {};

  const next = parsed.varsCommands.patches?.length
    ? applyJsonPatch(current, parsed.varsCommands.patches)
    : applyVarsPatch(current, parsed.varsCommands);

  // 恢复旧倒计时 — AI 的任何写入都被丢弃
  if (next['世界'] && Object.keys(oldCountdown).length > 0) {
    next['世界']['倒计时'] = oldCountdown;
  } else if (next['世界'] && Object.keys(oldCountdown).length === 0) {
    // 旧变量中也没有倒计时 → 删除 AI 可能创建的字段
    delete next['世界']['倒计时'];
  }

  const mapTree = next['地图'];
  if (mapTree) {
    normalizeLocations(next, mapTree);
  }
  clampVariableRanges(next);
  const snapshot = JSON.parse(JSON.stringify(next));
  return { nextVariables: next, snapshot };
}

// ========== 梦境物品自动标记 ==========

/**
 * 检测 AI 新增物品并自动标记梦境物品字段。
 * 以旧变量中的位面状态为准（叙事发生时的上下文）。
 * 仅检测主角持有物品和仓库，NPC 不可进入梦境故不处理。
 */
export function autoTagDreamItems(oldVars: Record<string, any>, newVars: Record<string, any>): void {
  const inDream = oldVars?.世界?.梦境定位?.位于梦境 === true;
  tagCategory(oldVars?.主角?.持有物品, newVars?.主角?.持有物品, inDream);
  tagCategory(oldVars?.仓库, newVars?.仓库, inDream);
}

function tagCategory(oldParent: any, newParent: any, isDream: boolean): void {
  if (!newParent) return;
  for (const cat of ['灵宝', '诡物', '物品']) {
    const oldCat = oldParent?.[cat] ?? {};
    const newCat = newParent[cat] ?? {};
    for (const [name, item] of Object.entries(newCat)) {
      if (!oldCat[name] && item && typeof item === 'object' && (item as any).梦境物品 === undefined) {
        (item as any).梦境物品 = isDream;
      }
    }
  }
}

// ========== numeric range clamping ==========

/** Clamp a numeric value to [min, max] and mutate the object in place. */
function clamp(obj: any, key: string, min: number, max: number): boolean {
  const v = obj[key];
  if (typeof v !== 'number') return false;
  if (v < min) { obj[key] = min; return true; }
  if (v > max) { obj[key] = max; return true; }
  return false;
}

/** Recursively walk character/skill trees to clamp 熟练度 to 0~999. */
function clampSkills(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (!val || typeof val !== 'object') continue;
    if (typeof val['熟练度'] === 'number') {
      clamp(val, '熟练度', 0, 999);
    }
    // Recurse into branches
    if (val['分支'] && typeof val['分支'] === 'object') {
      clampSkills(val['分支']);
    }
    // Recurse into nested skill objects (other keys)
    clampSkills(val);
  }
}

/** Recursively walk map anomalies to clamp 具现进度 to 0~100. */
function clampAnomalies(mapNode: any): void {
  if (!mapNode || typeof mapNode !== 'object') return;
  for (const key of Object.keys(mapNode)) {
    const val = mapNode[key];
    if (!val || typeof val !== 'object') continue;
    // Clamp anomaly 具现进度
    if (typeof val['具现进度'] === 'number') {
      clamp(val, '具现进度', 0, 100);
    }
    // Recurse into 子地图, 现实.地点细节.异常, 梦境.地点细节.异常
    if (val['现实']?.地点细节?.异常) clampAnomalies(val['现实'].地点细节.异常);
    if (val['梦境']?.地点细节?.异常) clampAnomalies(val['梦境'].地点细节.异常);
    if (val['子地图']) clampAnomalies(val['子地图']);
    // Walk generic children
    clampAnomalies(val);
  }
}

/** Clamp all documented numeric ranges across the variable tree. */
function clampVariableRanges(vars: Record<string, any>): void {
  if (!vars) return;

  // 1) 主角 body/base/special attributes
  const hero = vars['主角'];
  if (hero) {
    // 身体属性 当前: 0~上限
    const body = hero['身体属性'];
    if (body) {
      for (const stat of ['生命', '体力', '能量', 'SAN']) {
        const s = body[stat];
        if (s && typeof s === 'object') {
          if (typeof s.当前 === 'number') {
            const upper = typeof s.上限 === 'number' ? s.上限 : 100;
            if (s.当前 < 0) s.当前 = 0;
            if (s.当前 > upper) s.当前 = upper;
          }
        }
      }
    }
    // 基础属性 1~100
    const base = hero['基础属性'];
    if (base) for (const k of ['力量', '体质', '精神', '敏捷']) clamp(base, k, 1, 100);
    // 特殊属性 1~100
    const spec = hero['特殊属性'];
    if (spec) for (const k of ['幸运', '魅力']) clamp(spec, k, 1, 100);
    // 技能熟练度
    if (hero['技能']) clampSkills(hero['技能']);
  }

  // 2) All characters under 主要人物
  const chars = vars['主要人物'];
  if (chars) {
    // Female characters
    for (const group of ['异人', '普通人']) {
      const females = chars['女性']?.[group];
      if (females) {
        for (const name of Object.keys(females)) {
          const f = females[name];
          if (!f || typeof f !== 'object') continue;
          clamp(f, '好感值', -200, 200);
          clamp(f, '堕落值', 0, 500);
          clamp(f, '性欲值', 0, 100);
          // Body attributes
          const fBody = f['身体属性'];
          if (fBody) {
            for (const stat of ['生命', '能量', 'SAN']) {
              const s = fBody[stat];
              if (s && typeof s === 'object') {
                if (typeof s.当前 === 'number') {
                  const upper = typeof s.上限 === 'number' ? s.上限 : 100;
                  if (s.当前 < 0) s.当前 = 0;
                  if (s.当前 > upper) s.当前 = upper;
                }
              }
            }
          }
          // Base/special attributes
          const fBase = f['基础属性'];
          if (fBase) for (const k of ['力量', '体质', '精神', '敏捷']) clamp(fBase, k, 1, 100);
          const fSpec = f['特殊属性'];
          if (fSpec) for (const k of ['幸运', '魅力']) clamp(fSpec, k, 1, 100);
          // Skills
          if (f['技能']) clampSkills(f['技能']);
        }
      }
    }
    // Male characters
    for (const group of ['异人', '普通人']) {
      const males = chars['男性']?.[group];
      if (males) {
        for (const name of Object.keys(males)) {
          const m = males[name];
          if (!m || typeof m !== 'object') continue;
          clamp(m, '友善值', -200, 200);
          // Body attributes
          const mBody = m['身体属性'];
          if (mBody) {
            for (const stat of ['生命', 'SAN']) {
              const s = mBody[stat];
              if (s && typeof s === 'object') {
                if (typeof s.当前 === 'number') {
                  const upper = typeof s.上限 === 'number' ? s.上限 : 100;
                  if (s.当前 < 0) s.当前 = 0;
                  if (s.当前 > upper) s.当前 = upper;
                }
              }
            }
          }
          // Base/special attributes
          const mBase = m['基础属性'];
          if (mBase) for (const k of ['力量', '体质', '精神', '敏捷']) clamp(mBase, k, 1, 100);
          const mSpec = m['特殊属性'];
          if (mSpec) for (const k of ['幸运', '魅力']) clamp(mSpec, k, 1, 100);
          // Skills
          if (m['技能']) clampSkills(m['技能']);
        }
      }
    }
  }

  // 3) Map anomalies — clamp 具现进度 0~100
  if (vars['地图']) clampAnomalies(vars['地图']);
}

// ========== Variable change diff for UI notification ==========

function pathLabel(path: string): string {
  const parts = path.split('.');
  // 找有意义的名字段: 跳过结构层(女性/男性/异人/普通人/灵宝/诡物/物品)和顶层(主角/仓库/主要人物/世界/地图)
  const skip = new Set(['主角', '主要人物', '仓库', '世界', '地图', '特殊玩法', '柳三娘商店',
    '女性', '男性', '异人', '普通人', '灵宝', '诡物', '物品', '技能', '分支',
    '身体属性', '基础属性', '特殊属性', '所持物品', '持有物品', '资源', '超凡资源', '金钱']);
  const meaningful = parts.filter(p => !skip.has(p) && !/^\d/.test(p));
  const last = meaningful.length >= 2
    ? `${meaningful[meaningful.length - 2]} · ${meaningful[meaningful.length - 1]}`
    : meaningful.length === 1
      ? meaningful[0]
      : parts.length >= 2
        ? `${parts[parts.length - 2]} · ${parts[parts.length - 1]}`
        : path;
  // 翻译常见字段名
  return last
    .replace(/好感值/g, '好感值')
    .replace(/堕落值/g, '堕落值')
    .replace(/性欲值/g, '性欲值')
    .replace(/友善值/g, '友善值')
    .replace(/蝶烬/g, '蝶烬')
    .replace(/尸气/g, '尸气')
    .replace(/生命/g, '生命')
    .replace(/SAN/g, 'SAN')
    .replace(/能量/g, '能量')
    .replace(/当前位置/g, '位置')
    .replace(/当前行动/g, '行动')
    .replace(/当前想法/g, '想法')
    .replace(/地点/g, '地点')
    .replace(/天气/g, '天气')
    .replace(/时间/g, '时间')
    .replace(/具现进度/g, '具现进度');
}

export function buildVarChanges(
  preVars: Record<string, any>,
  nextVars: Record<string, any>,
): VarChange[] {
  const changes: VarChange[] = [];

  function walk(pre: any, next: any, path: string) {
    if (pre === next) return;

    // 新增
    if (pre === undefined || pre === null) {
      if (next !== undefined && next !== null) {
        changes.push({
          path, op: 'add',
          category: typeof next === 'number' ? 'numeric' : 'add',
          label: pathLabel(path), newValue: next,
        });
      }
      return;
    }

    // 删除
    if (next === undefined || next === null) {
      changes.push({ path, op: 'remove', category: 'remove', label: pathLabel(path) });
      return;
    }

    // 数值变更
    if (typeof pre === 'number' && typeof next === 'number') {
      changes.push({
        path, op: 'replace', category: 'numeric',
        label: pathLabel(path), oldValue: pre, newValue: next, delta: next - pre,
      });
      return;
    }

    // 字符串变更
    if (typeof pre === 'string' || typeof next === 'string') {
      changes.push({
        path, op: 'replace', category: 'text',
        label: pathLabel(path), oldValue: pre, newValue: next,
      });
      return;
    }

    // 数组变更
    if (Array.isArray(pre) || Array.isArray(next)) {
      if (JSON.stringify(pre) !== JSON.stringify(next)) {
        changes.push({
          path, op: 'replace', category: 'text',
          label: pathLabel(path), oldValue: pre, newValue: next,
        });
      }
      return;
    }

    // 对象 → 递归
    if (typeof pre === 'object' && typeof next === 'object') {
      const allKeys = new Set([...Object.keys(pre ?? {}), ...Object.keys(next ?? {})]);
      for (const k of allKeys) {
        walk(pre?.[k], next?.[k], path ? `${path}.${k}` : k);
      }
    } else {
      // 类型变了
      changes.push({
        path, op: 'replace', category: 'text',
        label: pathLabel(path), oldValue: pre, newValue: next,
      });
    }
  }

  walk(preVars, nextVars, '');
  return changes;
}
