import { MapLocationData, MapLocationRender } from '../types';

/**
 * Convert raw DEFAULT_WORLD_VARS.地图 tree into a flat-enough render tree.
 * Each node's children are positioned by their center coordinates within the parent's bounds.
 */
export function adaptMapTree(raw: Record<string, MapLocationData>): MapLocationRender[] {
  return Object.entries(raw).map(([key, data]) => adaptNode(key, data, false));
}

function adaptNode(key: string, data: MapLocationData, parentNoDream: boolean): MapLocationRender {
  const bounds = data.方位 ?? null;
  const hasBounds = bounds !== null;
  // 无坐标时 cx/cy 用 0（渲染时走世界级均匀排列）
  const cx = hasBounds ? (bounds.X[0] + bounds.X[1]) / 2 : 0;
  const cy = hasBounds ? (bounds.Y[0] + bounds.Y[1]) / 2 : 0;

  // 异界 and its descendants have no dream layer
  const noDream = parentNoDream || key === '异界';

  const children: MapLocationRender[] = data.子地图
    ? Object.entries(data.子地图).map(([childKey, childData]) => adaptNode(childKey, childData, noDream))
    : [];

  const name = key;

  return {
    key,
    name,
    searchTerms: data.检索词,
    cx,
    cy,
    bounds,
    hasBounds,
    reality: data.现实,
    // 异界及其子地图自动裁剪梦境数据
    dream: noDream ? { 描述: '', 地点细节: { 信息: [], 异常: {} } } : data.梦境,
    children,
    noDream,
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

