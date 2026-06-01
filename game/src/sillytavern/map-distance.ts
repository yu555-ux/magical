/**
 * 地图"前往"功能 — 距离和方位计算
 *
 * +X = 北, +Y = 东
 * 1 单位 = 1 km
 */

import { resolvePath } from './variables';

export interface TravelInfo {
  /** 距离（km），保留1位小数 */
  distance: number;
  /** 方位：东/南/西/北 */
  direction: string;
  /** 自动发送的提示词 */
  prompt: string;
}

/** 在地图树中递归向上查找节点的方位（X/Y范围） */
function findBounds(
  mapTree: Record<string, any>,
  path: string[],
): { X: [number, number]; Y: [number, number] } | null {
  // 从path最深层向上查找
  for (let i = path.length; i > 0; i--) {
    let node: any = mapTree;
    for (let j = 0; j < i; j++) {
      if (!node || typeof node !== 'object') break;
      node = node[path[j]];
    }
    if (node && typeof node === 'object' && node['方位']) {
      const fw = node['方位'];
      if (fw.X && fw.Y) return { X: fw.X as [number, number], Y: fw.Y as [number, number] };
    }
    // 也检查子地图中的节点
    const subPath = path.slice(0, i);
    let subNode: any = mapTree;
    for (let j = 0; j < subPath.length; j++) {
      if (!subNode || typeof subNode !== 'object') break;
      subNode = subNode[subPath[j]];
    }
    if (subNode && typeof subNode === 'object' && subNode['方位']) {
      const fw = subNode['方位'];
      if (fw.X && fw.Y) return { X: fw.X as [number, number], Y: fw.Y as [number, number] };
    }
  }
  return null;
}

/** 计算方位和距离 */
function calcDirectionDistance(
  fromBounds: { X: [number, number]; Y: [number, number] },
  toBounds: { X: [number, number]; Y: [number, number] },
): { distance: number; direction: string } {
  const fromX = (fromBounds.X[0] + fromBounds.X[1]) / 2;
  const fromY = (fromBounds.Y[0] + fromBounds.Y[1]) / 2;
  const toX = (toBounds.X[0] + toBounds.X[1]) / 2;
  const toY = (toBounds.Y[0] + toBounds.Y[1]) / 2;

  const dx = toX - fromX;
  const dy = toY - fromY;

  const distance = Math.sqrt(dx * dx + dy * dy);

  // +X=北, +Y=东
  let direction: string;
  if (Math.abs(dx) >= Math.abs(dy)) {
    direction = dx >= 0 ? '北' : '南';
  } else {
    direction = dy >= 0 ? '东' : '西';
  }

  return { distance: Math.round(distance * 10) / 10, direction };
}

/**
 * 计算玩家前往目标地点的旅行信息。
 * @param mapTree      原始地图变量树（未适配的 Record<string, any>）
 * @param currentLocation  玩家当前位置字符串（如 "11号楼-601室"）
 * @param destinationName  目标地点名称（MapLocationRender.name）
 * @returns TravelInfo 或 null（当前位置/目标无法定位时）
 */
export function calcTravelInfo(
  mapTree: Record<string, any>,
  currentLocation: string,
  destinationName: string,
): TravelInfo | null {
  if (!mapTree || !currentLocation || !destinationName) return null;
  if (currentLocation === destinationName) return null;

  // 在 mapTree 中解析位置路径
  const fromPath = resolvePath(currentLocation, mapTree);
  if (!fromPath) return null;

  const toPath = resolvePath(destinationName, mapTree);
  if (!toPath) return null;

  // 获取两点的方位范围
  const fromBounds = findBounds(mapTree, fromPath);
  if (!fromBounds) return null;

  const toBounds = findBounds(mapTree, toPath);
  if (!toBounds) return null;

  const { distance, direction } = calcDirectionDistance(fromBounds, toBounds);

  return {
    distance,
    direction,
    prompt: `{{user}}动身前往${destinationName}，目的地距当前位置大概为${direction}${distance}km`,
  };
}
