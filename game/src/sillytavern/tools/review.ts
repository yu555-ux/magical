/**
 * 流水线工具 — review_draft, revise_draft
 */
import type { AgentToolDef } from './registry';

export const reviewTools: Record<string, AgentToolDef> = {

  review_draft: {
    name: 'review_draft',
    label: '审查初稿',
    category: 'gameplay',
    description:
      '审查初稿，检测字数、八股句式、格式问题。返回问题清单供 revise_draft 修改。必须在阶段 4（审查修改）中使用。\n\n' +
      '【必须调用的场景】\n' +
      '- pipeline_phase 返回阶段 4 时\n' +
      '- draft_maintext 之后\n' +
      '- revise_draft 修改后需要再次验证时\n\n' +
      '【严禁的行为】\n' +
      '- 未通过审查就进入阶段 5\n' +
      '- 看到问题后忽略——必须修复',
    parameters: {
      type: 'object',
      properties: {
        issues: {
          type: 'array', items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['word_count', 'cliche', 'format', 'other'] },
              severity: { type: 'string', enum: ['must_fix', 'should_fix', 'suggestion'] },
              description: { type: 'string' },
            },
            required: ['type', 'severity', 'description'],
          },
          description: '发现的问题列表',
        },
        wordCount: { type: 'number', description: '实际字数（不计空白）' },
        passed: { type: 'boolean', description: '是否所有 must_fix 问题都已修复' },
      },
      required: ['issues', 'wordCount', 'passed'],
    },
    async execute(_ctx, params) {
      const issues = (params?.issues as any[]) ?? [];
      const wordCount = params?.wordCount as number ?? 0;
      const passed = params?.passed as boolean;
      const lines: string[] = [
        passed ? '✅ 审查通过' : '❌ 审查未通过',
        `字数: ${wordCount}`,
        `问题: ${issues.length} 个`,
      ];
      for (const issue of issues) {
        const emoji = issue.severity === 'must_fix' ? '🔴' : issue.severity === 'should_fix' ? '🟡' : '🟢';
        lines.push(`  ${emoji} [${issue.type}] ${issue.description}`);
      }
      if (passed) {
        lines.push('', '所有门禁已通过。请结束本回合，下一回合进入阶段 5 提交回复。');
      }
      return { content: [{ type: 'text', text: lines.join('\n') }], details: { issues, wordCount, passed } };
    },
  },

  revise_draft: {
    name: 'revise_draft',
    label: '修改初稿',
    category: 'gameplay',
    description:
      '根据 review_draft 发现的问题，逐项修改正文。修改后应再次调用 review_draft 验证。必须在阶段 4（审查修改）中使用。\n\n' +
      '【必须调用的场景】\n' +
      '- review_draft 返回 passed=false 时\n\n' +
      '【严禁的行为】\n' +
      '- 修改后不重新 review\n' +
      '- 修复一个问题的同时引入新问题',
    parameters: {
      type: 'object',
      properties: {
        revisedMaintext: { type: 'string', description: '修改后的正文' },
        fixes: {
          type: 'array', items: {
            type: 'object',
            properties: {
              issueType: { type: 'string' },
              fix: { type: 'string', description: '修改说明' },
            },
            required: ['issueType', 'fix'],
          },
          description: '每项修改的说明',
        },
      },
      required: ['revisedMaintext', 'fixes'],
    },
    async execute(_ctx, params) {
      const fixes = (params?.fixes as any[]) ?? [];
      return {
        content: [{ type: 'text', text: `🔧 已修改 ${fixes.length} 项问题。请再次 review_draft 验证。` }],
        details: params,
      };
    },
  },

};
