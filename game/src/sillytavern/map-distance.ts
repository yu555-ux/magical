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

/**
 * 在地图原始树中按路径查找节点。
 * resolvePath 返回的 path 跳过了"子地图"层级，
 * 遍历时需在每段之间插入"子地图"。
 */
function walkPath(
  mapData: Record<string, any>,
  path: string[],
  endIndex: number,
): any {
  let node: any = mapData;
  for (let j = 0; j < endIndex; j++) {
    if (!node || typeof node !== 'object') return null;
    node = node[path[j]];
    if (!node) return null;
    // 非最后一段时，进入子地图
    if (j < endIndex - 1) {
      node = node['子地图'];
      if (!node || typeof node !== 'object') return null;
    }
  }
  return node;
}

/** 在地图树中递归向上查找节点的方位（X/Y范围） */
function findBounds(
  mapData: Record<string, any>,
  path: string[],
): { X: [number, number]; Y: [number, number] } | null {
  for (let i = path.length; i > 0; i--) {
    const node = walkPath(mapData, path, i);
    if (node && typeof node === 'object' && node['方位']) {
      const fw = node['方位'];
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

  return { distance, direction };
}

/** 格式化距离字符串：< 1km 换算为 m，>= 1km 保留 1 位小数 */
function formatDistance(distance: number): string {
  if (distance < 1) {
    const meters = Math.round(distance * 1000);
    return `${meters}m`;
  }
  return `${Math.round(distance * 10) / 10}km`;
}

/**
 * 判断两点的中心坐标是否完全相等。
 */
function samePosition(
  a: { X: [number, number]; Y: [number, number] },
  b: { X: [number, number]; Y: [number, number] },
): boolean {
  const ax = (a.X[0] + a.X[1]) / 2;
  const ay = (a.Y[0] + a.Y[1]) / 2;
  const bx = (b.X[0] + b.X[1]) / 2;
  const by = (b.Y[0] + b.Y[1]) / 2;
  return ax === bx && ay === by;
}

/**
 * 计算玩家前往目标地点的旅行信息。
 * @param mapData      原始地图变量树（未适配的 Record<string, any>）
 * @param currentLocation  玩家当前位置字符串（如 "11号楼-601室"）
 * @param destinationName  目标地点名称（MapLocationRender.name）
 * @returns TravelInfo 或 null（当前位置/目标无法定位时）
 */
export function calcTravelInfo(
  mapData: Record<string, any>,
  currentLocation: string,
  destinationName: string,
): TravelInfo | null {
  if (!mapData || !currentLocation || !destinationName) return null;

  // 在 mapTree 中解析位置路径
  const fromPath = resolvePath(currentLocation, mapData);
  if (!fromPath) {
    console.log('[前往] 无法解析当前位置:', currentLocation);
    return null;
  }

  const toPath = resolvePath(destinationName, mapData);
  if (!toPath) {
    console.log('[前往] 无法解析目标地点:', destinationName);
    return null;
  }

  // 获取两点的方位范围
  const fromBounds = findBounds(mapData, fromPath);
  if (!fromBounds) {
    console.log('[前往] 当前位置无方位:', currentLocation, 'path:', fromPath);
    return null;
  }

  const toBounds = findBounds(mapData, toPath);
  if (!toBounds) {
    console.log('[前往] 目标地点无方位:', destinationName, 'path:', toPath);
    return null;
  }

  // X/Y 中心值完全相等 → 同位置
  if (samePosition(fromBounds, toBounds)) {
    console.log('[前往] 同位置，无需计算距离');
    return {
      distance: 0,
      direction: '',
      prompt: `{{user}}动身前往${destinationName}`,
    };
  }

  // 双方均为世界级地点（路径深度 ≤ 2）→ 不写距离
  const bothWorldLevel = fromPath.length <= 2 && toPath.length <= 2;

  const { distance, direction } = calcDirectionDistance(fromBounds, toBounds);

  let prompt: string;
  if (bothWorldLevel) {
    prompt = `{{user}}动身前往${destinationName}`;
  } else {
    const distStr = formatDistance(distance);
    prompt = `{{user}}动身前往${destinationName}，目的地距当前位置大概为${direction}${distStr}`;
  }

  console.log('[前往]', { from: currentLocation, to: destinationName, distance, direction, bothWorldLevel });

  return { distance, direction, prompt };
}
