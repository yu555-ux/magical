import type { JsonPatchOp } from "../types";
import { parseWorldTime, formatDateTime, getDatePart, tickAges, tickAllFemales, type ParsedTime } from '../physiology';
import { isValidRealityWeather, isValidDreamWeather, updateWeatherOnTimeTick } from '../weather';
import { resolvePath } from '../var-map';
import { validateEquipment } from '../var-clamp';
import { injectCountdown } from '../countdown';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { textResult } from './helpers';

function formatWorldTime(t: ParsedTime): string {
  return `${formatDateTime(t.year, t.month, t.day, t.hour, t.minute)}`;
}
function computeWeekday(t: ParsedTime): string {
  const d = new Date(t.year, t.month - 1, t.day);
  const w = ['日','一','二','三','四','五','六'];
  return `星期${w[d.getDay()]}`;
}
function formatWorldTimeFull(t: ParsedTime): string {
  const base = formatWorldTime(t);
  const wd = computeWeekday(t);
  return base.replace(/(\d{2}日)-/, `$1-${wd}-`);
}

export const worldTools: Record<string, AgentToolDef> = {
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
    '- 编造不存在的地点名——用 get_status 查看地图树确认\n' +
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
      if (path && path.length >= 1) {
        // 只取最后一级地点（秋青规则：每次只更新最后一级）
        resolved = path[path.length - 1];
      } else {
        return { content: [{ type: 'text', text: `「${rawLocation}」未在地图树中找到。请先用 update_map add_child 创建该地点（可填 wDesc/dDesc/winfo 详细描述），再移动到这里。` }] };
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

};
