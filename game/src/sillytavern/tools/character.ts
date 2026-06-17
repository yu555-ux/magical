import type { JsonPatchOp } from '../types';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { textResult, findNpc } from './helpers';

export const characterTools: Record<string, AgentToolDef> = {
// add_condition — 添加异常状态
// ══════════════════════════════════════════════

add_condition: {
  name: 'add_condition',
  label: '添加状态',
  category: 'variable',
  description:
    '向主角或 NPC 添加异常状态条目。状态会在状态面板中显示，每一条都是游戏世界里的真实后果。\n\n' +
    '【必须调用的场景】\n' +
    '- 战斗受伤后添加伤势状态（擦伤/骨折/内出血等）\n' +
    '- 受到诅咒/中毒/精神污染/寄生\n' +
    '- 获得临时 buff/debuff（强化/虚弱/魅惑等）\n' +
    '- 环境导致的异常（冻伤/中暑/缺氧等）\n\n' +
    '【严禁的行为】\n' +
    '- 在叙事中说"你中毒了""你受伤了"但不调用此工具\n' +
    '- 持续时间用模糊表述（"一会儿"应写为"30分钟"；"一阵子"应写为"1小时"）\n' +
    '- 状态名称直接用数值标签（❌"HP-20" ✅"左臂划伤"）\n' +
    '- reason 写成标签（"受伤"）而非原因\n\n' +
    '【你的职责】\n' +
    '你不是状态的发明者，你是伤势和异常的记录者。\n' +
    '每个状态必须有一个清晰的具体原因——是什么导致了它。\n' +
    '✅ "战斗中左臂被碎片飞溅划伤"  ❌ "扣血"\n\n' +
    '【duration 格式】\n' +
    '- "永久": 长期状态（如"奇迹枯竭"）\n' +
    '- "3小时": 指定持续时间\n' +
    '- "直到治疗为止": 条件持续类型',
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
    '从主角或 NPC 移除异常状态条目。状态的消失也必须是真实发生的——不是"时间到了自动消失"的叙事补丁。\n\n' +
    '【必须调用的场景】\n' +
    '- 状态持续时间自然到期\n' +
    '- 治疗/净化/解咒/手术成功\n' +
    '- 剧情中状态因某种原因消失（buff被驱散、诅咒被解除）\n\n' +
    '【严禁的行为】\n' +
    '- 在叙事中说"伤好了""毒消了"但不调用此工具\n' +
    '- 移除不存在或已经过期的状态——先用 get_status 确认\n' +
    '- reason 写成标签（"愈合"）而非恢复方式\n\n' +
    '【你的职责】\n' +
    '你不是恢复的宣告者，你是恢复过程的记录者。\n' +
    'reason 必须描述状态是如何消失的——是时间自然恢复，还是治疗干预。\n' +
    '✅ "经过3小时休息后自然消退"  ❌ "状态消失"',
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
    '管理主角与 NPC 的社交关系。关系必须是因为具体事件而改变，不是叙事的装饰品。\n\n' +
    '【必须调用的场景】\n' +
    '- 与 NPC 关系发生质变（陌生人→朋友、朋友→恋人、队友→决裂）\n' +
    '- 双方明确约定或公开承认某种关系\n' +
    '- 关系因事件恶化到无法维持原状\n\n' +
    '【严禁的行为】\n' +
    '- 为路人/一面之缘添加社交条目\n' +
    '- 单向认识、单方面好感就添加——需双方有明确互动且关系已落定\n' +
    '- reason 写成标签（"关系变化"）而非触发事件\n\n' +
    '【你的职责】\n' +
    '你不是关系的发明者，你是社交事实的记录者。\n' +
    '每一条关系都应有具体的落定事件——什么共同经历导致了这个关系。\n' +
    '✅ "一同经历了影魔战斗后互相信任"  ❌ "好感上升"\n\n' +
    '【双向对称】更新主角→NPC 后需手动反向调用，更新 NPC→主角。\n' +
    '【关系措辞】简洁明确：朋友、恋人、队友、上司、母子、姐弟 等',
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
};
