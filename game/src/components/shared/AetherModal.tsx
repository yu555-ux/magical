import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  zIndex?: number;
  maxWidth?: string;
  icon?: React.ReactNode;
}

export default function AetherModal({ isOpen, onClose, title, children, zIndex = 140, maxWidth = '780px', icon }: Props) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center p-3 md:p-4" style={{ zIndex }}>
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
          className="relative w-full max-h-[92vh] md:max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
                     shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
          style={{ maxWidth }}
        >
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />
          <div className="absolute top-0 left-0 right-0 h-[40px] bg-gradient-to-b from-aether-cyan/[0.03] to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between px-3 md:px-6 py-3 md:py-4.5 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              {icon ?? (
                <div className="relative shrink-0">
                  <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                  <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" />
                </div>
              )}
              <h2 className="font-display font-black text-xs md:text-sm tracking-[0.15em] text-aether-cyan/90 uppercase truncate">{title}</h2>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-aether-cyan transition-colors p-2 md:p-1.5 shrink-0">
              <X size={18} />
            </button>
          </div>

          {children}

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
