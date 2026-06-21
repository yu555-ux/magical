/**
 * 机制工具 — roll_dice, submit_reply
 */
import type { AgentToolDef } from './registry';

export const mechanicTools: Record<string, AgentToolDef> = {

  roll_dice: {
    name: 'roll_dice',
    label: '掷骰子',
    category: 'gameplay',
    description:
      '执行掷骰检定。支持 d20/d100 等标准骰子，以及带难度等级(DC)的技能检定。\n\n' +
      '【必须调用的场景】\n' +
      '- 任何需要随机判定的场景（战斗命中、技能检定、幸运判定等）\n' +
      '- 不确定的结果需要通过骰子决定时\n\n' +
      '【严禁的行为】\n' +
      '- 不掷骰就自行判定结果\n' +
      '- 在叙事中编造具体骰子数值\n\n' +
      '【你的职责】\n' +
      '你不是骰子结果的创造者，你是骰子结果的翻译者。此工具返回机械数值，你将数值转为生动的叙事描写。',
    parameters: {
      type: 'object',
      properties: {
        sides: { type: 'number', description: '骰子面数，默认 100', default: 100 },
        count: { type: 'number', description: '掷几个，默认 1', default: 1 },
        dc: { type: 'number', description: '可选：难度等级(DC)，用于判定成功/失败' },
        modifier: { type: 'number', description: '可选：加值（如 +5）', default: 0 },
        label: { type: 'string', description: '检定名称（如"战斗命中""潜行"）' },
      },
      required: [],
    },
    async execute(_ctx, params) {
      const sides = params?.sides ?? 100;
      const count = params?.count ?? 1;
      const dc = params?.dc as number | undefined;
      const modifier = params?.modifier ?? 0;
      const label = params?.label ? `[${params.label}] ` : '';

      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }
      const total = rolls.reduce((a, b) => a + b, 0) + modifier;

      let text = `${label}🎲 d${sides}`;
      if (count > 1) text += ` ×${count}`;
      if (modifier !== 0) text += ` ${modifier > 0 ? '+' : ''}${modifier}`;
      text += ` = ${rolls.join(' + ')}`;
      if (modifier !== 0) text += ` ${modifier > 0 ? '+' : ''}${modifier}`;
      text += ` = **${total}**`;

      if (dc !== undefined) {
        if (total >= dc) {
          text += ` ✅ 成功（DC ${dc}）`;
        } else {
          text += ` ❌ 失败（DC ${dc}）`;
        }
      }

      return { content: [{ type: 'text', text }], details: { rolls, total, dc, modifier } };
    },
  },

  // ══════════════════════════════════════════════
  // submit_reply — 提交最终回复
  // ══════════════════════════════════════════════

  submit_reply: {
    name: 'submit_reply',
    label: '提交回复',
    category: 'gameplay',
    description:
      '提交本轮最终回复。这是你向玩家输出叙事的**唯一方式**——只有通过此工具提交，你的回复才会被玩家看到。\n\n' +
      '【必须调用的场景】\n' +
      '- 所有工具调用完成后，准备输出叙事时\n' +
      '- 你确定本轮不需要再查询或修改状态时\n' +
      '- 不确定还需要什么时——直接调用此工具提交当前回复，不要犹豫\n\n' +
      '【严禁的行为】\n' +
      '- 在调用 submit_reply 之前直接输出任何文本——会被系统忽略，玩家什么也看不到\n' +
      '- 在 maintext 中输出推理、字段名、JSON、schema 路径、骰点或 GM 元评论\n' +
      '- 替玩家做决定——叙事必须停在玩家可回应处\n' +
      '- 跳过此工具直接发言——等于什么都没提交\n\n' +
      '【你的职责】\n' +
      '你不是在聊天框中回复，你是在通过工具提交一篇完整的叙事作品。\n' +
      'maintext 是你唯一的叙事输出渠道，所有思考、状态查询、数值计算都不应出现在其中。\n\n' +
      '【格式要求】\n' +
      '- maintext: 正文 1000-1500 字，第二人称沉浸式中文叙事，禁止 GM 解说/推理/JSON/骰点\n' +
      '- options: 4 个选项，格式 "(动作/交流/观察/色色) 内容"\n' +
      '- history.title: 2-5 字，模仿网文章节标题风格\n' +
      '- history.characters: 所有在场角色，分号分隔\n' +
      '- history.description: 约 100 字客观叙述，禁止升华/比喻/主观揣测，只记事实\n' +
      '- history.keyInfo: 一行一条，只记录有重要意义的关键细节\n' +
      '- history.foreshadowing: 一行一条，可继承上轮伏笔\n' +
      '- thinking: 思考过程，不会显示给玩家',
    parameters: {
      type: 'object',
      properties: {
        maintext: { type: 'string', description: '正文 1000-1500 字' },
        options: { type: 'array', items: { type: 'string' }, description: '4 个选项' },
        history: { type: 'object', properties: {
          title: { type: 'string', description: '2-5 字标题' },
          characters: { type: 'string', description: '所有在场角色，分号分隔' },
          description: { type: 'string', description: '约 100 字客观叙述' },
          keyInfo: { type: 'array', items: { type: 'string' }, description: '关键信息列表' },
          foreshadowing: { type: 'array', items: { type: 'string' }, description: '伏笔列表' },
        }, required: ['title', 'characters', 'description'] },
        thinking: { type: 'string', description: '思考过程（不显示给玩家）' },
      },
      required: ['maintext', 'options'],
    },
    async execute(_ctx, params) {
      const maintext = (params?.maintext as string)?.trim() ?? '';
      const options = (params?.options as string[]) ?? [];
      const history = params?.history as Record<string, any> | undefined;
      const thinking = (params?.thinking as string)?.trim();

      const lines: string[] = [];
      if (thinking) lines.push(`<thinking>\n${thinking}\n</thinking>`);
      lines.push(`<maintext>\n${maintext}\n</maintext>`);
      if (options.length > 0) {
        lines.push('<option>');
        for (let i = 0; i < options.length; i++) {
          const opt = options[i].trim();
          const label = opt.match(/^（[^）]+）/) ? opt : `选项${i + 1}: ${opt}`;
          lines.push(label);
        }
        lines.push('</option>');
      }
      if (history) {
        const h = history;
        lines.push('<history>');
        lines.push(`标题: ${h.title ?? ''}`);
        lines.push(`相关人物: ${h.characters ?? ''}`);
        lines.push(`描述: ${h.description ?? ''}`);
        if (Array.isArray(h.keyInfo)) lines.push('关键信息:', ...h.keyInfo.map((s: string) => `- ${s}`));
        if (Array.isArray(h.foreshadowing)) lines.push('伏笔:', ...h.foreshadowing.map((s: string) => `- ${s}`));
        lines.push('</history>');
      }
      const text = lines.join('\n');
      return { content: [{ type: 'text', text }], details: { maintext, options, history, thinking } };
    },
  },

};
