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

export function parseWorldTime(time: string): ParsedTime | null {
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

export function hoursBetween(a: ParsedTime, b: ParsedTime): number {
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

export interface SemenEntry {
  来源: string;
  容量: number;        // ml, 该来源当前剩余量（衰减后）
  注入时间: string;    // "YYYY年MM月DD日-HH:MM"
}

export interface Uterus {
  宫内精液: {
    总量: number;              // 所有来源.容量之和，代码自动同步
    来源列表: SemenEntry[];     // 按注入时间排序
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
    宫内精液: { 总量: 0, 来源列表: [] },
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
  dailyProb: number;      // 判定使用的日概率（不再缩放）
  rolled: number;
  success: boolean;
  trigger: 'fresh' | 'daily';  // 触发原因：新鲜注入 | 日期翻篇
  hoursPassed: number;
  cycleDay: number;
  dateCoeff: number;
  ageCoeff: number;
  semenCoeff: number;
  semenVolume: number;
  phase: Phase;
}

/** parseWorldTime 的返回类型 */
export type ParsedTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

// 计算旧来源列表的指纹（来源:注入时间 集合），用于检测新鲜注入
function buildFingerprint(entries: SemenEntry[] | null | undefined): Set<string> {
  const set = new Set<string>();
  if (!entries) return set;
  for (const e of entries) {
    if (e.注入时间) set.add(`${e.来源}:${e.注入时间}`);
  }
  return set;
}

export function tickFemalePhysiology(
  uterus: Uterus,
  worldDate: string,
  age: number,
  hoursPassed: number,
  dateChanged: boolean,
  prevEntries: SemenEntry[] | null,
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

  // 2. 宫内精液衰减（多来源独立衰减）
  const semen = uterus.宫内精液;
  const ovulating = isOvulation(uterus.生理周期.当前阶段);
  if (semen.来源列表.length > 0 && hoursPassed > 0) {
    const rate = ovulating ? 0.97 : 0.85;
    for (const entry of semen.来源列表) {
      entry.容量 = Math.round(entry.容量 * Math.pow(rate, hoursPassed));
    }
    // 清理归零条目，同步总量
    semen.来源列表 = semen.来源列表.filter(e => e.容量 >= 1);
    semen.总量 = semen.来源列表.reduce((sum, e) => sum + e.容量, 0);
  }

  // 3. 受精判定（事件驱动：每条来源独立判定，命中即停）
  let result: FertilizationResult | null = null;
  const canRoll =
    uterus.怀孕状态.状态 === '未孕' &&
    semen.来源列表.length > 0 &&
    ovulating;

  if (canRoll) {
    const prevFingerprint = buildFingerprint(prevEntries);
    const daysSince = daysBetween(uterus.生理周期.上次经期日, worldDate);
    const currentDay = (daysSince % uterus.生理周期.周期天数) + 1;
    const dc = dateCoefficient(currentDay);
    const ac = ageCoefficient(age);

    // 按注入时间排序，先注入的先判定
    for (const entry of semen.来源列表) {
      const entryKey = `${entry.来源}:${entry.注入时间}`;
      const isFresh = !prevFingerprint.has(entryKey);
      if (!(dateChanged || isFresh)) continue;

      const sc = semenCoefficient(entry.容量);
      const prob = dc * ac * sc;
      const rolled = Math.random();

      result = {
        name: '',
        father: entry.来源,
        dailyProb: prob,
        rolled,
        success: rolled < prob,
        trigger: isFresh ? 'fresh' : 'daily',
        hoursPassed,
        cycleDay: currentDay,
        dateCoeff: dc,
        ageCoeff: ac,
        semenCoeff: sc,
        semenVolume: entry.容量,
        phase: uterus.生理周期.当前阶段,
      };

      if (result.success) {
        uterus.怀孕状态.状态 = '受精';
        uterus.怀孕状态.受孕日期 = worldDate;
        uterus.怀孕状态.父方 = entry.来源;
        // 受精后将精液全部清零
        semen.来源列表 = [];
        semen.总量 = 0;
        break;
      }
      // 未命中 → 继续判下一条
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
  opts?: { dreamOnly?: boolean; prevVariables?: Record<string, any> },
): FertilizationResult[] {
  const results: FertilizationResult[] = [];
  const newParsed = parseWorldTime(newTime);
  if (!newParsed) return results;
  const newDate = formatDate(newParsed.year, newParsed.month, newParsed.day);
  const oldParsed = oldTime ? parseWorldTime(oldTime) : null;
  const oldDate = oldParsed ? formatDate(oldParsed.year, oldParsed.month, oldParsed.day) : null;
  const dreamOnly = opts?.dreamOnly ?? false;
  const prevVariables = opts?.prevVariables;

  if (!oldParsed) {
    // 首次 tick：仅初始化周期，不衰减不判定
    runTickPass(variables, newDate, dreamOnly, 0, false, results, null);
    return results;
  }

  const hoursPassed = hoursBetween(oldParsed, newParsed);
  if (hoursPassed <= 0) return results;

  const dateChanged = newDate !== oldDate;
  const daysPassed = dateChanged ? daysBetween(oldDate!, newDate) : 0;

  if (daysPassed > 1) {
    // 跨多天：逐日迭代，每天 24h，每天 dateChanged=true
    for (let d = 1; d <= daysPassed; d++) {
      runTickPass(variables, advanceDate(oldDate!, d), dreamOnly, 24, true, results, null);
    }
  } else {
    // 同一天或跨 1 天：按实际小时数
    runTickPass(variables, newDate, dreamOnly, hoursPassed, dateChanged, results, prevVariables);
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
  prevVariables: Record<string, any> | null,
): void {
  const females = variables?.['主要人物']?.['女性'];
  if (!females) return;

  for (const group of ['异人', '普通人']) {
    const chars = females[group];
    if (!chars || typeof chars !== 'object') continue;
    const prevChars = prevVariables?.['主要人物']?.['女性']?.[group];
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

      // 从 AI 合并前的快照读取旧来源列表，用于指纹比对检测新鲜注入
      const prevData = prevChars?.[charName];
      const prevEntries: SemenEntry[] | null =
        (prevData && typeof prevData === 'object'
          ? prevData['子宫']?.['宫内精液']?.['来源列表']
          : null) ?? null;

      const fr = tickFemalePhysiology(
        data['子宫'], dateStr, age, hoursPassed, dateChanged, prevEntries,
      );
      if (fr) {
        fr.name = charName;
        results.push(fr);
      }
    }
  }
}

// ── 年龄 tick ──

/** 世界年份变化时，所有人物年龄 +1 */
export function tickAges(
  variables: Record<string, any>,
  oldTime: string | null,
  newTime: string,
): void {
  if (!oldTime) return;
  const oldY = parseWorldTime(oldTime)?.year;
  const newY = parseWorldTime(newTime)?.year;
  if (!oldY || !newY || newY <= oldY) return;

  // 主角
  const hero = variables?.['主角'];
  if (hero && typeof hero['年龄'] === 'number') hero['年龄'] += (newY - oldY);

  // 所有人物
  const chars = variables?.['主要人物'];
  if (!chars) return;
  for (const gender of ['女性', '男性']) {
    for (const group of ['异人', '普通人']) {
      const g = chars[gender]?.[group];
      if (!g || typeof g !== 'object') continue;
      for (const name of Object.keys(g)) {
        const c = g[name];
        if (c && typeof c === 'object' && typeof c['年龄'] === 'number') {
          c['年龄'] += (newY - oldY);
        }
      }
    }
  }
}
