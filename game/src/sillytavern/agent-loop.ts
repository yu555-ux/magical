/**
 * Agent Tool Loop — 核心循环
 *
 * 参考 piagent agent-loop.ts:155-268 的内层 while 循环设计：
 *   用户消息 → LLM 调用(带 tools) → 解析回复
 *     ├─ 有 tool_call → 执行工具 → 工具结果回注 context → 继续循环
 *     └─ 无 tool_call → 退出循环，返回最终文本
 *
 * 使用 async generator 模式：每收到一个 SSE chunk 就 yield 事件，UI 实时更新。
 */

import type { ApiRouter } from './api-router';
import {
  parseToolCallDeltas,
  parseTextDelta,
  parseThinkingDelta,
  parseUsage,
  areToolCallsComplete,
  type ToolCallAccumulator,
} from './stream-parser';
import type { AgentStreamEvent, ToolExecutionRecord, OpenAIContextMessage, OpenAIAssistantMessage, OpenAIToolMessage } from './types';
import type { AgentToolDef, ToolExecutionContext, ToolResult } from './tools/registry';

// ── Types ──

export interface AgentLoopOptions {
  router: ApiRouter;
  systemPrompt: string;
  messages: OpenAIContextMessage[];
  tools: AgentToolDef[];
  toolContext: ToolExecutionContext;
  signal?: AbortSignal;
  maxTurns: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
}

export interface AgentLoopResult {
  text: string;
  thinking: string;
  toolCalls: ToolExecutionRecord[];
  turnCount: number;
  usage: { hit: number; miss: number; generated: number } | null;
  allMessages: OpenAIContextMessage[];
}

// ── Main loop ──

export async function* runAgentLoop(options: AgentLoopOptions): AsyncGenerator<AgentStreamEvent, AgentLoopResult> {
  const {
    router, systemPrompt, messages: initialMessages, tools, toolContext,
    signal, maxTurns, temperature, top_p, top_k,
    frequency_penalty, presence_penalty, max_tokens,
  } = options;

  // 转换为 OpenAI API 格式的工具
  const openaiTools = tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  // 初始化 context messages（deep copy，不污染原始）
  const contextMessages: OpenAIContextMessage[] = initialMessages.map(m => ({ ...m } as OpenAIContextMessage));

  let allText = '';
  let allThinking = '';
  const allToolCalls: ToolExecutionRecord[] = [];
  let turnCount = 0;
  let finalUsage: { hit: number; miss: number; generated: number } | null = null;

  try {
    while (turnCount < maxTurns) {
      if (signal?.aborted) {
        yield { type: 'error', message: '已中止' };
        break;
      }

      turnCount++;
      let turnUsage: { hit: number; miss: number; generated: number } | null = null;

  // ── 1. 调用 LLM ──
      // 构建请求消息（一次构建，调试和实际调用复用）
      const requestMessages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...contextMessages,
      ];

      console.group(`🤖 Agent Turn #${turnCount}/${maxTurns}`);
      console.log(`🔧 可用工具: ${openaiTools.map(t => t.function.name).join(', ')}`);
      console.log(`🌡️ 参数: temperature=${temperature}, top_p=${top_p}, top_k=${top_k}, max_tokens=${max_tokens}`);
      console.log(`📤 请求消息 (${requestMessages.length} 条):`);
      requestMessages.forEach((m, i) => {
        let text = '';
        try {
          if (m.content === undefined || m.content === null) {
            text = '(无内容 — 仅 tool_calls)';
          } else if (typeof m.content === 'string') {
            text = m.content;
          } else {
            text = JSON.stringify(m.content, null, 2);
          }
        } catch { text = '(无法显示)'; }
        console.log(`\n── [${i}] ${m.role} ──\n${text}`);
      });

      const t0 = Date.now();
      const response = await router.callAgent(
        {
          messages: requestMessages,
          tools: openaiTools,
          temperature,
          top_p,
          top_k,
          frequency_penalty,
          presence_penalty,
          max_tokens,
        },
        signal,
      );

      if (!response.ok) {
        yield { type: 'error', message: `API 错误 HTTP ${response.status}` };
        break;
      }

      // ── 2. 流式解析 ──
      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', message: '无法读取响应流' };
        break;
      }

      const decoder = new TextDecoder();
      let buf = '';
      let turnText = '';
      let turnThinking = '';
      const toolAccumulators = new Map<number, ToolCallAccumulator>();
      let hasTextStarted = false;
      let hasThinkingStarted = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          for (const line of part.split('\n').filter(l => l.startsWith('data: '))) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;

            let parsed: unknown;
            try { parsed = JSON.parse(raw); } catch { continue; }

            // 提取文本
            const textDelta = parseTextDelta(parsed);
            if (textDelta) {
              if (!hasTextStarted) { yield { type: 'text_start' }; hasTextStarted = true; }
              turnText += textDelta;
              allText += textDelta;
              yield { type: 'text_delta', chunk: textDelta };
            }

            // 提取 thinking
            const thinkingDelta = parseThinkingDelta(parsed);
            if (thinkingDelta) {
              if (!hasThinkingStarted) { yield { type: 'thinking_start' }; hasThinkingStarted = true; }
              turnThinking += thinkingDelta;
              allThinking += thinkingDelta;
              yield { type: 'thinking_delta', chunk: thinkingDelta };
            }

            // 提取 usage
            const usage = parseUsage(parsed);
            if (usage) { turnUsage = usage; finalUsage = usage; }

            // 提取 tool_call deltas
            parseToolCallDeltas(parsed, toolAccumulators);

            // 对新出现的 tool_call 发事件
            for (const [index, acc] of toolAccumulators) {
              if (acc.name && !acc.id) {
                // 仍在等待 id（第一帧）
              } else if (acc.name && acc.id) {
                // 已收到 id，可以通知 UI
                yield { type: 'toolcall_delta', id: acc.id, argumentsChunk: '' };
              }
            }
          }
        }
      }

      // 文本结束
      if (hasTextStarted) yield { type: 'text_end' };
      if (hasThinkingStarted) yield { type: 'thinking_end' };

      // 每轮缓存数据
      if (turnUsage) yield { type: 'turn_usage', hit: turnUsage.hit, miss: turnUsage.miss, generated: turnUsage.generated, turnIndex: turnCount };

      const elapsed = Date.now() - t0;
      console.log(`⏱️ 流式耗时: ${elapsed}ms`);
      if (turnUsage) {
        const hitRate = (turnUsage.hit + turnUsage.miss) > 0
          ? Math.round((turnUsage.hit / (turnUsage.hit + turnUsage.miss)) * 1000) / 10
          : 0;
        console.log(`💰 缓存: hit=${turnUsage.hit} miss=${turnUsage.miss} generated=${turnUsage.generated} | 命中率 ${hitRate}%`);
      } else {
        console.log(`💰 缓存: 无 usage 数据 (模型可能不支持返回)`)
      }
      if (turnText) console.log(`\n📝 AI 回复全文:\n${turnText}`);
      if (turnThinking) console.log(`\n💭 思考过程全文:\n${turnThinking}`);

      // ── 3. 处理 tool calls ──
      if (toolAccumulators.size > 0 && areToolCallsComplete(toolAccumulators)) {
        console.log(`🔧 检测到 ${toolAccumulators.size} 个工具调用`);

        // 将 assistant 消息（含 tool_calls）加入 context
        const assistantContent = turnText || undefined;
        const toolCallBlocks: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }> = [];
        for (const acc of toolAccumulators.values()) {
          if (acc.name) {
            toolCallBlocks.push({
              id: acc.id || `call_${Math.random().toString(36).slice(2, 11)}`,
              type: 'function',
              function: { name: acc.name, arguments: acc.arguments || '{}' },
            });
          }
        }

        // 添加 assistant 消息
        const assistantMsg: OpenAIAssistantMessage = { role: 'assistant' };
        if (assistantContent) assistantMsg.content = assistantContent;
        if (toolCallBlocks.length > 0) {
          assistantMsg.tool_calls = toolCallBlocks;
        }
        contextMessages.push(assistantMsg);

        // 执行工具（带事务保护：失败时回滚全部可变状态）
        const turnRecords: ToolExecutionRecord[] = [];
        for (const tcBlock of toolCallBlocks) {
          const toolName = tcBlock.function.name;
          const toolDef = tools.find(t => t.name === toolName);
          const t0 = Date.now();

          yield {
            type: 'toolcall_start',
            id: tcBlock.id,
            name: toolName,
          };

          // 事务保护：执行前快照全部三个可变引用，失败时回滚
          const beforeVars = structuredClone(toolContext.variables);
          const beforeDreamAnchor = { ...toolContext.dreamAnchor };
          const beforePlotHistory = structuredClone(toolContext.plotHistory);

          let toolResult: ToolResult;
          if (!toolDef) {
            console.warn(`  ⚠️ 未知工具: ${toolName}`);
            toolResult = { content: [{ type: 'text', text: `工具 "${toolName}" 未注册` }] };
          } else {
            try {
              let args: unknown;
              try { args = JSON.parse(tcBlock.function.arguments); } catch { args = {}; }
              console.log(`  🔨 ${toolName} 参数:`, args);
              toolResult = await toolDef.execute(toolContext, args);
            } catch (err) {
              console.error(`  ❌ ${toolName} 执行异常，回滚全部状态:`, err);
              toolContext.variables = beforeVars;
              Object.assign(toolContext.dreamAnchor, beforeDreamAnchor);
              Object.assign(toolContext.plotHistory, beforePlotHistory);
              toolResult = {
                content: [{ type: 'text', text: `工具执行出错（状态已回滚）: ${err instanceof Error ? err.message : String(err)}` }],
              };
            }
          }

          const duration = Date.now() - t0;
          const isError = toolResult.content.length === 1 && toolResult.content[0].text.startsWith('工具');

          const record: ToolExecutionRecord = {
            id: tcBlock.id,
            name: toolName,
            label: toolDef?.label ?? toolName,
            arguments: tcBlock.function.arguments,
            result: toolResult.content[0]?.text ?? '',
            isError,
            duration,
          };
          turnRecords.push(record);
          allToolCalls.push(record);

          yield { type: 'tool_result', record };

          // 工具结果完整加入 context（不截断，tavern2agent 无此限制）
          const toolMsg: OpenAIToolMessage = {
            role: 'tool',
            tool_call_id: tcBlock.id,
            content: toolResult.content[0]?.text ?? '',
          };
          contextMessages.push(toolMsg);

          const resultText = toolResult.content?.[0]?.text ?? '(无返回)';
          console.log(`  ✅ ${toolName} (${duration}ms) →`, resultText);
        }

        // submit_reply → 直接退出，返回格式化文本
        if (turnRecords.some(r => r.name === 'submit_reply')) {
          console.log(`✅ submit_reply 已执行，退出循环`);
          console.groupEnd();
          break;
        }

        console.log(`🔧 工具执行完成 (${turnRecords.length} 项)，继续生成...`);
        console.groupEnd();

        // 继续循环——AI 看到工具结果后接着生成
        continue;
      }

      // ── 4. 无 tool call → 退出循环 ──
      console.log(`✅ Turn #${turnCount} 无工具调用，叙事完成`);
      console.groupEnd();
      break;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      yield { type: 'error', message: '已中止' };
    } else {
      yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── 返回结果 ──
  yield { type: 'done', text: allText, thinking: allThinking };

  return {
    text: allText,
    thinking: allThinking,
    toolCalls: allToolCalls,
    turnCount,
    usage: finalUsage,
    allMessages: contextMessages,
  };
}
