/**
 * 流水线工具 — draft_maintext
 */
import type { AgentToolDef } from './registry';

export const draftTools: Record<string, AgentToolDef> = {

  draft_maintext: {
    name: 'draft_maintext',
    label: '撰写初稿',
    category: 'gameplay',
    description:
      '基于大纲和骰子结果撰写正文初稿。必须在阶段 3（正文初稿）中使用。这是初稿——后续还有审查和修改环节。\n\n' +
      '【必须调用的场景】\n' +
      '- pipeline_phase 返回阶段 3 时\n' +
      '- 在 plan_reply 和必要的 roll_dice 之后\n\n' +
      '【严禁的行为】\n' +
      '- 跳过此工具直接 submit_reply\n' +
      '- 在此阶段追求完美——字数和去八股留给阶段 4',
    parameters: {
      type: 'object',
      properties: {
        maintext: { type: 'string', description: '正文初稿' },
      },
      required: ['maintext'],
    },
    async execute(_ctx, params) {
      const text = (params?.maintext as string) ?? '';
      return {
        content: [{ type: 'text', text: `📝 初稿已记录 (约${text.length}字)。请结束本回合，下一回合进入阶段 4 审查修改。` }],
        details: { maintext: text },
      };
    },
  },

};
