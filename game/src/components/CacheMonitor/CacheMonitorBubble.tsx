/**
 * 缓存监控触发按钮 + 弹窗
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';
import { gameBus } from '../../sillytavern/event-bus';
import type { CacheUsageRecord } from '../../sillytavern/types';
import CacheMonitorModal from './CacheMonitorModal';

export default function CacheMonitorBubble() {
  const [latest, setLatest] = useState<CacheUsageRecord | null>(null);
  const [open, setOpen] = useState(false);

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
      {/* 触发按钮 — 右下角固定 */}
      <motion.button
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          fixed right-3 bottom-24 z-[140]
          w-10 h-10 rounded-full
          flex flex-col items-center justify-center
          glass-panel hover:border-aether-cyan/60
          transition-all cursor-pointer
          shadow-[0_0_12px_rgba(0,242,255,0.12)]
          hover:shadow-[0_0_20px_rgba(0,242,255,0.25)]
        `}
        title="缓存监控"
      >
        <Activity size={13} className={hitColor} />
        {latest && (
          <span className={`text-[8px] font-mono font-bold ${hitColor} leading-none mt-0.5`}>
            {Math.round(latest.hitRate)}%
          </span>
        )}
        {/* 新数据脉冲 */}
        {latest && (
          <motion.div
            className="absolute inset-0 rounded-full border border-aether-cyan/30"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            key={latest.requestId}
          />
        )}
      </motion.button>

      {/* 弹窗 */}
      <CacheMonitorModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
