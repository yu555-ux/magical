/**
 * 机制工具 — roll_dice, save_point
 */
import type { SavePoint } from '../types';
import type { AgentToolDef } from './registry';
import { SCENE_VARIABLE_TOOLS, type SceneType } from './scene-profiles';

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

  switch_scene: {
    name: 'switch_scene',
    label: '切换场景',
    category: 'mechanics',
    description:
      '根据当前情节发展切换场景类型，引擎会自动过滤变量工具列表。\n' +
      '【可选场景】\n' +
      '- combat: 战斗 — 资源/状态/技能/物品\n' +
      '- exploration: 探索 — 地点/地图/NPC跟踪/物品/状态\n' +
      '- social: 社交 — 社交关系/NPC跟踪/着装/资源\n' +
      '- intimate: 亲密 — 身体开发/着装/社交/资源/状态\n' +
      '- dream: 梦境 — 梦境切换/地点/地图/状态/资源\n\n' +
      '【使用时机】\n' +
      '- 场景发生明显变化时调用（如从日常进入战斗）\n' +
      '- 不确定当前场景时可以调用此工具确认\n' +
      '- 不调用时默认使用上一次设置的场景',
    parameters: {
      type: 'object',
      properties: {
        scene: { type: 'string', enum: ['combat', 'exploration', 'social', 'intimate', 'dream'], description: '新场景类型' },
        reason: { type: 'string', description: '为什么切换场景' },
      },
      required: ['scene', 'reason'],
    },
    async execute(ctx, params) {
      const scene = params?.scene as SceneType;
      const reason = params?.reason as string;
      if (!scene || !SCENE_VARIABLE_TOOLS[scene]) {
        return { content: [{ type: 'text', text: `参数错误：scene 必须是 combat/exploration/social/intimate/dream 之一` }] };
      }
      if (!reason || !reason.trim()) {
        return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
      }
      if (ctx.setCurrentScene) ctx.setCurrentScene(scene);
      const toolNames = SCENE_VARIABLE_TOOLS[scene];
      return {
        content: [{ type: 'text', text: `🎬 场景切换至: ${scene}\n  可用变量工具: ${toolNames.join(', ')}\n  原因：${reason}` }],
        details: { scene, reason },
      };
    },
  },

  // ══════════════════════════════════════════════
  // submit_reply — 提交最终回复
  // ══════════════════════════════════════════════

  submit_reply: {
    name: 'submit_reply',
    label: '提交回复',
    category: 'mechanics',
    description:
      '提交本轮最终回复。所有工具调用完成后、准备输出叙事时使用。\n' +
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
