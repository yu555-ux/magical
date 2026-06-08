/**
 * 缓存监控悬浮球 + 弹窗 — 仅 DeepSeek 系列模型可见，可拖拽
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';
import { gameBus } from '../../sillytavern/event-bus';
import type { CacheUsageRecord } from '../../sillytavern/types';
import CacheMonitorModal from './CacheMonitorModal';
import { useSS } from '../../hooks/SillytavernContext';

/** 判断是否为 DeepSeek 系列模型 */
function isDeepSeekModel(model: string | undefined): boolean {
  if (!model) return false;
  return model.toLowerCase().includes('deepseek');
}

export default function CacheMonitorBubble() {
  const { settings } = useSS();
  const [latest, setLatest] = useState<CacheUsageRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(() => isDeepSeekModel(settings?.api?.model));

  // 每当 settings 中的 model 变化时更新可见性
  useEffect(() => {
    setVisible(isDeepSeekModel(settings?.api?.model));
  }, [settings?.api?.model]);

  // 监听 api_usage 事件（同步更新最新模型 & 数据）
  useEffect(() => {
    return gameBus.on('api_usage', ({ record }) => {
      setLatest(record);
      // 以实际使用的模型为准，防止配置变更后悬浮球消失
      if (!visible && isDeepSeekModel(record.model)) setVisible(true);
    });
  }, [visible]);

  const hitColor = !latest
    ? 'text-white/40'
    : latest.hitRate >= 60
      ? 'text-aether-green'
      : latest.hitRate >= 30
        ? 'text-aether-gold'
        : 'text-aether-red';

  if (!visible) return null;

  return (
    <>
      {/* 可拖拽悬浮球 */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.1}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        className="fixed right-3 bottom-24 z-[140]"
      >
        <motion.button
          onClick={() => setOpen(true)}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className={`
            w-10 h-10 rounded-full
            flex flex-col items-center justify-center
            glass-panel hover:border-aether-cyan/60
            transition-all cursor-pointer
            shadow-[0_0_12px_rgba(0,242,255,0.12)]
            hover:shadow-[0_0_20px_rgba(0,242,255,0.25)]
          `}
          title="缓存监控 (DeepSeek)"
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
      </motion.div>

      {/* 弹窗 */}
      <CacheMonitorModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
