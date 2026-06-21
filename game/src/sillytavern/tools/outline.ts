/**
 * 流水线工具 — plan_reply
 */
import type { AgentToolDef } from './registry';

export const outlineTools: Record<string, AgentToolDef> = {

  plan_reply: {
    name: 'plan_reply',
    label: '规划大纲',
    category: 'gameplay',
    description:
      '在机械结算完成后，规划本轮叙事大纲。必须在阶段 2（大纲规划）中使用。\n\n' +
      '【必须调用的场景】\n' +
      '- pipeline_phase 返回阶段 2 时\n' +
      '- 所有状态变化已落地之后，draft_maintext 之前\n\n' +
      '【严禁的行为】\n' +
      '- 在状态未落地前写大纲\n' +
      '- 在大纲中写完整叙事（大纲只需骨架）',
    parameters: {
      type: 'object',
      properties: {
        variableChanges: {
          type: 'array', items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '变量路径' },
              from: { description: '变化前的值' },
              to: { description: '变化后的值' },
              reason: { type: 'string' },
            },
            required: ['path', 'to', 'reason'],
          },
          description: '本轮已落地的变量变化清单',
        },
        narrativeBeats: {
          type: 'array', items: {
            type: 'object',
            properties: {
              beat: { type: 'string', description: '叙事节拍（一句话）' },
            },
            required: ['beat'],
          },
          description: '叙事节拍序列（3-7 个 beat）',
        },
        endingPosition: { type: 'string', description: '结尾停在什么可行动的瞬间' },
      },
      required: ['variableChanges', 'narrativeBeats', 'endingPosition'],
    },
    async execute(_ctx, params) {
      const beats = (params?.narrativeBeats as any[]) ?? [];
      const lines: string[] = [
        '📋 大纲已记录。',
        '',
        `变量变化: ${((params?.variableChanges as any[]) ?? []).length} 项`,
        `叙事节拍: ${beats.length} 个`,
      ];
      beats.forEach((b, i) => {
        lines.push(`  ${i + 1}. ${b.beat}`);
      });
      lines.push(`结尾位置: ${params?.endingPosition}`);
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: params,
      };
    },
  },

};
