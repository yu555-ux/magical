/**
 * Variable change application — apply parsed tags to chat variables,
 * auto-tag dream items, build change diffs for UI.
 */

import type { ParsedTags, VarChange } from './types';
import { applyVarsPatch, applyJsonPatch } from './vars-merger';
import { normalizeLocations } from './var-map';
import { clampVariableRanges } from './var-clamp';

export function applyParsedToChat(
  current: Record<string, any>,
  parsed: ParsedTags,
): { nextVariables: Record<string, any>; snapshot: Record<string, any> } {
  // Preserve old countdown — AI is not allowed to modify it
  const oldCountdown = current?.['世界']?.['倒计时']
    ? JSON.parse(JSON.stringify(current['世界']['倒计时']))
    : {};

  const next = parsed.varsCommands.patches?.length
    ? applyJsonPatch(current, parsed.varsCommands.patches)
    : applyVarsPatch(current, parsed.varsCommands);

  // Restore old countdown — any AI write is discarded
  if (next['世界'] && Object.keys(oldCountdown).length > 0) {
    next['世界']['倒计时'] = oldCountdown;
  } else if (next['世界'] && Object.keys(oldCountdown).length === 0) {
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

// ========== dream item auto-tagging ==========

/**
 * Detect AI-added items and auto-tag 梦境物品 field.
 * Uses old vars' plane state (context at narration time).
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

// ========== Variable change diff for UI notification ==========

function pathLabel(path: string): string {
  const parts = path.split('.');
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
  return last
    .replace(/好感值/g, '好感值').replace(/堕落值/g, '堕落值').replace(/性欲值/g, '性欲值')
    .replace(/友善值/g, '友善值').replace(/蝶烬/g, '蝶烬').replace(/尸气/g, '尸气')
    .replace(/生命/g, '生命').replace(/SAN/g, 'SAN').replace(/能量/g, '能量')
    .replace(/当前位置/g, '位置').replace(/当前行动/g, '行动').replace(/当前想法/g, '想法')
    .replace(/地点/g, '地点').replace(/天气/g, '天气').replace(/时间/g, '时间')
    .replace(/具现进度/g, '具现进度');
}

export function buildVarChanges(
  preVars: Record<string, any>,
  nextVars: Record<string, any>,
): VarChange[] {
  const changes: VarChange[] = [];

  function walk(pre: any, next: any, path: string) {
    if (pre === next) return;

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

    if (next === undefined || next === null) {
      changes.push({ path, op: 'remove', category: 'remove', label: pathLabel(path) });
      return;
    }

    if (typeof pre === 'number' && typeof next === 'number') {
      changes.push({
        path, op: 'replace', category: 'numeric',
        label: pathLabel(path), oldValue: pre, newValue: next, delta: next - pre,
      });
      return;
    }

    if (typeof pre === 'string' || typeof next === 'string') {
      changes.push({
        path, op: 'replace', category: 'text',
        label: pathLabel(path), oldValue: pre, newValue: next,
      });
      return;
    }

    if (Array.isArray(pre) || Array.isArray(next)) {
      if (JSON.stringify(pre) !== JSON.stringify(next)) {
        changes.push({
          path, op: 'replace', category: 'text',
          label: pathLabel(path), oldValue: pre, newValue: next,
        });
      }
      return;
    }

    if (typeof pre === 'object' && typeof next === 'object') {
      const allKeys = new Set([...Object.keys(pre ?? {}), ...Object.keys(next ?? {})]);
      for (const k of allKeys) {
        walk(pre?.[k], next?.[k], path ? `${path}.${k}` : k);
      }
    } else {
      changes.push({
        path, op: 'replace', category: 'text',
        label: pathLabel(path), oldValue: pre, newValue: next,
      });
    }
  }

  walk(preVars, nextVars, '');
  return changes;
}
