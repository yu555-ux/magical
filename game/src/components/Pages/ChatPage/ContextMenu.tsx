import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';

interface Position {
  x: number;
  y: number;
  visible: boolean;
}

interface Props {
  ctxMenu: Position;
  onClose: () => void;
  onViewRaw: () => void;
  onRegenerate: () => void;
}

export default function ContextMenu({ ctxMenu, onClose, onViewRaw, onRegenerate }: Props) {
  return (
    <AnimatePresence>
      {ctxMenu.visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[130]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            className="absolute glass-panel border border-aether-cyan/30 shadow-[0_0_16px_rgba(0,242,255,0.12)] rounded overflow-hidden"
          >
            <button
              onClick={() => { onClose(); onViewRaw(); }}
              className="flex items-center gap-2 px-4 py-2.5 text-[12px] text-white/60 hover:text-aether-cyan hover:bg-aether-cyan/[0.06] transition-all font-display tracking-wide whitespace-nowrap w-full"
            >
              <ChevronRight size={13} />
              查看原文
            </button>
            <button
              onClick={() => { onClose(); onRegenerate(); }}
              className="flex items-center gap-2 px-4 py-2.5 text-[12px] text-white/60 hover:text-aether-purple hover:bg-aether-purple/[0.06] transition-all font-display tracking-wide whitespace-nowrap w-full border-t border-aether-border/10"
            >
              <ChevronRight size={13} />
              重 ROLL
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
