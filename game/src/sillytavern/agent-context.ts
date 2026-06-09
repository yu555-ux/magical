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
import { replaceMacros } from './prompt-assembler';
import type { AgentToolDef } from './tools/registry';
import { toOpenAITool } from './tools/registry';
import { SYSTEM_PROMPT, NARRATIVE_RULES } from './agent-defaults';

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
  const systemPrompt = systemPromptContent || SYSTEM_PROMPT;
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

  // ── Reference 层：仅工具速查 + 身份（user role, 紧贴用户输入上方）──
  // 世界观、时间、地点、角色等游戏状态通过工具调用获取，不预注入 prompt
  const refParts: string[] = [];

  // 玩家/角色身份（仅当用户在设置中填写了）
  const macroCtx = {
    userName,
    characterName,
    userInput: userInputMsg?.content ?? '',
    playerDescription,
    characterDescription,
    varsListText: '',
    lastMaintext: '',
    fullVars: variables,
  };
  if (playerDescription) refParts.push(`## 玩家设定\n${replaceMacros(playerDescription, macroCtx)}`);
  if (characterDescription) refParts.push(`## AI 角色设定\n${replaceMacros(characterDescription, macroCtx)}`);

  // 工具速查（核心：让 AI 知道有哪些工具可用）
  const toolIndex = buildToolIndex(tools);
  if (toolIndex) refParts.push(toolIndex);

  if (refParts.length > 0) {
    const refContent = `[以下为参考信息 — 游戏状态请通过工具查询]\n\n${refParts.join('\n\n---\n\n')}`;
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
  const rules = rulesContent || NARRATIVE_RULES;
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
