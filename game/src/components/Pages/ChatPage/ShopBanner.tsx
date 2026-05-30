/**
 * ShopBubble — 柳三娘商店入口，可拖动气泡。
 *
 * - 固定定位，可自由拖动
 * - 鼠标移入即时展开，移出 0.5s 后收起
 * - 拖动时不展开，立即收起
 * - 好感 ≥ 0：铜绿色调，随机招呼
 * - 好感 < 0：红灯，拒绝口吻
 * - layout 动画消除卡顿感
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ShopBannerProps {
  visible: boolean;
  favorability?: number;
  onOpenShop: () => void;
}

const WELCOME_LINES = [
  '来客人了？随便看看。',
  '货都在这儿了，尸气带够了没？',
  '压箱底的好东西，不买别碰。',
  '别傻站着，要买就买。',
];

const REJECT_LINES = [
  '哼，你也配进老娘的门？',
  '赶紧走远些，我的东西不卖你。',
  '别在这儿碍眼，回去把脸色摆正了再来。',
  '连个好脸都不给，还想占老娘的便宜？',
];

export default function ShopBanner({ visible, favorability = 0, onOpenShop }: ShopBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const collapseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rejected = favorability < 0;
  const lines = rejected ? REJECT_LINES : WELCOME_LINES;
  const line = useMemo(() => lines[Math.floor(Math.random() * lines.length)], [lines]);

  const clearCollapse = useCallback(() => {
    if (collapseRef.current) { clearTimeout(collapseRef.current); collapseRef.current = null; }
  }, []);

  const onEnter = useCallback(() => {
    if (dragging) return;
    clearCollapse();
    setExpanded(true);
  }, [dragging, clearCollapse]);

  const onLeave = useCallback(() => {
    if (dragging) return;
    collapseRef.current = setTimeout(() => setExpanded(false), 500);
  }, [dragging]);

  const onDragStart = useCallback(() => {
    setDragging(true);
    clearCollapse();
    setExpanded(false);
  }, [clearCollapse]);

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
            layout
            onClick={onOpenShop}
            className={`
              flex items-center gap-2 h-9 rounded-full
              backdrop-blur-lg border
              overflow-hidden whitespace-nowrap px-2.5
              cursor-grab active:cursor-grabbing
              ${rejected
                ? 'bg-red-950/70 border-red-500/20 hover:bg-red-950/85 hover:border-red-500/30 shadow-[0_2px_16px_rgba(0,0,0,0.35),0_0_0_1px_rgba(239,68,68,0.06)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(239,68,68,0.12)]'
                : 'bg-teal-950/70 border-teal-500/20 hover:bg-teal-950/85 hover:border-teal-500/30 shadow-[0_2px_16px_rgba(0,0,0,0.35),0_0_0_1px_rgba(20,184,166,0.06)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(20,184,166,0.12)]'
              }
            `}
            style={{ transition: 'background-color 0.3s, border-color 0.3s, box-shadow 0.3s' }}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${rejected ? 'bg-red-400/50' : 'bg-teal-400/50'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${rejected ? 'bg-red-400/80' : 'bg-teal-400/80'}`} />
            </span>

            <span className={`text-[11px] font-display tracking-[0.06em] shrink-0 ${rejected ? 'text-red-200/85' : 'text-teal-200/85'}`}>
              柳三娘
            </span>

            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <span className={`w-px h-3 shrink-0 ${rejected ? 'bg-red-500/20' : 'bg-teal-500/20'}`} />
                  <span className={`text-[11px] font-display tracking-[0.03em] max-w-[160px] truncate ${rejected ? 'text-red-300/50' : 'text-white/40'}`}>
                    「{line}」
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
