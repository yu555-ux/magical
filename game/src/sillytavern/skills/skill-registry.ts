/**
 * Skill 注册表 — Vite ?raw 导入所有 skill .md 文件
 *
 * 与 agent-prompt/module-content.ts 完全相同的模式。
 * 新增 skill：在此文件 import + 注册到 SKILL_CONTENT。
 */

import proseOptimizationRaw from './prose-optimization.md?raw';

export const SKILL_CONTENT: Record<string, string> = {
  'skills/prose-optimization.md': proseOptimizationRaw,
};
