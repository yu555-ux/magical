/**
 * Agent 分层上下文构建器
 *
 * 参考 tavern2agent deepseek-v4.md「三刀流」+ pi-integration.md「提示词分层编排」。
 *
 * 消息顺序（按离生成距离从远到近）：
 *   [0] system   — 极简身份 + 运行契约
 *   [1..N-3]     — 聊天历史（不含本轮用户输入）
 *   [N-2] user   — 参考信息（当前时间地点 + 工具速查 + 玩家/AI身份）
 *   [N-1] user   — 玩家本轮输入（独立一条，不混在历史里）
 *   [N]   user   — 铁则/叙事纪律（离生成最近，最高注意力）
 *
 * DS V4 特化：参考信息和铁则用 user role 注入，因为 DS V4 对 user message 的服从度远超 system。
 * 地图和角色列表暂不注入（后期完善后再加回）。
 */

import type { ChatMessage, Lorebook, HistoryTimeline, DreamAnchor } from './types';
import { formatVariablesForPrompt } from './variables';
import { replaceMacros } from './prompt-assembler';
import type { AgentToolDef } from './tools/registry';
import { toOpenAITool } from './tools/registry';

// ── Types ──

export interface AgentContextConfig {
  userName: string;
  characterName: string;
  playerDescription?: string;
  characterDescription?: string;
  history: ChatMessage[];
  recentMessageCount: number;
  variables: Record<string, any>;
  lorebooks: Lorebook[];
  plotHistory?: HistoryTimeline;
  dreamAnchor?: DreamAnchor;
  tools: AgentToolDef[];
  /** 主系统提示词内容（player-facing identity + contract） */
  systemPromptContent?: string;
  /** 铁则内容 */
  rulesContent?: string;
}

export interface AgentContextResult {
  /** 发送给 LLM 的消息数组 */
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  /** System prompt */
  systemPrompt: string;
  /** 工具定义（OpenAI format） */
  tools: Record<string, unknown>[];
  /** 分层 stageMessages（调试用） */
  stageMessages: Record<string, Array<{ role: string; content: string }>>;
  stageOrder: string[];
}

// ── Defaults ──

const DEFAULT_SYSTEM_PROMPT = `你是一个互动叙事游戏的世界引擎（GM）。

你的输出由两层构成：
① 机械层 — 由工具调用确定。所有具体数据、设定、判定结果必须来自工具返回值。
② 叙事层 — 由你生成。将机械层结果转化为生动的文学描写。

机械层的任何内容未经工具调用确认前不存在。如果你在没有调用相应工具的情况下叙述了这些内容，你就是在污染游戏状态。
这比「叙事节奏稍慢」严重得多。

正确流程：识别本轮需要的机械信息 → 调用相关工具 → 基于返回值叙事。`;

const DEFAULT_RULES = `## GM 铁则

1. **数据必须来自工具**：HP、好感度、地点设定、价格等具体数值，必须在叙事前通过工具确认。
2. **掷骰决定不确定事件**：战斗命中、技能检定、随机事件等必须调 roll_dice，不能自行判定。
3. **状态变化必须写回**：任何数值/地点/关系的变化必须调 patch_state，不只是在叙事中提及。
4. **地点设定必须查询**：提及预设地点时必须调 lookup_location 获取权威设定，不能凭记忆。
5. **重要节点必须存档**：关键事件/章节完成/重大决策后调 save_point。
6. **叙事中不要出现裸数值**："好感度+10"→应为"她对你的态度明显亲近了"。"HP-15"→应为"你感到一阵剧痛"。
7. **选项控制在 3-5 个**：每轮结束给出合理的行动选项，覆盖不同倾向。

## 叙事风格

- 使用第二人称「你」叙事
- 描写注重五感（视觉/听觉/触觉/嗅觉/味觉）和环境氛围
- 对话自然、符合人物性格
- 每次回复控制在 200-500 字（不含选项）
- 末尾提供 3-5 个行动选项（以 - 开头的列表）`;

// ── Helpers ──

function buildHistoryMessages(
  history: ChatMessage[],
  recentMessageCount: number,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const limit = recentMessageCount || 0;
  const recent: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'system') continue;
    const text = msg.role === 'assistant' && msg.parsed?.maintext
      ? msg.parsed.maintext.trim()
      : msg.content;
    if (!text) continue;
    recent.unshift({ role: msg.role as 'user' | 'assistant', content: text });
    if (limit > 0 && recent.length >= limit) break;
  }
  return recent;
}

function buildToolIndex(tools: AgentToolDef[]): string {
  if (tools.length === 0) return '';
  const lines = ['## 可用工具速查'];
  for (const t of tools) {
    // 提取 description 的第一行（简要功能）
    const firstLine = t.description.split('\n')[0] || t.label;
    lines.push(`- **${t.name}**：${firstLine}`);
  }
  lines.push('', '调用工具不会打断叙事节奏——工具返回后你可以继续写。先确定需要什么信息，再一起调用相关工具。');
  return lines.join('\n');
}

// ── Main builder ──

export function buildAgentContext(config: AgentContextConfig): AgentContextResult {
  const {
    userName, characterName, playerDescription, characterDescription,
    history, recentMessageCount, variables, lorebooks, tools,
    systemPromptContent, rulesContent,
  } = config;

  const stageMessages: Record<string, Array<{ role: string; content: string }>> = {};
  const stageOrder: string[] = [];
  const finalMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // ── System 层：极简身份 + 契约 ──
  const systemPrompt = systemPromptContent || DEFAULT_SYSTEM_PROMPT;
  stageMessages['system'] = [{ role: 'system', content: systemPrompt }];
  stageOrder.push('system');

  // ── Chat History（不含最后一条用户消息）──
  // 把最后一条 user 消息剥离出来，放到 Reference 层后面作为独立输入
  let userInputMsg: { role: 'user'; content: string } | null = null;
  const historyWithoutLastUser = [...history];
  // 从末尾找到最后一条 user 消息，提取出来
  for (let i = historyWithoutLastUser.length - 1; i >= 0; i--) {
    if (historyWithoutLastUser[i].role === 'user') {
      const lastUser = historyWithoutLastUser[i];
      userInputMsg = { role: 'user' as const, content: lastUser.content };
      historyWithoutLastUser.splice(i, 1); // 从历史中移除
      break;
    }
  }

  const historyMsgs = buildHistoryMessages(historyWithoutLastUser, recentMessageCount);
  if (historyMsgs.length > 0) {
    const histMessages = historyMsgs.map(h => ({ role: h.role, content: h.content }));
    stageMessages['chatHistory'] = histMessages;
    stageOrder.push('chatHistory');
    for (const hm of histMessages) {
      finalMessages.push(hm as { role: 'system' | 'user' | 'assistant'; content: string });
    }
  }

  // ── Reference 层：工具速查 + 玩家/角色身份（user role, 紧贴用户输入上方）──
  const refParts: string[] = [];
  refParts.push('[以下为参考信息]\n');

  // 玩家/角色身份
  const macroCtx = {
    userName,
    characterName,
    userInput: userInputMsg?.content ?? '',
    playerDescription,
    characterDescription,
    varsListText: formatVariablesForPrompt(variables),
    lastMaintext: '',
    fullVars: variables,
  };
  const identityParts: string[] = [];
  if (playerDescription) identityParts.push(`## 玩家设定\n${replaceMacros(playerDescription, macroCtx)}`);
  if (characterDescription) identityParts.push(`## AI 角色设定\n${replaceMacros(characterDescription, macroCtx)}`);
  if (identityParts.length > 0) refParts.push(identityParts.join('\n\n'));

  // 当前时间地点（从变量树中提取，轻量）
  const currentLocation = variables['世界']?.['现实']?.['地点'] ?? '';
  const currentTime = variables['世界']?.['现实']?.['时间'] ?? '';
  const inDream = variables['世界']?.['梦境定位']?.['位于梦境'] ?? false;
  if (currentLocation || currentTime) {
    const locationLines: string[] = [];
    if (currentLocation) locationLines.push(`当前位置: ${currentLocation}`);
    if (currentTime) locationLines.push(`当前时间: ${currentTime}`);
    locationLines.push(`是否梦境: ${inDream ? '是' : '否'}`);
    refParts.push(`## 当前状态\n${locationLines.join('\n')}`);
  }

  // 工具速查
  const toolIndex = buildToolIndex(tools);
  if (toolIndex) refParts.push(toolIndex);

  const refContent = refParts.join('\n\n---\n\n');
  if (refContent) {
    stageMessages['reference'] = [{ role: 'user', content: refContent }];
    stageOrder.push('reference');
    finalMessages.push({ role: 'user', content: refContent });
  }

  // ── 用户输入（独立一条，和参考信息、铁则区分开）──
  if (userInputMsg) {
    stageMessages['userInput'] = [userInputMsg];
    stageOrder.push('userInput');
    finalMessages.push(userInputMsg);
  }

  // ── Rule 层：铁则（user role, 放最下方, 离生成最近）──
  const rules = rulesContent || DEFAULT_RULES;
  const rulesMessage = { role: 'user' as const, content: `[以下是你必须严格遵守的叙事铁则——视为最高优先级指令]\n\n${rules}\n\n---\n以上铁则已加载完毕。请优先使用中文输出。` };
  stageMessages['rules'] = [rulesMessage];
  stageOrder.push('rules');
  finalMessages.push(rulesMessage);

  // ── Tools ──
  const openaiTools = tools.map(toOpenAITool);

  return {
    messages: finalMessages,
    systemPrompt,
    tools: openaiTools,
    stageMessages,
    stageOrder,
  };
}
