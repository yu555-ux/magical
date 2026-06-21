/**
 * 查询工具 — get_status, lookup_character, lookup_world
 */
import { scanLorebooks, formatMatchedEntries, type ScanResult } from '../lorebookEngine';
import type { AgentToolDef, ToolExecutionContext } from './registry';

// ── Macro ──

function replaceMacro(text: string, userName: string): string {
  return text.replace(/\{\{user\}\}/g, userName).replace(/<user>/g, userName);
}

// ── Status Brief Builder ──

function buildStatusBrief(vars: Record<string, any>, userName: string): string {
  const lines: string[] = [];
  const hero = vars['主角'] ?? {};
  const world = vars['世界'] ?? {};
  const inDream = world['位于梦境'] === true;
  const worldSource = inDream ? (world['梦境存档'] ?? {}) : (world['现实'] ?? {});
  const worldLabel = inDream ? '梦境' : '现实';

  const R = (s: string) => replaceMacro(s, userName);

  lines.push(`时间：${worldSource['时间'] ?? '未知'}`);
  lines.push(`地点：${worldLabel}-${R(worldSource['地点'] ?? '未知')}`);
  lines.push(`天气：${worldSource['天气'] ?? '未知'}`);
  lines.push('');
  lines.push(`玩家：${userName}`);
  const age = hero['年龄'];
  if (age !== undefined) lines.push(`年龄：${age}`);
  const rating = hero['评级'];
  if (rating) lines.push(`评级：${rating}`);
  lines.push('');

  // 属性
  lines.push('属性：');
  const body = hero['身体属性'] ?? {};
  const basic = hero['基础属性'] ?? {};
  const special = hero['特殊属性'] ?? {};
  for (const key of ['生命', '体力', '能量', 'SAN']) {
    const v = body[key];
    if (v && typeof v === 'object') lines.push(`  ${key}: ${v['当前'] ?? '?'}/${v['上限'] ?? '?'}`);
  }
  for (const key of ['力量', '体质', '精神', '敏捷']) {
    if (basic[key] !== undefined) lines.push(`  ${key}: ${basic[key]}`);
  }
  for (const key of ['幸运', '魅力']) {
    if (special[key] !== undefined) lines.push(`  ${key}: ${special[key]}`);
  }
  lines.push('');

  // 资源
  lines.push('资源：');
  const res = hero['资源'] ?? {};
  const money = res['金钱'];
  if (money && typeof money === 'object') lines.push(`  金钱: ${money['数值'] ?? 0} ${money['单位'] ?? '元'}`);
  const superRes = res['超凡资源'] ?? {};
  for (const key of ['蝶烬', '尸气']) {
    const v = superRes[key];
    if (v > 0) lines.push(`  ${key}: ${v}`);
  }
  lines.push('');

  // 技能
  lines.push('技能：');
  const skills = hero['技能'] ?? {};
  const skillNames = Object.keys(skills).filter(k => !k.startsWith('_'));
  if (skillNames.length === 0) {
    lines.push('  无');
  } else {
    for (const name of skillNames) {
      const s = skills[name];
      if (!s || typeof s !== 'object') continue;
      lines.push(`  ${name}:`);
      if (s['等级']) lines.push(`    等级: ${s['等级']}`);
      if (typeof s['熟练度'] === 'number') lines.push(`    熟练度: ${s['熟练度']}`);
      if (s['消耗能量'] !== undefined) lines.push(`    消耗能量: ${s['消耗能量']}`);
      if (s['描述']) lines.push(`    描述: ${s['描述']}`);
      if (s['使用要求']) lines.push(`    使用要求: ${s['使用要求']}`);
      if (s['副作用'] && typeof s['副作用'] === 'object' && Object.keys(s['副作用']).length > 0) {
        lines.push('    副作用:');
        for (const [ek, ev] of Object.entries(s['副作用'])) {
          lines.push(`      ${ek}: ${typeof ev === 'string' ? (ev || "''") : ev}`);
        }
      }
      if (s['分支'] && typeof s['分支'] === 'object' && Object.keys(s['分支']).length > 0) {
        lines.push('    分支:');
        for (const [bk, bv] of Object.entries(s['分支'])) {
          lines.push(`      ${bk}: ${typeof bv === 'string' ? bv : JSON.stringify(bv)}`);
        }
      } else {
        lines.push('    分支: 无');
      }
    }
  }
  lines.push('');

  // 状态
  lines.push('状态：');
  const conditions = hero['状态'] ?? {};
  const condNames = Object.keys(conditions).filter(k => !k.startsWith('_'));
  if (condNames.length === 0) {
    lines.push('  无');
  } else {
    for (const name of condNames) {
      const c = conditions[name];
      if (!c || typeof c !== 'object') continue;
      const desc = c['描述'] ?? '';
      const dur = c['持续时间'];
      lines.push(dur ? `  ${name} — ${desc} (${dur})` : `  ${name} — ${desc}`);
    }
  }
  lines.push('');

  // 持有物品
  lines.push('持有物品：');
  const inv = hero['持有物品'] ?? {};
  for (const cat of ['灵宝', '诡物', '物品']) {
    const items = inv[cat];
    if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
      lines.push(`  ${cat}：无`);
    } else {
      lines.push(`  ${cat}：`);
      for (const [itemName, item] of Object.entries(items)) {
        if (!item || typeof item !== 'object') continue;
        const parts: string[] = [];
        if ((item as any)['等级']) parts.push(`等级: ${(item as any)['等级']}`);
        if (typeof (item as any)['数量'] === 'number') parts.push(`数量: ${(item as any)['数量']}`);
        if ((item as any)['描述']) parts.push(`描述: ${(item as any)['描述']}`);
        if ((item as any)['效果'] && typeof (item as any)['效果'] === 'object')
          parts.push(`效果: {${Object.entries((item as any)['效果']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        if ((item as any)['规则'] && typeof (item as any)['规则'] === 'object')
          parts.push(`规则: {${Object.entries((item as any)['规则']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        if ((item as any)['副作用'] && typeof (item as any)['副作用'] === 'object')
          parts.push(`副作用: {${Object.entries((item as any)['副作用']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        lines.push(`    ${itemName}:`);
        for (const p of parts) lines.push(`      ${p}`);
      }
    }
  }
  lines.push('');

  // 社交关系
  lines.push('社交关系：');
  const social = hero['社交'] ?? {};
  const socialNames = Object.keys(social).filter(k => !k.startsWith('_'));
  if (socialNames.length === 0) {
    lines.push('  无');
  } else {
    for (const name of socialNames) {
      const rel = social[name];
      const relText = rel && typeof rel === 'object' ? (R(rel['关系'] ?? '未知')) : String(rel);
      lines.push(`  ${name}: ${relText}`);
    }
  }
  lines.push('');

  // 在场 NPC
  lines.push('在场NPC：');
  const chars = vars['主要人物'] ?? {};
  const playerLocation = worldSource['地点'] ?? '';
  const presentNpcs: Array<{ name: string; data: Record<string, any> }> = [];
  for (const gender of ['女性', '男性']) {
    for (const group of ['异人', '普通人']) {
      const g = chars[gender]?.[group];
      if (!g || typeof g !== 'object') continue;
      for (const [npcName, npcData] of Object.entries(g)) {
        if (!npcData || typeof npcData !== 'object') continue;
        if ((npcData as any)['当前位置'] === playerLocation) {
          presentNpcs.push({ name: npcName, data: npcData as Record<string, any> });
        }
      }
    }
  }
  if (presentNpcs.length === 0) {
    lines.push('  无');
  } else {
    for (const npc of presentNpcs) {
      const d = npc.data;
      lines.push(`  - ${npc.name}:`);
      const heroRel = social[npc.name];
      if (heroRel && typeof heroRel === 'object' && heroRel['关系']) {
        lines.push(`    关系: ${R(heroRel['关系'])}`);
      } else {
        lines.push('    关系: 未知');
      }
      if (d['当前位置']) lines.push(`    位置: ${R(d['当前位置'])}`);
      if (d['当前行动']) lines.push(`    行动: ${R(d['当前行动'])}`);
      if (d['当前想法']) lines.push(`    想法: ${R(d['当前想法'])}`);
    }
  }

  return `<player_var>\n${lines.join('\n')}\n</player_var>`;
}

// ── Character Brief Builders ──

interface NpcInfo {
  name: string;
  gender: string;
  group: string;
  data: Record<string, any>;
}

function findAllNpcs(vars: Record<string, any>): NpcInfo[] {
  const chars = vars['主要人物'] ?? {};
  const result: NpcInfo[] = [];
  for (const gender of ['女性', '男性']) {
    for (const group of ['异人', '普通人']) {
      const g = chars[gender]?.[group];
      if (!g || typeof g !== 'object') continue;
      for (const [name, data] of Object.entries(g)) {
        if (data && typeof data === 'object') {
          result.push({ name, gender, group, data: data as Record<string, any> });
        }
      }
    }
  }
  return result;
}

function buildCharacterIndex(vars: Record<string, any>, userName: string): string {
  const npcs = findAllNpcs(vars);
  const R = (s: string) => replaceMacro(s, userName);
  const lines: string[] = [];

  // 按分组聚合
  const groups: Record<string, NpcInfo[]> = {};
  for (const npc of npcs) {
    const key = `${npc.gender}·${npc.group === '异人' ? '异人' : '普通人'}`;
    (groups[key] ??= []).push(npc);
  }

  const groupOrder = ['女性·异人', '女性·普通人', '男性·异人', '男性·普通人'];
  for (const gk of groupOrder) {
    const list = groups[gk];
    if (!list || list.length === 0) continue;
    lines.push(`${gk}：`);
    for (const npc of list) {
      const identity = R(npc.data['身份'] ?? '未知身份');
      const location = R(npc.data['当前位置'] ?? '未知地点');
      lines.push(`  ${npc.name}: ${identity} | ${location}`);
    }
    lines.push('');
  }

  return `<character_index>\n${lines.join('\n').trim()}\n</character_index>`;
}

function buildCharacterBrief(name: string, vars: Record<string, any>, userName: string): string | null {
  const npcs = findAllNpcs(vars);
  const npc = npcs.find(n => n.name === name);
  if (!npc) return null;

  const d = npc.data;
  const R = (s: string) => replaceMacro(s, userName);
  const lines: string[] = [];
  const isFemale = npc.gender === '女性';
  const isMutant = npc.group === '异人';

  lines.push(`${npc.name}:`);
  lines.push(`  性别: ${npc.gender}`);
  lines.push(`  分组: ${npc.group === '异人' ? '异人' : '普通人'}`);
  const age = d['年龄'];
  if (age !== undefined) lines.push(`  年龄: ${age}`);
  lines.push(`  身份: ${R(d['身份'] ?? '未知')}`);

  if (isMutant) {
    const rating = d['评级'];
    if (rating) lines.push(`  评级: ${rating}`);
  }
  lines.push('');

  // 好感/友善
  if (isFemale) {
    if (d['好感值'] !== undefined) lines.push(`  好感值: ${d['好感值']}`);
    if (d['堕落值'] !== undefined) lines.push(`  堕落值: ${d['堕落值']}`);
    if (d['性欲值'] !== undefined) lines.push(`  性欲值: ${d['性欲值']}`);
  } else {
    if (d['友善值'] !== undefined) lines.push(`  友善值: ${d['友善值']}`);
  }
  const socialCircle = d['社交圈'];
  if (socialCircle && typeof socialCircle === 'object') {
    const sc = Object.keys(socialCircle).filter(k => !k.startsWith('_'));
    if (sc.length > 0) lines.push(`  社交圈: ${sc.map(k => R(k)).join(', ')}`);
  }
  lines.push('');

  // 身体属性
  lines.push('  身体属性：');
  const bp = d['身体属性'] ?? {};
  for (const key of (isMutant ? ['生命', '能量', 'SAN'] : ['生命', 'SAN'])) {
    const v = bp[key];
    if (v && typeof v === 'object') {
      lines.push(`    ${key}: ${v['当前'] ?? '?'}/${v['上限'] ?? '?'}`);
    }
  }
  lines.push('');

  // 基础属性
  lines.push('  基础属性：');
  const ba = d['基础属性'] ?? {};
  for (const key of ['力量', '体质', '精神', '敏捷']) {
    if (ba[key] !== undefined) lines.push(`    ${key}: ${ba[key]}`);
  }
  lines.push('');

  // 特殊属性
  lines.push('  特殊属性：');
  const sa = d['特殊属性'] ?? {};
  for (const key of ['幸运', '魅力']) {
    if (sa[key] !== undefined) lines.push(`    ${key}: ${sa[key]}`);
  }
  lines.push('');

  // 技能（仅异人）
  if (isMutant) {
    lines.push('  技能：');
    const skills = d['技能'] ?? {};
    const skillNames = Object.keys(skills).filter(k => !k.startsWith('_'));
    if (skillNames.length === 0) {
      lines.push('    无');
    } else {
      for (const sn of skillNames) {
        const s = skills[sn];
        if (!s || typeof s !== 'object') continue;
        lines.push(`    ${sn}:`);
        if (s['等级']) lines.push(`      等级: ${s['等级']}`);
        if (typeof s['熟练度'] === 'number') lines.push(`      熟练度: ${s['熟练度']}`);
        if (s['消耗能量'] !== undefined) lines.push(`      消耗能量: ${s['消耗能量']}`);
        if (s['描述']) lines.push(`      描述: ${s['描述']}`);
        if (s['使用要求']) lines.push(`      使用要求: ${s['使用要求']}`);
        if (s['副作用'] && typeof s['副作用'] === 'object' && Object.keys(s['副作用']).length > 0) {
          lines.push('      副作用:');
          for (const [ek, ev] of Object.entries(s['副作用'])) {
            lines.push(`        ${ek}: ${typeof ev === 'string' ? (ev || "''") : ev}`);
          }
        }
        if (s['分支'] && typeof s['分支'] === 'object' && Object.keys(s['分支']).length > 0) {
          lines.push('      分支:');
          for (const [bk, bv] of Object.entries(s['分支'])) {
            lines.push(`        ${bk}: ${typeof bv === 'string' ? bv : JSON.stringify(bv)}`);
          }
        } else {
          lines.push('      分支: 无');
        }
      }
    }
    lines.push('');
  }

  // 状态
  lines.push('  状态：');
  const conds = d['状态'] ?? {};
  const condNames = Object.keys(conds).filter(k => !k.startsWith('_'));
  if (condNames.length === 0) {
    lines.push('    无');
  } else {
    for (const cn of condNames) {
      const c = conds[cn];
      if (!c || typeof c !== 'object') continue;
      const desc = c['描述'] ?? '';
      const dur = c['持续时间'];
      lines.push(dur ? `    ${cn} — ${desc} (${dur})` : `    ${cn} — ${desc}`);
    }
  }
  lines.push('');

  // 所持物品
  lines.push('  所持物品：');
  const inv = d['所持物品'] ?? {};
  for (const cat of ['灵宝', '诡物', '物品']) {
    const items = inv[cat];
    if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
      lines.push(`    ${cat}：无`);
    } else {
      lines.push(`    ${cat}：`);
      for (const [itemName, item] of Object.entries(items)) {
        if (!item || typeof item !== 'object') continue;
        const parts: string[] = [];
        if ((item as any)['等级']) parts.push(`等级: ${(item as any)['等级']}`);
        if (typeof (item as any)['数量'] === 'number') parts.push(`数量: ${(item as any)['数量']}`);
        if ((item as any)['描述']) parts.push(`描述: ${(item as any)['描述']}`);
        if ((item as any)['效果'] && typeof (item as any)['效果'] === 'object')
          parts.push(`效果: {${Object.entries((item as any)['效果']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        if ((item as any)['规则'] && typeof (item as any)['规则'] === 'object')
          parts.push(`规则: {${Object.entries((item as any)['规则']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        if ((item as any)['副作用'] && typeof (item as any)['副作用'] === 'object')
          parts.push(`副作用: {${Object.entries((item as any)['副作用']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        lines.push(`      ${itemName}:`);
        for (const p of parts) lines.push(`        ${p}`);
      }
    }
  }
  lines.push('');

  // 着装（仅女性）
  if (isFemale) {
    const outfit = d['着装'];
    if (outfit && typeof outfit === 'object' && Object.keys(outfit).length > 0) {
      lines.push('  着装：');
      for (const [part, od] of Object.entries(outfit)) {
        if (!od || typeof od !== 'object') continue;
        lines.push(`    ${part}:`);
        if ((od as any)['名称']) lines.push(`      名称: ${(od as any)['名称']}`);
        if ((od as any)['描述']) lines.push(`      描述: ${(od as any)['描述']}`);
      }
      lines.push('');
    }

    // 身体开发（仅女性）
    const bodyDev = d['身体开发'];
    if (bodyDev && typeof bodyDev === 'object' && Object.keys(bodyDev).length > 0) {
      lines.push('  身体开发：');
      for (const [part, bd] of Object.entries(bodyDev)) {
        if (!bd || typeof bd !== 'object') continue;
        lines.push(`    ${part}:`);
        if ((bd as any)['描述']) lines.push(`      描述: ${(bd as any)['描述']}`);
        if (typeof (bd as any)['使用次数'] === 'number') lines.push(`      使用次数: ${(bd as any)['使用次数']}`);
      }
      lines.push('');
    }
  }

  return `<character_var>\n${lines.join('\n').trim()}\n</character_var>`;
}

// ── Location Brief Builders ──

function buildLocationIndex(mapTree: any): string {
  if (!mapTree || typeof mapTree !== 'object') return '<location_index>\n无地图数据\n</location_index>';
  const lines: string[] = [];
  function walk(node: any, depth: number) {
    const sub = node['子地图'];
    if (!sub || typeof sub !== 'object' || Object.keys(sub).length === 0) return;
    const indent = '  '.repeat(depth);
    for (const [name, child] of Object.entries(sub)) {
      const childSub = (child as any)?.['子地图'];
      const hasChildren = childSub && typeof childSub === 'object' && Object.keys(childSub).length > 0;
      if (hasChildren) {
        lines.push(`${indent}${name}：`);
        walk(child, depth + 1);
      } else {
        lines.push(`${indent}${name}`);
      }
    }
  }
  for (const [world, data] of Object.entries(mapTree)) {
    lines.push(`${world}：`);
    walk(data, 1);
  }
  return `<location_index>\n${lines.join('\n').trim()}\n</location_index>`;
}

function findLocationNode(root: any, target: string): { node: any; name: string } | null {
  if (!root || typeof root !== 'object') return null;
  const sub = root['子地图'];
  if (!sub || typeof sub !== 'object') return null;
  for (const [childName, childNode] of Object.entries(sub)) {
    if (childName === target) return { node: childNode, name: childName };
    const keywords = (childNode as any)?.['检索词'];
    if (Array.isArray(keywords) && keywords.some((k: string) => k === target)) {
      return { node: childNode, name: childName };
    }
    const found = findLocationNode(childNode, target);
    if (found) return found;
  }
  return null;
}

function searchAllWorlds(mapTree: any, target: string): { node: any; name: string; world: string; path: string[] } | null {
  if (!mapTree || typeof mapTree !== 'object') return null;
  for (const worldName of Object.keys(mapTree)) {
    const worldNode = mapTree[worldName];
    if (worldName === target) return { node: worldNode, name: worldName, world: worldName, path: [worldName] };
    const result = findLocationNode(worldNode, target);
    if (result) {
      // 递归向上拼接路径
      const path = [result.name];
      function collectPath(root2: any, t: string, acc: string[]) {
        const sub2 = root2['子地图'];
        if (!sub2) return false;
        for (const [cn, cn2] of Object.entries(sub2)) {
          if (cn === t) { acc.unshift(cn); return true; }
          if (collectPath(cn2, t, acc)) { acc.unshift(cn); return true; }
        }
        return false;
      }
      collectPath(worldNode, result.name, path);
      return { node: result.node, name: result.name, world: worldName, path: [worldName, ...path] };
    }
  }
  return null;
}

function buildLocationBrief(target: string, mapTree: any): string | null {
  const result = searchAllWorlds(mapTree, target);
  if (!result) return null;

  const { node, world, path } = result;
  const lines: string[] = [];
  const real = (node as any)?.['现实'];
  const dream = (node as any)?.['梦境'];
  const sub = (node as any)?.['子地图'];

  lines.push(`${target}:`);
  // 路径用 - 连接（去掉 子地图 段，只保留地点名）
  const cleanPath = path.filter(p => p !== '子地图');
  lines.push(`  路径: ${cleanPath.join('-')}`);
  lines.push('');

  if (real && typeof real === 'object') {
    lines.push('  现实:');
    if (real['描述']) lines.push(`    描述: ${real['描述']}`);
    const realDetail = real['地点细节'];
    if (realDetail && typeof realDetail === 'object') {
      const realInfo = realDetail['信息'];
      if (Array.isArray(realInfo) && realInfo.length > 0) {
        lines.push('    地点细节:');
        lines.push('      信息:');
        for (const info of realInfo) lines.push(`        - ${info}`);
      }
      const realAnom = realDetail['异常'];
      if (realAnom && typeof realAnom === 'object' && Object.keys(realAnom).length > 0) {
        if (!realDetail['信息'] || !realInfo?.length) lines.push('    地点细节:');
        lines.push('      异常:');
        for (const [aname, adata] of Object.entries(realAnom)) {
          lines.push(`        ${aname}: ${(adata as any)?.['描述'] ?? ''}`);
        }
      }
    }
    lines.push('');
  }

  if (dream && typeof dream === 'object') {
    lines.push('  梦境:');
    if (dream['描述']) lines.push(`    描述: ${dream['描述']}`);
    const dreamDetail = dream['地点细节'];
    if (dreamDetail && typeof dreamDetail === 'object') {
      const dreamInfo = dreamDetail['信息'];
      if (Array.isArray(dreamInfo) && dreamInfo.length > 0) {
        lines.push('    地点细节:');
        lines.push('      信息:');
        for (const info of dreamInfo) lines.push(`        - ${info}`);
      }
      const dreamAnom = dreamDetail['异常'];
      if (dreamAnom && typeof dreamAnom === 'object' && Object.keys(dreamAnom).length > 0) {
        if (!dreamDetail['信息'] || !dreamInfo?.length) lines.push('    地点细节:');
        lines.push('      异常:');
        for (const [aname, adata] of Object.entries(dreamAnom)) {
          lines.push(`        ${aname}: ${(adata as any)?.['描述'] ?? ''}`);
        }
      }
    }
    lines.push('');
  }

  if (sub && typeof sub === 'object') {
    const children = Object.keys(sub);
    if (children.length > 0) {
      lines.push(`  子地点:`);
      lines.push(`    ${children.join(', ')}`);
    }
  }

  return `<location_var>\n${lines.join('\n').trim()}\n</location_var>`;
}

// ── Tools ──

export const lookupTools: Record<string, AgentToolDef> = {

  get_status: {
    name: 'get_status',
    label: '查看状态',
    category: 'lookup',
    description:
      '查看玩家当前状态简报。包含时间/地点/天气/属性/资源/技能/状态/持有物品/社交关系/在场NPC。\n\n' +
      '【必须调用的场景】\n' +
      '- 每轮开始叙事前，获取当前完整状态快照\n' +
      '- 玩家询问当前状态、资源、同行者\n' +
      '- 不确定变量当前值时\n\n' +
      '【严禁的行为】\n' +
      '- 凭记忆推测数值——以本工具返回为准\n' +
      '- 状态未变化时重复调用（每轮最多调用一次）',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(ctx, _params) {
      return { content: [{ type: 'text', text: buildStatusBrief(ctx.variables, ctx.userName) }] };
    },
  },

  lookup_character: {
    name: 'lookup_character',
    label: '查找角色',
    category: 'lookup',
    description:
      '查找主要角色信息。不填 name 时列出全部已知角色摘要（名字/身份/地点），填 name 时返回该角色的完整信息（属性/技能/物品/社交/着装等）。\n\n' +
      '【必须调用的场景——以下任一情况必须调本工具】\n' +
      '- get_status 的在场NPC段出现了某个 NPC 名字 → 必须调本工具(name=该NPC)获取完整属性才能叙事\n' +
      '- 玩家与任何 NPC 互动（对话/战斗/交易/社交） → 先调本工具查该 NPC 的完整信息\n' +
      '- 玩家前往某地点 → 先调本工具(无参)看谁在那个地点，再调详情\n' +
      '- 需要进行战斗/技能对抗/好感判定 → 必须先调本工具获取 NPC 的属性和技能值\n\n' +
      '【严禁的行为】\n' +
      '- 凭记忆编造 NPC 外貌/性格/属性/技能——get_status 只有位置和关系，没有属性和技能\n' +
      '- 只靠 get_status 的在场NPC摘要就叙事——那里面只有名字/关系/位置/行动/想法，没有属性值',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '角色名字。不填则列出全部已知角色摘要。' },
      },
      required: [],
    },
    async execute(ctx, params) {
      const name = (params?.name as string)?.trim();
      if (!name) {
        return { content: [{ type: 'text', text: buildCharacterIndex(ctx.variables, ctx.userName) }] };
      }
      const brief = buildCharacterBrief(name, ctx.variables, ctx.userName);
      if (!brief) {
        return { content: [{ type: 'text', text: `未找到角色: ${name}` }] };
      }
      return { content: [{ type: 'text', text: brief }] };
    },
  },

  lookup_location: {
    name: 'lookup_location',
    label: '查找地点',
    category: 'lookup',
    description:
      '查找地点信息。不填 name 时列出全部已知地点的树状结构，填 name 时返回该地点的完整信息（现实/梦境描述、地点细节、异常、子地点）。\n\n' +
      '【必须调用的场景】\n' +
      '- 玩家进入新地点或切换场景 → 先调本工具获取地点描述再叙事\n' +
      '- 需要知道某地点的现实/梦境差异时\n' +
      '- 需要检查地点是否有异常时\n\n' +
      '【严禁的行为】\n' +
      '- 凭记忆编造地点描述——以本工具返回为准',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '地点名称。不填则列出全部已知地点的树状结构。' },
      },
      required: [],
    },
    async execute(ctx, params) {
      const mapTree = ctx.variables?.['地图'];
      const name = (params?.name as string)?.trim();
      if (!name) {
        return { content: [{ type: 'text', text: buildLocationIndex(mapTree) }] };
      }
      const brief = buildLocationBrief(name, mapTree);
      if (!brief) {
        return { content: [{ type: 'text', text: `未找到地点: ${name}` }] };
      }
      return { content: [{ type: 'text', text: brief }] };
    },
  },

  lookup_world: {
    name: 'lookup_world',
    label: '查询世界书',
    category: 'lookup',
    description:
      '在世界书中搜索设定条目。注意：标记为"常驻"的条目已随每轮提示词自动注入，无需查询；本工具只搜索非常驻条目。\n\n' +
      '【工作节奏】\n' +
      '- 每轮最多调用 1-2 次此工具，然后直接开始叙事\n' +
      '- 如果返回了条目内容，直接使用，不要换关键词重新搜索\n' +
      '- 如果返回"未找到"，说明当前无对应信息\n\n' +
      '【禁止】\n' +
      '- 反复换关键词查询同一个目标（如查了"周汝"又查"周汝 性格"又查"周汝 背景"）\n' +
      '- 一次查询多个无关概念（如 keyword="血月 周汝 夏城"）\n\n' +
      '【你的职责】\n' +
      '你不是世界设定的创造者，你是世界设定的翻译者。工具返回什么，你就用什么。\n' +
      '工具没返回的内容，意味着设定中没有——如实告诉玩家"不清楚"，或者用自己的常识补全。\n' +
      '但绝不能即兴编造一个有设定原型的地点的细节（如工具返回了夏城一中但没写校门颜色，你可以编校门颜色；但如果连夏城一中这个地点都没返回，你就不能凭空创造它）。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '角色名或核心概念。如"周汝"、"魔法少女"、"深渊"。一次只查一个。' },
      },
      required: ['keyword'],
    },
    async execute(ctx, params) {
      const keyword = params?.keyword as string;
      if (!keyword) return { content: [{ type: 'text', text: '请提供搜索关键词' }] };

      const scanResult: ScanResult = scanLorebooks(ctx.lorebooks, keyword, ctx.historyText);
      const allEntries = Object.values(scanResult.groups).flat().filter(e => !e.entry.constant);

      if (allEntries.length === 0) {
        return { content: [{ type: 'text', text: `未找到与「${keyword}」相关的信息。` }] };
      }

      const lowerName = keyword.toLowerCase();
      const matched = allEntries
        .filter(e => {
          const keys = e.entry.keys.map(k => k.toLowerCase());
          return keys.some(k => k.includes(lowerName) || lowerName.includes(k));
        })
        .slice(0, 3);

      if (matched.length === 0) {
        const closest = allEntries.slice(0, 3);
        const text = formatMatchedEntries(closest);
        return { content: [{ type: 'text', text: `未找到与「${keyword}」精确匹配的信息，以下是最相关的：\n\n${text}` }], details: { keyword, entries: closest } };
      }

      const text = formatMatchedEntries(matched);
      return { content: [{ type: 'text', text }], details: { keyword, entries: matched } };
    },
  },

};
