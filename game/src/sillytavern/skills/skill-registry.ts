/**
 * Skill 注册表 — Vite ?raw 导入所有 skill .md 文件
 *
 * 与 agent-prompt/module-content.ts 完全相同的模式。
 * 新增 skill：在此文件 import + 注册到 SKILL_CONTENT 和 SKILL_META。
 */

import proseOptimizationRaw from './prose-optimization.md?raw';

export const SKILL_CONTENT: Record<string, string> = {
  'skills/prose-optimization.md': proseOptimizationRaw,
};

/** Skill 元数据 — 用于设置页面展示 */
export interface SkillMeta {
  /** preset.json 中的模块 id */
  id: string;
  /** 显示名称 */
  name: string;
  /** 简要说明 */
  description: string;
  /** 来源文件路径 */
  source: string;
}

export const SKILL_META: SkillMeta[] = [
  {
    id: 'skill-prose-optimization',
    name: '正文优化流水线',
    description: '6 阶段渐进式正文生成：机械查询 → 变量修改 → 大纲规划 → 正文初稿 → 审查修改 → 提交。确保字数达标、无八股句式、格式规范。',
    source: 'skills/prose-optimization.md',
  },
];
