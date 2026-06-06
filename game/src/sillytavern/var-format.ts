/**
 * Variable formatting utilities — prompt-ready tree output, variable list, path lookup.
 */

/** Strip code-managed fields to prevent AI from overwriting them via <vars> */
function stripCodeManaged(vars: Record<string, any>): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(vars));
  if (clone['主角']) delete clone['主角']['年龄'];
  const females = clone?.['主要人物']?.['女性'];
  if (females) {
    for (const group of ['异人', '普通人']) {
      const g = females[group];
      if (!g || typeof g !== 'object') continue;
      for (const name of Object.keys(g)) {
        const c = g[name];
        const u = c?.['子宫'];
        if (!u || typeof u !== 'object') continue;
        const semen = u['宫内精液'];
        if (semen && typeof semen === 'object') delete semen['总量'];
        const cycle = u['生理周期'];
        if (cycle && typeof cycle === 'object') delete cycle['当前阶段'];
        delete u['怀孕状态'];
      }
    }
  }
  return clone;
}

export function formatVariablesForPrompt(variables: Record<string, any>): string {
  if (!variables || Object.keys(variables).length === 0) return '';
  const lines: string[] = [];
  treeFormat(stripCodeManaged(variables), lines, 0);
  return lines.join('\n');
}

function treeFormat(obj: Record<string, any>, lines: string[], depth: number) {
  const indent = '  '.repeat(depth);
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${indent}${key}:`);
      treeFormat(value, lines, depth + 1);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${indent}${key}: []`);
      } else if (typeof value[0] === 'object' && value[0] !== null) {
        lines.push(`${indent}${key}:`);
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const entryOrder = ['来源', '容量', '注入时间'];
            const sorted: Record<string, any> = {};
            for (const ek of entryOrder) { if (ek in item) sorted[ek] = item[ek]; }
            for (const ek of Object.keys(item).sort()) { if (!(ek in sorted)) sorted[ek] = item[ek]; }
            const nestedLines: string[] = [];
            treeFormat(sorted, nestedLines, depth + 2);
            for (let i = 0; i < nestedLines.length; i++) {
              if (i === 0) {
                lines.push(`${indent}  - ${nestedLines[i].trimStart()}`);
              } else {
                lines.push(nestedLines[i]);
              }
            }
          } else {
            lines.push(`${indent}  - ${item}`);
          }
        }
      } else {
        lines.push(`${indent}${key}: [${value.join(', ')}]`);
      }
    } else {
      lines.push(`${indent}${key}: ${value}`);
    }
  }
}

/** Look up a dotted-path variable and format it as indented text */
export function getVariablePath(variables: Record<string, any>, path: string): string {
  if (!variables || !path) return '无';

  const parts = path.split('.');
  let node: any = variables;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!node || typeof node !== 'object') return '无';
    if (!(part in node)) return '无';
    node = node[part];
  }

  if (node === undefined || node === null) return '无';
  if (typeof node !== 'object') return String(node);

  const lines: string[] = [];
  treeFormat(node, lines, 1);
  const result = lines.join('\n');
  return result || '无';
}

// ── Variable list (type reference for AI) ──

const SKIP_INTERNAL = new Set(['检索词', '梦境NPC', '方位', '年龄']);

function leafType(v: any): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'string[]';
  switch (typeof v) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    default: return 'object';
  }
}

export function formatVarsList(variables: Record<string, any>): string {
  if (!variables || Object.keys(variables).length === 0) return '';
  const lines: string[] = [];
  varsListWalk(variables, lines, 0);
  return lines.join('\n');
}

function varsListWalk(obj: Record<string, any>, lines: string[], depth: number): void {
  const indent = '  '.repeat(depth);
  for (const key of Object.keys(obj)) {
    if (SKIP_INTERNAL.has(key)) continue;
    const value = obj[key];
    if (value === null) {
      lines.push(`${indent}${key}: null`);
    } else if (Array.isArray(value)) {
      lines.push(`${indent}${key}: string[]`);
    } else if (typeof value === 'object') {
      const visibleKeys = Object.keys(value).filter(k => !SKIP_INTERNAL.has(k));
      if (visibleKeys.length === 0) {
        lines.push(`${indent}${key}: object`);
      } else {
        lines.push(`${indent}${key}:`);
        varsListWalk(value, lines, depth + 1);
      }
    } else {
      lines.push(`${indent}${key}: ${leafType(value)}`);
    }
  }
}
