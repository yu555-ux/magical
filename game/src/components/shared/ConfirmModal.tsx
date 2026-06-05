import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ACCENT = {
  danger:  { color: '#ef4444', glow: 'rgba(239,68,68,0.12)',   glowStrong: 'rgba(239,68,68,0.25)' },
  default: { color: '#00f2ff', glow: 'rgba(0,242,255,0.10)',   glowStrong: 'rgba(0,242,255,0.22)' },
};

export default function ConfirmModal({ isOpen, title, message, confirmLabel = '确认', variant = 'default', onConfirm, onCancel }: Props) {
  if (!isOpen) return null;

  const a = ACCENT[variant] ?? ACCENT.default;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 200 }}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-aether-dark/94 backdrop-blur-xl"
        />

        {/* Dialog card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-[90vw] max-w-[380px] overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(18,22,26,0.96) 0%, rgba(13,17,21,0.98) 100%)',
            backdropFilter: 'blur(40px)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.05),
              0 0 48px ${a.glow},
              0 24px 64px rgba(0,0,0,0.5)
            `,
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-px w-full shrink-0"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${a.color}35 15%, ${a.color}55 50%, ${a.color}35 85%, transparent 100%)`,
            }}
          />

          <div className="p-6 md:p-7 space-y-5">
            {/* Title */}
            <h3 className="text-[16px] md:text-[17px] font-display font-bold text-white/85 tracking-[0.04em]">
              {title}
            </h3>

            {/* Message */}
            <p className="text-[13px] md:text-[14px] text-white/45 leading-relaxed font-sans tracking-[0.02em]">
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {/* Cancel */}
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-xl text-[13px] font-display tracking-[0.05em]
                           border border-white/[0.08] text-white/40
                           hover:text-white/60 hover:border-white/[0.14] hover:bg-white/[0.03]
                           active:scale-[0.98]
                           transition-all duration-200"
              >
                取消
              </button>

              {/* Confirm */}
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-3 rounded-xl text-[13px] font-display font-bold tracking-[0.05em]
                           transition-all duration-200
                           active:scale-[0.98]"
                style={{
                  background: `${a.color}1a`,
                  border: `1px solid ${a.color}38`,
                  color: a.color,
                  boxShadow: `0 0 24px ${a.glow}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${a.color}2c`;
                  e.currentTarget.style.borderColor = `${a.color}55`;
                  e.currentTarget.style.boxShadow = `0 0 36px ${a.glowStrong}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${a.color}1a`;
                  e.currentTarget.style.borderColor = `${a.color}38`;
                  e.currentTarget.style.boxShadow = `0 0 24px ${a.glow}`;
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
