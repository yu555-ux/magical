/**
 * 天气系统 — 现实天气季节轮换 + 梦境月相计算。
 *
 * 现实天气：枚举约束，日期翻篇时按季节加权随机轮换。
 * 梦境天气：月相（新月/残月/满月）由日期计算 + 可被 AI 覆盖为血雨/血雾。
 *
 * 所有写入都走 世界.现实.天气 和 世界.梦境存档.天气。
 */

import { parseWorldTime, getDatePart, daysBetween, advanceDate, type ParsedTime } from './physiology';

// ── 枚举定义 ──

/** 现实天气可选值 */
export const REALITY_WEATHER = [
  '晴', '多云', '阴天',
  '小雨', '中雨', '大雨', '雷阵雨',
  '小雪', '中雪', '大雪',
  '雾', '霾', '大风',
] as const;
export type RealityWeather = (typeof REALITY_WEATHER)[number];

/** 梦境月相（代码计算） */
export const DREAM_MOON_PHASES = ['新月', '残月', '满月'] as const;
export type DreamMoonPhase = (typeof DREAM_MOON_PHASES)[number];

/** 梦境超自然天气（AI 可覆盖） */
export const DREAM_SUPERNATURAL = ['血雨', '血雾'] as const;
export type DreamSupernatural = (typeof DREAM_SUPERNATURAL)[number];

/** 梦境天气完整枚举 */
export const DREAM_WEATHER = [...DREAM_MOON_PHASES, ...DREAM_SUPERNATURAL] as const;
export type DreamWeather = (typeof DREAM_WEATHER)[number];

// ── 月相计算 ──

/** 参考新月日（2026-04-03），农历初一 */
const REFERENCE_NEW_MOON = '2026年04月03日';
const LUNAR_CYCLE = 29;
const NEW_MOON_DAYS = 1;          // 新月仅第1天
const FULL_MOON_START = 14;
const FULL_MOON_END = 16;

/**
 * 根据梦境日期计算月相。
 * 以 2026-04-03 为参考新月日，每 29 天一个循环。
 */
export function computeMoonPhase(dreamDate: string): DreamMoonPhase {
  const days = daysBetween(REFERENCE_NEW_MOON, dreamDate);
  const dayInCycle = ((days % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE + 1;

  if (dayInCycle <= NEW_MOON_DAYS) return '新月';
  if (dayInCycle >= FULL_MOON_START && dayInCycle <= FULL_MOON_END) return '满月';
  return '残月';
}

// ── 现实天气轮换 ──

/** 按月份返回季节加权天气候选池 */
function seasonPool(month: number): RealityWeather[] {
  if (month >= 3 && month <= 5) {
    // 春
    return ['晴', '晴', '多云', '多云', '阴天', '小雨', '小雨', '雾'];
  }
  if (month >= 6 && month <= 8) {
    // 夏
    return ['晴', '晴', '晴', '多云', '阴天', '小雨', '中雨', '大雨', '雷阵雨', '雷阵雨', '大风'];
  }
  if (month >= 9 && month <= 11) {
    // 秋
    return ['晴', '晴', '多云', '多云', '阴天', '阴天', '小雨', '中雨', '雾'];
  }
  // 冬 (12-2)
  return ['晴', '多云', '多云', '阴天', '阴天', '阴天', '小雪', '中雪', '霾'];
}

/** 随机抽取现实天气 */
export function rollRealityWeather(month: number): RealityWeather {
  const pool = seasonPool(month);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 校验是否为合法的现实天气值 */
export function isValidRealityWeather(v: unknown): v is RealityWeather {
  return typeof v === 'string' && (REALITY_WEATHER as readonly string[]).includes(v);
}

/** 校验是否为合法的梦境天气值 */
export function isValidDreamWeather(v: unknown): v is DreamWeather {
  return typeof v === 'string' && (DREAM_WEATHER as readonly string[]).includes(v);
}

// ── 天气更新（由 time_changed subscriber 调用） ──

export interface WeatherUpdate {
  reality: string;
  dream: string;
}

/**
 * 根据时间变化更新天气。
 * - 现实天气：日期翻篇时按季节随机轮换
 * - 梦境天气：日期变化时重新计算月相；若当前是超自然天气则保留（直到日期再次变化时重置为月相）
 */
export function updateWeatherOnTimeTick(
  oldDate: string | null,
  newDate: string,
  currentRealityWeather: string,
  currentDreamWeather: string,
  newDreamDate: string,
  oldDreamDate: string | null,
): WeatherUpdate {
  const realityDateChanged = oldDate !== newDate;
  const dreamDateChanged = oldDreamDate !== newDreamDate;

  let reality = currentRealityWeather;
  let dream = currentDreamWeather;

  // 现实：日期翻篇 → 轮换
  if (realityDateChanged && newDate) {
    const month = parseMonth(newDate);
    reality = rollRealityWeather(month ?? 4);
  }

  // 梦境：日期变化 → 月相覆盖超自然天气
  if (dreamDateChanged && newDreamDate) {
    const moon = computeMoonPhase(newDreamDate);
    // 如果当前是月相则更新，如果是超自然则重置为月相
    if ((DREAM_SUPERNATURAL as readonly string[]).includes(currentDreamWeather)) {
      dream = moon; // 日期翻篇 → 血雨/血雾消散，回到月相
    } else {
      dream = moon;
    }
  }

  return { reality, dream };
}

// ── 辅助 ──

/** 从日期字符串提取月份，支持 "YYYY年MM月DD日" 和 "YYYY年MM月DD日-星期X-HH:MM" */
function parseMonth(dateStr: string): number | null {
  // 先尝试纯日期格式
  const dm = dateStr.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (dm) return parseInt(dm[2], 10);
  // 再尝试完整时间格式
  const t = parseWorldTime(dateStr);
  return t?.month ?? null;
}
