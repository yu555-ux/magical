/**
 * ShopBubble — 柳三娘商店入口，可拖动气泡。
 *
 * - 固定定位，可自由拖动（仿 StatusBell）
 * - 默认紧凑 pill，hover 展开显示 NPC 台词
 * - 铜绿色调，贴合赶尸人身份
 */

import { useState, useMemo } from 'react';
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
  const [hovered, setHovered] = useState(false);
  const line = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], []);

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
          whileDrag={{ scale: 1.06, cursor: 'grabbing' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="fixed top-28 right-5 z-[85] select-none"
          style={{ touchAction: 'none' }}
        >
          <motion.button
            onClick={onOpenShop}
            animate={{
              width: hovered ? 'auto' : undefined,
              paddingLeft: hovered ? 16 : 10,
              paddingRight: hovered ? 16 : 10,
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
              overflow-hidden
              whitespace-nowrap
            "
          >
            {/* Pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400/50 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400/80" />
            </span>

            {/* Name — always visible */}
            <span className="text-[11px] text-teal-200/85 font-display tracking-[0.06em] shrink-0">
              柳三娘
            </span>

            {/* Expanded content */}
            <motion.span
              animate={{
                opacity: hovered ? 1 : 0,
                width: hovered ? 'auto' : 0,
                marginLeft: hovered ? 0 : -8,
              }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <span className="w-px h-3 bg-teal-500/20 shrink-0" />
              <span className="text-[11px] text-white/40 font-display tracking-[0.03em] max-w-[160px] truncate">
                「{line}」
              </span>
              <span className="text-[10px] text-teal-400/40 font-display tracking-[0.08em] shrink-0">
                看看
              </span>
            </motion.span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
