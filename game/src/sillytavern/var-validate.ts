/**
 * 变量写入白名单 + 类型守卫
 *
 * 规则：
 * - replace: 路径必须已存在，新值 typeof 必须等于旧值 typeof
 * - insert:  父级路径必须已存在（值类型不限制——允许自由新增字段）
 * - remove:  路径必须已存在
 *
 * 不依赖 default-world-vars 做对照——运行时变量树会动态增长（新 NPC/地点/物品）。
 * 用当前树做对照天然支持这种增长。
 */

import type { JsonPatchOp } from './types';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePatchOp(
  op: JsonPatchOp,
  currentVars: Record<string, any>,
): ValidationResult {
  const parts = (op.path || '').split('/').filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, error: `空路径: ${op.path}` };
  }

  // 沿着路径走到目标
  let parent: any = currentVars;
  for (let i = 0; i < parts.length - 1; i++) {
    if (parent == null || typeof parent !== 'object') {
      return { ok: false, error: `路径不存在 (父级不是对象): ${op.path}` };
    }
    parent = parent[parts[i]];
  }
  if (parent == null || typeof parent !== 'object') {
    return { ok: false, error: `路径不存在 (父级不是对象): ${op.path}` };
  }

  const key = parts[parts.length - 1];
  const oldValue = parent[key];

  switch (op.op) {
    case 'replace': {
      if (!(key in parent)) {
        return { ok: false, error: `replace 失败: 路径不存在 ${op.path}` };
      }
      if (op.value === undefined) {
        return { ok: false, error: `replace 失败: value 不能为 undefined (路径 ${op.path})` };
      }
      const oldType = typeof oldValue;
      const newType = typeof op.value;
      if (oldType !== newType) {
        return {
          ok: false,
          error: `replace 失败: ${op.path} 原类型为 ${oldType}(${JSON.stringify(oldValue)}), 新类型为 ${newType}(${JSON.stringify(op.value)})`,
        };
      }
      return { ok: true };
    }

    case 'insert': {
      // insert: 父级必须存在 (parent 已验证), 值类型不限制
      if (op.value === undefined) {
        return { ok: false, error: `insert 失败: value 不能为 undefined (路径 ${op.path})` };
      }
      return { ok: true };
    }

    case 'remove': {
      if (!(key in parent)) {
        return { ok: false, error: `remove 失败: 路径不存在 ${op.path}` };
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `未知操作: ${(op as any).op}` };
  }
}
