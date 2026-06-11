/**
 * Agent 工具注册中心
 *
 * 工具定义遵循 OpenAI function calling 规范。
 * 每个工具的 description 包含"必须调用的场景"和"严禁的行为"，
 * 参考 tavern2agent 的「工具 description 工程」模板。
 *
 * 使用方式：
 *   import { ALL_TOOLS, getEnabledTools } from './registry';
 *   const tools = getEnabledTools(settings.api.enabledTools ?? []);
 */

import type { Lorebook, JsonPatchOp, HistoryTimeline, DreamAnchor, SavePoint } from '../types';
import { scanLorebooks, formatMatchedEntries, type ScanResult } from '../lorebookEngine';
import { parseWorldTime, formatDate, formatDateTime, getDatePart, tickAges, tickAllFemales, type ParsedTime } from '../physiology';
import { isValidRealityWeather, isValidDreamWeather, updateWeatherOnTimeTick } from '../weather';
import { resolvePath, formatLocation } from '../var-map';
import { validateEquipment } from '../var-clamp';
import { injectCountdown } from '../countdown';

// ── Types ──

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details?: any;
}

/** 工具执行上下文 — 由 agent-loop 在运行时提供 */
export interface ToolExecutionContext {
  variables: Record<string, any>;
  lorebooks: Lorebook[];
  plotHistory: HistoryTimeline;
  userInput: string;
  historyText: string;
  /** 梦境锚点（toggle_dream 需要） */
  dreamAnchor: DreamAnchor;
  /** 修改变量（JSON Patch），返回是否成功 */
  patchVariables: (ops: JsonPatchOp[]) => { ok: boolean; error?: string; changes?: Array<{ path: string; oldValue?: any; newValue?: any }> };
  /** 追加剧情历史 */
  appendHistory: (sp: SavePoint) => void;
}

/** 工具分类（前端展示用） */
export type ToolCategory = 'lookup' | 'world' | 'variable' | 'mechanics' | 'deprecated';

export interface AgentToolDef {
  name: string;
  label: string;
  /** 工具分类 */
  category: ToolCategory;
  description: string;
  parameters: Record<string, unknown>;
  execute: (ctx: ToolExecutionContext, params: any) => Promise<ToolResult>;
  /** 默认隐藏（不在工具列表中展示，需手动启用） */
  hidden?: boolean;
}

// ── Shared Helpers ──

/** 构建 ToolResult 的统一出口 */
export function textResult(text: string, details?: any): ToolResult {
  return { content: [{ type: 'text', text }], details };
}

/** 从变量树中查找 NPC */
export function findNpc(vars: Record<string, any>, name: string): { path: string; gender: string; group: string } | null {
  const chars = vars?.['主要人物'];
  if (!chars) return null;
  for (const gender of ['女性', '男性']) {
    for (const group of ['异人', '普通人']) {
      const g = chars[gender]?.[group];
      if (g?.[name]) return { path: `/主要人物/${gender}/${group}/${name}`, gender, group };
    }
  }
  return null;
}

/** 获取 NPC 的指定字段路径 */
export function getNpcPath(vars: Record<string, any>, name: string, field: string): string | null {
  const npc = findNpc(vars, name);
  return npc ? `${npc.path}/${field}` : null;
}

/** 参数校验 */
export function assertString(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${name} 不能为空`);
  return v;
}
export function assertNumber(v: unknown, name: string): number {
  if (typeof v !== 'number' || isNaN(v)) throw new Error(`${name} 必须是数字`);
  return v;
}
export function requireReason(r: unknown): string {
  const s = r as string;
  if (!s || !s.trim()) throw new Error('reason 不能为空');
  return s;
}

/** 数值 Clamp */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

/** 递归搜索地图节点 */
export function findMapNode(node: any, target: string): any | null {
  if (!node || typeof node !== 'object') return null;
  if (node[target]) return node[target];
  for (const key of Object.keys(node)) {
    if (['检索词', '方位', '现实', '梦境', '子地图'].includes(key)) continue;
    const child = node[key];
    if (!child || typeof child !== 'object') continue;
    const terms = child['检索词'];
    if (Array.isArray(terms) && terms.some((t: string) => t === target)) return child;
    if (key === target) return child;
  }
  for (const key of Object.keys(node)) {
    if (['检索词', '方位', '现实', '梦境'].includes(key)) continue;
    const child = node[key];
    if (!child || typeof child !== 'object') continue;
    const sub = child['子地图'];
    if (sub) { const found = findMapNode(sub, target); if (found) return found; }
    const found = findMapNode(child, target);
    if (found) return found;
  }
  return null;
}

/** 获取节点在地图树中的 JSON Pointer 路径 */
export function getNodePath(root: any, target: any): string {
  const keyMap = ['检索词', '方位', '现实', '梦境', '子地图'];
  function search(node: any, p: string): string | null {
    if (!node || typeof node !== 'object') return null;
    if (node === target) return p;
    for (const key of Object.keys(node)) {
      if (keyMap.includes(key)) continue;
      const child = node[key];
      if (child === target) return p + '/' + key;
      if (child && typeof child === 'object') {
        const found = search(child, p + '/' + key);
        if (found) return found;
        const sub = child['子地图'];
        if (sub) { const f2 = search(sub, p + '/' + key + '/子地图'); if (f2) return f2; }
      }
    }
    return null;
  }
  return search(root, '/地图') ?? '/地图';
}

/** 从变量树中按路径读取值 */
export function pathGet(obj: any, p: string): any {
  return p.split('/').filter(Boolean).reduce((o, k) => o?.[k], obj);
}

/** 解析主角资源路径 */
export function resolveHeroResourcePath(resource: string): string | null {
  if (['生命', '体力', '能量', 'SAN'].includes(resource)) return `/主角/身体属性/${resource}/当前`;
  if (resource === '金钱') return '/主角/资源/金钱/数值';
  if (['蝶烬', '尸气'].includes(resource)) return `/主角/资源/超凡资源/${resource}`;
  if (['力量', '体质', '精神', '敏捷'].includes(resource)) return `/主角/基础属性/${resource}`;
  if (['幸运', '魅力'].includes(resource)) return `/主角/特殊属性/${resource}`;
  if (resource === '评级') return '/主角/评级';
  if (resource === '疲软长度') return '/主角/性器/疲软长度';
  if (resource === '勃起长度') return '/主角/性器/勃起长度';
  return null;
}

/** 解析 NPC 资源路径 */
export function resolveNpcResourcePath(vars: Record<string, any>, target: string, resource: string): string | null {
  const npc = findNpc(vars, target);
  if (!npc) return null;
  const b = npc.path;
  if (['生命', '能量', 'SAN'].includes(resource)) return `${b}/身体属性/${resource}/当前`;
  if (resource === '好感值' && npc.gender === '女性') return `${b}/好感值`;
  if (resource === '堕落值' && npc.gender === '女性') return `${b}/堕落值`;
  if (resource === '性欲值' && npc.gender === '女性') return `${b}/性欲值`;
  if (resource === '友善值' && npc.gender === '男性') return `${b}/友善值`;
  if (['力量', '体质', '精神', '敏捷'].includes(resource)) return `${b}/基础属性/${resource}`;
  if (['幸运', '魅力'].includes(resource)) return `${b}/特殊属性/${resource}`;
  return null;
}

/** 解析资源路径（主角或NPC通用） */
export function resolveResourcePath(vars: Record<string, any>, target: string, resource: string): string | null {
  if (target === '主角') return resolveHeroResourcePath(resource);
  return resolveNpcResourcePath(vars, target, resource);
}

/** 获取资源的合理范围（用于 clamp） */
export function getResourceRange(resource: string): { min: number; max: number } | null {
  if (['好感值', '友善值'].includes(resource)) return { min: -200, max: 200 };
  if (resource === '堕落值') return { min: 0, max: 500 };
  if (resource === '性欲值') return { min: 0, max: 100 };
  if (['力量', '体质', '精神', '敏捷', '幸运', '魅力'].includes(resource)) return { min: 1, max: 100 };
  return null; // 身体属性通过上限clamp，超凡/金钱不设限
}
