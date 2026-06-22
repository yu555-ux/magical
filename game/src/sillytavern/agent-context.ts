/**
 * Agent 分层上下文构建器
 *
 * 消息顺序（fate-sandbox 三层 slot 模型）：
 *   [0] system      — gm-system.md（极简身份 + 契约）
 *   [1..N] user     — pre-history slot 模块（背景参考：世界逻辑、文风、渲染协议）
 *   [N+1] user      — 动态参考（常驻世界书 + 工具速查 + 身份）
 *   [N+2..M]        — 聊天历史
 *   [M+1] user      — 玩家本轮输入
 *   [M+2..K] user   — pre-response slot 模块（最高注意力：自检清单、GM Brief、工具策略、硬规则）
 *   [K+1..L] user   — final-contract slot 模块（输出格式 + 输出前验证）
 *
 * DS V4 特化：参考信息和铁则用 user role 注入，因为 DS V4 对 user message 的服从度远超 system。
 */

import type { ChatMessage, Lorebook, HistoryTimeline, DreamAnchor, OpenAIContextMessage } from './types';
import { replaceMacros } from './prompt-assembler';
import type { AgentToolDef } from './tools/registry';
import { toOpenAITool } from './tools/registry';
import { buildInjectionContext } from './agent-prompt/injection';
import type { InjectionResult } from './agent-prompt/injection';

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
  /** 启用的 Skill ID 列表（来自 AppSettings.enabledSkills） */
  enabledSkills: string[];
  /** @deprecated 不再使用——system prompt 由 gm-system.md 提供 */
  systemPromptContent?: string;
  /** @deprecated 不再使用——铁则由 preset.json 的 pre-response 模块提供 */
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

// ── Main builder ──

export function buildAgentContext(config: AgentContextConfig): AgentContextResult {
  const {
    userName, characterName, playerDescription, characterDescription,
    history, recentMessageCount, variables, lorebooks, tools,
    systemPromptContent,
  } = config;

  const stageMessages: Record<string, Array<{ role: string; content: string }>> = {};
  const stageOrder: string[] = [];
  const finalMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // ── 分离最后一条用户消息 ──
  let userInputMsg: { role: 'user'; content: string } | null = null;
  const historyWithoutLastUser = [...history];
  for (let i = historyWithoutLastUser.length - 1; i >= 0; i--) {
    if (historyWithoutLastUser[i].role === 'user') {
      const lastUser = historyWithoutLastUser[i];
      userInputMsg = { role: 'user' as const, content: lastUser.content };
      historyWithoutLastUser.splice(i, 1);
      break;
    }
  }

  // ── 运行注入引擎 ──
  const injection: InjectionResult = buildInjectionContext({
    userName,
    characterName,
    userInput: userInputMsg?.content ?? '',
    variables,
    enabledSkills: config.enabledSkills,
  });

  // ── 宏上下文 ──
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

  // ── [0] System 层：极简身份 + 契约（由 gm-system.md 提供）──
  const systemPrompt = systemPromptContent
    ? replaceMacros(systemPromptContent, macroCtx)
    : replaceMacros(injection.systemPromptContent, macroCtx);
  stageMessages['system'] = [{ role: 'system', content: systemPrompt }];
  stageOrder.push('system');

  // ── [1..N] pre-history slot 模块（背景参考，低注意力）──
  if (injection.preHistoryMessages.length > 0) {
    for (const msg of injection.preHistoryMessages) {
      finalMessages.push(msg);
    }
    stageMessages['pre-history'] = injection.preHistoryMessages.map(m => ({ role: m.role, content: m.content }));
    stageOrder.push('pre-history');
  }

  // ── [N+1] 动态参考：世界书 + 工具速查 + 身份 ──
  const refParts: string[] = [];

  if (playerDescription) refParts.push(`## 玩家设定\n${replaceMacros(playerDescription, macroCtx)}`);
  if (characterDescription) refParts.push(`## AI 角色设定\n${replaceMacros(characterDescription, macroCtx)}`);

  // 常驻世界书
  const constantEntries: string[] = [];
  for (const lb of lorebooks) {
    for (const entry of lb.entries) {
      if (!entry.enabled || !entry.constant) continue;
      const c = entry.content.trim();
      if (!c) continue;
      constantEntries.push(c);
    }
  }
  if (constantEntries.length > 0) {
    const totalChars = constantEntries.reduce((s, c) => s + c.length, 0);
    refParts.push(`## 常驻世界知识 (${constantEntries.length} 条, ${(totalChars / 1000).toFixed(1)}k 字)\n${constantEntries.join('\n\n---\n')}`);
  }

  if (refParts.length > 0) {
    const refContent = `[以下为参考信息 — 游戏状态请通过工具查询]\n\n${refParts.join('\n\n---\n\n')}`;
    stageMessages['reference'] = [{ role: 'user', content: refContent }];
    stageOrder.push('reference');
    finalMessages.push({ role: 'user', content: refContent });
  }

  // ── 聊天历史 ──
  const historyMsgs = buildHistoryMessages(historyWithoutLastUser, recentMessageCount);
  if (historyMsgs.length > 0) {
    const histMessages = historyMsgs.map(h => ({ role: h.role, content: h.content }));
    stageMessages['chatHistory'] = histMessages;
    stageOrder.push('chatHistory');
    for (const hm of histMessages) {
      finalMessages.push(hm as { role: 'system' | 'user' | 'assistant'; content: string });
    }
  }

  // ── 用户输入 ──
  if (userInputMsg) {
    stageMessages['userInput'] = [userInputMsg];
    stageOrder.push('userInput');
    finalMessages.push(userInputMsg);
  }

  // ── [M+2..K] pre-response slot 模块（最高注意力）──
  if (injection.preResponseMessages.length > 0) {
    for (const msg of injection.preResponseMessages) {
      finalMessages.push(msg);
    }
    stageMessages['pre-response'] = injection.preResponseMessages.map(m => ({ role: m.role, content: m.content }));
    stageOrder.push('pre-response');
  }

  // ── [K+1..L] final-contract slot 模块 ──
  if (injection.finalContractMessages.length > 0) {
    for (const msg of injection.finalContractMessages) {
      finalMessages.push(msg);
    }
    stageMessages['final-contract'] = injection.finalContractMessages.map(m => ({ role: m.role, content: m.content }));
    stageOrder.push('final-contract');
  }

  // ── Tools ──
  const openaiTools = tools.map(toOpenAITool);

  // ── 调试日志 ──
  if (injection.loadedModules.length > 0) {
    console.log(`[agent-context] 加载模块 (${injection.loadedModules.length}): ${injection.loadedModules.join(', ')}`);
  }

  return {
    messages: finalMessages,
    systemPrompt,
    tools: openaiTools,
    stageMessages,
    stageOrder,
  };
}
