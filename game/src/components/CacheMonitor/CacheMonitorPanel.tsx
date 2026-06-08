/**
 * 缓存监控主面板
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Trash2, Zap } from 'lucide-react';
import type { CacheUsageRecord } from '../../sillytavern/types';
import { getUsageHistory, clearUsageHistory, calculateCost } from '../../sillytavern/cache-monitor';

interface Props {
  latest: CacheUsageRecord | null;
  onClose: () => void;
}

export default function CacheMonitorPanel({ latest, onClose }: Props) {
  const [history, setHistory] = useState<CacheUsageRecord[]>([]);

  const refresh = useCallback(async () => {
    setHistory(await getUsageHistory(50));
  }, []);

  useEffect(() => {
    refresh();
    // 有新数据时自动刷新
    if (latest) setHistory(prev => [latest, ...prev].slice(0, 50));
  }, [latest, refresh]);

  const handleClear = async () => {
    await clearUsageHistory();
    setHistory([]);
  };

  const totalCost = history.reduce((s, r) => s + r.cost, 0);
  const avgHitRate = history.length > 0
    ? Math.round(history.reduce((s, r) => s + r.hitRate, 0) / history.length)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="fixed right-3 bottom-32 z-[150] w-[300px] max-h-[420px] glass-panel border-glow overflow-hidden flex flex-col rounded-xl"
    >
      {/* tech-line top */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/40 to-transparent" />

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-aether-border/20 bg-aether-cyan/[0.03]">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-aether-cyan" />
          <h3 className="font-display text-xs font-semibold tracking-[0.15em] text-aether-cyan uppercase">
            缓存监控
          </h3>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-aether-cyan transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Summary bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-aether-dark/60 border-b border-aether-border/10 text-[10px] font-mono">
        <span className="text-white/40">{history.length} 次请求</span>
        <span className={avgHitRate >= 60 ? 'text-aether-green' : avgHitRate >= 30 ? 'text-aether-gold' : 'text-aether-red'}>
          均 {avgHitRate}%
        </span>
        <span className="text-aether-cyan/70">¥{totalCost.toFixed(4)}</span>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="text-center py-10 text-white/25 text-xs font-mono">
            发送消息后开始采集
          </div>
        ) : (
          history.map((r, i) => (
            <CacheEntry key={r.requestId} record={r} isLatest={i === 0} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-aether-border/20 bg-aether-dark/40">
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-aether-red transition-colors"
        >
          <Trash2 size={10} /> 清空
        </button>
        <span className="text-[9px] text-white/20 font-mono">仅第一API</span>
      </div>

      {/* tech-line bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
    </motion.div>
  );
}

/** 单条缓存记录 */
function CacheEntry({ record, isLatest }: { record: CacheUsageRecord; isLatest: boolean }) {
  const { hit, miss, total, hitRate, cost, timestamp, model } = record;
  const timeStr = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const barColor = hitRate >= 60
    ? 'from-aether-green to-aether-cyan'
    : hitRate >= 30
      ? 'from-aether-gold to-aether-green'
      : 'from-aether-red to-aether-gold';

  return (
    <div className={`px-4 py-2 border-b border-aether-border/10 hover:bg-white/[0.02] transition-colors ${isLatest ? 'bg-aether-cyan/[0.02]' : ''}`}>
      {/* Hit rate bar */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(hitRate, 2)}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span className={`text-[11px] font-mono font-bold w-8 text-right ${
          hitRate >= 60 ? 'text-aether-green' : hitRate >= 30 ? 'text-aether-gold' : 'text-aether-red'
        }`}>
          {hitRate}%
        </span>
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-[9px] font-mono">
        <span className="text-white/35">
          <span className="text-aether-green/60">中:{hit.toLocaleString()}</span>
          {' '}
          <span className="text-aether-red/50">未:{miss.toLocaleString()}</span>
          {total > 0 && <span className="text-white/20"> · {total.toLocaleString()}</span>}
        </span>
        <span className="flex items-center gap-2">
          {cost > 0 && <span className="text-aether-cyan/50">¥{cost.toFixed(4)}</span>}
          <span className="text-white/20">{timeStr}</span>
        </span>
      </div>
    </div>
  );
}
