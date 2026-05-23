/**
 * Map filter engine — filters the map tree by proximity to current location
 * and formats it as prompt-ready text.
 */
import { resolvePath } from './variables';

// ── helpers ──

const MAP_META_KEYS = ['检索词', '方位', '现实', '梦境', '子地图'];

function isMetaKey(key: string): boolean {
  return MAP_META_KEYS.includes(key);
}

function getLayer(node: Record<string, any>, isDream: boolean): Record<string, any> | undefined {
  return isDream ? node['梦境'] : node['现实'];
}

function getDescription(node: Record<string, any>, isDream: boolean): string {
  const layer = getLayer(node, isDream);
  return layer?.['描述'] || '';
}

function getRealityPrototype(node: Record<string, any>, isDream: boolean): string {
  if (!isDream) return '';
  return node['现实']?.['描述'] || '';
}

// ── type D: off-path (shared by leaf cases) ──

function buildTypeD(node: Record<string, any>, isDream: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  if (node['方位']) result['方位'] = node['方位'];
  result['描述'] = getDescription(node, isDream);
  const proto = getRealityPrototype(node, isDream);
  if (proto) result['现实原型'] = proto;
  return result;
}

// ── type B: sibling ──

function buildTypeB(node: Record<string, any>, isDream: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  if (node['方位']) result['方位'] = node['方位'];
  result['描述'] = getDescription(node, isDream);
  const proto = getRealityPrototype(node, isDream);
  if (proto) result['现实原型'] = proto;

  const layer = getLayer(node, isDream);
  const detail = layer?.['地点细节'];
  if (detail) {
    const d: Record<string, any> = {};
    if (detail['信息']?.length > 0) d['信息'] = [...detail['信息']];
    if (detail['异常'] && Object.keys(detail['异常']).length > 0) {
      d['异常'] = {};
      for (const [anomalyKey, anomaly] of Object.entries(detail['异常'])) {
        if (anomaly && typeof anomaly === 'object') {
          d['异常'][anomalyKey] = {
            评级: (anomaly as any)['评级'],
            描述: (anomaly as any)['描述'],
          };
        }
      }
    }
    if (Object.keys(d).length > 0) result['地点细节'] = d;
  }

  return result;
}

// ── type A: current node ──

function buildTypeA(node: Record<string, any>, isDream: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  if (node['方位']) result['方位'] = node['方位'];
  result['描述'] = getDescription(node, isDream);
  const proto = getRealityPrototype(node, isDream);
  if (proto) result['现实原型'] = proto;

  const layer = getLayer(node, isDream);
  const detail = layer?.['地点细节'];
  if (detail) {
    const d: Record<string, any> = {};
    if (detail['信息']?.length > 0) d['信息'] = [...detail['信息']];
    if (detail['异常'] && Object.keys(detail['异常']).length > 0) {
      d['异常'] = { ...detail['异常'] }; // full fields including 具现进度
    }
    if (Object.keys(d).length > 0) result['地点细节'] = d;
  }

  // Expand sub-map one level only
  if (node['子地图'] && typeof node['子地图'] === 'object') {
    result['子地图'] = buildShallowChildren(node['子地图'], isDream);
  }

  return result;
}

// ── type C: path ancestor ──

function buildTypeC(
  node: Record<string, any>,
  path: string[],
  pathIndex: number,
  isDream: boolean,
): Record<string, any> {
  const result: Record<string, any> = {};
  if (node['方位']) result['方位'] = node['方位'];
  result['描述'] = getDescription(node, isDream);
  const proto = getRealityPrototype(node, isDream);
  if (proto) result['现实原型'] = proto;

  // No 地点细节

  // Expand sub-map (path continues down)
  if (node['子地图'] && typeof node['子地图'] === 'object') {
    result['子地图'] = processTree(node['子地图'], path, pathIndex, isDream);
  }

  return result;
}

// ── 异界 special ──

function buildYijie(node: Record<string, any>, isDream: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  if (node['方位']) result['方位'] = node['方位'];
  result['描述'] = getDescription(node, isDream);
  const proto = getRealityPrototype(node, isDream);
  if (proto) result['现实原型'] = proto;

  // Expand sub-map one level (children get 方位+描述 only, no further expansion)
  if (node['子地图'] && typeof node['子地图'] === 'object') {
    result['子地图'] = buildShallowChildren(node['子地图'], isDream);
  }

  return result;
}

// ── shallow children (Type A sub-map & 异界 sub-map) ──

function buildShallowChildren(subMap: Record<string, any>, isDream: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(subMap)) {
    if (isMetaKey(key)) continue;
    const node = subMap[key];
    if (!node || typeof node !== 'object') continue;
    result[key] = buildTypeD(node, isDream);
  }
  return result;
}

// ── main tree processor ──

function processTree(
  subMap: Record<string, any>,
  path: string[],
  pathIndex: number,
  isDream: boolean,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key of Object.keys(subMap)) {
    if (isMetaKey(key)) continue;
    const node = subMap[key];
    if (!node || typeof node !== 'object') continue;

    const isOnPath = pathIndex < path.length && key === path[pathIndex];

    if (isOnPath && pathIndex === path.length - 1) {
      // Type A: current node
      result[key] = buildTypeA(node, isDream);
    } else if (isOnPath) {
      // Type C: path ancestor
      result[key] = buildTypeC(node, path, pathIndex + 1, isDream);
    } else if (pathIndex === path.length - 1) {
      // Type B: sibling (same parent as current node)
      result[key] = buildTypeB(node, isDream);
    } else if (key === '异界') {
      // 异界 special: expand one level even when off-path
      result[key] = buildYijie(node, isDream);
    } else {
      // Type D: off-path
      result[key] = buildTypeD(node, isDream);
    }
  }

  return result;
}

// ── full-map fallback (when currentLocation doesn't match any node) ──

function simplifyFullMap(tree: Record<string, any>, isDream: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(tree)) {
    if (isMetaKey(key)) continue;
    const node = tree[key];
    if (!node || typeof node !== 'object') continue;

    const simplified = buildTypeD(node, isDream);
    if (key === '异界' && node['子地图']) {
      simplified['子地图'] = buildShallowChildren(node['子地图'], isDream);
    } else if (node['子地图'] && typeof node['子地图'] === 'object') {
      simplified['子地图'] = simplifyFullMap(node['子地图'], isDream);
    }
    result[key] = simplified;
  }
  return result;
}

// ── public API ──

/**
 * Filter the full map tree by proximity to currentLocation.
 * Returns a new tree with only the fields appropriate for each node type.
 */
export function filterMap(
  mapTree: Record<string, any>,
  path: string[] | null,
  isDream: boolean,
): Record<string, any> {
  if (!mapTree || Object.keys(mapTree).length === 0) return {};

  if (!path || path.length === 0) {
    return simplifyFullMap(mapTree, isDream);
  }

  return processTree(mapTree, path, 0, isDream);
}

// ── text formatter ──

const FIELD_ORDER = ['方位', '描述', '现实原型', '地点细节', '子地图'];

/**
 * Convert a filtered map tree to indented prompt-ready text.
 */
export function formatMap(tree: Record<string, any>, indentLevel: number = 0): string {
  const indent = '  '.repeat(indentLevel);
  let output = '';

  const keys = Object.keys(tree);

  // Sort keys: put known fields in order, then other keys alphabetically
  const knownKeys = keys.filter(k => FIELD_ORDER.includes(k));
  const unknownKeys = keys.filter(k => !FIELD_ORDER.includes(k));
  const orderedKeys = [
    ...FIELD_ORDER.filter(f => knownKeys.includes(f)),
    ...unknownKeys.sort(),
  ];

  for (const key of orderedKeys) {
    const value = tree[key];
    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = formatMap(value, indentLevel + 1);
      if (!nested) continue;
      output += `${indent}${key}:\n${nested}`;
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;
      output += `${indent}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const nested = formatMap(item, indentLevel + 1);
          if (nested) output += `${indent}  - ${nested.trimStart()}`;
        } else {
          output += `${indent}  - ${item}\n`;
        }
      }
    } else if (typeof value === 'string') {
      output += `${indent}${key}: ${value}\n`;
    } else {
      output += `${indent}${key}: ${String(value)}\n`;
    }
  }

  return output;
}

// ── convenience: resolve + filter + format ──

/**
 * Process the full map tree for prompt injection.
 * Resolves the current location, filters by proximity, and formats as text.
 */
export function processMapForPrompt(
  mapTree: Record<string, any>,
  currentLocation: string,
  isDream: boolean,
): string {
  if (!mapTree || Object.keys(mapTree).length === 0) return '';

  const path = resolvePath(currentLocation, mapTree);
  const filtered = filterMap(mapTree, path, isDream);
  if (!filtered || Object.keys(filtered).length === 0) return '';

  return formatMap(filtered, 1).trimEnd();
}
