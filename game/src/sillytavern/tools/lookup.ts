/**
 * 查询工具 — get_status, lookup_world
 */
import { scanLorebooks, formatMatchedEntries, type ScanResult } from '../lorebookEngine';
import { formatVariablesForPrompt } from '../var-format';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { pathGet, findMapNode } from './helpers';

/** 生成变量树的结构视图（深度限制），让 LLM 自行发现字段和分组 */
function buildTreeView(obj: Record<string, any>, maxDepth: number, prefix = '', depth = 0): string {
  if (depth >= maxDepth) return '';
  const lines: string[] = [];
  const keys = Object.keys(obj).filter(k => !k.startsWith('_'));
  for (const key of keys) {
    const val = obj[key];
    const indent = '  '.repeat(depth);
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const subKeys = Object.keys(val).filter(k => !k.startsWith('_'));
      if (subKeys.length > 0) {
        lines.push(`${indent}${key}: {${subKeys.join(', ')}}`);
        if (depth < maxDepth - 1 && Object.keys(val).length < 20) {
          lines.push(buildTreeView(val, maxDepth, key, depth + 1));
        }
      } else {
        lines.push(`${indent}${key}: {}`);
      }
    } else if (Array.isArray(val)) {
      lines.push(`${indent}${key}: [...]`);
    } else {
      lines.push(`${indent}${key}: ${typeof val === 'string' ? `"${val.slice(0, 30)}"` : val}`);
    }
  }
  return lines.join('\n');
}

export const lookupTools: Record<string, AgentToolDef> = {

  // ── get_status ──
  get_status: {
    name: 'get_status',
    label: '查看状态',
    category: 'lookup',
    description:
      '按路径查询变量树。多路径用空格分隔。\n' +
      '不填 path 时自动显示完整变量结构(树形,深度2),可直接看到所有字段名和NPC分组。\n' +
      '【严禁】凭记忆推测数值、一次性查询全部状态',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '查询路径。多个用空格分隔。不确定时先用 "/主角 /世界/现实" 看顶层结构。NPC路径必须使用"异人"或"普通人"分组。',
        },
      },
      required: ['path'],
    },
    async execute(ctx, params) {
      const rawPath = (params?.path as string)?.trim();
      if (!rawPath) {
        // 无 path → 显示完整变量结构（深度2层），让 LLM 自行发现所有字段和分组
        const tree = buildTreeView(ctx.variables, 2);
        return {
          content: [{ type: 'text', text: `变量结构总览:\n${tree}\n\n请指定 path 查询具体路径。例如 path="/主角/身体属性/生命/当前"` }],
        };
      }

      const paths = rawPath.split(/\s+/).filter(Boolean);
      const results: string[] = [];
      for (const p of paths) {
        const target = pathGet(ctx.variables, p);
        if (target === undefined) {
          let hint = '';
          if (p.startsWith('/主要人物')) {
            hint = '  提示：NPC 分类只有"异人"和"普通人"，请检查路径中的分组名称';
          } else if (p.includes('/梦境')) {
            hint = '  提示：梦境状态在 /世界/位于梦境，梦境数据在 /世界/梦境存档';
          } else if (p.startsWith('/主角') && p !== '/主角') {
            const hero = ctx.variables?.['主角'];
            if (hero && typeof hero === 'object') {
              hint = `  提示：/主角 顶层字段: ${Object.keys(hero).filter(k => !k.startsWith('_')).join(', ')}`;
            }
          }
          results.push(`路径 ${p}: 不存在${hint}`);
        } else {
          const text = typeof target === 'object' && !Array.isArray(target)
            ? formatVariablesForPrompt(target as Record<string, any>)
            : String(target);
          results.push(`## ${p}\n${text}`);
        }
      }
      return { content: [{ type: 'text', text: results.join('\n\n') }], details: { paths, rawPath } };
    },
  },

  // ── lookup_world ──
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
      const allEntries = Object.values(scanResult.groups).flat().filter(e => !e.entry.constant);

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
        const closest = allEntries.slice(0, 3);
        const text = formatMatchedEntries(closest);
        return { content: [{ type: 'text', text: `未找到与「${keyword}」精确匹配的条目，以下是最相关的条目（直接使用，无需再次查询）：\n\n${text}` }], details: { keyword, entries: closest } };
      }

      const text = formatMatchedEntries(matched);
      return { content: [{ type: 'text', text }], details: { keyword, entries: matched } };
    },
  },

};
