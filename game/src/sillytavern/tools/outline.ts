/**
 * 流水线工具 — outline_draft, plan_reply
 */
import type { AgentToolDef } from './registry';

export const outlineTools: Record<string, AgentToolDef> = {

  // ══════════════════════════════════════════════
  // outline_draft — 阶段 1：大纲草稿（机械查询之后，变量修改之前）
  // ══════════════════════════════════════════════

  outline_draft: {
    name: 'outline_draft',
    label: '大纲草稿',
    category: 'gameplay',
    description:
      '在机械查询完成后（已获得 <player_var> 和 <phase0_lookup>），分析玩家意图和聊天记录，规划本轮骰子和变量修改方向。必须在阶段 1（大纲草稿）中使用。\n\n' +
      '【调用前必须做的事】\n' +
      '1. 从上下文消息中找到玩家本轮输入（最后一条 role=user 的消息）\n' +
      '2. 回顾最近 2-3 轮聊天记录：玩家说了什么、GM 回复了什么、剧情推进到了哪里\n' +
      '3. 结合 <player_var> 中的当前状态，判断玩家的行动是否需要检定\n\n' +
      '【必须调用的场景】\n' +
      '- pipeline_phase 返回阶段 1 时\n\n' +
      '【严禁的行为】\n' +
      '- 不回顾聊天记录就填——playerIntent 必须来自玩家实际输入\n' +
      '- 在 diceRollsNeeded 中写不需要检定的日常动作（对话、走路、吃饭不需要骰子）\n' +
      '- 在 variablesToModify 中漏掉强制项（时间推进和 NPC 想法更新每次都必须有）',
    parameters: {
      type: 'object',
      properties: {
        playerIntent: { type: 'string', description: '玩家本轮想做什么。从玩家输入中提取，一句话概括。' },
        recentContext: { type: 'string', description: '最近 2-3 轮发生了什么。从聊天记录中总结，2-3 句。' },
        plotDirection: { type: 'string', description: '本轮剧情大方向。基于玩家意图 + 当前状态 + 剧情惯性，用 1-2 句话说明本轮叙事走向。' },
        diceRollsNeeded: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: '检定名称（如"长剑攻击地精"）' },
              sides: { type: 'number', description: '骰子面数，默认 20' },
              dc: { type: 'number', description: '难度等级' },
              modifier: { type: 'number', description: '加值' },
              reason: { type: 'string', description: '为什么需要掷这个骰子' },
            },
            required: ['label', 'sides', 'reason'],
          },
          description: '需要掷骰的检定列表。如果玩家的行动不需要任何检定，填空数组 [] 并说明原因。日常对话、走路、吃饭、观察等不需要骰子。',
        },
        variablesToModify: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '变量路径（如 主角/身体属性/生命/当前）' },
              action: { type: 'string', description: '操作类型：replace / advance_time / update_npc_info / add_condition 等' },
              reason: { type: 'string', description: '为什么需要修改这个变量' },
            },
            required: ['path', 'action', 'reason'],
          },
          description: '计划修改的变量列表。至少包含时间推进（advance_time）和 NPC 想法更新（update_npc_info），这两项是强制项。',
        },
      },
      required: ['playerIntent', 'recentContext', 'plotDirection', 'diceRollsNeeded', 'variablesToModify'],
    },
    async execute(_ctx, params) {
      const diceRolls = (params?.diceRollsNeeded as any[]) ?? [];
      const varMods = (params?.variablesToModify as any[]) ?? [];
      const hasTime = varMods.some((v: any) => v.action === 'advance_time');
      const hasNpc = varMods.some((v: any) => v.action === 'update_npc_info');

      const lines: string[] = [
        '📋 大纲草稿已记录。',
        '',
        `玩家意图: ${params?.playerIntent ?? '—'}`,
        '',
        `最近剧情: ${params?.recentContext ?? '—'}`,
        '',
        `剧情方向: ${params?.plotDirection ?? '—'}`,
        '',
        `🎲 需要检定: ${diceRolls.length} 项`,
      ];
      for (const d of diceRolls) {
        lines.push(`  ${d.label} (d${d.sides}${d.dc ? ', DC=' + d.dc : ''}${d.modifier ? ', +' + d.modifier : ''}): ${d.reason}`);
      }
      if (diceRolls.length === 0) lines.push('  本次无需检定。');

      lines.push('');
      lines.push(`📊 计划修改变量: ${varMods.length} 项`);
      for (const v of varMods) {
        lines.push(`  ${v.path}: ${v.action} — ${v.reason}`);
      }

      if (!hasTime) {
        lines.push('');
        lines.push('⚠️ 警告：variablesToModify 缺少时间推进（advance_time）。这是强制项，请在阶段 2 中补充。');
      }
      if (!hasNpc) {
        lines.push('');
        lines.push('⚠️ 警告：variablesToModify 缺少 NPC 想法更新（update_npc_info）。如果本场景涉及 NPC，这是强制项。');
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: params,
      };
    },
  },

  // ══════════════════════════════════════════════
  // plan_reply — 阶段 3：叙事大纲（变量修改之后）
  // ══════════════════════════════════════════════

  plan_reply: {
    name: 'plan_reply',
    label: '规划大纲',
    category: 'gameplay',
    description:
      '在变量修改完成后，基于已落地的状态规划本轮叙事大纲。必须在阶段 3（大纲规划）中使用。\n\n' +
      '【必须调用的场景】\n' +
      '- pipeline_phase 返回阶段 3 时\n' +
      '- 所有变量已写入 + 骰子已掷后，draft_maintext 之前\n\n' +
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
