/**
 * Character filter engine — filters NPCs by position proximity to protagonist
 * and formats them as prompt-ready text for the 4 character macros.
 */
import { resolvePath } from './variables';

// ── types ──

type Gender = 'female' | 'male';
type CharType = 'stranger' | 'normal';
type CharLevel = 'L0' | 'L1' | 'L2';

// ── level determination ──

function determineLevel(
  protagonistPath: string[] | null,
  npcPath: string[] | null,
): CharLevel {
  if (!protagonistPath || !npcPath) return 'L2';

  let common = 0;
  const minLen = Math.min(protagonistPath.length, npcPath.length);
  for (let i = 0; i < minLen; i++) {
    if (protagonistPath[i] === npcPath[i]) common++;
    else break;
  }

  if (protagonistPath.length === npcPath.length && common === protagonistPath.length) {
    return 'L0';
  }

  const maxLen = Math.max(protagonistPath.length, npcPath.length);
  if (common === maxLen - 1) {
    return 'L1';
  }

  return 'L2';
}

// ── helpers ──

function hasNonEmptyItems(items: Record<string, any> | undefined): boolean {
  if (!items || typeof items !== 'object') return false;
  return (
    (items['灵宝'] && Object.keys(items['灵宝']).length > 0) ||
    (items['诡物'] && Object.keys(items['诡物']).length > 0) ||
    (items['物品'] && Object.keys(items['物品']).length > 0)
  );
}

// ── L0: full detail (same node) ──

function buildL0(
  charData: Record<string, any>,
  gender: Gender,
  type: CharType,
): Record<string, any> {
  const n: Record<string, any> = {};

  n['年龄'] = charData['年龄'] ?? 0;
  n['身份'] = charData['身份'] || '';
  if (charData['评级']) n['评级'] = charData['评级'];

  if (gender === 'female') {
    n['好感值'] = charData['好感值'] ?? 0;
    n['堕落值'] = charData['堕落值'] ?? 0;
  } else {
    n['友善值'] = charData['友善值'] ?? 0;
  }

  n['当前位置'] = charData['当前位置'] || '';
  n['当前行动'] = charData['当前行动'] || '';
  n['当前想法'] = charData['当前想法'] || '';
  if (charData['状态'] && Object.keys(charData['状态']).length > 0) {
    n['状态'] = charData['状态'];
  }

  if (charData['身体属性']) n['身体属性'] = charData['身体属性'];
  if (charData['基础属性']) n['基础属性'] = charData['基础属性'];
  if (charData['特殊属性']) n['特殊属性'] = charData['特殊属性'];

  if (gender === 'female' && charData['着装']) {
    n['着装'] = charData['着装'];
  }

  if (gender === 'female' && charData['身体开发']) {
    n['身体开发'] = charData['身体开发'];
  }

  if (type === 'stranger') {
    if (charData['技能'] && Object.keys(charData['技能']).length > 0) {
      n['技能'] = charData['技能'];
    }
    if (hasNonEmptyItems(charData['所持物品'])) {
      n['所持物品'] = charData['所持物品'];
    }
  }

  if (charData['社交圈']) {
    n['社交圈'] = charData['社交圈'];
  }

  return n;
}

// ── L1: medium detail (same building) ──

function buildL1(
  charData: Record<string, any>,
  gender: Gender,
  _type: CharType,
): Record<string, any> {
  const n: Record<string, any> = {};

  n['年龄'] = charData['年龄'] ?? 0;
  n['身份'] = charData['身份'] || '';
  if (charData['评级']) n['评级'] = charData['评级'];

  if (gender === 'female') {
    n['好感值'] = charData['好感值'] ?? 0;
    n['堕落值'] = charData['堕落值'] ?? 0;
  } else {
    n['友善值'] = charData['友善值'] ?? 0;
  }

  n['当前位置'] = charData['当前位置'] || '';
  n['当前行动'] = charData['当前行动'] || '';

  if (charData['身体属性']) n['身体属性'] = charData['身体属性'];

  if (gender === 'female' && charData['身体开发']) {
    n['身体开发'] = charData['身体开发'];
  }

  return n;
}

// ── L2: minimal detail (same district / far) ──

function buildL2(charData: Record<string, any>, gender: Gender): Record<string, any> {
  const n: Record<string, any> = {};

  n['年龄'] = charData['年龄'] ?? 0;
  n['身份'] = charData['身份'] || '';

  if (gender === 'female') {
    n['好感值'] = charData['好感值'] ?? 0;
    n['堕落值'] = charData['堕落值'] ?? 0;
  } else {
    n['友善值'] = charData['友善值'] ?? 0;
  }

  n['当前位置'] = charData['当前位置'] || '';
  n['当前行动'] = charData['当前行动'] || '';

  if (charData['身体属性']) n['身体属性'] = charData['身体属性'];

  return n;
}

// ── group processor ──

/**
 * Filter a single character group (e.g. 女性.异人) by proximity and dream state.
 * Returns filtered dict keyed by character name, ready for text formatting.
 */
export function filterCharacterGroup(
  group: Record<string, any> | undefined,
  protagonistPath: string[] | null,
  isDream: boolean,
  mapTree: Record<string, any>,
  gender: Gender,
  type: CharType,
): Record<string, any> {
  const result: Record<string, any> = {};
  if (!group || typeof group !== 'object') return result;

  for (const charName of Object.keys(group)) {
    const charData = group[charName];
    if (!charData || typeof charData !== 'object') continue;

    const charIsDreamNPC = charData['梦境NPC'] === true;
    if (isDream !== charIsDreamNPC) continue;

    const charLocation = charData['当前位置'] || '';
    const npcPath = resolvePath(charLocation, mapTree);
    const level = determineLevel(protagonistPath, npcPath);

    if (level === 'L0') {
      result[charName] = buildL0(charData, gender, type);
    } else if (level === 'L1') {
      result[charName] = buildL1(charData, gender, type);
    } else {
      result[charName] = buildL2(charData, gender);
    }
  }

  return result;
}

// ── text formatter (same format as map-filter) ──

import { formatMap } from './map-filter';

/**
 * Format a filtered character group to indented prompt text.
 */
export function formatCharacterGroup(group: Record<string, any>): string {
  if (!group || typeof group !== 'object' || Object.keys(group).length === 0) return '';
  return formatMap(group, 1).trimEnd();
}
