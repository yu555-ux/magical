import type { JsonPatchOp } from '../types';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { textResult, findNpc } from './helpers';

export const itemTools: Record<string, AgentToolDef> = {
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
};
