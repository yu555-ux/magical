/**
 * 机制工具 — pipeline_phase, roll_dice, submit_reply
 */
import type { AgentToolDef } from './registry';

// ── Phase tracker ──

let currentPhase = 0;

const PHASE_INSTRUCTIONS: Record<number, string> = {
  0: `[阶段 0/5：机械查询]

本回合你只能调用查询工具。禁止调用任何变量修改工具。

1. get_status — 获取当前状态快照
2. lookup_character — 查在场 NPC 的完整属性
3. lookup_location — 查当前地点的描述和异常
4. lookup_world — 如有需要，查世界书

完成后调用 submit_reply，以一句简短总结结束本回合。
然后下一回合调 pipeline_phase(phase=1)。`,

  1: `[阶段 1/5：变量修改]

本回合你只能修改变量和掷骰子。禁止写大纲或正文。

1. roll_dice — 执行所有需要的骰子检定（可多次调用）
2. update_resource / advance_time / change_location 等 — 将变化写入状态树
3. 确保所有机械变化已落地

完成后调用 submit_reply，列出本回合所做的变更。
然后下一回合调 pipeline_phase(phase=2)。`,

  2: `[阶段 2/5：大纲规划]

本回合你只能调用 plan_reply 写叙事大纲。禁止写正文。

基于已落地的状态，调用 plan_reply：
- variableChanges: 本轮已写入的变量变化清单
- narrativeBeats: 叙事节拍序列（3-7 个 beat）
- endingPosition: 结尾停在什么可行动的瞬间

完成后调用 submit_reply，大纲会自动记录。
然后下一回合调 pipeline_phase(phase=3)。`,

  3: `[阶段 3/5：正文初稿]

本回合你只能调用 draft_maintext 写正文初稿。

按大纲的节拍顺序撰写正文：
- 中文第二人称沉浸式叙事
- 不复制设定表或 GM 简报
- 停在明确可行动的瞬间
- 这是初稿，不需要追求完美——字数在 800-1600 字都接受

完成后调用 submit_reply，初稿会自动记录。
然后下一回合调 pipeline_phase(phase=4)。`,

  4: `[阶段 4/5：审查修改]

本回合你只能调用 review_draft 和 revise_draft。

1. 调 review_draft 审查初稿
2. 根据返回的问题逐项修改——调 revise_draft
3. 修改后再次 review_draft 确认
4. 重复直到所有 mandatory gate 通过：
   - 字数 1000-1500（不计标签和空白）
   - 无八股句式
   - maintext 不含 GM 解说/推理/JSON/骰点/字段名
   - options 恰好 4 条

完成后调用 submit_reply，确认审查通过。
然后下一回合调 pipeline_phase(phase=5)。`,

  5: `[阶段 5/5：提交回复]

本回合调用 submit_reply 提交最终回复。

maintext 填入审查通过的最终正文，options 填入 4 个选项，history 填入标题/人物/描述。
提交后，本次优化流水线结束。`,
};

// ── Tools ──

export const mechanicTools: Record<string, AgentToolDef> = {

  pipeline_phase: {
    name: 'pipeline_phase',
    label: '流水线阶段',
    category: 'gameplay',
    description:
      '查看或推进正文优化流水线的当前阶段。每回合开始时必须先调本工具确认当前阶段和允许使用的工具。\n\n' +
      '阶段 0：机械查询 — 只调查询工具\n' +
      '阶段 1：变量修改 — 修改变量 + 掷骰\n' +
      '阶段 2：大纲规划 — 调 plan_reply\n' +
      '阶段 3：正文初稿 — 调 draft_maintext\n' +
      '阶段 4：审查修改 — 调 review_draft/revise_draft\n' +
      '阶段 5：提交回复 — 调 submit_reply\n\n' +
      '【必须调用的场景】\n' +
      '- 每回合开始时，必须先调本工具确认当前阶段\n' +
      '- 完成当前阶段后，调 pipeline_phase(phase=N+1) 推进到下一阶段\n\n' +
      '【严禁的行为】\n' +
      '- 跳过阶段——必须按 0→1→2→3→4→5 顺序推进\n' +
      '- 在当前阶段调用其他阶段的专属工具',
    parameters: {
      type: 'object',
      properties: {
        phase: { type: 'number', description: '切换到的阶段号（0-5）。不填则返回当前阶段。' },
      },
      required: [],
    },
    async execute(_ctx, params) {
      if (typeof params?.phase === 'number') {
        currentPhase = Math.max(0, Math.min(5, params.phase));
      }
      const instruction = PHASE_INSTRUCTIONS[currentPhase] ?? '未知阶段';
      return { content: [{ type: 'text', text: instruction }] };
    },
  },

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
      const isFinal = currentPhase === 5;

      // 阶段 5（最终提交）时强制字数验证
      if (isFinal) {
        const charCount = maintext.replace(/\s/g, '').length;
        if (charCount < 1000) {
          return { content: [{ type: 'text', text: `❌ 字数不足 (${charCount}/1000)。请先调用 revise_draft 扩写正文。` }] };
        }
        if (charCount > 1500) {
          return { content: [{ type: 'text', text: `❌ 字数超标 (${charCount}/1500)。请先调用 revise_draft 精简正文。` }] };
        }
      }

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
