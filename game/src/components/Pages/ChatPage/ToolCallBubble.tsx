/**
 * ToolCallBubble — Agent 工具调用状态气泡
 *
 * 显示在聊天气泡中，表示当前正在执行/已完成的工具调用。
 * 参考 TauriTavern StreamingProcessor.toolCalls 的状态模式。
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wrench, Check, X, Loader2, ChevronDown } from 'lucide-react';
import type { ToolExecutionRecord } from '../../../sillytavern/types';

interface Props {
  /** 正在执行的工具调用（id → name/startTime） */
  pendingCalls: Map<string, { name: string; label: string; startTime: number }>;
  /** 已完成的工具调用 */
  completedCalls: ToolExecutionRecord[];
}

export default function ToolCallBubble({ pendingCalls, completedCalls }: Props) {
  const [expanded, setExpanded] = useState(false);

  const pendingList = Array.from(pendingCalls.entries()).map(([id, info]) => ({
    id,
    name: info.name,
    label: info.label,
    startTime: info.startTime,
  }));

  const hasContent = pendingList.length > 0 || completedCalls.length > 0;
  if (!hasContent) return null;

  const allDone = pendingList.length === 0;

  return (
    <div className="my-2 mx-0">
      <div
        className={`rounded-lg border text-xs font-mono overflow-hidden transition-all ${
          allDone
            ? 'border-aether-border/20 bg-white/[0.02]'
            : 'border-aether-cyan/20 bg-aether-cyan/[0.04]'
        }`}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-white/50 hover:text-white/70 transition-colors"
        >
          {allDone ? (
            <Check size={12} className="text-green-400 shrink-0" />
          ) : (
            <Loader2 size={12} className="text-aether-cyan animate-spin shrink-0" />
          )}
          <Wrench size={12} className="shrink-0" />
          <span className="flex-1 text-left">
            {allDone
              ? `工具调用完成 (${completedCalls.length} 项)`
              : `工具调用中... (${pendingList.length} 项执行中)`}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={12} />
          </motion.span>
        </button>

        {/* Detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-2 space-y-1 border-t border-aether-border/10 pt-2">
                {/* Completed */}
                {completedCalls.map((call) => (
                  <div key={call.id} className="flex items-center gap-2 text-white/40">
                    {call.isError ? (
                      <X size={10} className="text-red-400 shrink-0" />
                    ) : (
                      <Check size={10} className="text-green-400 shrink-0" />
                    )}
                    <span className="text-white/60">{call.label || call.name}</span>
                    <span className="text-white/30">{call.duration}ms</span>
                    {call.result && (
                      <span className="truncate text-white/25 max-w-[200px]">
                        → {call.result.slice(0, 60)}{call.result.length > 60 ? '...' : ''}
                      </span>
                    )}
                  </div>
                ))}

                {/* Pending */}
                {pendingList.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-aether-cyan/50">
                    <Loader2 size={10} className="animate-spin shrink-0" />
                    <span>{p.label || p.name}</span>
                    <span className="text-aether-cyan/30">
                      {Math.round((Date.now() - p.startTime) / 100) / 10}s
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
