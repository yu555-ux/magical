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

// ── Helpers ──

function pathGet(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/** 在地图树中递归查找节点，返回从 root 到该节点的 JSON Pointer 路径 */
function _getNodePath(root: any, target: any): string {
  const keyMap = ['检索词', '方位', '现实', '梦境', '子地图'];
  function search(node: any, path: string): string | null {
    if (!node || typeof node !== 'object') return null;
    if (node === target) return path;
    for (const key of Object.keys(node)) {
      if (keyMap.includes(key)) continue;
      const child = node[key];
      if (child === target) return path + '/' + key;
      if (child && typeof child === 'object') {
        const found = search(child, path + '/' + key);
        if (found) return found;
        const sub = child['子地图'];
        if (sub) { const f2 = search(sub, path + '/' + key + '/子地图'); if (f2) return f2; }
      }
    }
    return null;
  }
  return search(root, '/地图') ?? '/地图';
}

/** 从 ParsedTime 计算中文星期 */
function computeWeekday(t: ParsedTime): string {
  const d = new Date(t.year, t.month - 1, t.day);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `星期${weekdays[d.getDay()]}`;
}

/** 格式化为完整时间字符串 "YYYY年MM月DD日-星期X-HH:MM" */
function formatWorldTime(t: ParsedTime): string {
  return `${formatDateTime(t.year, t.month, t.day, t.hour, t.minute)}`;
}

/** 尝试格式化为带星期的完整时间 */
function formatWorldTimeFull(t: ParsedTime): string {
  const base = formatWorldTime(t);
  const weekday = computeWeekday(t);
  // 在日期和时间之间插入星期
  return base.replace(/(\d{2}日)-/, `$1-${weekday}-`);
}

function formatVariablesForPrompt(vars: Record<string, any>, maxDepth = 5, prefix = '', depth = 0): string {
  if (depth >= maxDepth) return '{...}';
  const lines: string[] = [];
  const keys = Object.keys(vars).filter(k => !k.startsWith('_'));
  for (const key of keys) {
    const val = vars[key];
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      lines.push(`${key}:`);
      lines.push(formatVariablesForPrompt(val, maxDepth, fullPath, depth + 1).split('\n').map(l => `  ${l}`).join('\n'));
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

  update_resource: {
    name: 'update_resource',
    label: '更新资源',
    category: 'variable',
    description:
      '修改角色或 NPC 的资源数值。这是变更 HP/MP/金钱/好感等数值的首选方式。\n\n' +
      '【支持的目标】\n' +
      '- "主角": 玩家角色\n' +
      '- NPC 名字: 如 "顾昀"、"周汝"、"张云"\n\n' +
      '【支持的资源】\n' +
      '- 主角: 生命、体力、能量、SAN、金钱、蝶烬、尸气\n' +
      '- NPC: 生命、能量、SAN、好感值（仅女性角色）、堕落值（仅女性角色）、性欲值（仅女性角色）、友善值（仅男性角色）\n\n' +
      '【action 含义】\n' +
      '- spend: 消耗（减法），如受伤扣血\n' +
      '- restore: 恢复（加法，不超过上限），如治疗回血\n' +
      '- set: 直接设为指定值\n' +
      '- add: 净增加（加法，可超过上限），如获得金钱\n\n' +
      '【必须调用的场景】\n' +
      '- 战斗造成伤害或消耗\n' +
      '- 治疗恢复生命/体力\n' +
      '- 交易/奖励获得或消耗金钱\n' +
      '- NPC 好感度变化\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中说"你受了伤"但不调用此工具\n' +
      '- 编造数值——必须先 get_status 确认当前值再操作\n' +
      '- 试图修改代码管理的字段（倒计时、年龄、子宫、生理）',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标角色名。"主角" 或 NPC 名字如 "顾昀"' },
        resource: { type: 'string', description: '资源名。主角: 生命/体力/能量/SAN/金钱/蝶烬/尸气。NPC: 生命/能量/SAN/好感值/堕落值/性欲值(女)/友善值(男)' },
        action: { type: 'string', enum: ['spend', 'restore', 'set', 'add'], description: '操作类型：spend=消耗, restore=恢复, set=设置, add=增加' },
        amount: { type: 'number', description: '变化量（正数）' },
        reason: { type: 'string', description: '为什么变化（必填）' },
      },
      required: ['target', 'resource', 'action', 'amount', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const resource = params?.resource as string;
      const action = params?.action as string;
      const amount = params?.amount as number;
      const reason = params?.reason as string;

      if (!target || !resource || !action || !['spend', 'restore', 'set', 'add'].includes(action)) {
        return { content: [{ type: 'text', text: '参数错误：target、resource、action（spend/restore/set/add）均为必填' }] };
      }
      if (typeof amount !== 'number' || amount < 0) {
        return { content: [{ type: 'text', text: '参数错误：amount 必须是≥0的数字' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      // 解析资源路径
      const isTargetSelf = target === '主角';
      let resourcePath: string | null = null;

      if (isTargetSelf) {
        if (['生命', '体力', '能量', 'SAN'].includes(resource)) {
          resourcePath = `/主角/身体属性/${resource}/当前`;
        } else if (resource === '金钱') {
          resourcePath = '/主角/资源/金钱/数值';
        } else if (['蝶烬', '尸气'].includes(resource)) {
          resourcePath = `/主角/资源/超凡资源/${resource}`;
        } else if (['力量', '体质', '精神', '敏捷'].includes(resource)) {
          resourcePath = `/主角/基础属性/${resource}`;
        } else if (['幸运', '魅力'].includes(resource)) {
          resourcePath = `/主角/特殊属性/${resource}`;
        } else if (resource === '评级') {
          resourcePath = '/主角/评级';
        } else if (resource === '疲软长度') {
          resourcePath = '/主角/性器/疲软长度';
        } else if (resource === '勃起长度') {
          resourcePath = '/主角/性器/勃起长度';
        }
      } else {
        // 在 NPC 树中查找
        const chars = ctx.variables?.['主要人物'];
        if (chars) {
          for (const gender of ['女性', '男性']) {
            for (const group of ['异人', '普通人']) {
              const g = chars[gender]?.[group];
              if (!g || typeof g !== 'object') continue;
              if (g[target]) {
                if (['生命', '能量', 'SAN'].includes(resource)) {
                  resourcePath = `/主要人物/${gender}/${group}/${target}/身体属性/${resource}/当前`;
                } else if (resource === '好感值' && gender === '女性') {
                  resourcePath = `/主要人物/${gender}/${group}/${target}/好感值`;
                } else if (resource === '堕落值' && gender === '女性') {
                  resourcePath = `/主要人物/${gender}/${group}/${target}/堕落值`;
                } else if (resource === '性欲值' && gender === '女性') {
                  resourcePath = `/主要人物/${gender}/${group}/${target}/性欲值`;
                } else if (resource === '友善值' && gender === '男性') {
                  resourcePath = `/主要人物/${gender}/${group}/${target}/友善值`;
                } else if (['力量', '体质', '精神', '敏捷'].includes(resource)) {
                  resourcePath = `/主要人物/${gender}/${group}/${target}/基础属性/${resource}`;
                } else if (['幸运', '魅力'].includes(resource)) {
                  resourcePath = `/主要人物/${gender}/${group}/${target}/特殊属性/${resource}`;
                }
                break;
              }
            }
            if (resourcePath) break;
          }
        }
      }

      if (!resourcePath) {
        const available = isTargetSelf
          ? '身体属性: 生命/体力/能量/SAN | 基础属性: 力量/体质/精神/敏捷 | 特殊属性: 幸运/魅力 | 资源: 金钱/蝶烬/尸气 | 评级'
          : '身体属性: 生命/能量/SAN | 基础: 力量/体质/精神/敏捷 | 特殊: 幸运/魅力 | 好感/堕落/性欲(女)/友善(男)';
        return { content: [{ type: 'text', text: `未找到资源路径。target="${target}", resource="${resource}"。可用资源: ${available}` }] };
      }

      // 读取当前值
      const currentVal = resourcePath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
      if (typeof currentVal !== 'number') {
        return { content: [{ type: 'text', text: `资源 ${resourcePath} 当前值不是数字: ${JSON.stringify(currentVal)}` }] };
      }

      // 计算新值
      let newVal: number;
      switch (action) {
        case 'spend': newVal = currentVal - amount; break;
        case 'restore': {
          const maxPath = resourcePath.replace('/当前', '/上限');
          const maxVal = maxPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
          const upper = typeof maxVal === 'number' ? maxVal : 100;
          newVal = Math.min(currentVal + amount, upper);
          break;
        }
        case 'set': newVal = amount; break;
        case 'add': newVal = currentVal + amount; break;
        default: return { content: [{ type: 'text', text: `未知 action: ${action}` }] };
      }

      // clamp 到合理范围
      if (['生命', '体力', '能量', 'SAN'].includes(resource)) {
        const maxPath = resourcePath.replace('/当前', '/上限');
        const maxVal = maxPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
        const upper = typeof maxVal === 'number' ? maxVal : 100;
        newVal = Math.max(0, Math.min(newVal, upper));
      }
      if (resource === '好感值' || resource === '友善值') {
        newVal = Math.max(-200, Math.min(newVal, 200));
      }
      if (resource === '堕落值') {
        newVal = Math.max(0, Math.min(newVal, 500));
      }
      if (resource === '性欲值') {
        newVal = Math.max(0, Math.min(newVal, 100));
      }
      if (['力量', '体质', '精神', '敏捷', '幸运', '魅力'].includes(resource)) {
        newVal = Math.max(1, Math.min(newVal, 100));
      }
      // 评级是字符串，不对其执行数字 clamp
      const patchValue: unknown = resource === '评级' ? (action === 'set' ? amount.toString() : newVal) : newVal;

      const result = ctx.patchVariables([{ op: 'replace', path: resourcePath, value: patchValue }]);
      if (!result.ok) {
        return { content: [{ type: 'text', text: `状态更新失败：${result.error}` }] };
      }

      const actionLabel = { spend: '消耗', restore: '恢复', set: '设置', add: '增加' }[action];
      return {
        content: [{ type: 'text', text: `📊 ${target} ${resource} ${actionLabel} ${amount}: ${currentVal} → ${newVal}\n  原因：${reason}` }],
        details: { target, resource, action, amount, oldValue: currentVal, newValue: newVal, reason, path: resourcePath },
      };
    },
  },

  // ══════════════════════════════════════════════
  // add_item — 添加物品
  // ══════════════════════════════════════════════

  add_item: {
    name: 'add_item',
    label: '添加物品',
    category: 'variable',
    description:
      '向主角或 NPC 的持有物品或仓库中添加物品。自动创建完整的物品条目。\n\n' +
      '【物品分类】\n' +
      '- 灵宝: 超凡宝物，有等级/描述/效果\n' +
      '- 诡物: 诡异物品，有等级/描述/效果/规则/副作用\n' +
      '- 物品: 普通物品，有数量/描述\n\n' +
      '【存放位置】\n' +
      '- "持有物品": 角色身上携带\n' +
      '- "仓库": 存放在仓库中\n\n' +
      '【必须调用的场景】\n' +
      '- 购买/获赠/拾取/交易获得物品\n' +
      '- NPC 持有物品发生变化\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中说"你获得了XX"但不调用此工具',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标角色名。"主角" 或 NPC 名字' },
        category: { type: 'string', enum: ['灵宝', '诡物', '物品'], description: '物品分类' },
        itemName: { type: 'string', description: '物品名称' },
        location: { type: 'string', enum: ['持有物品', '仓库'], description: '存放位置' },
        quantity: { type: 'number', description: '数量，默认 1' },
        level: { type: 'string', description: '（灵宝/诡物必填）等级：微末/凶煞/祸城/倾国/绝域/灭世' },
        desc: { type: 'string', description: '物品描述' },
        effects: { type: 'object', description: '（可选）效果：{ "效果名": "效果描述" }' },
        rules: { type: 'object', description: '（仅诡物可选）使用规则' },
        sideEffects: { type: 'object', description: '（仅诡物可选）副作用' },
        reason: { type: 'string', description: '获得原因' },
      },
      required: ['target', 'category', 'itemName', 'location', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const category = params?.category as string;
      const itemName = params?.itemName as string;
      const location = params?.location as string;
      const quantity = (params?.quantity as number) ?? 1;
      const level = params?.level as string | undefined;
      const desc = params?.desc as string | undefined;
      const effects = params?.effects as Record<string, string> | undefined;
      const rules = params?.rules as Record<string, string> | undefined;
      const sideEffects = params?.sideEffects as Record<string, string> | undefined;
      const reason = params?.reason as string;

      if (!target || !category || !itemName || !location || !['持有物品', '仓库'].includes(location)) {
        return { content: [{ type: 'text', text: '参数错误：target、category、itemName、location（持有物品/仓库）均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      // 确定变量根路径
      let basePath: string;
      if (target === '主角') {
        basePath = location === '持有物品' ? '/主角/持有物品' : '/仓库';
      } else {
        const chars = ctx.variables?.['主要人物'];
        let found = false;
        basePath = '';
        if (chars) {
          for (const gender of ['女性', '男性']) {
            for (const group of ['异人', '普通人']) {
              const g = chars[gender]?.[group];
              if (g?.[target]) {
                basePath = `/主要人物/${gender}/${group}/${target}/所持物品`;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
        if (!found) {
          return { content: [{ type: 'text', text: `未找到 NPC: ${target}` }] };
        }
      }

      // 构建物品条目
      const item: Record<string, unknown> = {};
      if (level) item['等级'] = level;
      if (desc) item['描述'] = desc;
      if (effects) item['效果'] = effects;
      if (category === '诡物') {
        if (rules) item['规则'] = rules;
        if (sideEffects) item['副作用'] = sideEffects;
      }
      item['数量'] = quantity;

      const itemPath = `${basePath}/${category}/${itemName}`;

      // 检查是否已存在
      const existing = itemPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
      if (existing && typeof existing === 'object' && typeof existing['数量'] === 'number') {
        // 已存在 → 增加数量
        const newQty = existing['数量'] + quantity;
        ctx.patchVariables([{ op: 'replace', path: `${itemPath}/数量`, value: newQty }]);
        return {
          content: [{ type: 'text', text: `📦 ${target} ${itemName} 数量 +${quantity} (${existing['数量']} → ${newQty})\n  原因：${reason}` }],
        };
      }

      // 不存在 → 新增
      ctx.patchVariables([{ op: 'insert', path: itemPath, value: item }]);
      return {
        content: [{ type: 'text', text: `📦 ${target} 获得 ${itemName} ×${quantity} (${category})\n  存放于: ${location}\n  原因：${reason}` }],
      };
    },
  },

  // ══════════════════════════════════════════════
  // remove_item — 移除物品
  // ══════════════════════════════════════════════

  remove_item: {
    name: 'remove_item',
    label: '移除物品',
    category: 'variable',
    description:
      '从主角或 NPC 的持有物品中移除物品。可彻底删除或转移到仓库。\n\n' +
      '【必须调用的场景】\n' +
      '- 使用消耗品\n' +
      '- 丢弃/出售/交易交出物品\n' +
      '- 装备损坏\n\n' +
      '【moveTo 选项】\n' +
      '- "仓库": 转移到仓库（如卸下装备）\n' +
      '- 不填: 彻底删除（消耗品/丢弃）',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标角色名' },
        category: { type: 'string', enum: ['灵宝', '诡物', '物品'], description: '物品分类' },
        itemName: { type: 'string', description: '物品名称' },
        quantity: { type: 'number', description: '移除数量，默认 1' },
        moveTo: { type: 'string', description: '（可选）"仓库" 表示转移到仓库，不填则彻底删除' },
        reason: { type: 'string', description: '移除原因' },
      },
      required: ['target', 'category', 'itemName', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const category = params?.category as string;
      const itemName = params?.itemName as string;
      const quantity = (params?.quantity as number) ?? 1;
      const moveTo = params?.moveTo as string | undefined;
      const reason = params?.reason as string;

      if (!target || !category || !itemName) {
        return { content: [{ type: 'text', text: '参数错误：target、category、itemName 均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      // 查找物品路径
      let basePath: string;
      if (target === '主角') {
        basePath = '/主角/持有物品';
      } else {
        const chars = ctx.variables?.['主要人物'];
        let found = false;
        basePath = '';
        if (chars) {
          for (const gender of ['女性', '男性']) {
            for (const group of ['异人', '普通人']) {
              const g = chars[gender]?.[group];
              if (g?.[target]) {
                basePath = `/主要人物/${gender}/${group}/${target}/所持物品`;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
        if (!found) {
          return { content: [{ type: 'text', text: `未找到 NPC: ${target}` }] };
        }
      }

      const itemPath = `${basePath}/${category}/${itemName}`;
      const existing = itemPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);

      if (!existing || typeof existing !== 'object') {
        return { content: [{ type: 'text', text: `${target} 没有 ${itemName}` }] };
      }

      const currentQty = typeof existing['数量'] === 'number' ? existing['数量'] : 1;

      if (moveTo === '仓库') {
        // 转移到仓库
        if (target === '主角') {
          const dstPath = `/仓库/${category}/${itemName}`;
          const dstExisting = dstPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
          if (dstExisting && typeof dstExisting['数量'] === 'number') {
            ctx.patchVariables([{ op: 'replace', path: `${dstPath}/数量`, value: dstExisting['数量'] + quantity }]);
          } else {
            ctx.patchVariables([{ op: 'insert', path: dstPath, value: { ...existing, 数量: quantity } }]);
          }
        }
      }

      // 移除/减少
      if (currentQty <= quantity) {
        // 全部移除
        ctx.patchVariables([{ op: 'remove', path: itemPath }]);
      } else {
        // 只减少数量
        ctx.patchVariables([{ op: 'replace', path: `${itemPath}/数量`, value: currentQty - quantity }]);
      }

      const action = moveTo === '仓库' ? '移至仓库' : '移除';
      return {
        content: [{ type: 'text', text: `📦 ${target} ${itemName} ×${Math.min(quantity, currentQty)} ${action}\n  原因：${reason}` }],
      };
    },
  },

  // ══════════════════════════════════════════════
  // add_condition — 添加异常状态
  // ══════════════════════════════════════════════

  add_condition: {
    name: 'add_condition',
    label: '添加状态',
    category: 'variable',
    description:
      '向主角或 NPC 添加异常状态条目。状态会在状态面板中显示。\n\n' +
      '【duration 格式】\n' +
      '- "永久": 长期状态（如"奇迹枯竭"）\n' +
      '- "3小时": 指定持续时间\n' +
      '- "直到治疗为止": 条件持续类型\n\n' +
      '【必须调用的场景】\n' +
      '- 战斗受伤后添加伤势状态\n' +
      '- 受到诅咒/中毒/精神污染\n' +
      '- 获得临时 buff/debuff\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中说"你中毒了"但不调用此工具\n' +
      '- 持续时间用模糊表述（"一会儿"→"30分钟"）',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标角色名。"主角" 或 NPC 名字' },
        name: { type: 'string', description: '状态名称，如"轻微擦伤""中毒""魅惑"' },
        description: { type: 'string', description: '状态描述' },
        duration: { type: 'string', description: '持续时间："永久" / "3小时" / "直到治疗为止" 等' },
        reason: { type: 'string', description: '添加原因' },
      },
      required: ['target', 'name', 'description', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const name = params?.name as string;
      const desc = params?.description as string;
      const duration = params?.duration as string | undefined;
      const reason = params?.reason as string;

      if (!target || !name || !desc) {
        return { content: [{ type: 'text', text: '参数错误：target、name、description 均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      let basePath: string;
      if (target === '主角') {
        basePath = '/主角/状态';
      } else {
        const chars = ctx.variables?.['主要人物'];
        let found = false;
        basePath = '';
        if (chars) {
          for (const gender of ['女性', '男性']) {
            for (const group of ['异人', '普通人']) {
              const g = chars[gender]?.[group];
              if (g?.[target]) {
                basePath = `/主要人物/${gender}/${group}/${target}/状态`;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
        if (!found) {
          return { content: [{ type: 'text', text: `未找到 NPC: ${target}` }] };
        }
      }

      const entry: Record<string, unknown> = { 描述: desc };
      if (duration) entry['持续时间'] = duration;

      const condPath = `${basePath}/${name}`;
      ctx.patchVariables([{ op: 'insert', path: condPath, value: entry }]);

      const durText = duration ? ` (${duration})` : '';
      return {
        content: [{ type: 'text', text: `⚠️ ${target} 获得状态: ${name}${durText}\n  描述: ${desc}\n  原因：${reason}` }],
        details: { target, name, description: desc, duration, reason },
      };
    },
  },

  // ══════════════════════════════════════════════
  // remove_condition — 移除异常状态
  // ══════════════════════════════════════════════

  remove_condition: {
    name: 'remove_condition',
    label: '移除状态',
    category: 'variable',
    description:
      '从主角或 NPC 移除异常状态条目。\n\n' +
      '【必须调用的场景】\n' +
      '- 状态持续时间到期\n' +
      '- 治疗/净化/解咒\n' +
      '- 剧情中状态消失\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中说"伤好了"但不调用此工具',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标角色名' },
        name: { type: 'string', description: '要移除的状态名称' },
        reason: { type: 'string', description: '移除原因' },
      },
      required: ['target', 'name', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const name = params?.name as string;
      const reason = params?.reason as string;

      if (!target || !name) {
        return { content: [{ type: 'text', text: '参数错误：target、name 均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      let basePath: string;
      if (target === '主角') {
        basePath = '/主角/状态';
      } else {
        const chars = ctx.variables?.['主要人物'];
        let found = false;
        basePath = '';
        if (chars) {
          for (const gender of ['女性', '男性']) {
            for (const group of ['异人', '普通人']) {
              const g = chars[gender]?.[group];
              if (g?.[target]) {
                basePath = `/主要人物/${gender}/${group}/${target}/状态`;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
        if (!found) {
          return { content: [{ type: 'text', text: `未找到 NPC: ${target}` }] };
        }
      }

      const condPath = `${basePath}/${name}`;
      const existing = condPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
      if (!existing) {
        return { content: [{ type: 'text', text: `${target} 没有状态 "${name}"` }] };
      }

      ctx.patchVariables([{ op: 'remove', path: condPath }]);
      return {
        content: [{ type: 'text', text: `✅ ${target} 状态已移除: ${name}\n  原因：${reason}` }],
        details: { target, name, reason },
      };
    },
  },

  // ══════════════════════════════════════════════
  // update_social — 更新社交关系
  // ══════════════════════════════════════════════

  update_social: {
    name: 'update_social',
    label: '更新社交',
    category: 'variable',
    description:
      '管理主角社交关系。当与 NPC 建立/改变/解除明确关系时使用。\n\n' +
      '【关系措辞】简洁明确：朋友、恋人、队友、上司、母子、姐弟 等\n\n' +
      '【双向对称】更新 A→B 时请同时更新 B→A。策略提示词会要求 LLM 手动双向调用。\n\n' +
      '【必须调用的场景】\n' +
      '- 与 NPC 关系发生质变（陌生人→朋友、朋友→恋人）\n' +
      '- 明确约定或承认某种关系\n\n' +
      '【严禁的行为】\n' +
      '- 为路人/陌生人添加社交\n' +
      '- 单向认识就添加条目（需双方有明确互动）',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'NPC 名字' },
        relationship: { type: 'string', description: '新的关系描述，如"朋友""队友"' },
        action: { type: 'string', enum: ['set', 'remove'], description: 'set=设置关系, remove=删除该社交条目' },
        reason: { type: 'string', description: '为什么关系发生变化' },
      },
      required: ['target', 'action', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const relationship = params?.relationship as string;
      const action = params?.action as string;
      const reason = params?.reason as string;

      if (!target || !action || !['set', 'remove'].includes(action)) {
        return { content: [{ type: 'text', text: '参数错误：target、action（set/remove）均为必填' }] };
      }
      if (action === 'set' && (!relationship || !relationship.trim())) {
        return { content: [{ type: 'text', text: '参数错误：action=set 时 relationship 不能为空' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      const socialPath = `/主角/社交/${target}`;

      if (action === 'remove') {
        const existing = socialPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
        if (!existing) {
          return { content: [{ type: 'text', text: `社交中不存在 ${target}` }] };
        }
        ctx.patchVariables([{ op: 'remove', path: socialPath }]);
        return {
          content: [{ type: 'text', text: `🔗 已从社交中移除 ${target}\n  原因：${reason}` }],
        };
      }

      // action === 'set'
      const entry = { 关系: relationship };
      const existing = socialPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
      ctx.patchVariables([{ op: existing ? 'replace' : 'insert', path: socialPath, value: entry }]);
      const oldRel = existing?.['关系'] ? ` (原: ${existing['关系']})` : '';
      return {
        content: [{ type: 'text', text: `🔗 主角 ↔ ${target}: ${relationship}${oldRel}\n  原因：${reason}` }],
        details: { target, relationship, action, reason },
      };
    },
  },

  // ══════════════════════════════════════════════
  // update_skill — 管理技能
  // ══════════════════════════════════════════════

  update_skill: {
    name: 'update_skill',
    label: '技能管理',
    category: 'variable',
    description:
      '管理主角或异人 NPC 的技能（仅异人具备技能字段）。\n\n' +
      '【action 说明】\n' +
      '- create: 创建新技能条目\n' +
      '- update: 更新已有技能的熟练度/等级\n' +
      '- unlock_branch: 解锁新分支\n\n' +
      '【create 时需提供的字段】\n' +
      '- level: 等级（微尘/聚砂/凝石/磐岩/撼山/摧城/覆国/夷地/灭世）\n' +
      '- desc: 技能描述\n' +
      '- requirement: 使用要求\n' +
      '- cost: 消耗能量（数字）\n' +
      '- sideEffects: 副作用 { "副作用名": "描述" }\n' +
      '- proficiency: 初始熟练度（0-999）\n\n' +
      '【update 时需提供】\n' +
      '- field: 要更新的字段名（如"熟练度""等级""描述"）\n' +
      '- value: 新值\n\n' +
      '【unlock_branch 时需提供】\n' +
      '- branchName + branchDesc + branchEffect',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '"主角" 或异人 NPC 名字' },
        skillName: { type: 'string', description: '技能名称' },
        action: { type: 'string', enum: ['create', 'update', 'unlock_branch'], description: '操作类型' },
        level: { type: 'string', description: '（create 时）技能等级' },
        desc: { type: 'string', description: '（create 时）技能描述' },
        requirement: { type: 'string', description: '（create 时）使用要求' },
        cost: { type: 'number', description: '（create 时）消耗能量' },
        sideEffects: { type: 'object', description: '（create 时）副作用对象' },
        proficiency: { type: 'number', description: '（create/update 时）熟练度值' },
        field: { type: 'string', description: '（update 时）要更新的字段名' },
        value: { description: '（update 时）新值' },
        branchName: { type: 'string', description: '（unlock_branch 时）新分支名称' },
        branchDesc: { type: 'string', description: '（unlock_branch 时）分支描述' },
        branchEffect: { type: 'string', description: '（unlock_branch 时）分支效果' },
        reason: { type: 'string', description: '变化原因' },
      },
      required: ['target', 'skillName', 'action', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const skillName = params?.skillName as string;
      const action = params?.action as string;
      const reason = params?.reason as string;

      if (!target || !skillName || !action || !['create', 'update', 'unlock_branch'].includes(action)) {
        return { content: [{ type: 'text', text: '参数错误：target、skillName、action（create/update/unlock_branch）均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      let skillPath: string;
      if (target === '主角') {
        skillPath = `/主角/技能/${skillName}`;
      } else {
        const chars = ctx.variables?.['主要人物'];
        skillPath = '';
        if (chars) {
          for (const gender of ['女性', '男性']) {
            const g = chars[gender]?.['异人'];
            if (g?.[target]) {
              skillPath = `/主要人物/${gender}/异人/${target}/技能/${skillName}`;
              break;
            }
          }
        }
        if (!skillPath) {
          return { content: [{ type: 'text', text: `未找到异人 NPC: ${target}（仅异人具备技能字段，普通人/未知角色无技能）` }] };
        }
      }

      const existing = skillPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);

      if (action === 'create') {
        if (existing) {
          return { content: [{ type: 'text', text: `技能 "${skillName}" 已存在。请使用 action=update 修改` }] };
        }
        const entry: Record<string, unknown> = {
          等级: params?.level ?? '微尘',
          描述: params?.desc ?? '',
          使用要求: params?.requirement ?? '',
          消耗能量: params?.cost ?? 0,
          副作用: params?.sideEffects ?? {},
          熟练度: params?.proficiency ?? 0,
          分支: {},
        };
        ctx.patchVariables([{ op: 'insert', path: skillPath, value: entry }]);
        return {
          content: [{ type: 'text', text: `🎯 ${target} 习得新技能: ${skillName} (${entry['等级']})\n  原因：${reason}` }],
        };
      }

      if (!existing || typeof existing !== 'object') {
        return { content: [{ type: 'text', text: `技能 "${skillName}" 不存在。请使用 action=create 创建` }] };
      }

      if (action === 'update') {
        const field = params?.field as string;
        const value = params?.value;
        if (!field || value === undefined) {
          return { content: [{ type: 'text', text: '参数错误：action=update 时 field 和 value 均为必填' }] };
        }
        ctx.patchVariables([{ op: 'replace', path: `${skillPath}/${field}`, value }]);
        return {
          content: [{ type: 'text', text: `🎯 ${target} ${skillName}.${field}: ${JSON.stringify(existing[field])} → ${JSON.stringify(value)}\n  原因：${reason}` }],
        };
      }

      // unlock_branch
      const branchName = params?.branchName as string;
      const branchDesc = params?.branchDesc as string;
      const branchEffect = params?.branchEffect as string;
      if (!branchName || !branchDesc || !branchEffect) {
        return { content: [{ type: 'text', text: '参数错误：action=unlock_branch 时 branchName、branchDesc、branchEffect 均为必填' }] };
      }
      const branchEntry = { 描述: branchDesc, 效果: branchEffect };
      ctx.patchVariables([{ op: 'insert', path: `${skillPath}/分支/${branchName}`, value: branchEntry }]);
      return {
        content: [{ type: 'text', text: `🎯 ${target} ${skillName} 解锁新分支: ${branchName}\n  原因：${reason}` }],
      };
    },
  },

  // ══════════════════════════════════════════════
  // update_outfit — 更新 NPC 着装
  // ══════════════════════════════════════════════

  update_outfit: {
    name: 'update_outfit',
    label: '更新着装',
    category: 'variable',
    description:
      '更新女性 NPC 的着装（仅女性角色具备此字段）。更换衣物、战斗破损、亲密行为脱下时使用。\n\n' +
      '【slot 可选值】上衣 / 下衣 / 内衣 / 袜子 / 鞋子\n\n' +
      '【必须调用的场景】\n' +
      '- NPC 主动更换衣物\n' +
      '- 战斗导致衣物破损\n' +
      '- 亲密行为中脱下衣物\n\n' +
      '【严禁的行为】\n' +
      '- 每轮都更新着装——只在发生实际变化时使用',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'NPC 名字' },
        slot: { type: 'string', enum: ['上衣', '下衣', '内衣', '袜子', '鞋子'], description: '着装部位' },
        name: { type: 'string', description: '衣物名称' },
        description: { type: 'string', description: '衣物描述（颜色/材质/状态）' },
        reason: { type: 'string', description: '为什么更换/破损' },
      },
      required: ['target', 'slot', 'name', 'description', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const slot = params?.slot as string;
      const name = params?.name as string;
      const desc = params?.description as string;
      const reason = params?.reason as string;

      if (!target || !slot || !name || !desc) {
        return { content: [{ type: 'text', text: '参数错误：target、slot、name、description 均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      const chars = ctx.variables?.['主要人物'];
      let outfitPath = '';
      if (chars) {
        for (const gender of ['女性', '男性']) {
          for (const group of ['异人', '普通人']) {
            const g = chars[gender]?.[group];
            if (g?.[target]) {
              outfitPath = `/主要人物/${gender}/${group}/${target}/着装/${slot}`;
              break;
            }
          }
          if (outfitPath) break;
        }
      }
      if (!outfitPath) {
        return { content: [{ type: 'text', text: `未找到 NPC: ${target}` }] };
      }

      const entry = { 名称: name, 描述: desc };
      ctx.patchVariables([{ op: 'replace', path: outfitPath, value: entry }]);
      return {
        content: [{ type: 'text', text: `👗 ${target} ${slot}: ${name}\n  描述: ${desc}\n  原因：${reason}` }],
        details: { target, slot, name, description: desc, reason },
      };
    },
  },

  // ══════════════════════════════════════════════
  // update_body_development — 更新身体开发
  // ══════════════════════════════════════════════

  update_body_development: {
    name: 'update_body_development',
    label: '身体开发',
    category: 'variable',
    description:
      '记录女性 NPC 身体开发状态（仅女性角色具备此字段）。亲密接触或性行为后使用。\n\n' +
      '【part 可选值】嘴巴 / 胸部 / 小穴 / 屁穴\n\n' +
      '【必须调用的场景】\n' +
      '- 亲密行为后对应部位使用次数+1\n' +
      '- 身体开发描述需要更新时\n\n' +
      '【严禁的行为】\n' +
      '- 未经亲密行为就增加使用次数',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'NPC 名字' },
        part: { type: 'string', enum: ['嘴巴', '胸部', '小穴', '屁穴'], description: '开发部位' },
        increment: { type: 'boolean', description: '是否使用次数+1（默认 true）' },
        newDescription: { type: 'string', description: '（可选）更新后的描述文字' },
        reason: { type: 'string', description: '触发原因' },
      },
      required: ['target', 'part', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const part = params?.part as string;
      const increment = params?.increment !== false;
      const newDescription = params?.newDescription as string | undefined;
      const reason = params?.reason as string;

      if (!target || !part) {
        return { content: [{ type: 'text', text: '参数错误：target、part 均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      const chars = ctx.variables?.['主要人物'];
      let devPath = '';
      if (chars) {
        for (const gender of ['女性', '男性']) {
          for (const group of ['异人', '普通人']) {
            const g = chars[gender]?.[group];
            if (g?.[target]) {
              devPath = `/主要人物/${gender}/${group}/${target}/身体开发/${part}`;
              break;
            }
          }
          if (devPath) break;
        }
      }
      if (!devPath) {
        return { content: [{ type: 'text', text: `未找到 NPC: ${target}` }] };
      }

      const current = devPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
      if (!current || typeof current !== 'object') {
        return { content: [{ type: 'text', text: `${target} 没有 ${part} 的身体开发数据` }] };
      }

      const ops: JsonPatchOp[] = [];
      if (increment) {
        const newCount = (current['使用次数'] ?? 0) + 1;
        ops.push({ op: 'replace', path: `${devPath}/使用次数`, value: newCount });
      }
      if (newDescription) {
        ops.push({ op: 'replace', path: `${devPath}/描述`, value: newDescription });
      }
      if (ops.length === 0) {
        return { content: [{ type: 'text', text: '没有需要更新的内容' }] };
      }

      const result = ctx.patchVariables(ops);
      const changes: string[] = [];
      if (increment) changes.push(`使用次数: ${current['使用次数']} → ${(current['使用次数'] ?? 0) + 1}`);
      if (newDescription) changes.push(`描述已更新`);

      return {
        content: [{ type: 'text', text: `🔞 ${target} ${part} ${changes.join(', ')}\n  原因：${reason}` }],
        details: { target, part, increment, newDescription, reason },
      };
    },
  },

  // ══════════════════════════════════════════════
  // update_npc_info — 更新 NPC 跟踪信息
  // ══════════════════════════════════════════════

  update_npc_info: {
    name: 'update_npc_info',
    label: 'NPC信息',
    category: 'variable',
    description:
      '更新 NPC 的位置、当前行动或当前想法。\n\n' +
      '【field 可选值】\n' +
      '- 当前位置: NPC 物理位置变化时更新\n' +
      '- 当前行动: NPC 正在做什么\n' +
      '- 当前想法: 15字左右第一人称心理活动\n\n' +
      '【必须调用的场景】\n' +
      '- NPC 移动到新地点\n' +
      '- NPC 开始/结束某个行动\n' +
      '- NPC 的心态发生明显变化\n\n' +
      '【严禁的行为】\n' +
      '- 每轮都更新——只在发生实质性变化时使用\n' +
      '- 当前想法超过30字',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'NPC 名字' },
        field: { type: 'string', enum: ['当前位置', '当前行动', '当前想法'], description: '要更新的字段' },
        value: { type: 'string', description: '新的值' },
        reason: { type: 'string', description: '为什么变化' },
      },
      required: ['target', 'field', 'value', 'reason'],
    },
    async execute(ctx, params) {
      const target = params?.target as string;
      const field = params?.field as string;
      const value = params?.value as string;
      const reason = params?.reason as string;

      if (!target || !field || !value) {
        return { content: [{ type: 'text', text: '参数错误：target、field、value 均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      const chars = ctx.variables?.['主要人物'];
      let npcPath = '';
      if (chars) {
        for (const gender of ['女性', '男性']) {
          for (const group of ['异人', '普通人']) {
            const g = chars[gender]?.[group];
            if (g?.[target]) {
              npcPath = `/主要人物/${gender}/${group}/${target}/${field}`;
              break;
            }
          }
          if (npcPath) break;
        }
      }
      if (!npcPath) {
        return { content: [{ type: 'text', text: `未找到 NPC: ${target}` }] };
      }

      ctx.patchVariables([{ op: 'replace', path: npcPath, value }]);
      return {
        content: [{ type: 'text', text: `📍 ${target} ${field}: ${value}\n  原因：${reason}` }],
        details: { target, field, value, reason },
      };
    },
  },

  // ══════════════════════════════════════════════
  // update_map — 地图管理
  // ══════════════════════════════════════════════

  update_map: {
    name: 'update_map',
    label: '地图管理',
    category: 'variable',
    description:
      '管理地图节点：新增子地点、更新描述/探索信息、管理异常条目。\n' +
      '工具自动在整棵地图树中搜索 location 名称（支持检索词匹配），无需手动指定完整路径。\n\n' +
      '【action 说明】\n' +
      '- add_child: 在 location 的子地图下新增子地点。提供 name+检索词+方位+wDesc(可选)+dDesc(可选)\n' +
      '- update_desc: 更新 location 的现实/梦境描述。至少提供一个 world\n' +
      '- add_info: 向 location 的地点细节.信息 追加条目\n' +
      '- add_anomaly: 向 location 添加异常条目。name+评级+描述必填\n' +
      '- update_anomaly: 更新已有异常的具现进度或描述\n' +
      '- remove_anomaly: 删除某个异常条目\n\n' +
      '【必须调用的场景】\n' +
      '- 探索到地图中不存在的新区域 → add_child\n' +
      '- 发现某地点的隐藏信息 → add_info\n' +
      '- 遭遇/击败异常 → add_anomaly / update_anomaly / remove_anomaly',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['add_child', 'update_desc', 'add_info', 'add_anomaly', 'update_anomaly', 'remove_anomaly'], description: '操作类型' },
        location: { type: 'string', description: '目标地点名称（支持检索词匹配）' },
        world: { type: 'string', enum: ['现实', '梦境'], description: '（add_child/add_anomaly 时）现实或梦境' },
        name: { type: 'string', description: '（add_child/anomaly 时）名称' },
        keywords: { type: 'array', items: { type: 'string' }, description: '（add_child 时）检索词列表' },
        xMin: { type: 'number' }, xMax: { type: 'number' }, yMin: { type: 'number' }, yMax: { type: 'number' }, zMin: { type: 'number' }, zMax: { type: 'number' },
        wDesc: { type: 'string', description: '（add_child/update_desc 时）现实世界描述' },
        dDesc: { type: 'string', description: '（add_child/update_desc 时）梦境世界描述' },
        info: { type: 'string', description: '（add_info 时）要追加的信息条目' },
        anomalyName: { type: 'string', description: '（add_anomaly/update_anomaly/remove_anomaly 时）异常名称' },
        rating: { type: 'string', description: '（add_anomaly 时）异常评级' },
        desc: { type: 'string', description: '（add_anomaly/update_anomaly 时）描述' },
        progress: { type: 'number', description: '（update_anomaly 时）具现进度 0-100' },
        traits: { type: 'object', description: '（add_anomaly 时）特性：{ "特性名": { 描述, 效果:[] } }' },
        reason: { type: 'string', description: '变更原因' },
      },
      required: ['action', 'location', 'reason'],
    },
    async execute(ctx, params) {
      // 递归搜索地图树，支持检索词匹配
      function findMapNode(node: any, target: string): any | null {
        if (!node || typeof node !== 'object') return null;
        // 直接键名匹配
        if (node[target]) return node[target];
        // 检索词匹配
        for (const key of Object.keys(node)) {
          if (['检索词', '方位', '现实', '梦境', '子地图'].includes(key)) continue;
          const child = node[key];
          if (!child || typeof child !== 'object') continue;
          const terms = child['检索词'];
          if (Array.isArray(terms) && terms.some((t: string) => t === target)) return child;
          if (key === target) return child;
        }
        // 递归子地图
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

      const action = params?.action as string;
      const location = params?.location as string;
      const world = params?.world as string;
      const reason = params?.reason as string;

      if (!action || !location) {
        return { content: [{ type: 'text', text: '参数错误：action、location 均为必填' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      const mapTree = ctx.variables?.['地图'];
      if (!mapTree) {
        return { content: [{ type: 'text', text: '变量树中没有地图数据' }] };
      }

      const node = findMapNode(mapTree, location);
      if (!node || typeof node !== 'object') {
        return { content: [{ type: 'text', text: `在地图中未找到地点: ${location}` }] };
      }

      switch (action) {
        case 'add_child': {
          const name = params?.name as string;
          const keywords = params?.keywords as string[] | undefined;
          if (!name) return { content: [{ type: 'text', text: 'action=add_child 时 name 必填' }] };
          const child: Record<string, any> = { 检索词: keywords ?? [name] };
          const xMin = params?.xMin, xMax = params?.xMax, yMin = params?.yMin, yMax = params?.yMax, zMin = params?.zMin, zMax = params?.zMax;
          if (xMin !== undefined) child['方位'] = { X: [xMin, xMax ?? xMin], Y: [yMin ?? xMin, yMax ?? xMin], Z: [zMin ?? 0, zMax ?? 0] };
          child['现实'] = { 描述: params?.wDesc ?? '', 地点细节: { 信息: [], 异常: {} } };
          child['梦境'] = { 描述: params?.dDesc ?? '', 地点细节: { 信息: [], 异常: {} } };
          child['子地图'] = {};
          const sub = node['子地图'] ?? {};
          sub[name] = child;
          ctx.patchVariables([{ op: 'replace', path: _getNodePath(mapTree, node) + '/子地图', value: sub }]);
          return { content: [{ type: 'text', text: `🗺️ 在 ${location} 下新增子地点: ${name}\n  原因：${reason}` }] };
        }
        case 'update_desc': {
          const wDesc = params?.wDesc as string | undefined;
          const dDesc = params?.dDesc as string | undefined;
          if (!wDesc && !dDesc) return { content: [{ type: 'text', text: 'action=update_desc 时至少提供 wDesc 或 dDesc 中的一个' }] };
          const ops: JsonPatchOp[] = [];
          if (wDesc) ops.push({ op: 'replace', path: _getNodePath(mapTree, node) + '/现实/描述', value: wDesc });
          if (dDesc) ops.push({ op: 'replace', path: _getNodePath(mapTree, node) + '/梦境/描述', value: dDesc });
          ctx.patchVariables(ops);
          return { content: [{ type: 'text', text: `🗺️ 已更新 ${location} 的描述\n  原因：${reason}` }] };
        }
        case 'add_info': {
          const info = params?.info as string;
          if (!info) return { content: [{ type: 'text', text: 'action=add_info 时 info 必填' }] };
          const w = world === '梦境' ? '梦境' : '现实';
          const infoArr = node[w]?.['地点细节']?.['信息'] ?? [];
          infoArr.push(info);
          const infoPath = _getNodePath(mapTree, node) + `/${w}/地点细节/信息`;
          ctx.patchVariables([{ op: 'replace', path: infoPath, value: infoArr }]);
          return { content: [{ type: 'text', text: `📝 ${location}(${w}) 新增信息: ${info}\n  原因：${reason}` }] };
        }
        case 'add_anomaly': {
          const aName = params?.anomalyName as string;
          const rating = params?.rating as string;
          const desc = params?.desc as string;
          if (!aName || !rating || !desc) return { content: [{ type: 'text', text: 'action=add_anomaly 时 anomalyName、rating、desc 必填' }] };
          const w = world === '梦境' ? '梦境' : '现实';
          const entry: Record<string, any> = { 评级: rating, 描述: desc };
          if (w === '梦境') entry['具现进度'] = 0;
          const traits = params?.traits;
          if (traits) entry['特性'] = traits;
          const aPath = _getNodePath(mapTree, node) + `/${w}/地点细节/异常/${aName}`;
          ctx.patchVariables([{ op: 'insert', path: aPath, value: entry }]);
          return { content: [{ type: 'text', text: `⚠️ ${location}(${w}) 新增异常: ${aName} (${rating})\n  原因：${reason}` }] };
        }
        case 'update_anomaly': {
          const aName = params?.anomalyName as string;
          if (!aName) return { content: [{ type: 'text', text: 'action=update_anomaly 时 anomalyName 必填' }] };
          const w = world === '梦境' ? '梦境' : '现实';
          const aPath = _getNodePath(mapTree, node) + `/${w}/地点细节/异常/${aName}`;
          const existing = aPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
          if (!existing) return { content: [{ type: 'text', text: `${location}(${w}) 中不存在异常 "${aName}"` }] };
          const ops: JsonPatchOp[] = [];
          if (params?.desc) ops.push({ op: 'replace', path: `${aPath}/描述`, value: params.desc });
          if (typeof params?.progress === 'number') ops.push({ op: 'replace', path: `${aPath}/具现进度`, value: Math.max(0, Math.min(100, params.progress)) });
          if (ops.length === 0) return { content: [{ type: 'text', text: '没有需要更新的字段' }] };
          ctx.patchVariables(ops);
          return { content: [{ type: 'text', text: `⚠️ 已更新 ${location}(${w}) 异常 "${aName}"\n  原因：${reason}` }] };
        }
        case 'remove_anomaly': {
          const aName = params?.anomalyName as string;
          if (!aName) return { content: [{ type: 'text', text: 'action=remove_anomaly 时 anomalyName 必填' }] };
          const w = world === '梦境' ? '梦境' : '现实';
          const aPath = _getNodePath(mapTree, node) + `/${w}/地点细节/异常/${aName}`;
          ctx.patchVariables([{ op: 'remove', path: aPath }]);
          return { content: [{ type: 'text', text: `✅ 已从 ${location}(${w}) 移除异常 "${aName}"\n  原因：${reason}` }] };
        }
        default:
          return { content: [{ type: 'text', text: `未知 action: ${action}` }] };
      }
    },
  },

  // ── save_point (mechanics) ──
  save_point: {
    name: 'save_point',
    label: '记录剧情节点',
    category: 'mechanics',
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

  // ── roll_dice (mechanics) ──
  roll_dice: {
    name: 'roll_dice',
    label: '掷骰子',
    category: 'mechanics',
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

  // ── advance_time (variable) ──
  advance_time: {
    name: 'advance_time',
    label: '推进时间',
    category: 'variable',
    description:
      '推进现实或梦境世界的时间。这是改变游戏时间的唯一方式。\n\n' +
      '【必须调用的场景】\n' +
      '- 任何导致时间流逝的行为：赶路、休息、等待、守夜、调查、治疗\n' +
      '- 剧情需要跳过一个时间段时\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中说"过了三十分钟"但不调此工具\n' +
      '- 试图推进零分钟或负数时间\n' +
      '- 试图自己拼写时间字符串——填 minutes，引擎计算新时间\n\n' +
      '【你的职责】\n' +
      '你不是时间的创造者，你是时间的记录者。填 minutes 和 reason，引擎完成计算。',
    parameters: {
      type: 'object',
      properties: {
        world: { type: 'string', enum: ['reality', 'dream'], description: '推进哪个世界的时间' },
        minutes: { type: 'number', description: '推进多少分钟（必须 >0）' },
        reason: { type: 'string', description: '为什么消耗了这些时间' },
      },
      required: ['world', 'minutes', 'reason'],
    },
    async execute(ctx, params) {
      const world = params?.world as string;
      const minutes = params?.minutes as number;
      const reason = params?.reason as string;
      if (!world || !['reality', 'dream'].includes(world)) {
        return { content: [{ type: 'text', text: '参数错误：world 必须是 reality 或 dream' }] };
      }
      if (typeof minutes !== 'number' || minutes <= 0) {
        return { content: [{ type: 'text', text: '参数错误：minutes 必须 >0' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      const timeField = world === 'reality' ? '现实' : '梦境存档';
      const currentTime = ctx.variables?.['世界']?.[timeField]?.['时间'];
      if (!currentTime) {
        return { content: [{ type: 'text', text: `无法读取当前${world === 'reality' ? '现实' : '梦境'}时间` }] };
      }

      const parsed = parseWorldTime(currentTime);
      if (!parsed) {
        return { content: [{ type: 'text', text: `无法解析时间字符串: ${currentTime}` }] };
      }

      // 时间推进
      const totalMinutes = parsed.hour * 60 + parsed.minute + minutes;
      const newMinute = totalMinutes % 60;
      const newHour = Math.floor(totalMinutes / 60) % 24;
      const extraDays = Math.floor(totalMinutes / (60 * 24));
      const newDate = new Date(parsed.year, parsed.month - 1, parsed.day + extraDays);
      const newParsed: ParsedTime = {
        year: newDate.getFullYear(),
        month: newDate.getMonth() + 1,
        day: newDate.getDate(),
        hour: newHour,
        minute: newMinute,
      };

      const newTime = formatWorldTimeFull(newParsed);
      ctx.patchVariables([{ op: 'replace', path: `/世界/${timeField}/时间`, value: newTime }]);

      // ══════════════════════════════════════════════
      // 状态先行：时间变更后立即同步刷新所有派生状态
      // 确保 LLM 在下一轮看到的变量树已是完整最新状态
      // ══════════════════════════════════════════════

      // ── 1. 天气轮换（日期变化时）──
      const otherField = world === 'reality' ? '梦境存档' : '现实';
      const otherTime = ctx.variables?.['世界']?.[otherField]?.['时间'] ?? '';
      const realityOldTime = world === 'reality' ? currentTime : otherTime;
      const dreamOldTime = world === 'dream' ? currentTime : otherTime;
      const realityNewTime = world === 'reality' ? newTime : realityOldTime;
      const dreamNewTime = world === 'dream' ? newTime : dreamOldTime;

      const realityWeather = ctx.variables?.['世界']?.['现实']?.['天气'] ?? '阴天';
      const dreamWeather = ctx.variables?.['世界']?.['梦境存档']?.['天气'] ?? '残月';

      const weather = updateWeatherOnTimeTick(
        getDatePart(realityOldTime),
        getDatePart(realityNewTime),
        realityWeather,
        dreamWeather,
        getDatePart(dreamNewTime),
        getDatePart(dreamOldTime),
      );

      const weatherOps: JsonPatchOp[] = [];
      if (weather.reality !== realityWeather) {
        weatherOps.push({ op: 'replace', path: '/世界/现实/天气', value: weather.reality });
      }
      if (weather.dream !== dreamWeather) {
        weatherOps.push({ op: 'replace', path: '/世界/梦境存档/天气', value: weather.dream });
      }
      if (weatherOps.length > 0) {
        ctx.patchVariables(weatherOps);
      }

      // ── 2. 生理 tick + 年龄增长 ──
      if (world === 'reality') {
        tickAges(ctx.variables, currentTime, newTime);
        tickAllFemales(ctx.variables, currentTime, newTime, { dreamOnly: false });
      } else {
        tickAllFemales(ctx.variables, currentTime, newTime, { dreamOnly: true });
      }

      // ── 3. 倒计时刷新 ──
      injectCountdown(ctx.variables, ctx.dreamAnchor);

      // ══════════════════════════════════════════════

      const oldDisplay = currentTime;
      const sideEffects: string[] = [];
      for (const op of weatherOps) {
        const label = op.path?.includes('现实') ? '现实天气' : '梦境天气';
        sideEffects.push(`${label}: ${op.value}`);
      }
      const sideNote = sideEffects.length > 0 ? `\n  🌤 天气同步更新: ${sideEffects.join(', ')}` : '';
      const paceWarning = minutes > 30 ? '\n\n⚠️ Pacing: 时间跨度较大（>30分钟），请勿继续玩下一个行动窗口，直接进入叙事。' : '';

      return {
        content: [{ type: 'text', text: `⏰ ${world === 'reality' ? '现实' : '梦境'}时间已推进 ${minutes} 分钟\n  ${oldDisplay} → ${newTime}\n  原因：${reason}${sideNote}${paceWarning}` }],
        details: { world, minutes, oldTime: currentTime, newTime, reason, weatherChanges: weatherOps },
      };
    },
  },

  // ── change_location (variable) ──
  change_location: {
    name: 'change_location',
    label: '切换地点',
    category: 'variable',
    description:
      '改变现实或梦境世界中的当前地点。支持地点简称，引擎自动解析为完整路径。\n\n' +
      '【必须调用的场景】\n' +
      '- 玩家移动到新地点（换房间、过马路、进城、下地铁）\n' +
      '- 梦境中移动到其他区域\n' +
      '- 任何导致"当前位置"变化的行动\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中说"你们来到了天台"但不调此工具\n' +
      '- 编造不存在的地点名——先用 lookup_location 确认\n' +
      '- 同时改变时间和地点——时间和地点分开调',
    parameters: {
      type: 'object',
      properties: {
        world: { type: 'string', enum: ['reality', 'dream'], description: '切换哪个世界的地点' },
        location: { type: 'string', description: '目标地点，支持简称如"601室"、"天台"、"幸福小区"。引擎自动解析为完整路径。' },
        reason: { type: 'string', description: '为什么移动到这里' },
      },
      required: ['world', 'location', 'reason'],
    },
    async execute(ctx, params) {
      const world = params?.world as string;
      const rawLocation = params?.location as string;
      const reason = params?.reason as string;
      if (!world || !['reality', 'dream'].includes(world)) {
        return { content: [{ type: 'text', text: '参数错误：world 必须是 reality 或 dream' }] };
      }
      if (!rawLocation) {
        return { content: [{ type: 'text', text: '参数错误：location 不能为空' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }

      const timeField = world === 'reality' ? '现实' : '梦境存档';
      const mapTree = ctx.variables?.['地图'];
      let resolved = rawLocation;
      if (mapTree) {
        const path = resolvePath(rawLocation, mapTree);
        if (path && path.length >= 2) {
          resolved = path.slice(-3).join('-');
        } else if (path && path.length === 1) {
          resolved = path[0];
        }
      }

      ctx.patchVariables([{ op: 'replace', path: `/世界/${timeField}/地点`, value: resolved }]);

      const note = resolved !== rawLocation ? `（解析自 "${rawLocation}"）` : '';
      return {
        content: [{ type: 'text', text: `📍 ${world === 'reality' ? '现实' : '梦境'}地点已切换至：${resolved} ${note}\n  原因：${reason}` }],
        details: { world, rawLocation, resolved, reason },
      };
    },
  },

  // ── change_weather (variable) ──
  change_weather: {
    name: 'change_weather',
    label: '改变天气',
    category: 'variable',
    description:
      '覆盖现实或梦境世界的当前天气。仅限有效枚举值。\n\n' +
      '【必须调用的场景】\n' +
      '- 剧情需要特定天气氛围（暴雨、大雪、大雾）\n' +
      '- 梦境中触发血雨、血雾等异常天气\n\n' +
      '【严禁的行为】\n' +
      '- 编造不存在的天气值——必须从枚举中选择\n' +
      '- 每轮都改天气——只在天气对氛围有实质影响时使用\n' +
      '- 现实天气：晴、多云、阴天、小雨、中雨、大雨、雷阵雨、小雪、中雪、大雪、雾、霾、大风\n' +
      '- 梦境天气：新月、残月、满月（月相）、血雨、血雾（超自然）\n\n' +
      '【注意】\n' +
      '梦境月相（新月/残月/满月）由日期自动计算，日期翻篇时会重置。血雨/血雾是超自然覆盖，下次日期变化时也会回到月相。',
    parameters: {
      type: 'object',
      properties: {
        world: { type: 'string', enum: ['reality', 'dream'], description: '改变哪个世界的天气' },
        weather: { type: 'string', description: '天气值。现实：晴/多云/阴天/小雨/中雨/大雨/雷阵雨/小雪/中雪/大雪/雾/霾/大风。梦境：新月/残月/满月/血雨/血雾。' },
        reason: { type: 'string', description: '为什么改成这个天气' },
      },
      required: ['world', 'weather', 'reason'],
    },
    async execute(ctx, params) {
      const world = params?.world as string;
      const weather = params?.weather as string;
      const reason = params?.reason as string;
      if (!world || !['reality', 'dream'].includes(world)) {
        return { content: [{ type: 'text', text: '参数错误：world 必须是 reality 或 dream' }] };
      }
      if (!weather) {
        return { content: [{ type: 'text', text: '参数错误：weather 不能为空' }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空，需说明为什么改成这个天气' }] };
      }

      if (world === 'reality') {
        if (!isValidRealityWeather(weather)) {
          return { content: [{ type: 'text', text: `无效的现实天气值: ${weather}。允许值: 晴, 多云, 阴天, 小雨, 中雨, 大雨, 雷阵雨, 小雪, 中雪, 大雪, 雾, 霾, 大风` }] };
        }
      } else {
        if (!isValidDreamWeather(weather)) {
          return { content: [{ type: 'text', text: `无效的梦境天气值: ${weather}。允许值: 新月, 残月, 满月, 血雨, 血雾` }] };
        }
      }

      const timeField = world === 'reality' ? '现实' : '梦境存档';
      const oldWeather = ctx.variables?.['世界']?.[timeField]?.['天气'] ?? '未知';
      ctx.patchVariables([{ op: 'replace', path: `/世界/${timeField}/天气`, value: weather }]);

      return {
        content: [{ type: 'text', text: `🌤 ${world === 'reality' ? '现实' : '梦境'}天气: ${oldWeather} → ${weather}\n  原因：${reason}` }],
        details: { world, oldWeather, newWeather: weather, reason },
      };
    },
  },

  // ── toggle_dream (variable) ──
  toggle_dream: {
    name: 'toggle_dream',
    label: '梦境切换',
    category: 'variable',
    description:
      '进入或离开梦境世界。切换时会自动更新梦境倒计时、验证装备位面。\n\n' +
      '【必须调用的场景】\n' +
      '- 玩家入睡进入梦境时\n' +
      '- 玩家从梦境中苏醒时\n' +
      '- 任何导致跨越梦境/现实边界的行为\n\n' +
      '【严禁的行为】\n' +
      '- 在叙事中暗示"你进入了梦境"但不调此工具\n' +
      '- 来回反复切换——每次切换都有倒计时限制\n' +
      '- 在未满足入梦条件时强行切换（检查可进入梦境倒计时是否为 00:00）',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['enter', 'wake'], description: 'enter=进入梦境, wake=苏醒回现实' },
        reason: { type: 'string', description: '入梦/苏醒的原因' },
      },
      required: ['action', 'reason'],
    },
    async execute(ctx, params) {
      const action = params?.action as string;
      const reason = params?.reason as string;
      if (!action || !['enter', 'wake'].includes(action)) {
        return { content: [{ type: 'text', text: '参数错误：action 必须是 enter 或 wake' }] };
      }

      const currentlyInDream = ctx.variables?.['世界']?.['位于梦境'] === true;

      if (action === 'enter' && currentlyInDream) {
        return { content: [{ type: 'text', text: '⚠️ 已经在梦境中，无需再次进入' }] };
      }
      if (action === 'wake' && !currentlyInDream) {
        return { content: [{ type: 'text', text: '⚠️ 已经在现实中，无需再次苏醒' }] };
      }

      // 入梦前检查倒计时（先刷新确保基于最新时间计算）
      if (action === 'enter') {
        injectCountdown(ctx.variables, ctx.dreamAnchor);
        const countdown = ctx.variables?.['世界']?.['倒计时']?.['可进入梦境倒计时'];
        if (countdown && countdown !== '00:00') {
          return { content: [{ type: 'text', text: `⚠️ 入梦条件未满足：可进入梦境倒计时为 ${countdown}，需等待归零后才能入梦。` }] };
        }
      }

      // 记录锚点时间
      if (action === 'enter') {
        const realityTime = ctx.variables?.['世界']?.['现实']?.['时间'];
        ctx.dreamAnchor.lastEnteredAt = realityTime ?? '';
      } else {
        const dreamTime = ctx.variables?.['世界']?.['梦境存档']?.['时间'];
        ctx.dreamAnchor.lastWokeAt = dreamTime ?? '';
      }

      // 切换状态
      ctx.patchVariables([{ op: 'replace', path: '/世界/位于梦境', value: action === 'enter' }]);

      // 验证装备位面（自动卸下不适配物品）
      validateEquipment(ctx.variables);

      // 重算倒计时（状态已切换，重新计算两个倒计时）
      injectCountdown(ctx.variables, ctx.dreamAnchor);

      const label = action === 'enter' ? '🌙 进入梦境' : '☀️ 苏醒回到现实';
      return {
        content: [{ type: 'text', text: `${label}\n  原因：${reason}` }],
        details: { action, reason, dreamAnchor: { ...ctx.dreamAnchor } },
      };
    },
  },

  // ══════════════════════════════════════════════
  // commit_turn — 回合原子提交
  // ══════════════════════════════════════════════

  commit_turn: {
    name: 'commit_turn',
    label: '提交回合',
    category: 'variable',
    description:
      '回合级原子提交：一次调用中完成时间推进和状态变更。所有事件在同一事务中执行，任何失败都会全部回滚。\n\n' +
      '【工作流程】\n' +
      '1. 推进时间（如需要）→ 自动同步天气/生理/倒计时\n' +
      '2. 依次执行 events[] 中的状态变更\n' +
      '3. 返回变更摘要\n\n' +
      '【何时使用】\n' +
      '- 需要推进时间的同时修改状态（战斗、探索、社交）\n' +
      '- 多个状态变更需要一起成功或一起失败\n\n' +
      '【events 支持的类型】\n' +
      '- kind: "resource" → 资源变化（同 update_resource）\n\n' +
      '【示例】\n' +
      '战斗回合：{ summary:"战斗受伤", time:{kind:"elapsed",minutes:5}, events:[{kind:"resource",event:{target:"主角",resource:"生命",action:"spend",amount:10}}] }',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '本回合摘要（必填）' },
        time: {
          type: 'object',
          description: '时间推进设置',
          properties: {
            kind: { type: 'string', enum: ['elapsed', 'none'], description: 'elapsed=经过一段时间, none=不推进时间' },
            minutes: { type: 'number', description: '（elapsed 时必填）推进多少分钟，必须 >0' },
          },
          required: ['kind'],
        },
        events: {
          type: 'array',
          description: '状态事件列表',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['resource'], description: '事件类型' },
              event: {
                type: 'object',
                description: '事件参数。resource 类型同 update_resource 参数（target/resource/action/amount）',
                properties: {
                  target: { type: 'string' },
                  resource: { type: 'string' },
                  action: { type: 'string', enum: ['spend', 'restore', 'set', 'add'] },
                  amount: { type: 'number' },
                },
                required: ['target', 'resource', 'action', 'amount'],
              },
            },
            required: ['kind', 'event'],
          },
        },
      },
      required: ['summary'],
    },
    async execute(ctx, params) {
      const summary = params?.summary as string;
      const time = params?.time as { kind: string; minutes?: number } | undefined;
      const events = (params?.events ?? []) as Array<{ kind: string; event: Record<string, unknown> }>;

      if (!summary || !summary.trim()) {
        return { content: [{ type: 'text', text: '参数错误：summary 不能为空' }] };
      }

      const changeLog: string[] = [];

      // ── 1. 时间推进 ──
      if (time && time.kind === 'elapsed') {
        const minutes = time.minutes as number;
        if (typeof minutes !== 'number' || minutes <= 0) {
          return { content: [{ type: 'text', text: '参数错误：time.kind=elapsed 时 minutes 必须 >0' }] };
        }

        // 复用 advance_time 的时间计算逻辑（仅推进现实世界时间）
        const currentTime = ctx.variables?.['世界']?.['现实']?.['时间'];
        if (!currentTime) {
          return { content: [{ type: 'text', text: '无法读取当前现实时间' }] };
        }
        const parsed = parseWorldTime(currentTime);
        if (!parsed) {
          return { content: [{ type: 'text', text: `无法解析时间字符串: ${currentTime}` }] };
        }

        const totalMinutes = parsed.hour * 60 + parsed.minute + minutes;
        const newMinute = totalMinutes % 60;
        const newHour = Math.floor(totalMinutes / 60) % 24;
        const extraDays = Math.floor(totalMinutes / (60 * 24));
        const newDate = new Date(parsed.year, parsed.month - 1, parsed.day + extraDays);
        const newParsed: ParsedTime = {
          year: newDate.getFullYear(), month: newDate.getMonth() + 1,
          day: newDate.getDate(), hour: newHour, minute: newMinute,
        };
        const newTime = formatWorldTimeFull(newParsed);
        ctx.patchVariables([{ op: 'replace', path: '/世界/现实/时间', value: newTime }]);

        // 同步刷新派生状态（天气/生理/年龄/倒计时）
        const dreamCurrentTime = ctx.variables?.['世界']?.['梦境存档']?.['时间'] ?? '';
        const realityWeather = ctx.variables?.['世界']?.['现实']?.['天气'] ?? '阴天';
        const dreamWeather = ctx.variables?.['世界']?.['梦境存档']?.['天气'] ?? '残月';

        const weather = updateWeatherOnTimeTick(
          getDatePart(currentTime), getDatePart(newTime),
          realityWeather, dreamWeather,
          getDatePart(dreamCurrentTime), getDatePart(dreamCurrentTime),
        );
        if (weather.reality !== realityWeather) {
          ctx.patchVariables([{ op: 'replace', path: '/世界/现实/天气', value: weather.reality }]);
        }
        if (weather.dream !== dreamWeather) {
          ctx.patchVariables([{ op: 'replace', path: '/世界/梦境存档/天气', value: weather.dream }]);
        }

        tickAges(ctx.variables, currentTime, newTime);
        tickAllFemales(ctx.variables, currentTime, newTime, { dreamOnly: false });
        injectCountdown(ctx.variables, ctx.dreamAnchor);

        changeLog.push(`⏰ 现实时间: ${currentTime} → ${newTime}`);
        if (weather.reality !== realityWeather) changeLog.push(`🌤 天气: ${weather.reality}`);
      }

      // ── 2. 执行 events ──
      for (const ev of events) {
        if (ev.kind === 'resource') {
          const e = ev.event;
          const target = e.target as string;
          const resource = e.resource as string;
          const action = e.action as string;
          const amount = e.amount as number;

          if (!target || !resource || !action || typeof amount !== 'number') {
            return { content: [{ type: 'text', text: `事件参数错误: ${JSON.stringify(e)}` }] };
          }

          // 调用 update_resource 的路径解析逻辑
          const isSelf = target === '主角';
          let rp: string | null = null;
          if (isSelf) {
            if (['生命', '体力', '能量', 'SAN'].includes(resource)) rp = `/主角/身体属性/${resource}/当前`;
            else if (resource === '金钱') rp = '/主角/资源/金钱/数值';
            else if (['蝶烬', '尸气'].includes(resource)) rp = `/主角/资源/超凡资源/${resource}`;
            else if (['力量', '体质', '精神', '敏捷'].includes(resource)) rp = `/主角/基础属性/${resource}`;
            else if (['幸运', '魅力'].includes(resource)) rp = `/主角/特殊属性/${resource}`;
            else if (resource === '评级') rp = '/主角/评级';
          } else {
            const chars = ctx.variables?.['主要人物'];
            if (chars) {
              outer: for (const gender of ['女性', '男性']) {
                for (const group of ['异人', '普通人']) {
                  const g = chars[gender]?.[group];
                  if (!g || !g[target]) continue;
                  if (['生命', '能量', 'SAN'].includes(resource)) rp = `/主要人物/${gender}/${group}/${target}/身体属性/${resource}/当前`;
                  else if (resource === '好感值' && gender === '女性') rp = `/主要人物/${gender}/${group}/${target}/好感值`;
                  else if (resource === '堕落值' && gender === '女性') rp = `/主要人物/${gender}/${group}/${target}/堕落值`;
                  else if (resource === '性欲值' && gender === '女性') rp = `/主要人物/${gender}/${group}/${target}/性欲值`;
                  else if (resource === '友善值' && gender === '男性') rp = `/主要人物/${gender}/${group}/${target}/友善值`;
                  else if (['力量', '体质', '精神', '敏捷'].includes(resource)) rp = `/主要人物/${gender}/${group}/${target}/基础属性/${resource}`;
                  else if (['幸运', '魅力'].includes(resource)) rp = `/主要人物/${gender}/${group}/${target}/特殊属性/${resource}`;
                  break outer;
                }
              }
            }
          }
          if (!rp) {
            return { content: [{ type: 'text', text: `未找到资源路径: target="${target}", resource="${resource}"` }] };
          }

          const cv = rp.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
          if (typeof cv !== 'number') {
            return { content: [{ type: 'text', text: `资源当前值不是数字: ${rp}` }] };
          }

          let nv: number;
          switch (action) {
            case 'spend': nv = cv - amount; break;
            case 'set': nv = amount; break;
            case 'add': nv = cv + amount; break;
            case 'restore': {
              const mp = rp.replace('/当前', '/上限');
              const mv = mp.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
              nv = Math.min(cv + amount, typeof mv === 'number' ? mv : 100);
              break;
            }
            default: return { content: [{ type: 'text', text: `未知 action: ${action}` }] };
          }

          // Clamp
          if (['生命', '体力', '能量', 'SAN'].includes(resource)) {
            const mp = rp.replace('/当前', '/上限');
            const mv = mp.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
            nv = Math.max(0, Math.min(nv, typeof mv === 'number' ? mv : 100));
          }
          if (resource === '好感值' || resource === '友善值') nv = Math.max(-200, Math.min(nv, 200));
          if (resource === '堕落值') nv = Math.max(0, Math.min(nv, 500));
          if (resource === '性欲值') nv = Math.max(0, Math.min(nv, 100));

          ctx.patchVariables([{ op: 'replace', path: rp, value: nv }]);
          changeLog.push(`📊 ${target} ${resource}: ${cv} → ${nv}`);
        } else {
          return { content: [{ type: 'text', text: `未知事件类型: ${ev.kind}` }] };
        }
      }

      // ── 3. Pacing 警告 ──
      const warnings: string[] = [];
      if (events.length >= 3) {
        warnings.push('⚠️ Pacing: 本轮已有多个领域事件，请停止推进，将已执行的变更渲染为场景叙事。');
      }
      if (time && time.kind === 'elapsed' && (time.minutes ?? 0) > 30) {
        warnings.push('⚠️ Pacing: 时间跨度较大（>30分钟），请勿继续玩下一个行动窗口，直接进入叙事。');
      }

      const resultText = `📋 回合已提交：${summary}\n${changeLog.join('\n')}${warnings.length > 0 ? '\n\n' + warnings.join('\n') : ''}`;
      return {
        content: [{ type: 'text', text: resultText || `📋 回合已提交：${summary}（无状态变更）` }],
        details: { summary, time, events, changes: changeLog, warnings },
      };
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

/** 排除隐藏工具，按分类分组。前端渲染工具选择面板时使用。 */
export function getToolsByCategory(filterHidden = true): Record<ToolCategory, AgentToolDef[]> {
  const grouped: Record<ToolCategory, AgentToolDef[]> = {
    lookup: [],
    world: [],
    variable: [],
    mechanics: [],
    deprecated: [],
  };
  for (const tool of ALL_TOOLS) {
    if (filterHidden && tool.hidden) continue;
    grouped[tool.category].push(tool);
  }
  return grouped;
}

/** 分类的中文标签 */
export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  lookup: '🔍 查询',
  world: '🌍 世界',
  variable: '📊 变量',
  mechanics: '🎲 机制',
  deprecated: '🗑️ 已降级',
};

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
