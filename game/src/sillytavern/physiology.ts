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

function toJd(y: number, m: number, d: number): number {
  return Math.floor(new Date(y, m - 1, d).getTime() / 86400000);
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
  return toJd(db.year, db.month, db.day) - toJd(da.year, da.month, da.day);
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
  const jd = toJd(d.year, d.month, d.day) + days;
  const nd = new Date(jd * 86400000);
  return formatDate(nd.getFullYear(), nd.getMonth() + 1, nd.getDate());
}

export function getDatePart(worldTime: string): string {
  const t = parseWorldTime(worldTime);
  if (!t) return '';
  return formatDate(t.year, t.month, t.day);
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

// ── 历史阶段推算（用于衰减逐日迭代） ──

function phaseOnDate(
  uterus: Uterus,
  dateStr: string,
): Phase {
  const status = uterus.怀孕状态.状态;
  // 怀孕后周期冻结：受孕日起，所有日期视为非排卵期
  if (status !== '未孕' && uterus.怀孕状态.受孕日期) {
    if (daysBetween(uterus.怀孕状态.受孕日期, dateStr) >= 0) return '安全期';
  }

  let daysSince = daysBetween(uterus.生理周期.上次经期日, dateStr);
  // 补齐可能的历史周期推进
  const cycle = uterus.生理周期.周期天数;
  while (daysSince >= cycle) daysSince -= cycle;
  const cd = (daysSince % cycle) + 1;
  return determinePhase(cd, uterus.生理周期.经期长度);
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

// ── 单日 tick ──

export function tickFemalePhysiology(
  uterus: Uterus,
  worldDate: string,
  age: number,
  prevDate?: string,
): void {
  // 1. 生理周期（仅未孕时运行）
  if (uterus.怀孕状态.状态 === '未孕') {
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

  // 2. 宫内精液衰减（只衰减上次tick到本次tick之间的天数，避免重复计算）
  const semen = uterus.宫内精液;
  if (semen.总量 > 0 && semen.注入时间) {
    const injDateMatch = semen.注入时间.match(DATE_RE);
    const injDate = injDateMatch ? injDateMatch[0] : semen.注入时间;
    const daysTotal = daysBetween(injDate, worldDate);

    // 如果传了 prevDate，跳过已衰减的天数，只处理新增的日期
    const alreadyDecayed = prevDate ? daysBetween(injDate, prevDate) : 0;
    const startD = Math.max(1, alreadyDecayed + 1);

    for (let d = startD; d <= daysTotal; d++) {
      const thatDate = advanceDate(injDate, d);
      const thatPhase = phaseOnDate(uterus, thatDate);
      const rate = isOvulation(thatPhase) ? 0.97 : 0.85;
      semen.总量 = Math.round(semen.总量 * Math.pow(rate, 24));

      if (semen.总量 < 1) {
        semen.总量 = 0;
        semen.来源 = null;
        semen.注入时间 = null;
        break;
      }
    }
  }

  // 3. 受精判定
  if (
    uterus.怀孕状态.状态 === '未孕' &&
    semen.总量 > 0 &&
    isOvulation(uterus.生理周期.当前阶段)
  ) {
    const daysSince = daysBetween(uterus.生理周期.上次经期日, worldDate);
    const currentDay = (daysSince % uterus.生理周期.周期天数) + 1;
    const prob = dateCoefficient(currentDay) * ageCoefficient(age) * semenCoefficient(semen.总量);

    if (Math.random() < prob) {
      uterus.怀孕状态.状态 = '受精';
      uterus.怀孕状态.受孕日期 = worldDate;
      uterus.怀孕状态.父方 = semen.来源;
    }
  }

  // 4. 怀孕阶段推进
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

// ── 受精事件 ──

export interface FertilizationEvent {
  name: string;
  father: string;
}

// ── 批量 tick（按日迭代） ──

export function tickAllFemales(
  variables: Record<string, any>,
  oldTime: string | null,
  newTime: string,
  opts?: { dreamOnly?: boolean },
): FertilizationEvent[] {
  const events: FertilizationEvent[] = [];
  const newDate = getDatePart(newTime);
  if (!newDate) return events;
  const oldDate = oldTime ? getDatePart(oldTime) : null;
  const dreamOnly = opts?.dreamOnly ?? false;

  if (!oldDate) {
    runTickPass(variables, newDate, dreamOnly, events);
    return events;
  }

  const daysPassed = daysBetween(oldDate, newDate);
  if (daysPassed <= 0) return events;

  for (let d = 1; d <= daysPassed; d++) {
    const prevDate = d === 1 ? oldDate! : advanceDate(oldDate, d - 1);
    runTickPass(variables, advanceDate(oldDate, d), dreamOnly, events, prevDate);
  }
  return events;
}

function runTickPass(variables: Record<string, any>, dateStr: string, dreamOnly: boolean, events: FertilizationEvent[], prevDate?: string): void {
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

      const oldStatus = data['子宫']?.怀孕状态?.状态;
      tickFemalePhysiology(data['子宫'], dateStr, age, prevDate);
      const newStatus = data['子宫']?.怀孕状态?.状态;
      if (oldStatus === '未孕' && newStatus === '受精') {
        events.push({ name: charName, father: data['子宫'].怀孕状态.父方 ?? '未知' });
      }
    }
  }
}
