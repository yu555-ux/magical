import { MapLocationData, MapLocationRender } from '../types';

/**
 * Convert raw DEFAULT_WORLD_VARS.地图 tree into a flat-enough render tree.
 * Each node's children are positioned by their center coordinates within the parent's bounds.
 */
export function adaptMapTree(raw: Record<string, MapLocationData>): MapLocationRender[] {
  return Object.entries(raw).map(([key, data]) => adaptNode(key, data));
}

function adaptNode(key: string, data: MapLocationData): MapLocationRender {
  const bounds = data.方位;
  const cx = (bounds.X[0] + bounds.X[1]) / 2;
  const cy = (bounds.Y[0] + bounds.Y[1]) / 2;

  const children: MapLocationRender[] = data.子地图
    ? Object.entries(data.子地图).map(([childKey, childData]) => adaptNode(childKey, childData))
    : [];

  // Use the last search term as display name (usually the shortest / most readable)
  const name = data.检索词.length > 0 ? data.检索词[0] : key;

  return {
    key,
    name,
    searchTerms: data.检索词,
    cx,
    cy,
    bounds,
    reality: data.现实,
    dream: data.梦境,
    children,
  };
}

/**
 * Walk the tree by key path to find a node.
 * Returns the node and its path segments.
 */
export function findNode(
  tree: MapLocationRender[],
  path: string[],
): MapLocationRender | null {
  let current: MapLocationRender | undefined;
  let list = tree;
  for (const seg of path) {
    current = list.find((n) => n.key === seg);
    if (!current) return null;
    list = current.children;
  }
  return current ?? null;
}

/**
 * Build an array of [key, node] for each level of the path — used for breadcrumbs.
 */
export function pathNodes(
  tree: MapLocationRender[],
  path: string[],
): { key: string; name: string }[] {
  const result: { key: string; name: string }[] = [];
  let list = tree;
  for (const seg of path) {
    const node = list.find((n) => n.key === seg);
    if (!node) break;
    result.push({ key: node.key, name: node.name });
    list = node.children;
  }
  return result;
}
