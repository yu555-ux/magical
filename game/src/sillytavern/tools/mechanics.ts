/**
 * 机制工具 — roll_dice, save_point
 */
import type { SavePoint } from '../types';
import type { AgentToolDef } from './registry';

export const mechanicTools: Record<string, AgentToolDef> = {

  save_point: {
    name: 'save_point',
    label: '记录剧情节点',
    category: 'mechanics',
    description:
      '在剧情历史中记录一个重要的剧情节点（存档点）。用于标记关键事件、章节完成、重大转折。\n\n' +
      '【必须调用的场景】\n' +
      '- 完成一个重要事件或章节时\n' +
      '- 揭示关键信息时\n' +
      '- 玩家做出重大决策时\n' +
      '- NPC 关键对话或转折时\n\n' +
      '【严禁的行为】\n' +
      '- 每轮对话都记录——只在真正重要的节点使用\n' +
      '- 记录与当前剧情无关的推测信息',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '剧情节点标题（简短）' },
        world: { type: 'string', enum: ['现实', '梦境'], description: '发生在现实还是梦境' },
        date: { type: 'string', description: '游戏内日期' },
        location: { type: 'string', description: '发生地点' },
        characters: { type: 'string', description: '相关人物（逗号分隔）' },
        description: { type: 'string', description: '事件简述（2-3 句话）' },
        keyInfo: { type: 'array', items: { type: 'string' }, description: '关键信息列表' },
        foreshadowing: { type: 'array', items: { type: 'string' }, description: '伏笔列表（可选）' },
      },
      required: ['title', 'world', 'date', 'location', 'characters', 'description'],
    },
    async execute(ctx, params) {
      const sp: SavePoint = {
        sequence: 0,
        title: params.title ?? '',
        world: params.world ?? '现实',
        date: params.date ?? '',
        location: params.location ?? '',
        characters: params.characters ?? '',
        description: params.description ?? '',
        keyInfo: Array.isArray(params.keyInfo) ? params.keyInfo : [],
        foreshadowing: Array.isArray(params.foreshadowing) ? params.foreshadowing : [],
      };
      ctx.appendHistory(sp);
      return {
        content: [{ type: 'text', text: `已记录剧情节点：「${sp.title}」(${sp.world}/${sp.location})` }],
        details: { savePoint: sp },
      };
    },
  },

  roll_dice: {
    name: 'roll_dice',
    label: '掷骰子',
    category: 'mechanics',
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

};
