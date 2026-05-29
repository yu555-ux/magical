/**
 * ShopBanner — 柳三娘商店入口浮层。
 *
 * 当玩家位于梦境301室且交易已解锁时，在聊天消息区顶部浮现。
 * 暖金色配色，与系统冷青蓝色主题形成区分。
 */

import { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Sparkles } from 'lucide-react';

interface ShopBannerProps {
  visible: boolean;
  onOpenShop: () => void;
}

const NPC_LINES = [
  '来客人了？随便看看，不买别碰。',
  '哟，又来照顾三娘生意了？',
  '货都在这儿了。尸气带够了没？',
  '这些可都是三娘压箱底的好东西……',
  '别傻站着，要买就买，不买就别耽误我抽烟。',
];

/** 每次 visible 变化时重新随机选一条台词 */
function useRandomLine(visible: boolean): string {
  const lineRef = useRef(NPC_LINES[0]);

  const line = useMemo(() => {
    if (visible) {
      const idx = Math.floor(Math.random() * NPC_LINES.length);
      lineRef.current = NPC_LINES[idx];
    }
    return lineRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return line;
}

export default function ShopBanner({ visible, onOpenShop }: ShopBannerProps) {
  const npcLine = useRandomLine(visible);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0, y: -8 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden shrink-0"
        >
          <div
            className="
              mx-3 my-2 px-4 py-2.5
              flex items-center gap-3
              bg-gradient-to-r from-amber-950/20 via-amber-900/10 to-transparent
              backdrop-blur-sm
              border border-amber-500/15
              rounded-lg
              shadow-[0_0_20px_rgba(245,158,11,0.04),inset_0_1px_0_rgba(245,158,11,0.06)]
              relative overflow-hidden
            "
          >
            {/* Left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-amber-400/60 via-amber-500/30 to-transparent rounded-r-full" />

            {/* Subtle top highlight line */}
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-amber-400/20 via-amber-300/10 to-transparent" />

            {/* Icon */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-md" />
              <Sparkles
                size={16}
                className="text-amber-400/80 relative z-10"
                strokeWidth={1.5}
              />
            </div>

            {/* NPC flavor text */}
            <span className="flex-1 text-[13px] text-amber-200/70 font-display tracking-[0.06em] leading-relaxed min-w-0">
              <span className="text-amber-400/50 text-[11px] tracking-[0.12em] uppercase mr-1.5">
                柳三娘
              </span>
              「{npcLine}」
            </span>

            {/* Browse button */}
            <motion.button
              onClick={onOpenShop}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="
                shrink-0
                flex items-center gap-1.5
                px-3.5 py-1.5
                rounded-full
                bg-amber-500/12
                border border-amber-500/25
                text-amber-300 text-[12px] font-display tracking-[0.08em]
                hover:bg-amber-500/20 hover:border-amber-400/40 hover:text-amber-200
                active:bg-amber-500/25
                transition-all duration-200
                animate-glow-breathe
                group
                cursor-pointer
                select-none
              "
            >
              <ShoppingBag
                size={13}
                className="text-amber-400/70 group-hover:text-amber-300 transition-colors"
                strokeWidth={1.5}
              />
              <span>浏览商品</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
