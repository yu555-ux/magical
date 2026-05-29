/**
 * ShopBubble — 柳三娘商店入口，可拖动气泡。
 *
 * - 固定定位，可自由拖动
 * - 悬停 1.5 秒后展开对话，离开 1.5 秒后收起
 * - 拖动时不展开，立即收起
 * - 铜绿色调，紧凑 pill 形态
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ShopBannerProps {
  visible: boolean;
  onOpenShop: () => void;
}

const LINES = [
  '来客人了？随便看看。',
  '货都在这儿了，尸气带够了没？',
  '压箱底的好东西，不买别碰。',
  '别傻站着，要买就买。',
];

export default function ShopBanner({ visible, onOpenShop }: ShopBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const expandRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const line = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], []);

  const clearBoth = useCallback(() => {
    if (expandRef.current) { clearTimeout(expandRef.current); expandRef.current = null; }
    if (collapseRef.current) { clearTimeout(collapseRef.current); collapseRef.current = null; }
  }, []);

  const onEnter = useCallback(() => {
    if (dragging) return;
    // Cancel any pending collapse
    if (collapseRef.current) { clearTimeout(collapseRef.current); collapseRef.current = null; }
    // If already expanded, stay expanded — no need to restart timer
    // Start expand timer (won't hurt if already expanded, setExpanded(true) is idempotent)
    expandRef.current = setTimeout(() => setExpanded(true), 1500);
  }, [dragging]);

  const onLeave = useCallback(() => {
    // Cancel pending expand
    if (expandRef.current) { clearTimeout(expandRef.current); expandRef.current = null; }
    // If not yet expanded, just collapse
    setExpanded(prev => {
      if (!prev) return false;
      // Already expanded — start collapse delay
      collapseRef.current = setTimeout(() => setExpanded(false), 1500);
      return true;
    });
  }, []);

  const onDragStart = useCallback(() => {
    setDragging(true);
    clearBoth();
    setExpanded(false);
  }, [clearBoth]);

  const onDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          drag
          dragMomentum={false}
          dragElastic={0.08}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          whileDrag={{ scale: 1.06, cursor: 'grabbing' }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          className="fixed top-28 right-5 z-[85] select-none"
          style={{ touchAction: 'none' }}
        >
          <motion.button
            onClick={onOpenShop}
            animate={{
              paddingLeft: expanded ? 16 : 10,
              paddingRight: expanded ? 16 : 10,
            }}
            className="
              flex items-center gap-2
              h-9
              rounded-full
              bg-teal-950/70 backdrop-blur-lg
              border border-teal-500/20
              shadow-[0_2px_16px_rgba(0,0,0,0.35),0_0_0_1px_rgba(20,184,166,0.06)]
              hover:bg-teal-950/85 hover:border-teal-500/30
              hover:shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(20,184,166,0.12)]
              transition-all duration-300
              cursor-grab active:cursor-grabbing
              overflow-hidden whitespace-nowrap
            "
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400/50 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400/80" />
            </span>

            <span className="text-[11px] text-teal-200/85 font-display tracking-[0.06em] shrink-0">
              柳三娘
            </span>

            <motion.span
              animate={{
                opacity: expanded ? 1 : 0,
                width: expanded ? 'auto' : 0,
                marginLeft: expanded ? 0 : -8,
              }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <span className="w-px h-3 bg-teal-500/20 shrink-0" />
              <span className="text-[11px] text-white/40 font-display tracking-[0.03em] max-w-[160px] truncate">
                「{line}」
              </span>
            </motion.span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
