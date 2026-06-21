import type { JsonPatchOp } from '../types';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { textResult, findNpc, clamp } from './helpers';

export const npcTools: Record<string, AgentToolDef> = {

  // ══════════════════════════════════════════════
  // upsert_actor — 创建/更新 NPC
  // ══════════════════════════════════════════════

  upsert_actor: {
    name: 'upsert_actor',
    label: '创建/更新NPC',
    category: 'variable',
    description:
      '创建新 NPC 或更新已有 NPC 的身份信息。LLM 自由创作人物内容，工具负责写入正确路径。\n\n' +
      '【必须调用的场景】\n' +
      '- 玩家首次遇到有名字、有持续互动的角色\n' +
      '- 需要追踪的 NPC（≥1次互动且后续可能再出现）\n' +
      '- NPC 身份/评级/外观/技能发生明确变化需要更新\n\n' +
      '【严禁的行为】\n' +
      '- 为路人/一次性角色创建完整条目（只出现一次、无名字的商贩不需要）\n' +
      '- 更新时覆盖未传入的字段——已存在时只更新被改动的字段\n' +
      '- reason 写成标签而非出场原因\n\n' +
      '【你的职责】\n' +
      '你不是角色工厂，你是世界中人物登场的记录者。\n' +
      'reason 必须描述这个角色是谁、为什么出现在当前故事中。\n' +
      '✅ "在便利店遇到的同班同学，知晓异常事件的线索"  ❌ "创建NPC"\n\n' +
      '【必填】name gender group reason\n' +
      '【身份】age identity tags rating(仅异人) dreamNpc\n' +
      '【位置】location action thought\n' +
      '【身体】lifeMax energyMax(仅异人) sanMax — 上限值，当前自动=上限\n' +
      '【属性】str con spi agi luck charm\n' +
      '【关系】好感值/堕落值/性欲值(仅女性) 友善值(仅男性)\n' +
      '【外观】outfit(仅女性) bodyDev(仅女性) — {部位:{名称,描述}}\n' +
      '【异能】skills(仅异人) items(仅异人)\n' +
      '【社交】socialCircle — {角色名:关系标签}，双向对称\n' +
      '【状态】conditions — {状态名:{描述,持续时间}}\n' +
      '【生理】lastPeriod cycleDays periodLen semen(仅女性) — 子宫初始值\n' +
      '已存在时只更新传入的字段，不覆盖未传字段。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'NPC 名字' },
        gender: { type: 'string', enum: ['女性', '男性'] },
        group: { type: 'string', enum: ['异人', '普通人'], description: '异人=有超自然能力/魔法/异能' },
        age: { type: 'number' },
        identity: { type: 'string', description: '完整身份描述' },
        tags: { type: 'array', items: { type: 'string' }, description: '检索词/别名' },
        rating: { type: 'string', description: '（仅异人）微尘/聚砂/凝石/磐岩/撼山/摧城/覆国/夷地/灭世' },
        dreamNpc: { type: 'boolean' },
        location: { type: 'string' },
        action: { type: 'string', description: '当前正在做什么' },
        thought: { type: 'string', description: '第一人称，约15字' },
        lifeMax: { type: 'number', description: '生命上限' },
        energyMax: { type: 'number', description: '（仅异人）能量上限' },
        sanMax: { type: 'number', description: 'SAN上限' },
        str: { type: 'number' }, con: { type: 'number' }, spi: { type: 'number' }, agi: { type: 'number' },
        luck: { type: 'number' }, charm: { type: 'number' },
        好感值: { type: 'number', description: '（仅女性）-200~200' },
        堕落值: { type: 'number', description: '（仅女性）0~500' },
        性欲值: { type: 'number', description: '（仅女性）0~100' },
        友善值: { type: 'number', description: '（仅男性）-200~200' },
        outfit: { type: 'object', description: '（仅女性）{上衣/下衣/内衣/袜子/鞋子: {名称,描述}}' },
        bodyDev: { type: 'object', description: '（仅女性）{嘴巴/胸部/小穴/屁穴: {描述,使用次数}}' },
        skills: { type: 'object', description: '（仅异人）{技能名: {等级,描述,使用要求,消耗能量,副作用:{},熟练度,分支:{}}}' },
        items: { type: 'object', description: '（仅异人）{灵宝:{},诡物:{},物品:{}}' },
        socialCircle: { type: 'object', description: '{角色名: 关系标签}，双向对称' },
        conditions: { type: 'object', description: '{状态名: {描述,持续时间}}' },
        lastPeriod: { type: 'string', description: '（仅女性）上次经期日 YYYY年MM月DD日' },
        cycleDays: { type: 'number', description: '（仅女性）周期天数，默认28' },
        periodLen: { type: 'number', description: '（仅女性）经期天数，默认5' },
        semen: { type: 'array', items: { type: 'object' }, description: '（仅女性）[{来源,容量,注入时间}]' },
        reason: { type: 'string' },
      },
      required: ['name', 'gender', 'group', 'reason'],
    },
    async execute(ctx, params) {
      const name = params?.name as string;
      const gender = params?.gender as string;
      const group = params?.group as string;
      const reason = params?.reason as string;
      if (!name || !gender || !group || !['女性', '男性'].includes(gender) || !['异人', '普通人'].includes(group)) {
        return { content: [{ type: 'text', text: '参数错误：name, gender(女性/男性), group(异人/普通人) 为必填' }] };
      }
      if (!reason || !reason.trim()) return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };

      const basePath = `/主要人物/${gender}/${group}/${name}`;
      const existing = basePath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
      const isNew = !existing || typeof existing !== 'object' || Object.keys(existing).length < 3;

      // 拼装新 NPC 数据
      const defStat = (v: any, d: number) => typeof v === 'number' ? v : d;

      if (isNew) {
        const data: Record<string, any> = {
          检索词: params?.tags ?? [name],
          梦境NPC: params?.dreamNpc ?? false,
          年龄: params?.age ?? 0,
          身份: params?.identity ?? '',
          社交圈: params?.socialCircle ?? {},
          当前位置: params?.location ?? '',
          当前行动: params?.action ?? '',
          当前想法: params?.thought ?? '',
          状态: params?.conditions ?? {},
        };
        const set = (k: string, v: any) => { if (v !== undefined) data[k] = v; };
        if (group === '异人') set('评级', params?.rating);

        // 身体属性
        const lifeMax = params?.lifeMax ?? 100;
        const sanMax = params?.sanMax ?? 100;
        const body: Record<string, any> = { 生命: { 当前: lifeMax, 上限: lifeMax }, SAN: { 当前: sanMax, 上限: sanMax } };
        if (group === '异人') {
          const eMax = params?.energyMax ?? 100;
          body['能量'] = { 当前: eMax, 上限: eMax };
        }
        data['身体属性'] = body;

        // 基础属性 + 特殊属性
        data['基础属性'] = { 力量: defStat(params?.str, 10), 体质: defStat(params?.con, 10), 精神: defStat(params?.spi, 10), 敏捷: defStat(params?.agi, 10) };
        data['特殊属性'] = { 幸运: defStat(params?.luck, 50), 魅力: defStat(params?.charm, 50) };

        // 关系值
        if (gender === '女性') {
          set('好感值', params?.['好感值'] ?? 0);
          set('堕落值', params?.['堕落值'] ?? 0);
          set('性欲值', params?.['性欲值'] ?? 0);
        } else {
          set('友善值', params?.['友善值'] ?? 0);
        }

        // 外观
        if (gender === '女性') {
          set('着装', params?.outfit ?? { 上衣: {名称:'',描述:''}, 下衣: {名称:'',描述:''}, 内衣: {名称:'',描述:''}, 袜子: {名称:'',描述:''}, 鞋子: {名称:'',描述:''} });
          set('身体开发', params?.bodyDev ?? { 嘴巴: {描述:'',使用次数:0}, 胸部: {描述:'',使用次数:0}, 小穴: {描述:'',使用次数:0}, 屁穴: {描述:'',使用次数:0} });
          // 子宫
          const uterus: Record<string, any> = {
            宫内精液: { 总量: params?.semen ? params.semen.reduce((s: number, e: any) => s + (e.容量||0), 0) : 0, 来源列表: params?.semen ?? [] },
            生理周期: { 上次经期日: params?.lastPeriod ?? '2026年04月01日', 周期天数: params?.cycleDays ?? 28, 经期长度: params?.periodLen ?? 5, 当前阶段: '安全期' },
            怀孕状态: { 状态: '未孕', 受孕日期: null, 父方: null },
            生育记录: [],
          };
          data['子宫'] = uterus;
        }

        // 异能
        if (group === '异人') {
          set('技能', params?.skills ?? {});
          set('所持物品', params?.items ?? { 灵宝:{}, 诡物:{}, 物品:{} });
        }

        ctx.patchVariables([{ op: 'insert', path: basePath, value: data }]);
        return { content: [{ type: 'text', text: `👤 新建 NPC: ${name}（${gender}/${group}）\n  身份: ${data['身份'] || '未填写'}\n  原因：${reason}` }], details: { name, gender, group, reason } };
      }

      // 更新已有 NPC
      const ops: JsonPatchOp[] = [];
      const changed: string[] = [];
      const setField = (key: string, val: any) => { if (val !== undefined) { ops.push({ op: 'replace', path: `${basePath}/${key}`, value: val }); changed.push(key); } };
      setField('身份', params?.identity);
      setField('当前位置', params?.location);
      setField('当前行动', params?.action);
      setField('当前想法', params?.thought);
      if (params?.tags) setField('检索词', params.tags);
      if (ops.length > 0) {
        ctx.patchVariables(ops);
        return { content: [{ type: 'text', text: `👤 更新 NPC: ${name} — ${changed.join('、')}\n  原因：${reason}` }] };
      }
      return { content: [{ type: 'text', text: `${name} 已存在，无需更新（未提供新值）` }] };
    },
  },

  // update_ability — 管理能力
// ══════════════════════════════════════════════

update_ability: {
  name: 'update_ability',
  label: '能力管理',
  category: 'variable',
  description:
    '管理主角或异人 NPC 的能力（仅异人具备能力字段）。能力是角色力量的体现。\n\n' +
    '【必须调用的场景】\n' +
    '- 角色首次展现或习得新能力 → action=create\n' +
    '- 能力熟练度/等级因使用或训练提升 → action=update\n' +
    '- 能力突破性进展，解锁新分支 → action=unlock_branch\n\n' +
    '【严禁的行为】\n' +
    '- 对普通人（非异人）使用——他们没有能力字段\n' +
    '- 未经剧情铺垫就凭空习得高级能力\n' +
    '- reason 写成标签（"升级"）而非习得/提升的来源事件\n\n' +
    '【你的职责】\n' +
    '你不是能力的发明者，你是角色力量成长的记录者。\n' +
    '每次能力变化都应有一个具体的触发事件。\n' +
    '✅ "在与影魔的战斗中领悟了新能力"  ❌ "升级"\n\n' +
    '【action 说明】\n' +
    '- create: 创建新能力条目\n' +
    '- update: 更新已有能力的熟练度/等级\n' +
    '- unlock_branch: 解锁新分支\n\n' +
    '【create 时需提供的字段】\n' +
    '- level: 等级（微尘/聚砂/凝石/磐岩/撼山/摧城/覆国/夷地/灭世）\n' +
    '- desc: 能力描述\n' +
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
      abilityName: { type: 'string', description: '能力名称' },
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
    required: ['target', 'abilityName', 'action', 'reason'],
  },
  async execute(ctx, params) {
    const target = params?.target as string;
    const abilityName = params?.abilityName as string;
    const action = params?.action as string;
    const reason = params?.reason as string;

    if (!target || !abilityName || !action || !['create', 'update', 'unlock_branch'].includes(action)) {
      return { content: [{ type: 'text', text: '参数错误：target、abilityName、action（create/update/unlock_branch）均为必填' }] };
    }
    if (!reason || !reason.trim()) {
      return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
    }

    let skillPath: string;
    if (target === '主角') {
      skillPath = `/主角/技能/${abilityName}`;
    } else {
      const chars = ctx.variables?.['主要人物'];
      skillPath = '';
      if (chars) {
        for (const gender of ['女性', '男性']) {
          const g = chars[gender]?.['异人'];
          if (g?.[target]) {
            skillPath = `/主要人物/${gender}/异人/${target}/技能/${abilityName}`;
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
        return { content: [{ type: 'text', text: `技能 "${abilityName}" 已存在。请使用 action=update 修改` }] };
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
        content: [{ type: 'text', text: `🎯 ${target} 习得新技能: ${abilityName} (${entry['等级']})\n  原因：${reason}` }],
      };
    }

    if (!existing || typeof existing !== 'object') {
      return { content: [{ type: 'text', text: `技能 "${abilityName}" 不存在。请使用 action=create 创建` }] };
    }

    if (action === 'update') {
      const field = params?.field as string;
      const value = params?.value;
      if (!field || value === undefined) {
        return { content: [{ type: 'text', text: '参数错误：action=update 时 field 和 value 均为必填' }] };
      }
      ctx.patchVariables([{ op: 'replace', path: `${skillPath}/${field}`, value }]);
      return {
        content: [{ type: 'text', text: `🎯 ${target} ${abilityName}.${field}: ${JSON.stringify(existing[field])} → ${JSON.stringify(value)}\n  原因：${reason}` }],
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
      content: [{ type: 'text', text: `🎯 ${target} ${abilityName} 解锁新分支: ${branchName}\n  原因：${reason}` }],
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
    '更新女性 NPC 的着装（仅女性角色具备此字段）。着装变化必须是世界中真实发生的事件。\n\n' +
    '【必须调用的场景】\n' +
    '- NPC 主动更换衣物\n' +
    '- 战斗导致衣物破损\n' +
    '- 亲密行为中脱下或更换衣物\n' +
    '- 环境导致着装变化（被雨淋湿、被撕裂等）\n\n' +
    '【严禁的行为】\n' +
    '- 每轮都更新着装——只在发生实际变化时使用\n' +
    '- 描述变化但不调用此工具——AI 叙事中的着装描述必须与变量一致\n' +
    '- reason 写成标签（"换装"）而非原因\n\n' +
    '【你的职责】\n' +
    '你不是衣柜的管理员，你是着装变化的记录者。\n' +
    '每件衣物的变化都应有原因——主动换装、外力破损、还是情境需要。\n\n' +
    '【slot 可选值】上衣 / 下衣 / 内衣 / 袜子 / 鞋子',
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
    '记录女性 NPC 身体开发状态（仅女性角色具备此字段）。每次记录都应是具体亲密事件的后果。\n\n' +
    '【必须调用的场景】\n' +
    '- 亲密行为后对应部位使用次数+1\n' +
    '- 身体开发描述需要更新时\n\n' +
    '【严禁的行为】\n' +
    '- 未经亲密行为就增加使用次数\n' +
    '- 没有对应剧情铺垫就凭空记录\n' +
    '- reason 写成标签（"口交"）而无上下文\n\n' +
    '【你的职责】\n' +
    '你不是身体的评估者，你是亲密事件的记录者。\n' +
    'reason 应简洁但包含触发情境。\n' +
    '✅ "在卧室的亲密互动中"  ❌ "使用"\n\n' +
    '【part 可选值】嘴巴 / 胸部 / 小穴 / 屁穴',
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
    '更新 NPC 的位置、当前行动或当前想法。NPC 和玩家一样在世界上活动——他们的位置在变、行动在推进、想法在产生。\n\n' +
    '【必须调用的场景】\n' +
    '- 与 NPC 互动后，NPC 的位置/行动/想法发生了实质性变化\n' +
    '- NPC 在玩家视野外独立行动后重新出现\n' +
    '- NPC 对玩家产生了新的态度或念头\n' +
    '- 战斗/冲突/事件改变了 NPC 的状态\n\n' +
    '【严禁的行为】\n' +
    '- 每轮都机械式更新——只在发生实质性变化时使用\n' +
    '- 当前想法写成叙事段落——保持15字左右的第一人称心理活动\n' +
    '- 想法包含 NPC 不可能知道的信息（秘密、幕后真相、GM视角事实）\n' +
    '- reason 写成标签（"行动变化"）而非触发事件\n\n' +
    '【你的职责】\n' +
    '你不是 NPC 的操控者，你是他们自主活动的观察者和记录者。\n' +
    '每次更新都应是因为世界中发生了导致变化的事件。\n' +
    '✅ "看到主角受伤后决定帮忙"  ❌ "更新NPC状态"\n\n' +
    '【field 可选值】\n' +
    '- 当前位置: NPC 物理位置变化时更新\n' +
    '- 当前行动: NPC 正在做什么\n' +
    '- 当前想法: 15字左右第一人称心理活动',
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
