/**
 * 柳三娘商店 — 购买引擎。
 *
 * 条件检查（纯函数，不涉及 DB）：
 *   checkShopAvailability(vars)  → 返回 boolean
 *   getShopItems(vars)           → 返回商品数组
 *   getPlayerCorpseQi(vars)      → 返回尸气数值
 *
 * 写入操作（异步，DB-first）：
 *   purchaseItem(itemName)       → 扣除尸气、减库存、物品写入持有物品
 */

import { getDatabase } from './database';

// ========== types ==========

export interface ShopItem {
  名称: string;
  分类: '灵宝' | '诡物' | '物品';
  价格: number;
  等级: string;
  描述: string;
  效果: Record<string, string>;
  规则?: Record<string, string>;
  副作用?: string;
  库存: number;
}

// ========== helpers ==========

function pathGet(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function containsBuilding11(location: string): boolean {
  if (!location) return false;
  return location.includes('11号楼');
}

// ========== pure checks ==========

/** 检查商店是否可用（四个条件 AND） */
export function checkShopAvailability(vars: Record<string, any>): boolean {
  if (!vars) return false;

  // 1. 位于梦境
  const inDream = pathGet(vars, '世界.梦境定位.位于梦境');
  if (inDream !== true) return false;

  // 2. 玩家在 11 号楼（梦境存档中的位置）
  const playerLoc = pathGet(vars, '世界.梦境存档.地点') ?? '';
  if (!containsBuilding11(playerLoc)) return false;

  // 3. 柳三娘在 11 号楼
  const lsnLoc = pathGet(vars, '主要人物.女性.异人.柳三娘.当前位置') ?? '';
  if (!containsBuilding11(lsnLoc)) return false;

  // 4. 交易已解锁
  const tradeOpen = pathGet(vars, '特殊玩法.柳三娘商店.交易开放');
  if (tradeOpen !== true) return false;

  return true;
}

// ========== favorability & discount ==========

/** 读取柳三娘好感值 */
export function getLiuSanniangFavorability(vars: Record<string, any>): number {
  return pathGet(vars, '主要人物.女性.异人.柳三娘.好感值') ?? 0;
}

/**
 * 根据好感值返回折扣率与是否拒售。
 * rate: 0 = 原价, 0.2 = 8折, 1 = 免费
 * rejected: true 表示柳三娘拒绝交易
 */
export function getDiscountRate(favorability: number): { rate: number; rejected: boolean } {
  if (favorability < 0) return { rate: 0, rejected: true };
  if (favorability >= 180) return { rate: 1, rejected: false };
  if (favorability >= 160) return { rate: 0.8, rejected: false };
  if (favorability >= 130) return { rate: 0.6, rejected: false };
  if (favorability >= 100) return { rate: 0.4, rejected: false };
  if (favorability >= 60) return { rate: 0.2, rejected: false };
  if (favorability >= 30) return { rate: 0.1, rejected: false };
  return { rate: 0, rejected: false };
}

/** 计算折后价（Math.floor 向下取整） */
export function getDiscountedPrice(price: number, favorability: number): number {
  const { rate, rejected } = getDiscountRate(favorability);
  if (rejected) return price;
  if (rate >= 1) return 0;
  return Math.floor(price * (1 - rate));
}

/** 获取玩家尸气余额 */
export function getPlayerCorpseQi(vars: Record<string, any>): number {
  return pathGet(vars, '主角.资源.超凡资源.尸气') ?? 0;
}

/** 获取可购买的商品列表（过滤售罄商品） */
export function getShopItems(vars: Record<string, any>): ShopItem[] {
  const catalog = pathGet(vars, '柳三娘商店.商品') ?? {};
  const items: ShopItem[] = [];

  for (const [name, data] of Object.entries(catalog)) {
    const item = data as any;
    if (!item || (item.库存 ?? 0) <= 0) continue;
    items.push({ 名称: name, ...item });
  }

  return items;
}

// ========== purchase (DB-first) ==========

export async function purchaseItem(
  itemName: string,
  quantity: number = 1,
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDatabase();
    const chats = await db.chats.toArray();
    const chat = chats[chats.length - 1];
    if (!chat) return { success: false, error: '无法获取存档' };

    const vars = JSON.parse(JSON.stringify(chat.variables ?? {}));

    // Validate shop is available
    if (!checkShopAvailability(vars)) {
      return { success: false, error: '当前无法交易' };
    }

    // Check favorability — reject if negative
    const favorability = getLiuSanniangFavorability(vars);
    const { rejected } = getDiscountRate(favorability);
    if (rejected) {
      return { success: false, error: '柳三娘对你心存芥蒂，不愿与你交易' };
    }

    // Get item from catalog
    const catalog = pathGet(vars, '柳三娘商店.商品') ?? {};
    const raw = catalog[itemName];
    if (!raw) return { success: false, error: '商品不存在' };

    const stock = raw.库存 ?? 0;
    if (stock <= 0) return { success: false, error: '商品已售罄' };
    if (quantity > stock) return { success: false, error: `库存不足（仅剩 ${stock} 件）` };
    if (quantity < 1) return { success: false, error: '数量无效' };

    const originalPrice: number = raw.价格 ?? 0;
    const unitPrice = getDiscountedPrice(originalPrice, favorability);
    const totalPrice = unitPrice * quantity;

    // Check funds
    const corpseQi = pathGet(vars, '主角.资源.超凡资源.尸气') ?? 0;
    if (corpseQi < totalPrice) return { success: false, error: '尸气不足' };

    // Deduct total price
    vars.主角.资源.超凡资源.尸气 = corpseQi - totalPrice;

    // Decrement stock by quantity
    catalog[itemName].库存 = stock - quantity;

    // Add to held items
    if (!vars.主角.持有物品) vars.主角.持有物品 = { 灵宝: {}, 诡物: {}, 物品: {} };
    const category: string = raw.分类 ?? '物品';
    if (!vars.主角.持有物品[category]) vars.主角.持有物品[category] = {};

    const held = vars.主角.持有物品[category];
    if (held[itemName]) {
      // Already owns — increment quantity
      held[itemName].数量 = (held[itemName].数量 ?? 1) + quantity;
    } else {
      // New item — copy from catalog
      const copy: any = {
        等级: raw.等级,
        描述: raw.描述,
        数量: quantity,
        效果: raw.效果 ? { ...raw.效果 } : {},
      };
      if (raw.规则) copy.规则 = { ...raw.规则 };
      if (raw.副作用) copy.副作用 = raw.副作用;
      held[itemName] = copy;
    }

    // Persist
    await db.chats.put({ ...chat, variables: vars, updatedAt: Date.now() });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
