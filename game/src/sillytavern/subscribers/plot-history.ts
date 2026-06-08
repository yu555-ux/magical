/**
 * 剧情历史订阅者
 * 监听 message_received 事件，从 AI 回复的 <history> 标签中提取
 * 剧情节点并追加到 plotHistory
 */

import { gameBus } from '../event-bus';
import { enrichHistory } from '../variables';
import type { HistoryTimeline, SavePoint } from '../types';

let lastHistoryPatch: { reality?: SavePoint; dream?: SavePoint } | null = null;

/** 注册剧情历史订阅者 */
export function initPlotHistorySubscriber() {
  gameBus.on('message_received', ({ parsed, chat, userName }) => {
    lastHistoryPatch = null;

    if (!parsed.history) return;

    // 用当前变量状态 enrich history 中的宏
    const enriched = enrichHistory(parsed.history, chat.variables ?? {}, userName);

    if (enriched.world === '现实') {
      lastHistoryPatch = { reality: enriched };
    } else if (enriched.world === '梦境') {
      lastHistoryPatch = { dream: enriched };
    }
  });
}

/** 应用本轮 <history> 到 plotHistory。返回新的 plotHistory，无变化则返回原值 */
export function applyPlotHistory(current: HistoryTimeline): { timeline: HistoryTimeline; changed: boolean } {
  if (!lastHistoryPatch) return { timeline: current, changed: false };

  const next: HistoryTimeline = {
    reality: [...current.reality],
    dream: [...current.dream],
  };

  if (lastHistoryPatch.reality) {
    next.reality.push({ ...lastHistoryPatch.reality, sequence: next.reality.length + 1 });
  }
  if (lastHistoryPatch.dream) {
    next.dream.push({ ...lastHistoryPatch.dream, sequence: next.dream.length + 1 });
  }

  return { timeline: next, changed: true };
}

/** 清除剧情历史缓存 */
export function clearPlotHistoryPatch() {
  lastHistoryPatch = null;
}
