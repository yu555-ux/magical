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

function isAt301(location: string): boolean {
  if (!location) return false;
  return location.includes('301室') || location.includes('301');
}

// ========== pure checks ==========

/** 检查商店是否可用（四个条件 AND） */
export function checkShopAvailability(vars: Record<string, any>): boolean {
  if (!vars) return false;

  // 1. 位于梦境
  const inDream = pathGet(vars, '世界.梦境定位.位于梦境');
  if (inDream !== true) return false;

  // 2. 玩家在 301 室（梦境存档中的位置）
  const playerLoc = pathGet(vars, '世界.梦境存档.地点') ?? '';
  if (!isAt301(playerLoc)) return false;

  // 3. 柳三娘在 301 室
  const lsnLoc = pathGet(vars, '主要人物.女性.异人.柳三娘.当前位置') ?? '';
  if (!isAt301(lsnLoc)) return false;

  // 4. 交易已解锁
  const tradeOpen = pathGet(vars, '特殊玩法.柳三娘商店.交易开放');
  if (tradeOpen !== true) return false;

  return true;
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

    // Get item from catalog
    const catalog = pathGet(vars, '柳三娘商店.商品') ?? {};
    const raw = catalog[itemName];
    if (!raw) return { success: false, error: '商品不存在' };

    const stock = raw.库存 ?? 0;
    if (stock <= 0) return { success: false, error: '商品已售罄' };

    const price: number = raw.价格 ?? 0;

    // Check funds
    const corpseQi = pathGet(vars, '主角.资源.超凡资源.尸气') ?? 0;
    if (corpseQi < price) return { success: false, error: '尸气不足' };

    // Deduct
    vars.主角.资源.超凡资源.尸气 = corpseQi - price;

    // Decrement stock
    catalog[itemName].库存 = stock - 1;

    // Add to held items
    if (!vars.主角.持有物品) vars.主角.持有物品 = { 灵宝: {}, 诡物: {}, 物品: {} };
    const category: string = raw.分类 ?? '物品';
    if (!vars.主角.持有物品[category]) vars.主角.持有物品[category] = {};

    const held = vars.主角.持有物品[category];
    if (held[itemName]) {
      // Already owns — increment quantity
      held[itemName].数量 = (held[itemName].数量 ?? 1) + 1;
    } else {
      // New item — copy from catalog
      const copy: any = {
        等级: raw.等级,
        描述: raw.描述,
        数量: 1,
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
