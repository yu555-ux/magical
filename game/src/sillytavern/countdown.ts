/**
 * 倒计时引擎 — 完全由代码控制，AI 无法写入。
 *
 * 两个倒计时基于锚点时间 + 当前世界时间自动计算：
 *  - 可进入梦境倒计时：苏醒后从 24:00 倒计时，归零可再次入梦
 *  - 离开梦境倒计时：  入梦后从 24:00 倒计时，归零强制苏醒
 */

import { parseWorldTime } from './physiology';
import type { DreamAnchor } from './types';

// ── 时间差计算 ──

/**
 * 计算两个世界时间字符串之间的分钟差（timeB - timeA）。
 * timeA 晚于 timeB（时间回退）时钳制为 0，防止负数倒计时。
 */
function minutesBetween(timeA: string, timeB: string): number {
  const a = parseWorldTime(timeA);
  const b = parseWorldTime(timeB);
  if (!a || !b) return 0;
  const dA = new Date(a.year, a.month - 1, a.day, a.hour, a.minute);
  const dB = new Date(b.year, b.month - 1, b.day, b.hour, b.minute);
  return Math.max(0, Math.floor((dB.getTime() - dA.getTime()) / 60000));
}

// ── 格式化 ──

const H24 = 1440; // 24 小时的分钟数

/** 将分钟数（0~1440）格式化为 "HH:MM"，超范围自动钳制。 */
export function formatCountdown(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(H24, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── 核心计算 ──

/**
 * 根据锚点时间 + 当前世界时间计算两个倒计时。
 *
 * 边界情况：
 *  - 锚点不存在（首次/旧存档）：可进入 = "00:00"，离开 = "24:00"
 *  - 时间回退：流逝分钟钳制为 0，倒计时保持 24:00
 *  - 不在梦境时离开倒计时恒为 "00:00"，在梦境时可进入倒计时恒为 "00:00"
 */
export function computeCountdowns(
  inDream: boolean,
  realityTime: string | null | undefined,
  dreamTime: string | null | undefined,
  anchor: DreamAnchor | null | undefined,
): { 可进入梦境倒计时: string; 离开梦境倒计时: string } {
  // ── 可进入梦境倒计时 ──
  let canEnter: string;
  if (inDream) {
    canEnter = '00:00';
  } else if (anchor?.lastWokeAt && realityTime) {
    const elapsed = minutesBetween(anchor.lastWokeAt, realityTime);
    canEnter = formatCountdown(Math.max(0, H24 - elapsed));
  } else {
    // 无锚点（首次运行或从未苏醒）→ 可直接入梦
    canEnter = '00:00';
  }

  // ── 离开梦境倒计时 ──
  let leave: string;
  if (!inDream) {
    leave = '00:00';
  } else if (anchor?.lastEnteredAt && dreamTime) {
    const elapsed = minutesBetween(anchor.lastEnteredAt, dreamTime);
    leave = formatCountdown(Math.max(0, H24 - elapsed));
  } else {
    // 入梦但无锚点 → 满倒计时
    leave = '24:00';
  }

  return { 可进入梦境倒计时: canEnter, 离开梦境倒计时: leave };
}

/**
 * 将计算出的倒计时注入到变量对象中（原地修改）。
 * 用于提示拼装和显示层 — 确保 AI 和 UI 看到的始终是代码计算值。
 */
export function injectCountdown(
  vars: Record<string, any>,
  anchor: DreamAnchor | null | undefined,
): void {
  const world = vars['世界'];
  if (!world || typeof world !== 'object') return;

  const inDream = world['位于梦境'] === true;
  const realityTime = (world['现实']?.['时间'] ?? null) as string | null;
  const dreamTime = (world['梦境存档']?.['时间'] ?? null) as string | null;

  const computed = computeCountdowns(inDream, realityTime, dreamTime, anchor);

  if (!world['倒计时'] || typeof world['倒计时'] !== 'object') {
    world['倒计时'] = {};
  }
  world['倒计时']['可进入梦境倒计时'] = computed.可进入梦境倒计时;
  world['倒计时']['离开梦境倒计时'] = computed.离开梦境倒计时;
}
