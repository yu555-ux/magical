/**
 * Map path resolution and item movement utilities.
 */

import { getDatabase } from './database';

// ========== item movement ==========

/**
 * Move an item between 仓库 and 主角.持有物品 in the latest chat's variables.
 */
export async function moveItem(
  itemName: string,
  category: string,
  direction: 'equip' | 'unequip',
): Promise<boolean> {
  try {
    const db = getDatabase();
    const chats = await db.chats.toArray();
    const chat = chats[chats.length - 1];
    if (!chat) return false;

    const vars = JSON.parse(JSON.stringify(chat.variables ?? {}));
    const warehouse = vars.仓库 ?? {};
    const held = vars.主角?.持有物品 ?? {};

    const src = direction === 'equip' ? (warehouse[category] ?? {}) : (held[category] ?? {});
    const dst = direction === 'equip' ? (held[category] ?? {}) : (warehouse[category] ?? {});

    if (!src[itemName]) return false;

    // Plane check: only allow equipping items matching current plane
    if (direction === 'equip') {
      const inDream = vars?.世界?.位于梦境 === true;
      const isDreamItem = src[itemName]?.梦境物品 === true;
      if ((inDream && !isDreamItem) || (!inDream && isDreamItem)) {
        return false;
      }
    }

    dst[itemName] = src[itemName];
    delete src[itemName];

    if (direction === 'equip') {
      vars.仓库 = { ...warehouse, [category]: src };
      vars.主角 = { ...(vars.主角 ?? {}), 持有物品: { ...held, [category]: dst } };
    } else {
      vars.主角 = { ...(vars.主角 ?? {}), 持有物品: { ...held, [category]: src } };
      vars.仓库 = { ...warehouse, [category]: dst };
    }

    await db.chats.put({ ...chat, variables: vars, updatedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

// ========== map path resolution ==========

const MAP_META_KEYS = ['检索词', '方位', '现实', '梦境', '子地图'];

interface PathMatch {
  path: string[];
  priority: number;
  parentMatch: boolean;
}

/**
 * Search the map tree for a location string.
 * When the target contains "-" (e.g. '11号楼-601室'), it is split into
 * parentHint + leafSearch for priority matching.
 * Returns the path array from root to the matched node, or null.
 */
export function resolvePath(
  currentLocation: string,
  mapTree: Record<string, any>,
): string[] | null {
  if (!currentLocation || !mapTree) return null;

  const segments = currentLocation.split('-');
  const hasParentHint = segments.length >= 2;
  const leafSearch = hasParentHint ? segments[segments.length - 1] : currentLocation;
  const parentHint = hasParentHint ? segments[segments.length - 2] : undefined;

  const matches: PathMatch[] = [];

  function search(node: Record<string, any>, path: string[]): void {
    if (!node || typeof node !== 'object') return;
    const parentKey = path.length > 0 ? path[path.length - 1] : '';

    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;

      if (hasParentHint) {
        if (key === leafSearch) {
          matches.push({ path: [...path, key], priority: 1, parentMatch: parentKey === parentHint });
          continue;
        }
        const terms = child['检索词'];
        if (Array.isArray(terms)) {
          if (terms.some((t: string) => t === leafSearch)) {
            matches.push({ path: [...path, key], priority: 2, parentMatch: parentKey === parentHint });
            continue;
          }
        }
      } else {
        if (key === currentLocation) {
          matches.push({ path: [...path, key], priority: 1, parentMatch: true });
          continue;
        }
        const terms = child['检索词'];
        if (Array.isArray(terms)) {
          if (terms.some((t: string) => t === currentLocation)) {
            matches.push({ path: [...path, key], priority: 2, parentMatch: true });
            continue;
          }
          if (terms.some((t: string) => t.includes(currentLocation) || currentLocation.includes(t))) {
            matches.push({ path: [...path, key], priority: 3, parentMatch: true });
            continue;
          }
        }
        if (key.includes(currentLocation) || currentLocation.includes(key)) {
          matches.push({ path: [...path, key], priority: 4, parentMatch: true });
          continue;
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;
      const subMap = child['子地图'];
      if (subMap && typeof subMap === 'object') {
        search(subMap, [...path, key]);
      }
    }
  }

  search(mapTree, []);

  if (hasParentHint && matches.length === 0) {
    return resolvePathFallback(currentLocation, mapTree);
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.parentMatch !== b.parentMatch) return a.parentMatch ? -1 : 1;
    return a.priority - b.priority;
  });

  return matches[0].path;
}

/** Fallback: full-string fuzzy matching for suffix formats like '<user>家-客厅' */
function resolvePathFallback(target: string, mapTree: Record<string, any>): string[] | null {
  const matches: PathMatch[] = [];

  function search(node: Record<string, any>, path: string[]): void {
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;

      const terms = child['检索词'];
      if (Array.isArray(terms)) {
        if (terms.some((t: string) => t === target)) {
          matches.push({ path: [...path, key], priority: 2, parentMatch: true });
          continue;
        }
        if (terms.some((t: string) => t.includes(target) || target.includes(t))) {
          matches.push({ path: [...path, key], priority: 3, parentMatch: true });
          continue;
        }
      }
      if (key.includes(target) || target.includes(key)) {
        matches.push({ path: [...path, key], priority: 4, parentMatch: true });
        continue;
      }
    }
    for (const key of Object.keys(node)) {
      if (MAP_META_KEYS.includes(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;
      const subMap = child['子地图'];
      if (subMap && typeof subMap === 'object') {
        search(subMap, [...path, key]);
      }
    }
  }

  search(mapTree, []);
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.priority - b.priority);
  return matches[0].path;
}

/**
 * Convert an AI-output location string into the parent-leaf format.
 * E.g. '601室' → '11号楼-601室'.
 */
export function formatLocation(raw: string, mapTree: Record<string, any>): string {
  if (!raw || !mapTree) return raw;
  const path = resolvePath(raw, mapTree);
  if (!path || path.length === 0) return raw;
  if (path.length === 1) return path[0];
  if (path.length === 2) return path[0] + '-' + path[1];
  return path[path.length - 3] + '-' + path[path.length - 2] + '-' + path[path.length - 1];
}

/** Recursively normalize 当前位置 and 地点 fields to parent-leaf format. */
export function normalizeLocations(obj: Record<string, any>, mapTree: Record<string, any>): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if ((key === '当前位置' || key === '地点') && typeof val === 'string' && val.trim()) {
      obj[key] = formatLocation(val, mapTree);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      normalizeLocations(val, mapTree);
    }
  }
}
