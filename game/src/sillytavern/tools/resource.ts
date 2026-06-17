import type { JsonPatchOp } from '../types';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { parseWorldTime, getDatePart, tickAges, tickAllFemales, type ParsedTime } from '../physiology';
import { updateWeatherOnTimeTick } from '../weather';
import { injectCountdown } from '../countdown';
import { textResult, clamp, resolveResourcePath } from './helpers';

function formatWorldTimeFull(t: any): string {
  const base = `${t.year}年${String(t.month).padStart(2,'0')}月${String(t.day).padStart(2,'0')}日-${String(t.hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}`;
  const d = new Date(t.year, t.month - 1, t.day);
  const w = ['日','一','二','三','四','五','六'];
  return base.replace(/(\d{2}日)-/, '$1-星期' + w[d.getDay()] + '-');
}

export const resourceTools: Record<string, AgentToolDef> = {
// update_resource — 资源增减（替代 patch_state）
// ══════════════════════════════════════════════

update_resource: {
  name: 'update_resource',
  label: '更新资源',
  category: 'variable',
  description:
    '修改角色或 NPC 的资源数值。HP/MP/金钱/好感等所有数值变化的统一入口。\n\n' +
    '【必须调用的场景】\n' +
    '- 战斗造成伤害或消耗能量\n' +
    '- 治疗/休息恢复生命或体力\n' +
    '- 交易/奖励/拾取获得或消耗金钱\n' +
    '- NPC 好感度/堕落值/性欲值/友善值发生变化\n' +
    '- 属性值（力量/体质/精神/敏捷/幸运/魅力）发生变化\n\n' +
    '【严禁的行为】\n' +
    '- 在叙事中说"你受了伤""好感上升"但不调用此工具\n' +
    '- 编造数值——必须先 get_status 确认当前值再操作\n' +
    '- 试图修改代码自动管理的字段（倒计时、年龄、子宫生理周期）\n' +
    '- reason 写成标签（"受伤""变化"）而非因果描述\n\n' +
    '【你的职责】\n' +
    '你不是数值的创造者，你是因果的记录者。\n' +
    'reason 必须描述导致数值变化的具体事件，不是变化的名称。\n' +
    '✅ "战斗中被碎片划伤左臂"  ❌ "扣血"\n' +
    '✅ "从柳三娘处购买了镇尸符"  ❌ "获得物品"\n\n' +
    '【支持的目标】\n' +
    '- "主角": 玩家角色\n' +
    '- NPC 名字: 如 "顾昀"、"周汝"、"张云"\n\n' +
    '【支持的资源】\n' +
    '- 主角: 生命、体力、能量、SAN、金钱、蝶烬、尸气、力量、体质、精神、敏捷、幸运、魅力、评级\n' +
    '- NPC: 生命、能量、SAN、好感值（仅女性）、堕落值（仅女性）、性欲值（仅女性）、友善值（仅男性）、力量、体质、精神、敏捷、幸运、魅力\n\n' +
    '【action 含义】\n' +
    '- spend: 消耗（减法），如受伤扣血\n' +
    '- restore: 恢复（加法，不超过上限），如治疗回血\n' +
    '- set: 直接设为指定值\n' +
    '- add: 净增加（加法，可超过上限），如获得金钱',
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
commit_turn: {
  name: 'commit_turn',
  label: '提交回合',
  category: 'variable',
  description:
    '回合级原子提交：一次调用中完成时间推进和多项状态变更。所有事件在同一事务中执行——全部成功或全部回滚。\n\n' +
    '【必须调用的场景】\n' +
    '- 需要同时推进时间并修改一个以上状态时（如"过了5分钟+扣了10HP+加了中毒状态"）\n' +
    '- 多个状态变更之间有因果关联，需要保证原子性\n\n' +
    '【严禁的行为】\n' +
    '- 用 commit_turn 只推进时间——时间跨度<5分钟的单独行动直接用 advance_time\n' +
    '- 用 commit_turn 只做一项资源变更——直接用 update_resource\n' +
    '- summary 写成标签（"战斗""探索"）而非事件概要\n\n' +
    '【你的职责】\n' +
    '你不是状态变更的创造者，你是回合的记录者。\n' +
    'summary 应描述发生了什么事件、为什么这一系列变化在同一回合。\n' +
    '✅ "在与影魔的短暂交手中受伤，消耗了体力和能量"  ❌ "战斗回合"\n\n' +
    '【events 支持的类型】\n' +
    '- kind: "resource" → 资源变化（参数同 update_resource）\n\n' +
    '【示例】\n' +
    '战斗回合：{ summary:"与影魔短暂交手，左臂被划伤，体力消耗严重", time:{kind:"elapsed",minutes:5}, events:[{kind:"resource",event:{target:"主角",resource:"生命",action:"spend",amount:10}},{kind:"resource",event:{target:"主角",resource:"体力",action:"spend",amount:15}}] }',
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
