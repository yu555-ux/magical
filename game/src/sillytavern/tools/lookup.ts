/**
 * 查询工具 — get_status, lookup_world
 */
import { scanLorebooks, formatMatchedEntries, type ScanResult } from '../lorebookEngine';
import type { AgentToolDef } from './registry';

// ── Status Brief Builder ──

function buildStatusBrief(vars: Record<string, any>): string {
  const lines: string[] = [];
  const hero = vars['主角'] ?? {};
  const world = vars['世界'] ?? {};
  const inDream = world['位于梦境'] === true;
  const worldSource = inDream ? (world['梦境存档'] ?? {}) : (world['现实'] ?? {});
  const worldLabel = inDream ? '梦境' : '现实';

  // ── 时间 ──
  const time = worldSource['时间'];
  lines.push(`时间：${time ?? '未知'}`);

  // ── 地点 ──
  const location = worldSource['地点'];
  lines.push(`地点：${worldLabel}-${location ?? '未知'}`);

  // ── 天气 ──
  const weather = worldSource['天气'];
  lines.push(`天气：${weather ?? '未知'}`);
  lines.push('');

  // ── 玩家 ──
  lines.push('玩家：{{user}}');
  const age = hero['年龄'];
  if (age !== undefined) lines.push(`年龄：${age}`);
  const rating = hero['评级'];
  if (rating) lines.push(`评级：${rating}`);
  lines.push('');

  // ── 属性 ──
  lines.push('属性：');
  const body = hero['身体属性'] ?? {};
  const basic = hero['基础属性'] ?? {};
  const special = hero['特殊属性'] ?? {};

  for (const key of ['生命', '体力', '能量', 'SAN']) {
    const v = body[key];
    if (v && typeof v === 'object') {
      lines.push(`  ${key}: ${v['当前'] ?? '?'}/${v['上限'] ?? '?'}`);
    }
  }
  for (const key of ['力量', '体质', '精神', '敏捷']) {
    if (basic[key] !== undefined) lines.push(`  ${key}: ${basic[key]}`);
  }
  for (const key of ['幸运', '魅力']) {
    if (special[key] !== undefined) lines.push(`  ${key}: ${special[key]}`);
  }
  lines.push('');

  // ── 资源 ──
  lines.push('资源：');
  const res = hero['资源'] ?? {};
  const money = res['金钱'];
  if (money && typeof money === 'object') {
    lines.push(`  金钱: ${money['数值'] ?? 0} ${money['单位'] ?? '元'}`);
  }
  const superRes = res['超凡资源'] ?? {};
  for (const key of ['蝶烬', '尸气']) {
    const v = superRes[key];
    if (v > 0) lines.push(`  ${key}: ${v}`);
  }
  if (!res['金钱'] && Object.values(superRes).every((v: any) => !(v > 0))) {
    lines.push('  无');
  }
  lines.push('');

  // ── 技能 ──
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

  // ── 状态 ──
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
      const label = dur ? `${name} — ${desc} (${dur})` : `${name} — ${desc}`;
      lines.push(`  ${label}`);
    }
  }
  lines.push('');

  // ── 持有物品 ──
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
        if ((item as any)['效果'] && typeof (item as any)['效果'] === 'object') {
          parts.push(`效果: {${Object.entries((item as any)['效果']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        }
        if ((item as any)['规则'] && typeof (item as any)['规则'] === 'object') {
          parts.push(`规则: {${Object.entries((item as any)['规则']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        }
        if ((item as any)['副作用'] && typeof (item as any)['副作用'] === 'object') {
          parts.push(`副作用: {${Object.entries((item as any)['副作用']).map(([k, v]) => `${k}: ${v}`).join(', ')}}`);
        }
        lines.push(`    ${itemName}:`);
        for (const p of parts) lines.push(`      ${p}`);
      }
    }
  }
  lines.push('');

  // ── 社交关系 ──
  lines.push('社交关系：');
  const social = hero['社交'] ?? {};
  const socialNames = Object.keys(social).filter(k => !k.startsWith('_'));
  if (socialNames.length === 0) {
    lines.push('  无');
  } else {
    for (const name of socialNames) {
      const rel = social[name];
      const relText = rel && typeof rel === 'object' ? (rel['关系'] ?? '未知') : String(rel);
      lines.push(`  ${name}: ${relText}`);
    }
  }
  lines.push('');

  // ── 在场 NPC ──
  lines.push('在场NPC：');
  const chars = vars['主要人物'] ?? {};
  const playerLocation = location ?? '';
  const presentNpcs: Array<{
    name: string;
    gender: string;
    group: string;
    data: Record<string, any>;
  }> = [];

  for (const gender of ['女性', '男性']) {
    for (const group of ['异人', '普通人']) {
      const g = chars[gender]?.[group];
      if (!g || typeof g !== 'object') continue;
      for (const [npcName, npcData] of Object.entries(g)) {
        if (!npcData || typeof npcData !== 'object') continue;
        const npcLoc = (npcData as any)['当前位置'];
        if (typeof npcLoc === 'string' && npcLoc === playerLocation) {
          presentNpcs.push({ name: npcName, gender, group, data: npcData as Record<string, any> });
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
      // 关系（从主角社交中查或从 NPC 好感/友善推断）
      const heroRel = social[npc.name];
      if (heroRel && typeof heroRel === 'object' && heroRel['关系']) {
        lines.push(`    关系: ${heroRel['关系']}`);
      } else {
        lines.push('    关系: 未知');
      }
      if (d['当前位置']) lines.push(`    位置: ${d['当前位置']}`);
      if (d['当前行动']) lines.push(`    行动: ${d['当前行动']}`);
      if (d['当前想法']) lines.push(`    想法: ${d['当前想法']}`);
    }
  }

  return `<player_var>\n${lines.join('\n')}\n</player_var>`;
}

// ── Tools ──

export const lookupTools: Record<string, AgentToolDef> = {

  // ── get_status ──
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
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(ctx, _params) {
      const brief = buildStatusBrief(ctx.variables);
      return { content: [{ type: 'text', text: brief }] };
    },
  },

  // ── lookup_world ──
  lookup_world: {
    name: 'lookup_world',
    label: '查询世界书',
    category: 'lookup',
    description:
      '在世界书中搜索设定条目。注意：标记为"常驻"的条目已随每轮提示词自动注入，无需查询；本工具只搜索非常驻条目。\n\n' +
      '【工作节奏】\n' +
      '- 每轮最多调用 1-2 次此工具，然后直接开始叙事\n' +
      '- 如果返回了条目内容，直接使用，不要换关键词重新搜索\n' +
      '- 如果返回"未找到"，说明设定中确实没有，自由创作即可\n\n' +
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
        return { content: [{ type: 'text', text: `世界书中没有与「${keyword}」相关的条目。这很正常——你可以根据自己的判断自然地描写，不需要再次查询。` }] };
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
        return { content: [{ type: 'text', text: `未找到与「${keyword}」精确匹配的条目，以下是最相关的条目（直接使用，无需再次查询）：\n\n${text}` }], details: { keyword, entries: closest } };
      }

      const text = formatMatchedEntries(matched);
      return { content: [{ type: 'text', text }], details: { keyword, entries: matched } };
    },
  },

};
