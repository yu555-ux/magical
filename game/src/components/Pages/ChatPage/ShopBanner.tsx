/**
 * ShopBanner — 柳三娘商店入口气泡。
 *
 * 当交易条件满足时，在聊天区底部浮现一枚半透明气泡。
 * 铜绿色调，贴合赶尸人的阴冷身份。
 */

import { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ShopBannerProps {
  visible: boolean;
  onOpenShop: () => void;
}

const NPC_LINES = [
  '来客人了？随便看看。',
  '货都在这儿了，尸气带够了没？',
  '这些可都是三娘压箱底的好东西。',
];

function useRandomLine(visible: boolean): string {
  const lineRef = useRef(NPC_LINES[0]);
  useMemo(() => {
    if (visible) {
      lineRef.current = NPC_LINES[Math.floor(Math.random() * NPC_LINES.length)];
    }
  }, [visible]);
  return lineRef.current;
}

export default function ShopBanner({ visible, onOpenShop }: ShopBannerProps) {
  const npcLine = useRandomLine(visible);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.94 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-4 right-4 z-20 pointer-events-auto"
        >
          <button
            onClick={onOpenShop}
            className="
              group
              flex items-center gap-2.5
              px-4 py-2.5
              rounded-2xl
              bg-teal-950/60 backdrop-blur-md
              border border-teal-500/15
              shadow-[0_4px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(20,184,166,0.08)]
              hover:bg-teal-950/75 hover:border-teal-500/25
              hover:shadow-[0_4px_28px_rgba(0,0,0,0.5),0_0_0_1px_rgba(20,184,166,0.15)]
              active:scale-[0.97]
              transition-all duration-300
              cursor-pointer select-none
            "
          >
            {/* Subtle glow dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400/70" />
            </span>

            {/* Text */}
            <span className="text-[12px] text-teal-200/80 font-display tracking-[0.05em] leading-none">
              柳三娘
            </span>

            <span className="w-px h-3.5 bg-teal-500/15" />

            <span className="text-[12px] text-white/45 font-display tracking-[0.04em] leading-none max-w-[180px] truncate">
              「{npcLine}」
            </span>

            {/* Arrow hint */}
            <span className="text-teal-400/30 text-[11px] font-display tracking-[0.08em] group-hover:text-teal-400/50 transition-colors">
              看看
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
