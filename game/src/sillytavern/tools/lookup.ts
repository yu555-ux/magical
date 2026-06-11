import { scanLorebooks, formatMatchedEntries, type ScanResult } from '../lorebookEngine';
import { formatVariablesForPrompt } from '../var-format';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { pathGet } from './helpers';

export const lookupTools: Record<string, AgentToolDef> = {
// ── get_status (lookup) ──
get_status: {
  name: 'get_status',
  label: '查看状态',
  category: 'lookup',
  description:
    '按路径查询游戏状态。这是了解游戏状态的唯一权威方式。\n\n' +
    '【必须调用的场景】\n' +
    '- 需要知道玩家/NPC当前数值时（HP、好感度、金钱等）\n' +
    '- 需要确认当前地点和时间时\n' +
    '- 玩家询问"我的状态"或"现在怎么样了"时\n' +
    '- 决定下一步行动前，需要确认当前数据时\n\n' +
    '【严禁的行为】\n' +
    '- 凭记忆推测数值——你的内部记忆不可靠\n' +
    '- 不指定 path 就调用——必须至少指定一个查询路径\n' +
    '- 不要一次性查询全部状态（这会污染系统上下文，导致缓存失效）\n' +
    '- 每次只查询本轮叙事真正需要的字段\n\n' +
    '【常用 path 示例】\n' +
    '- 时间地点: "/世界/现实" 或 "/世界/梦境存档"\n' +
    '- 玩家状态: "/主角/身体属性" 或 "/主角/资源"\n' +
    '- NPC信息: "/主要人物/女性/异人/顾昀" （查单个NPC）\n' +
    '- 精简快照: "/世界/现实 /主角/身体属性 /主角/社交" （多个路径用空格分隔）',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '必填：查询路径。多个路径用空格分隔，如 "/主角/身体属性 /世界/现实"。你不知道哪些字段存在时，先用 "/主角 /世界/现实" 看顶层结构，再精确查询。',
      },
    },
    required: ['path'],
  },
  async execute(ctx, params) {
    const rawPath = params?.path as string | undefined;
    if (!rawPath) {
      // 无 path 时只返回顶层结构摘要（而非全量 54KB 数据）
      const topKeys = Object.keys(ctx.variables).filter(k => !k.startsWith('_'));
      const summary = topKeys.map(k => {
        const v = ctx.variables[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          return `${k}: {${Object.keys(v).join(', ')}}`;
        }
        return `${k}: ${typeof v}`;
      }).join('\n');
      return {
        content: [{ type: 'text', text: `状态顶层结构:\n${summary}\n\n请指定 path 参数查询具体路径。例如 path="/主角/身体属性"` }],
        details: { topKeys },
      };
    }

    // 支持空格分隔的多个路径
    const paths = rawPath.split(/\s+/).filter(Boolean);
    const results: string[] = [];
    for (const p of paths) {
      const target = pathGet(ctx.variables, p);
      if (target === undefined) {
        results.push(`路径 ${p}: 不存在`);
      } else {
        const text = typeof target === 'object' && !Array.isArray(target)
          ? formatVariablesForPrompt(target as Record<string, any>, 2)  // depth limit = 2
          : String(target);
        results.push(`## ${p}\n${text}`);
      }
    }
    return { content: [{ type: 'text', text: results.join('\n\n') }], details: { paths, rawPath } };
  },
},

// ══════════════════════════════════════════════
// update_resource — 资源增减（替代 patch_state）
// ══════════════════════════════════════════════

// ── lookup_world (lookup) ──
lookup_world: {
  name: 'lookup_world',
  label: '查询世界书',
  category: 'lookup',
  description:
    '在世界书中搜索设定条目。注意：标记为"常驻"的条目已随每轮提示词自动注入，无需查询；本工具只搜索非常驻条目。\n\n' +
    '【工作节奏】\n' +
    '- 每轮最多调用 1-2 次此工具，然后直接开始叙事\n' +
    '- 如果返回了条目内容，直接使用，不要换关键词重新搜索\n' +
    '- 如果返回"未找到"，说明设定中确实没有，自由创作即可\n\n' +
    '【禁止】\n' +
    '- 反复换关键词查询同一个目标（如查了"周汝"又查"周汝 性格"又查"周汝 背景"）\n' +
    '- 一次查询多个无关概念（如 keyword="血月 周汝 夏城"）\n\n' +
    '【你的职责】\n' +
    '你不是世界设定的创造者，你是世界设定的翻译者。工具返回什么，你就用什么。\n' +
    '工具没返回的内容，意味着设定中没有——如实告诉玩家"不清楚"，或者用自己的常识补全。\n' +
    '但绝不能即兴编造一个有设定原型的地点的细节（如工具返回了夏城一中但没写校门颜色，你可以编校门颜色；但如果连夏城一中这个地点都没返回，你就不能凭空创造它）。',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '角色名或核心概念。如"周汝"、"魔法少女"、"深渊"。一次只查一个。' },
    },
    required: ['keyword'],
  },
  async execute(ctx, params) {
    const keyword = params?.keyword as string;
    if (!keyword) return { content: [{ type: 'text', text: '请提供搜索关键词' }] };

    const scanResult: ScanResult = scanLorebooks(ctx.lorebooks, keyword, ctx.historyText);
    // 排除 constant=true 的条目（已随 prompt 注入，无需重复查询）
    const allEntries = Object.values(scanResult.groups)
      .flat()
      .filter(e => !e.entry.constant);

    if (allEntries.length === 0) {
      return { content: [{ type: 'text', text: `世界书中没有与「${keyword}」相关的条目。这很正常——你可以根据自己的判断自然地描写，不需要再次查询。` }] };
    }

    const lowerName = keyword.toLowerCase();
    const matched = allEntries
      .filter(e => {
        const keys = e.entry.keys.map(k => k.toLowerCase());
        return keys.some(k => k.includes(lowerName) || lowerName.includes(k));
      })
      .slice(0, 3);

    if (matched.length === 0) {
      // 有关联条目但没精确匹配 → 直接返回最相关的，不让 AI 再查
      const closest = allEntries.slice(0, 3);
      const text = formatMatchedEntries(closest);
      return { content: [{ type: 'text', text: `未找到与「${keyword}」精确匹配的条目，以下是最相关的条目（直接使用，无需再次查询）：\n\n${text}` }], details: { keyword, entries: closest } };
    }

    const text = formatMatchedEntries(matched);
    return { content: [{ type: 'text', text }], details: { keyword, entries: matched } };
  },
},

// ── lookup_location (lookup) ──
lookup_location: {
  name: 'lookup_location',
  label: '查地点设定',
  category: 'lookup',
  description:
    '在世界书中搜索地点设定。等同于 lookup_world 但专用于地点查询。\n\n' +
    '【必须调用的场景】\n' +
    '- 玩家进入或提及任何地点（城镇/区域/建筑/房间）\n' +
    '- 需要描述地点环境、氛围时\n\n' +
    '【严禁的行为】\n' +
    '- 凭记忆描述地点细节——你的内部记忆没有这些信息\n' +
    '- 即兴编造地点名和特征',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '地点名称，如"夏城一中"、"11号楼"、"深渊第三层"' },
    },
    required: ['name'],
  },
  async execute(ctx, params) {
    const name = params?.name as string;
    if (!name) return { content: [{ type: 'text', text: '请提供地点名称' }] };

    const scanResult: ScanResult = scanLorebooks(ctx.lorebooks, name, ctx.historyText);
    // 排除 constant=true 的条目（已随 prompt 注入，无需重复查询）
    const allEntries = Object.values(scanResult.groups)
      .flat()
      .filter(e => !e.entry.constant);

    if (allEntries.length === 0) {
      return { content: [{ type: 'text', text: `未找到与「${name}」相关的世界书条目。该地点可能尚未在设定中定义。` }] };
    }

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

// ══════════════════════════════════════════════
// 领域事件工具 — 世界层（替代 patch_state）
// ══════════════════════════════════════════════

};
