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

import type { Lorebook, JsonPatchOp, HistoryTimeline, SavePoint } from '../types';
import { scanLorebooks, formatMatchedEntries, type ScanResult } from '../lorebookEngine';

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
  /** 修改变量（JSON Patch），返回是否成功 */
  patchVariables: (ops: JsonPatchOp[]) => { ok: boolean; error?: string; changes?: Array<{ path: string; oldValue?: any; newValue?: any }> };
  /** 追加剧情历史 */
  appendHistory: (sp: SavePoint) => void;
}

export interface AgentToolDef {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (ctx: ToolExecutionContext, params: any) => Promise<ToolResult>;
}

// ── Helpers ──

function pathGet(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function formatVariablesForPrompt(vars: Record<string, any>, prefix = ''): string {
  const lines: string[] = [];
  const keys = Object.keys(vars).filter(k => !k.startsWith('_'));
  for (const key of keys) {
    const val = vars[key];
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      lines.push(`${key}:`);
      lines.push(formatVariablesForPrompt(val, fullPath).split('\n').map(l => `  ${l}`).join('\n'));
    } else if (Array.isArray(val)) {
      lines.push(`${key}: [${val.length} 项]`);
    } else {
      lines.push(`${key}: ${String(val)}`);
    }
  }
  return lines.join('\n');
}

// ── Tools ──

const TOOL_DEFS: Record<string, AgentToolDef> = {

  // ── get_status ──
  get_status: {
    name: 'get_status',
    label: '查看状态',
    description:
      '获取当前游戏状态，包括玩家属性、位置、时间、NPC好感度等。这是了解游戏状态的唯一权威方式。\n\n' +
      '【必须调用的场景】\n' +
      '- 需要知道玩家/NPC当前数值时（HP、好感度、金钱等）\n' +
      '- 需要确认当前地点和时间时\n' +
      '- 玩家询问"我的状态"或"现在怎么样了"时\n' +
      '- 决定下一步行动前，需要确认当前数据时\n\n' +
      '【严禁的行为】\n' +
      '- 凭记忆推测数值——你的内部记忆不可靠\n' +
      '- 在叙事中说"你的HP还剩XX点"但并未调此工具确认',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '可选：JSON Pointer 路径，限定查询范围。如 "/主角/资源" 只返回主角资源。不填返回全部状态。',
        },
      },
      required: [],
    },
    async execute(ctx, params) {
      const path = params?.path as string | undefined;
      const target = path ? pathGet(ctx.variables, path) : ctx.variables;
      if (target === undefined) return { content: [{ type: 'text', text: `路径 ${path} 不存在` }] };
      const text = typeof target === 'object' && !Array.isArray(target)
        ? formatVariablesForPrompt(target as Record<string, any>)
        : JSON.stringify(target, null, 2);
      return { content: [{ type: 'text', text }], details: { path, data: target } };
    },
  },

  // ── patch_state ──
  patch_state: {
    name: 'patch_state',
    label: '修改状态',
    description:
      '通过 JSON Patch (RFC 6902) 修改游戏变量树。这是修改变量的唯一方式。\n\n' +
      '【必须调用的场景】\n' +
      '- 玩家 HP/MP/金钱等数值变化\n' +
      '- NPC 好感度变化\n' +
      '- 地点切换（世界.现实.地点）\n' +
      '- 物品增加/减少/装备\n' +
      '- 任何需要持久记录的状态变化\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中说"好感度+10"但未调此工具——这会导致状态污染\n' +
      '- 自行修改不存在的路径——必须先 get_status 确认路径结构\n' +
      '- op 只能用 replace/add/remove，不支持其他自定义 op',
    parameters: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: 'JSON Patch 操作数组',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['replace', 'add', 'remove'], description: '操作类型' },
              path: { type: 'string', description: 'JSON Pointer 路径，如 /主角/资源/HP' },
              value: { description: '（replace/add 时必填）要设置的值' },
            },
            required: ['op', 'path'],
          },
        },
      },
      required: ['ops'],
    },
    async execute(ctx, params) {
      const ops = params?.ops as JsonPatchOp[] | undefined;
      if (!ops || !Array.isArray(ops) || ops.length === 0) {
        return { content: [{ type: 'text', text: '参数错误：ops 必须是非空数组' }] };
      }
      const result = ctx.patchVariables(ops);
      if (!result.ok) {
        return { content: [{ type: 'text', text: `状态更新失败：${result.error}` }] };
      }
      const lines = result.changes?.map(c =>
        `  ${c.path}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`
      ) ?? [];
      return {
        content: [{ type: 'text', text: `已更新 ${ops.length} 项变量:\n${lines.join('\n')}` }],
        details: { ops, changes: result.changes },
      };
    },
  },

  // ── save_point ──
  save_point: {
    name: 'save_point',
    label: '记录剧情节点',
    description:
      '在剧情历史中记录一个重要的剧情节点（存档点）。用于标记关键事件、章节完成、重大转折。\n\n' +
      '【必须调用的场景】\n' +
      '- 完成一个重要事件或章节时\n' +
      '- 揭示关键信息时\n' +
      '- 玩家做出重大决策时\n' +
      '- NPC 关键对话或转折时\n\n' +
      '【严禁的行为】\n' +
      '- 每轮对话都记录——只在真正重要的节点使用\n' +
      '- 记录与当前剧情无关的推测信息',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '剧情节点标题（简短）' },
        world: { type: 'string', enum: ['现实', '梦境'], description: '发生在现实还是梦境' },
        date: { type: 'string', description: '游戏内日期' },
        location: { type: 'string', description: '发生地点' },
        characters: { type: 'string', description: '相关人物（逗号分隔）' },
        description: { type: 'string', description: '事件简述（2-3 句话）' },
        keyInfo: { type: 'array', items: { type: 'string' }, description: '关键信息列表' },
        foreshadowing: { type: 'array', items: { type: 'string' }, description: '伏笔列表（可选）' },
      },
      required: ['title', 'world', 'date', 'location', 'characters', 'description'],
    },
    async execute(ctx, params) {
      const sp: SavePoint = {
        sequence: 0, // 由 subscriber 自动分配
        title: params.title ?? '',
        world: params.world ?? '现实',
        date: params.date ?? '',
        location: params.location ?? '',
        characters: params.characters ?? '',
        description: params.description ?? '',
        keyInfo: Array.isArray(params.keyInfo) ? params.keyInfo : [],
        foreshadowing: Array.isArray(params.foreshadowing) ? params.foreshadowing : [],
      };
      ctx.appendHistory(sp);
      return {
        content: [{ type: 'text', text: `已记录剧情节点：「${sp.title}」(${sp.world}/${sp.location})` }],
        details: { savePoint: sp },
      };
    },
  },

  // ── roll_dice ──
  roll_dice: {
    name: 'roll_dice',
    label: '掷骰子',
    description:
      '执行掷骰检定。支持 d20/d100 等标准骰子，以及带难度等级(DC)的技能检定。\n\n' +
      '【必须调用的场景】\n' +
      '- 任何需要随机判定的场景（战斗命中、技能检定、幸运判定等）\n' +
      '- 不确定的结果需要通过骰子决定时\n\n' +
      '【严禁的行为】\n' +
      '- 不掷骰就自行判定结果\n' +
      '- 在叙事中编造具体骰子数值\n\n' +
      '【你的职责】\n' +
      '你不是骰子结果的创造者，你是骰子结果的翻译者。此工具返回机械数值，你将数值转为生动的叙事描写。',
    parameters: {
      type: 'object',
      properties: {
        sides: { type: 'number', description: '骰子面数，默认 100', default: 100 },
        count: { type: 'number', description: '掷几个，默认 1', default: 1 },
        dc: { type: 'number', description: '可选：难度等级(DC)，用于判定成功/失败' },
        modifier: { type: 'number', description: '可选：加值（如 +5）', default: 0 },
        label: { type: 'string', description: '检定名称（如"战斗命中""潜行"）' },
      },
      required: [],
    },
    async execute(_ctx, params) {
      const sides = params?.sides ?? 100;
      const count = params?.count ?? 1;
      const dc = params?.dc as number | undefined;
      const modifier = params?.modifier ?? 0;
      const label = params?.label ? `[${params.label}] ` : '';

      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }
      const total = rolls.reduce((a, b) => a + b, 0) + modifier;

      let text = `${label}🎲 d${sides}`;
      if (count > 1) text += ` ×${count}`;
      if (modifier !== 0) text += ` ${modifier > 0 ? '+' : ''}${modifier}`;
      text += ` = ${rolls.join(' + ')}`;
      if (modifier !== 0) text += ` ${modifier > 0 ? '+' : ''}${modifier}`;
      text += ` = **${total}**`;

      if (dc !== undefined) {
        if (total >= dc) {
          text += ` ✅ 成功（DC ${dc}）`;
        } else {
          text += ` ❌ 失败（DC ${dc}）`;
        }
      }

      return { content: [{ type: 'text', text }], details: { rolls, total, dc, modifier } };
    },
  },

  // ── lookup_location ──
  lookup_location: {
    name: 'lookup_location',
    label: '查地点设定',
    description:
      '在世界书（Lorebook）中搜索地点相关的设定条目。这是获取地点权威信息的唯一方式。\n\n' +
      '【必须调用的场景】\n' +
      '- 玩家进入或提及任何城镇/区域/地标\n' +
      '- 需要描述地点环境、氛围、NPC 分布时\n' +
      '- 叙事中第一次出现的新地点\n\n' +
      '【严禁的行为】\n' +
      '- 凭记忆描述地点——你的内部记忆对预设地点的细节不可靠\n' +
      '- 即兴编造地点名——先查索引确认是否存在',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '地点名称关键词' },
      },
      required: ['name'],
    },
    async execute(ctx, params) {
      const name = params?.name as string;
      if (!name) return { content: [{ type: 'text', text: '请提供地点名称' }] };

      // 扫描世界书（结合用户输入和历史上下文）
      const scanResult: ScanResult = scanLorebooks(ctx.lorebooks, name, ctx.historyText);
      const allEntries = Object.values(scanResult.groups).flat();

      if (allEntries.length === 0) {
        return { content: [{ type: 'text', text: `未找到与「${name}」相关的世界书条目。该地点可能尚未定义。` }] };
      }

      // 过滤最匹配的条目（按标题匹配优先）
      const lowerName = name.toLowerCase();
      const matched = allEntries
        .filter(e => {
          const keys = e.entry.keys.map(k => k.toLowerCase());
          return keys.some(k => k.includes(lowerName) || lowerName.includes(k));
        })
        .slice(0, 3);

      if (matched.length === 0) {
        return { content: [{ type: 'text', text: `未找到精确匹配「${name}」的条目，但找到了 ${allEntries.length} 个可能相关的条目。` }] };
      }

      const text = formatMatchedEntries(matched);
      return { content: [{ type: 'text', text }], details: { entries: matched } };
    },
  },
};

// ── Public API ──

/** 所有可用工具的元数据（名称/标签/描述/参数） */
export const ALL_TOOLS = Object.values(TOOL_DEFS);

/** 根据名称查找工具定义 */
export function getToolByName(name: string): AgentToolDef | undefined {
  return TOOL_DEFS[name];
}

/** 根据启用的工具名称列表，返回对应的工具定义数组 */
export function getEnabledTools(names: string[]): AgentToolDef[] {
  return names
    .map(n => TOOL_DEFS[n])
    .filter((t): t is AgentToolDef => t !== undefined);
}

/** 将工具定义转为 OpenAI function calling 格式 */
export function toOpenAITool(def: AgentToolDef): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
  };
}
