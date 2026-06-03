import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ isOpen, title, message, confirmLabel = '确认', variant = 'default', onConfirm, onCancel }: Props) {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const accent = isDanger ? 'rgba(239, 68, 68, 1)' : 'rgba(0, 242, 255, 1)';
  const accentName = isDanger ? 'red' : 'aether-cyan';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 200 }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-aether-dark/94 backdrop-blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[400px] glass-panel border overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]"
          style={{ borderColor: `${accent}20` }}
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0"
                style={{ borderColor: `${accent}30`, background: `${accent}08` }}>
                <AlertTriangle size={17} style={{ color: accent, opacity: 0.8 }} />
              </div>
              <h3 className="font-display font-bold text-[15px] text-white/85 tracking-wide">{title}</h3>
            </div>

            <p className="text-[13px] text-white/50 leading-relaxed font-mono">{message}</p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/[0.06] text-[12px] text-white/40 hover:text-white/60 hover:bg-white/[0.03] transition-all font-display tracking-wide"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-display tracking-wide transition-all"
                style={{
                  background: `${accent}12`,
                  border: `1px solid ${accent}25`,
                  color: accent,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${accent}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${accent}12`;
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
