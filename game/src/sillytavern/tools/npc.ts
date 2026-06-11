import type { JsonPatchOp } from '../types';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { textResult, findNpc, clamp } from './helpers';

export const npcTools: Record<string, AgentToolDef> = {
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
};
