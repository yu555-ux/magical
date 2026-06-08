/**
 * 缓存监控 — 数据采集与存储
 *
 * 只监控第一 API（流式 SSE）。
 * 在 SSE 流的最后一条 chunk 中提取 usage 数据。
 */

import { getDatabase } from './database';
import { gameBus } from './event-bus';
import type { CacheUsageRecord, PromptMessage } from './types';

// ── 计费模型 ──

interface PricingModel {
  name: string;
  hit: number;   // 每百万 token 价格
  miss: number;  // 每百万 token 价格
}

const PRICING: Record<string, PricingModel> = {
  'deepseek-v4-flash':    { name: 'V4 Flash', hit: 0.0028, miss: 0.14 },
  'deepseek-v4-pro':      { name: 'V4 Pro',   hit: 0.003625, miss: 0.435 },
  'gemini-3.1':           { name: 'Gemini',   hit: 0.02, miss: 1.00 },
};

const DEFAULT_PRICING: PricingModel = { name: '未知', hit: 0.02, miss: 1.00 };

function findPricing(model: string): PricingModel {
  for (const [key, val] of Object.entries(PRICING)) {
    if (model.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return DEFAULT_PRICING;
}

/** 计算单次请求费用（元） */
export function calculateCost(model: string, hit: number, miss: number): number {
  const p = findPricing(model);
  return (hit / 1_000_000) * p.hit + (miss / 1_000_000) * p.miss;
}

/** 获取模型对应的计价模型名 */
export function getPricingName(model: string): string {
  return findPricing(model).name;
}

// ── DeepSeek SSE Usage 提取 ──

interface DSUsage {
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
  prompt_tokens?: number;
}

/**
 * 从流式 SSE 文本中提取 usage 数据。
 * DeepSeek 在倒数第二条 chunk（[DONE] 前）返回 usage 对象。
 * 兼容两种格式：
 *   SSE: data: {"choices":[{"delta":{},"usage":{...}}]}
 *   普通 JSON: {"usage": {...}}
 */
export function extractUsageFromSSE(rawText: string): DSUsage | null {
  if (!rawText) return null;

  // 尝试直接 JSON 解析（非流式）
  try {
    const json = JSON.parse(rawText.trim());
    if (json?.usage) return json.usage as DSUsage;
  } catch { /* not JSON */ }

  // SSE 逐行扫描，收集 usage
  const lines = rawText.split('\n');
  let lastUsage: DSUsage | null = null;
  for (const line of lines) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    try {
      const parsed = JSON.parse(line.substring(6));
      const usage = parsed?.choices?.[0]?.usage ?? parsed?.usage;
      if (usage) lastUsage = usage as DSUsage;
    } catch { /* skip */ }
  }

  return lastUsage;
}

/** 从 usage 对象构建 CacheUsageRecord */
export function buildUsageRecord(
  usage: DSUsage,
  model: string,
  chatId: string,
  promptMessages?: Array<{ role: string; content: string }>,
  userInput?: string,
): CacheUsageRecord {
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss = usage.prompt_cache_miss_tokens ?? 0;
  const total = hit + miss;
  const hitRate = total > 0 ? Math.round((hit / total) * 1000) / 10 : 0;
  const cost = calculateCost(model, hit, miss);

  // 构建消息摘要（仅存预览，完整内容通过 fullPromptMessages 单独存取）
  const messages: PromptMessage[] | undefined = promptMessages?.map((m) => ({
    role: m.role,
    preview: m.content.slice(0, 200),
    charCount: m.content.length,
  }));

  let totalChars = 0;
  if (promptMessages) {
    for (const m of promptMessages) totalChars += m.content.length;
  }

  return {
    requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    model,
    chatId,
    hit,
    miss,
    total,
    hitRate,
    cost,
    generated: usage.completion_tokens ?? 0,
    messages,
    totalChars,
    userInput: userInput?.slice(0, 100),
  };
}

// ── 完整提示词存储（用于 diff，单独存避免 CacheUsageRecord 过大）──

const fullPromptStore = new Map<string, Array<{ role: string; content: string }>>();

export function storeFullPrompt(requestId: string, messages: Array<{ role: string; content: string }>) {
  // 限制缓存数量，避免内存溢出
  if (fullPromptStore.size > 100) {
    const firstKey = fullPromptStore.keys().next().value;
    if (firstKey) fullPromptStore.delete(firstKey);
  }
  fullPromptStore.set(requestId, messages);
}

export function getFullPrompt(requestId: string): Array<{ role: string; content: string }> | null {
  return fullPromptStore.get(requestId) ?? null;
}

// ── 持久化 ──

export async function saveUsageRecord(record: CacheUsageRecord): Promise<void> {
  try {
    await getDatabase().cacheUsage.put(record);
  } catch (e) {
    console.warn('[CacheMonitor] 存储失败:', e);
  }
}

export async function getUsageHistory(limit = 100): Promise<CacheUsageRecord[]> {
  return getDatabase().cacheUsage
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

export async function clearUsageHistory(): Promise<void> {
  await getDatabase().cacheUsage.clear();
}

// ── 事件订阅 ──

/** 初始化缓存监控的数据库持久化订阅 */
export function initCacheMonitor(): () => void {
  return gameBus.on('api_usage', async ({ record }) => {
    await saveUsageRecord(record);
  });
}
