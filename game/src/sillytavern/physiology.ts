/**
 * 生殖系统 — 纯规则驱动的生理模拟。
 * 代码负责全部计算，AI 只读取结果用于叙事。
 */

// ── 时间工具 ──

const WORLD_TIME_RE = /(\d{4})年(\d{2})月(\d{2})日.*?(\d{2}):(\d{2})/;
const DATE_RE = /(\d{4})年(\d{2})月(\d{2})日/;

interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

export function parseWorldTime(time: string) {
  const m = time.match(WORLD_TIME_RE);
  if (!m) return null;
  return {
    year: +m[1],
    month: +m[2],
    day: +m[3],
    hour: +m[4],
    minute: +m[5],
  };
}

function parseDate(s: string): ParsedDate | null {
  const m = s.match(DATE_RE);
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

export function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  const timeA = new Date(da.year, da.month - 1, da.day).getTime();
  const timeB = new Date(db.year, db.month - 1, db.day).getTime();
  return Math.round((timeB - timeA) / 86400000);
}

export function formatDate(y: number, m: number, d: number): string {
  return `${y}年${String(m).padStart(2, '0')}月${String(d).padStart(2, '0')}日`;
}

export function formatDateTime(y: number, m: number, d: number, h: number, min: number): string {
  return `${formatDate(y, m, d)}-${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function advanceDate(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  const nd = new Date(d.year, d.month - 1, d.day);
  nd.setDate(nd.getDate() + days);
  return formatDate(nd.getFullYear(), nd.getMonth() + 1, nd.getDate());
}

export function getDatePart(worldTime: string): string {
  const t = parseWorldTime(worldTime);
  if (!t) return '';
  return formatDate(t.year, t.month, t.day);
}

export function hoursBetween(
  a: { year: number; month: number; day: number; hour: number; minute: number },
  b: { year: number; month: number; day: number; hour: number; minute: number },
): number {
  const timeA = new Date(a.year, a.month - 1, a.day, a.hour, a.minute).getTime();
  const timeB = new Date(b.year, b.month - 1, b.day, b.hour, b.minute).getTime();
  return (timeB - timeA) / 3600000;
}

// ── 阶段判定 ──

export type Phase = '经期' | '安全期' | '排卵期';

export function determinePhase(currentDay: number, periodLen: number): Phase {
  if (currentDay <= periodLen) return '经期';
  if (currentDay < 14) return '安全期';
  if (currentDay <= 16) return '排卵期';
  return '安全期';
}

function isOvulation(phase: string): boolean {
  return phase === '排卵期';
}

// ── 系数查表 ──

function dateCoefficient(currentDay: number): number {
  if (currentDay === 14) return 0.12;
  if (currentDay === 15) return 0.09;
  if (currentDay === 16) return 0.05;
  return 0;
}

function ageCoefficient(age: number): number {
  if (age < 20) return 1.1;
  if (age <= 25) return 1.0;
  if (age <= 30) return 0.9;
  if (age <= 35) return 0.6;
  if (age <= 40) return 0.3;
  return 0.1;
}

function semenCoefficient(volume: number): number {
  // 6 档：1ml→0.35, 3ml→0.7, 5ml→1.0, 10ml→1.35, 20ml→1.6, 50ml→3.0
  // 超过 50ml 用幂函数外推：3.0 × (量 / 50) ^ 1.2
  const tiers: [number, number][] = [
    [1, 0.35],
    [3, 0.7],
    [5, 1.0],
    [10, 1.35],
    [20, 1.6],
    [50, 3.0],
  ];
  if (volume <= tiers[0][0]) return tiers[0][1];
  for (let i = 0; i < tiers.length - 1; i++) {
    const [v1, c1] = tiers[i];
    const [v2, c2] = tiers[i + 1];
    if (volume <= v2) {
      const t = (volume - v1) / (v2 - v1);
      return c1 + t * (c2 - c1);
    }
  }
  // 超过 50ml：幂函数外推，不封顶
  return 3.0 * Math.pow(volume / 50, 1.2);
}

// ── 类型 ──

export interface Uterus {
  宫内精液: {
    总量: number;
    来源: string | null;
    注入时间: string | null;
  };
  生理周期: {
    上次经期日: string;
    周期天数: number;
    经期长度: number;
    当前阶段: Phase;
  };
  怀孕状态: {
    状态: '未孕' | '受精' | '早孕' | '中孕' | '晚孕' | '产褥期';
    受孕日期: string | null;
    父方: string | null;
  };
  生育记录: Array<{
    生产日期: string;
    父方: string;
    孩子: string;
  }>;
}

// ── 默认子宫 ──

export function createDefaultUterus(
  lastPeriod: string,
  cycleDays: number,
  periodLen: number,
): Uterus {
  return {
    宫内精液: { 总量: 0, 来源: null, 注入时间: null },
    生理周期: {
      上次经期日: lastPeriod,
      周期天数: cycleDays,
      经期长度: periodLen,
      当前阶段: '安全期',
    },
    怀孕状态: { 状态: '未孕', 受孕日期: null, 父方: null },
    生育记录: [],
  };
}

// ── 小时级 tick ──

export interface FertilizationResult {
  name: string;
  father: string | null;
  probability: number;
  rolled: number;
  success: boolean;
}

export function tickFemalePhysiology(
  uterus: Uterus,
  worldDate: string,
  age: number,
  hoursPassed: number,
  dateChanged: boolean,
): FertilizationResult | null {
  // 1. 生理周期（仅日期变化且未孕时运行）
  if (dateChanged && uterus.怀孕状态.状态 === '未孕') {
    const cycle = uterus.生理周期.周期天数;
    const periodLen = uterus.生理周期.经期长度;
    let daysSince = daysBetween(uterus.生理周期.上次经期日, worldDate);

    while (daysSince >= cycle) {
      uterus.生理周期.上次经期日 = advanceDate(uterus.生理周期.上次经期日, cycle);
      daysSince = daysBetween(uterus.生理周期.上次经期日, worldDate);
    }

    const currentDay = (daysSince % cycle) + 1;
    uterus.生理周期.当前阶段 = determinePhase(currentDay, periodLen);
  }

  // 2. 宫内精液衰减（按实际小时数）
  const semen = uterus.宫内精液;
  if (semen.总量 > 0 && hoursPassed > 0) {
    const rate = isOvulation(uterus.生理周期.当前阶段) ? 0.97 : 0.85;
    semen.总量 = Math.round(semen.总量 * Math.pow(rate, hoursPassed));

    if (semen.总量 < 1) {
      semen.总量 = 0;
      semen.来源 = null;
      semen.注入时间 = null;
    }
  }

  // 3. 受精判定（每次时间推进都判定，概率按小时比例缩放）
  let result: FertilizationResult | null = null;
  if (
    uterus.怀孕状态.状态 === '未孕' &&
    semen.总量 > 0 &&
    isOvulation(uterus.生理周期.当前阶段) &&
    hoursPassed > 0
  ) {
    const daysSince = daysBetween(uterus.生理周期.上次经期日, worldDate);
    const currentDay = (daysSince % uterus.生理周期.周期天数) + 1;
    const dailyProb = dateCoefficient(currentDay) * ageCoefficient(age) * semenCoefficient(semen.总量);
    const scaledProb = dailyProb * (hoursPassed / 24);
    const rolled = Math.random();

    result = {
      name: '', // 由调用方填入
      father: semen.来源,
      probability: scaledProb,
      rolled,
      success: rolled < scaledProb,
    };

    if (result.success) {
      uterus.怀孕状态.状态 = '受精';
      uterus.怀孕状态.受孕日期 = worldDate;
      uterus.怀孕状态.父方 = semen.来源;
    }
  }

  // 4. 怀孕阶段推进（仅日期变化时）
  if (dateChanged) {
    const status = uterus.怀孕状态.状态;
    if (['受精', '早孕', '中孕', '晚孕'].includes(status) && uterus.怀孕状态.受孕日期) {
      const gestationalWeeks = Math.floor(daysBetween(uterus.怀孕状态.受孕日期, worldDate) / 7);

      if (gestationalWeeks >= 38 && status === '晚孕') {
        uterus.怀孕状态.状态 = '产褥期';
      } else if (gestationalWeeks >= 28 && status === '中孕') {
        uterus.怀孕状态.状态 = '晚孕';
      } else if (gestationalWeeks >= 14 && status === '早孕') {
        uterus.怀孕状态.状态 = '中孕';
      } else if (gestationalWeeks >= 2 && status === '受精') {
        uterus.怀孕状态.状态 = '早孕';
      }
    }

    // 5. 产褥期恢复
    if (uterus.怀孕状态.状态 === '产褥期' && uterus.怀孕状态.受孕日期) {
      const deliveryDate = advanceDate(uterus.怀孕状态.受孕日期, 266);
      const ppDays = daysBetween(deliveryDate, worldDate);

      if (ppDays >= 42) {
        uterus.怀孕状态.状态 = '未孕';
        uterus.怀孕状态.受孕日期 = null;
        uterus.怀孕状态.父方 = null;
        uterus.生理周期.上次经期日 = worldDate;
        uterus.生理周期.当前阶段 = '经期';
      }
    }
  }

  return result;
}

// ── 批量 tick ──

export function tickAllFemales(
  variables: Record<string, any>,
  oldTime: string | null,
  newTime: string,
  opts?: { dreamOnly?: boolean },
): FertilizationResult[] {
  const results: FertilizationResult[] = [];
  const newParsed = parseWorldTime(newTime);
  if (!newParsed) return results;
  const newDate = formatDate(newParsed.year, newParsed.month, newParsed.day);
  const oldParsed = oldTime ? parseWorldTime(oldTime) : null;
  const oldDate = oldParsed ? formatDate(oldParsed.year, oldParsed.month, oldParsed.day) : null;
  const dreamOnly = opts?.dreamOnly ?? false;

  if (!oldParsed) {
    // 首次 tick：仅初始化周期，不衰减不判定
    runTickPass(variables, newDate, dreamOnly, 0, false, results);
    return results;
  }

  const hoursPassed = hoursBetween(oldParsed, newParsed);
  if (hoursPassed <= 0) return results;

  const dateChanged = newDate !== oldDate;
  const daysPassed = dateChanged ? daysBetween(oldDate!, newDate) : 0;

  if (daysPassed > 1) {
    // 跨多天：逐日迭代，每天 24h
    for (let d = 1; d <= daysPassed; d++) {
      runTickPass(variables, advanceDate(oldDate!, d), dreamOnly, 24, true, results);
    }
  } else {
    // 同一天或跨 1 天：按实际小时数
    runTickPass(variables, newDate, dreamOnly, hoursPassed, dateChanged, results);
  }
  return results;
}

function runTickPass(
  variables: Record<string, any>,
  dateStr: string,
  dreamOnly: boolean,
  hoursPassed: number,
  dateChanged: boolean,
  results: FertilizationResult[],
): void {
  const females = variables?.['主要人物']?.['女性'];
  if (!females) return;

  for (const group of ['异人', '普通人']) {
    const chars = females[group];
    if (!chars || typeof chars !== 'object') continue;
    for (const charName of Object.keys(chars)) {
      const data = chars[charName];
      if (!data || typeof data !== 'object') continue;

      const isDreamNPC = data['梦境NPC'] === true;
      if (dreamOnly ? !isDreamNPC : isDreamNPC) continue;

      const age = data['年龄'];
      if (typeof age !== 'number') continue;

      if (!data['子宫'] || typeof data['子宫'] !== 'object') {
        data['子宫'] = createDefaultUterus('2026年03月28日', 28, 5);
      }

      const fr = tickFemalePhysiology(data['子宫'], dateStr, age, hoursPassed, dateChanged);
      if (fr) {
        fr.name = charName;
        results.push(fr);
      }
    }
  }
}
