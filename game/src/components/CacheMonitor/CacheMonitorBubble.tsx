/**
 * 缓存监控浮动气泡
 * 始终悬浮在屏幕右侧边缘，显示最新命中率，点击展开主面板
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity } from 'lucide-react';
import { gameBus } from '../../sillytavern/event-bus';
import type { CacheUsageRecord } from '../../sillytavern/types';
import CacheMonitorPanel from './CacheMonitorPanel';

export default function CacheMonitorBubble() {
  const [latest, setLatest] = useState<CacheUsageRecord | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    return gameBus.on('api_usage', ({ record }) => {
      setLatest(record);
    });
  }, []);

  const hitColor = !latest
    ? 'text-white/40'
    : latest.hitRate >= 60
      ? 'text-aether-green'
      : latest.hitRate >= 30
        ? 'text-aether-gold'
        : 'text-aether-red';

  return (
    <>
      {/* 浮动气泡 */}
      <motion.button
        onClick={() => setPanelOpen(true)}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          fixed right-3 bottom-24 z-[140]
          w-11 h-11 rounded-full
          flex flex-col items-center justify-center
          glass-panel hover:border-aether-cyan/60
          transition-all cursor-pointer
          shadow-[0_0_15px_rgba(0,242,255,0.15)]
          hover:shadow-[0_0_25px_rgba(0,242,255,0.3)]
        `}
        title="缓存监控"
      >
        <Activity size={14} className={hitColor} />
        {latest && (
          <span className={`text-[9px] font-mono font-bold ${hitColor} leading-none mt-0.5`}>
            {Math.round(latest.hitRate)}%
          </span>
        )}
        {/* 活跃脉冲 */}
        {latest && (
          <motion.div
            className="absolute inset-0 rounded-full border border-aether-cyan/30"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            key={latest.requestId}
          />
        )}
      </motion.button>

      {/* 主面板 */}
      <AnimatePresence>
        {panelOpen && (
          <CacheMonitorPanel
            latest={latest}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
