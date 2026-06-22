/**
 * 机制工具 — pipeline_phase, end_phase, roll_dice, finish_reply
 */
import type { AgentToolDef } from './registry';

// ── Phase tracker ──

let currentPhase = 0;

/** 重置流水线阶段到 0。每次玩家发起新消息时必须调用。 */
export function resetPipelinePhase() { currentPhase = 0; }

const PHASE_INSTRUCTIONS: Record<number, string> = {
  0: `[阶段 0/6：机械查询]

主角完整状态已通过 <player_var> 自动注入提示词（含时间/地点/天气/属性/技能/物品/社交/在场NPC摘要）。
本阶段只需补充查询 NPC 详情和地点详情，一个回合内批量完成：

1. lookup_character(name=在场NPC) — 逐人查询，可并发调用。获取完整属性和技能值
2. lookup_location(name=当前地点) — 获取地点描述、异常、子地点
3. lookup_world(keyword) — 仅在需要查世界书补充设定时调用

⚠️ 所有查询应在一个回合内并发完成。禁止分多轮逐条查询。
全部查询完成后，调 end_phase 收口，然后调 pipeline_phase(phase=1) 进入下一阶段。`,

  1: `[阶段 1/6：大纲草稿]

⚠️ 在调用 outline_draft 之前，必须先从上下文消息中完成以下回顾：

1. 找到玩家本轮输入（最后一条 role=user 的消息），提取玩家想做什么
2. 回顾最近 2-3 轮聊天记录：玩家说了什么、GM 回复了什么、剧情推进到了哪里
3. 结合 <player_var> 的当前状态和 <phase0_lookup> 的角色/地点详情

然后调用 outline_draft 工具，认真填写以下字段：
- playerIntent: 玩家本轮想做什么（必须来自玩家实际输入）
- recentContext: 最近 2-3 轮发生了什么（从聊天记录中总结）
- plotDirection: 本轮剧情大方向（基于意图 + 状态 + 剧情惯性）
- diceRollsNeeded: 需要掷骰的检定。日常对话/走路/吃饭不需要骰子。战斗/技能判定/危险场景需要
- variablesToModify: 计划修改的变量。至少包含时间推进和 NPC 想法更新

完成后调 end_phase 收口，然后调 pipeline_phase(phase=2) 进入下一阶段。`,

  2: `[阶段 2/6：变量修改]

本阶段只能修改变量和掷骰子。禁止写大纲或正文。

请先回顾 <phase1_outline> 中 outline_draft 的计划，然后执行：

【强制 1：时间推进】
每次剧情都必须推进时间。对话、思考、移动、观察——全都消耗时间。
- 短对话 → advance_time(minutes=1~3)
- 普通交互 → advance_time(minutes=3~10)
- 战斗/探索 → advance_time(minutes=10~30)
禁止声称"没有时间流逝"。禁止跳过。

【强制 2：NPC 想法更新】
如果本场景涉及任何 NPC（在场 / 被提及 / 被互动），必须调 update_npc_info 更新该 NPC 的当前想法。
- 玩家与 NPC 对话 → 更新该 NPC 的想法
- 玩家观察 NPC → 更新该 NPC 的想法
- NPC 对事件做出反应 → 更新该 NPC 的想法
每个涉及的 NPC 都要更新。禁止声称"想法没变"——任何互动都会改变想法。

【强制 3：执行骰子检定】
回顾 <phase1_outline> 中 diceRollsNeeded 列出的检定，逐个调用 roll_dice。

【强制 4：修改变量】
回顾 <phase1_outline> 中 variablesToModify 列出的变量，逐个更新。

全部更新完成后，调 end_phase 收口，然后调 pipeline_phase(phase=3) 进入下一阶段。`,

  3: `[阶段 3/6：叙事大纲]

本阶段调用 plan_reply 写叙事大纲。禁止写正文。

基于已落地的状态，调用 plan_reply：
- variableChanges: 本轮已写入的变量变化清单
- narrativeBeats: 叙事节拍序列（3-7 个 beat）
- endingPosition: 结尾停在什么可行动的瞬间

完成后调 end_phase 收口，然后调 pipeline_phase(phase=4) 进入下一阶段。`,

  4: `[阶段 4/6：正文初稿]

本阶段调用 draft_maintext 写正文初稿。

按大纲的节拍顺序撰写正文：
- 中文第二人称沉浸式叙事
- 不复制设定表或 GM 简报
- 停在明确可行动的瞬间
- 这是初稿，不需要追求完美

完成后调 end_phase 收口，然后调 pipeline_phase(phase=5) 进入下一阶段。`,

  5: `[阶段 5/6：审查修改]

本阶段只能调用 review_draft 和 revise_draft，可跨多轮反复修改。

1. 调 review_draft 审查初稿
2. 根据返回的问题逐项修改——调 revise_draft
3. 修改后再次 review_draft 确认
4. 重复直到所有门禁通过：
   - 字数 1000-1500（不计标签和空白）
   - 无八股句式
   - maintext 不含 GM 解说/推理/JSON/骰点/字段名
   - options 恰好 4 条

全部门禁通过后，调 end_phase 收口，然后调 pipeline_phase(phase=6) 进入最终阶段。`,

  6: `[阶段 6/6：提交回复]

本阶段调用 finish_reply 提交最终回复。

maintext 填入审查通过的最终正文，options 填入 4 个选项，history 填入标题/人物/描述。

⚠️ 如果 finish_reply 返回错误（如字数不足），不要放弃——调 pipeline_phase(phase=5) 回到阶段 5 修改正文，修改通过后再回到阶段 6 重新提交。

调用成功（无 ❌ 错误）后，本次流水线结束，玩家将收到最终回复。`,
};

// ── Tools ──

export const mechanicTools: Record<string, AgentToolDef> = {

  pipeline_phase: {
    name: 'pipeline_phase',
    label: '流水线阶段',
    category: 'gameplay',
    description:
      '查看或推进正文优化流水线的当前阶段。每回合开始时必须先调本工具确认当前阶段和允许使用的工具。\n\n' +
      '阶段 0：机械查询 — 只调查询工具（lookup_character/lookup_location/lookup_world）\n' +
      '阶段 1：大纲草稿 — 调 outline_draft（回顾聊天记录 + 分析玩家意图 + 规划骰子/变量）\n' +
      '阶段 2：变量修改 — 修改变量 + 掷骰（advance_time/update_resource/roll_dice 等）\n' +
      '阶段 3：叙事大纲 — 调 plan_reply\n' +
      '阶段 4：正文初稿 — 调 draft_maintext\n' +
      '阶段 5：审查修改 — 调 review_draft/revise_draft\n' +
      '阶段 6：提交回复 — 调 finish_reply\n\n' +
      '【必须调用的场景】\n' +
      '- 每回合开始时，必须先调本工具确认当前阶段\n' +
      '- 完成当前阶段后，调 pipeline_phase(phase=N+1) 推进到下一阶段\n\n' +
      '【严禁的行为】\n' +
      '- 跳过阶段——必须按 0→1→2→3→4→5→6 顺序推进\n' +
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
        currentPhase = Math.max(0, Math.min(6, params.phase));
      }
      const instruction = PHASE_INSTRUCTIONS[currentPhase] ?? '未知阶段';
      return { content: [{ type: 'text', text: instruction }] };
    },
  },

  end_phase: {
    name: 'end_phase',
    label: '结束阶段',
    category: 'gameplay',
    description:
      '标记当前流水线阶段完成，进行阶段收口。不退出 agent loop——仅表示本阶段工作已做完，可以进入下一阶段。\n\n' +
      '【必须调用的场景】\n' +
      '- 当前阶段的所有工作已完成，准备进入下一阶段时\n\n' +
      '【严禁的行为】\n' +
      '- 工作未完成就调本工具——必须确认当前阶段的目标已达成',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '本阶段完成的总结（一句话）' },
      },
      required: ['summary'],
    },
    async execute(_ctx, params) {
      const summary = (params?.summary as string) ?? '';
      return {
        content: [{ type: 'text', text: `✅ 阶段 ${currentPhase}/5 收口完成：${summary}\n请调 pipeline_phase(phase=${currentPhase + 1}) 进入下一阶段。` }],
      };
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
  // finish_reply — 提交最终回复
  // ══════════════════════════════════════════════

  finish_reply: {
    name: 'finish_reply',
    label: '提交回复',
    category: 'gameplay',
    description:
      '提交最终回复，退出 agent loop。仅在流水线阶段 6（提交回复）中使用。调用本工具后玩家将收到最终叙事。\n\n' +
      '【必须调用的场景】\n' +
      '- pipeline_phase 返回阶段 6 时\n' +
      '- 所有质量门禁已通过，正文准备就绪\n\n' +
      '【严禁的行为】\n' +
      '- 在阶段 0-5 调用本工具——阶段收口请用 end_phase\n' +
      '- 在 maintext 中输出推理、字段名、JSON、schema 路径、骰点或 GM 元评论\n' +
      '- 替玩家做决定——叙事必须停在玩家可回应处\n\n' +
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
      const isFinal = currentPhase === 6;

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
