import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  edited: string;
  onEditedChange: (v: string) => void;
  onApply: () => void;
  dirty: boolean;
}

export default function RawXmlViewerModal({ isOpen, onClose, content, edited, onEditedChange, onApply, dirty }: Props) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-aether-dark/92 backdrop-blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[780px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
                     shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
        >
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />
          <div className="absolute top-0 left-0 right-0 h-[40px] bg-gradient-to-b from-aether-cyan/[0.03] to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between px-6 py-4.5 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" />
              </div>
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">原始输出</h2>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-aether-cyan transition-colors p-1.5">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            <textarea
              value={edited}
              onChange={(e) => onEditedChange(e.target.value)}
              className="flex-1 min-h-[200px] text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed font-mono bg-aether-dark/40 border border-aether-border/15 rounded-lg p-4 resize-none focus:outline-none focus:border-aether-cyan/50 focus:ring-1 focus:ring-aether-cyan/20 transition-all"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/20">点击文本框可直接编辑原始输出</span>
              <button
                onClick={onApply}
                disabled={!dirty}
                className={`px-4 py-2 rounded text-xs font-display tracking-wide transition-all ${
                  dirty
                    ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_12px_rgba(0,242,255,0.25)] hover:shadow-[0_0_20px_rgba(0,242,255,0.4)]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                应用修改
              </button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
