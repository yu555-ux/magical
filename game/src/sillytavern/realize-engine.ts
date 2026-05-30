/**
 * 梦境具现引擎 — 将梦境物品具现为现实奇物
 *
 * 消耗公式:
 *   物品（普通）: 免费
 *   灵宝: base × (1 + Σ效果×ε)     ε = triangular(0.08, 0.15, 0.28)
 *   诡物: base × P × N
 *         P = 1 + Σ效果×α + Σ规则×β   α,β = triangular(0.06, 0.12, 0.22)
 *         N = max(0.35, 1 − Σ副作用×γ) γ = triangular(0.12, 0.20, 0.30)
 */

import { getDatabase } from './database';

// ── 三角分布 ──
function triangular(min: number, mode: number, max: number): number {
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

// ── 等级 → 蝶烬消耗范围 ──
const RANK_RANGE: Record<string, { min: number; mode: number; max: number }> = {
  微末: { min: 10,  mode: 50,   max: 100 },
  凶煞: { min: 50,  mode: 100,  max: 200 },
  祸城: { min: 150, mode: 300,  max: 500 },
  倾国: { min: 500, mode: 800,  max: 1000 },
  绝域: { min: 1000, mode: 1500, max: 2000 },
  灭世: { min: 2500, mode: 4000, max: 5000 },
};

// ── 系数 ──
function rollEffectCoeff(): number   { return triangular(0.08, 0.15, 0.28); }
function rollRuleCoeff(): number     { return triangular(0.06, 0.12, 0.22); }
function rollDiscount(): number      { return triangular(0.12, 0.20, 0.30); }

// ── 字段计数 ──
function countEffects(item: any): number {
  const eff = item?.效果;
  if (!eff || typeof eff !== 'object') return 0;
  return Object.keys(eff).length;
}
function countRules(item: any): number {
  const rules = item?.规则;
  if (!rules || typeof rules !== 'object') return 0;
  return Object.keys(rules).length;
}
function countSideEffects(item: any): number {
  const se = item?.副作用;
  if (!se) return 0;
  if (typeof se === 'object') return Object.keys(se).length;
  return 0;
}

// ── 类型 ──
export interface RealizePreview {
  cost: number;
  breakdown: string;
  /** 内部: 预 roll 的成本, 执行时透传避免二次随机 */
  _base: number;
  _effMultiplier: number;
  _discount: number;
}

// ── 预计算具现消耗 ──
export function previewRealizeCost(item: any, category: string): RealizePreview {
  // 普通物品: 免费
  if (category === '物品') {
    return { cost: 0, breakdown: '物品分类 — 无需蝶烬，直接具现', _base: 0, _effMultiplier: 1, _discount: 1 };
  }

  const rank = item?.等级 ?? '';
  const range = RANK_RANGE[rank];
  if (!range) {
    return { cost: 100, breakdown: `未知等级(${rank}) — 默认消耗 100 蝶烬`, _base: 100, _effMultiplier: 1, _discount: 1 };
  }

  const base = Math.round(triangular(range.min, range.mode, range.max));
  const nEffects = countEffects(item);
  const nRules = countRules(item);
  const nSideEffects = countSideEffects(item);

  if (category === '灵宝') {
    let effMultiplier = 1;
    const lines: string[] = [`等级 ${rank} — 基础: ${base} 蝶烬`];
    for (let i = 0; i < nEffects; i++) {
      const eps = rollEffectCoeff();
      effMultiplier += eps;
      lines.push(`  效果 #${i + 1}  × ${eps.toFixed(2)}`);
    }
    const cost = Math.round(base * effMultiplier);
    lines.push(`  ${base} × ${effMultiplier.toFixed(3)} = ${cost} 蝶烬`);
    return { cost, breakdown: lines.join('\n'), _base: base, _effMultiplier: effMultiplier, _discount: 1 };
  }

  // 诡物: cost = base × P × N
  let P = 1;
  const lines: string[] = [`等级 ${rank} — 基础: ${base} 蝶烬`];

  for (let i = 0; i < nEffects; i++) {
    const alpha = rollRuleCoeff();
    P += alpha;
    lines.push(`  效果 #${i + 1}  × ${alpha.toFixed(2)}`);
  }
  for (let i = 0; i < nRules; i++) {
    const beta = rollRuleCoeff();
    P += beta;
    lines.push(`  规则 #${i + 1}  × ${beta.toFixed(2)}`);
  }

  let discount = 0;
  for (let i = 0; i < nSideEffects; i++) {
    const gamma = rollDiscount();
    discount += gamma;
    lines.push(`  副作用 #${i + 1}  × ${gamma.toFixed(2)} (折扣)`);
  }
  const N = Math.max(0.35, 1 - discount);

  const cost = Math.round(base * P * N);
  lines.push(`  ${base} × ${P.toFixed(3)} (正向) × ${N.toFixed(3)} (折扣) = ${cost} 蝶烬`);
  return { cost, breakdown: lines.join('\n'), _base: base, _effMultiplier: P, _discount: N };
}

// ── 执行具现 ──
export async function realizeItem(
  itemName: string,
  category: string,
  preview: RealizePreview,
  quantity: number = 1,
): Promise<{ success: boolean; cost: number; error?: string }> {
  try {
    const db = getDatabase();
    const chats = await db.chats.toArray();
    const chat = chats[chats.length - 1];
    if (!chat) return { success: false, cost: 0, error: '无法获取存档' };

    const vars = JSON.parse(JSON.stringify(chat.variables ?? {}));
    const warehouse = vars.仓库 ?? {};
    const catItems = { ...warehouse[category] ?? {} };
    const item = catItems[itemName];

    if (!item) return { success: false, cost: 0, error: '物品不存在' };
    if (item.梦境物品 !== true) return { success: false, cost: 0, error: '该物品已是现实奇物' };

    const totalQty = item.数量 ?? 1;
    const qty = Math.min(quantity, totalQty);
    const totalCost = preview.cost * qty;

    // 检查蝶烬余额
    if (totalCost > 0) {
      const currentAsh = vars?.主角?.资源?.超凡资源?.蝶烬 ?? 0;
      if (currentAsh < totalCost) {
        return { success: false, cost: totalCost, error: `蝶烬不足（需要 ${totalCost}，当前 ${currentAsh}）` };
      }
      vars.主角.资源.超凡资源.蝶烬 = currentAsh - totalCost;
    }

    // 具现: 部分或全部转为现实奇物
    if (qty >= totalQty) {
      // 全部具现 — 直接翻转
      item.梦境物品 = false;
      catItems[itemName] = item;
    } else {
      // 部分具现 — 拆分
      item.数量 = totalQty - qty;  // 保留梦境的
      catItems[itemName] = item;

      // 新增/合并现实版本
      const reality = { ...JSON.parse(JSON.stringify(item)) };
      reality.数量 = qty;
      reality.梦境物品 = false;
      const realityKey = `${itemName}（具现）`;
      if (catItems[realityKey]) {
        catItems[realityKey].数量 = (catItems[realityKey].数量 ?? 0) + qty;
      } else {
        catItems[realityKey] = reality;
      }
    }

    // 写回
    if (!vars.仓库) vars.仓库 = {};
    vars.仓库 = { ...warehouse, [category]: catItems };
    await db.chats.put({ ...chat, variables: vars, updatedAt: Date.now() });

    return { success: true, cost: totalCost };
  } catch (e) {
    return { success: false, cost: 0, error: String(e) };
  }
}
