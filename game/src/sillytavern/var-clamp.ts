/**
 * Variable validation and numeric range clamping.
 */

/**
 * Auto-unequip items that don't match the current plane.
 * Call after variables change to ensure equipment consistency.
 */
export function validateEquipment(vars: Record<string, any>): void {
  const inDream = vars?.世界?.位于梦境 === true;
  const held = vars?.主角?.持有物品;
  const warehouse = vars?.仓库;
  if (!held || !warehouse) return;

  for (const cat of ['灵宝', '诡物', '物品'] as const) {
    const catHeld = held[cat] ?? {};
    const catWh = warehouse[cat] ?? {};
    for (const [name, item] of Object.entries(catHeld) as [string, any][]) {
      const isDreamItem = item?.梦境物品 === true;
      if ((inDream && !isDreamItem) || (!inDream && isDreamItem)) {
        if (catWh[name]) {
          catWh[name].数量 = (catWh[name].数量 ?? 0) + (item.数量 ?? 1);
        } else {
          catWh[name] = item;
        }
        delete catHeld[name];
      }
    }
    held[cat] = catHeld;
    warehouse[cat] = catWh;
  }
}

// ========== numeric range clamping ==========

function clamp(obj: any, key: string, min: number, max: number): boolean {
  const v = obj[key];
  if (typeof v !== 'number') return false;
  if (v < min) { obj[key] = min; return true; }
  if (v > max) { obj[key] = max; return true; }
  return false;
}

/** Recursively walk character/skill trees to clamp 熟练度 to 0~999. */
function clampSkills(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (!val || typeof val !== 'object') continue;
    if (typeof val['熟练度'] === 'number') {
      clamp(val, '熟练度', 0, 999);
    }
    if (val['分支'] && typeof val['分支'] === 'object') {
      clampSkills(val['分支']);
    }
    clampSkills(val);
  }
}

/** Recursively walk map anomalies to clamp 具现进度 to 0~100. */
function clampAnomalies(mapNode: any): void {
  if (!mapNode || typeof mapNode !== 'object') return;
  for (const key of Object.keys(mapNode)) {
    const val = mapNode[key];
    if (!val || typeof val !== 'object') continue;
    if (typeof val['具现进度'] === 'number') {
      clamp(val, '具现进度', 0, 100);
    }
    if (val['现实']?.地点细节?.异常) clampAnomalies(val['现实'].地点细节.异常);
    if (val['梦境']?.地点细节?.异常) clampAnomalies(val['梦境'].地点细节.异常);
    if (val['子地图']) clampAnomalies(val['子地图']);
    clampAnomalies(val);
  }
}

/** Clamp all documented numeric ranges across the variable tree. */
export function clampVariableRanges(vars: Record<string, any>): void {
  if (!vars) return;

  // 1) 主角 body/base/special attributes
  const hero = vars['主角'];
  if (hero) {
    const body = hero['身体属性'];
    if (body) {
      for (const stat of ['生命', '体力', '能量', 'SAN']) {
        const s = body[stat];
        if (s && typeof s === 'object') {
          if (typeof s.当前 === 'number') {
            const upper = typeof s.上限 === 'number' ? s.上限 : 100;
            if (s.当前 < 0) s.当前 = 0;
            if (s.当前 > upper) s.当前 = upper;
          }
        }
      }
    }
    const base = hero['基础属性'];
    if (base) for (const k of ['力量', '体质', '精神', '敏捷']) clamp(base, k, 1, 100);
    const spec = hero['特殊属性'];
    if (spec) for (const k of ['幸运', '魅力']) clamp(spec, k, 1, 100);
    if (hero['技能']) clampSkills(hero['技能']);
  }

  // 2) All characters under 主要人物
  const chars = vars['主要人物'];
  if (chars) {
    for (const group of ['异人', '普通人']) {
      const females = chars['女性']?.[group];
      if (females) {
        for (const name of Object.keys(females)) {
          const f = females[name];
          if (!f || typeof f !== 'object') continue;
          clamp(f, '好感值', -200, 200);
          clamp(f, '堕落值', 0, 500);
          clamp(f, '性欲值', 0, 100);
          const fBody = f['身体属性'];
          if (fBody) {
            for (const stat of ['生命', '能量', 'SAN']) {
              const s = fBody[stat];
              if (s && typeof s === 'object') {
                if (typeof s.当前 === 'number') {
                  const upper = typeof s.上限 === 'number' ? s.上限 : 100;
                  if (s.当前 < 0) s.当前 = 0;
                  if (s.当前 > upper) s.当前 = upper;
                }
              }
            }
          }
          const fBase = f['基础属性'];
          if (fBase) for (const k of ['力量', '体质', '精神', '敏捷']) clamp(fBase, k, 1, 100);
          const fSpec = f['特殊属性'];
          if (fSpec) for (const k of ['幸运', '魅力']) clamp(fSpec, k, 1, 100);
          if (f['技能']) clampSkills(f['技能']);
        }
      }
    }
    for (const group of ['异人', '普通人']) {
      const males = chars['男性']?.[group];
      if (males) {
        for (const name of Object.keys(males)) {
          const m = males[name];
          if (!m || typeof m !== 'object') continue;
          clamp(m, '友善值', -200, 200);
          const mBody = m['身体属性'];
          if (mBody) {
            for (const stat of ['生命', 'SAN']) {
              const s = mBody[stat];
              if (s && typeof s === 'object') {
                if (typeof s.当前 === 'number') {
                  const upper = typeof s.上限 === 'number' ? s.上限 : 100;
                  if (s.当前 < 0) s.当前 = 0;
                  if (s.当前 > upper) s.当前 = upper;
                }
              }
            }
          }
          const mBase = m['基础属性'];
          if (mBase) for (const k of ['力量', '体质', '精神', '敏捷']) clamp(mBase, k, 1, 100);
          const mSpec = m['特殊属性'];
          if (mSpec) for (const k of ['幸运', '魅力']) clamp(mSpec, k, 1, 100);
          if (m['技能']) clampSkills(m['技能']);
        }
      }
    }
  }

  // 3) Map anomalies — clamp 具现进度 0~100
  if (vars['地图']) clampAnomalies(vars['地图']);
}
