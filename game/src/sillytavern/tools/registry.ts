/**
 * Agent 工具注册中心 — Barrel 导出
 *
 * 工具定义分布在各分类文件中：
 *   helpers.ts      — 共享工具函数
 *   lookup.ts       — get_status, lookup_world, lookup_location
 *   world.ts        — advance_time, change_location, change_weather, toggle_dream
 *   resource.ts     — update_resource, commit_turn, update_skill
 *   item.ts         — add_item, remove_item
 *   character.ts    — add_condition, remove_condition, update_social
 *   npc.ts          — update_outfit, update_body_development, update_npc_info
 *   map.ts          — update_map
 *   mechanics.ts    — roll_dice, save_point
 *
 * 新增工具：在对应分类文件中添加 → 无需改动本文件
 */

import type { Lorebook, JsonPatchOp, HistoryTimeline, DreamAnchor, SavePoint } from '../types';
import { lookupTools } from './lookup';
import { worldTools } from './world';
import { resourceTools } from './resource';
import { itemTools } from './item';
import { characterTools } from './character';
import { npcTools } from './npc';
import { mapTools } from './map';
import { mechanicTools } from './mechanics';

// ── Types ──

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details?: any;
}

export interface ToolExecutionContext {
  variables: Record<string, any>;
  lorebooks: Lorebook[];
  plotHistory: HistoryTimeline;
  userInput: string;
  historyText: string;
  dreamAnchor: DreamAnchor;
  patchVariables: (ops: JsonPatchOp[]) => { ok: boolean; error?: string; changes?: Array<{ path: string; oldValue?: any; newValue?: any }> };
  appendHistory: (sp: SavePoint) => void;
}

export type ToolCategory = 'lookup' | 'world' | 'variable' | 'mechanics' | 'deprecated';

export interface AgentToolDef {
  name: string;
  label: string;
  category: ToolCategory;
  description: string;
  parameters: Record<string, unknown>;
  execute: (ctx: ToolExecutionContext, params: any) => Promise<ToolResult>;
  hidden?: boolean;
}

// ── 集中注册 ──

export const ALL_TOOL_DEFS: Record<string, AgentToolDef> = {
  ...lookupTools,
  ...worldTools,
  ...resourceTools,
  ...itemTools,
  ...characterTools,
  ...npcTools,
  ...mapTools,
  ...mechanicTools,
};

// ── Public API ──

export const ALL_TOOLS = Object.values(ALL_TOOL_DEFS);

export function getToolByName(name: string): AgentToolDef | undefined {
  return ALL_TOOL_DEFS[name];
}

export function getEnabledTools(names: string[]): AgentToolDef[] {
  return names.map(n => ALL_TOOL_DEFS[n]).filter((t): t is AgentToolDef => t !== undefined);
}

export function getToolsByCategory(filterHidden = true): Record<ToolCategory, AgentToolDef[]> {
  const grouped: Record<ToolCategory, AgentToolDef[]> = { lookup: [], world: [], variable: [], mechanics: [], deprecated: [] };
  for (const tool of ALL_TOOLS) {
    if (filterHidden && tool.hidden) continue;
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  lookup: '🔍 查询', world: '🌍 世界', variable: '📊 变量', mechanics: '🎲 机制', deprecated: '🗑️ 已降级',
};

export function toOpenAITool(def: AgentToolDef): Record<string, unknown> {
  return { type: 'function', function: { name: def.name, description: def.description, parameters: def.parameters } };
}
