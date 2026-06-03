import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, TrendingDown, Plus, Minus, Edit3 } from 'lucide-react';
import type { VarChange } from '../../../sillytavern/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  changes: VarChange[];
}

const ACCENT = 'rgba(0,242,255,1)';

function describe(c: VarChange): { text: string; color: string; Icon: any; glow: string } {
  if (c.category === 'remove') {
    return { text: `${c.label} 已移除`, color: '#f87171', Icon: Minus, glow: 'rgba(248,113,113,0.15)' };
  }
  if (c.category === 'add') {
    const v = typeof c.newValue === 'number' ? ` → ${c.newValue}` : ' 新增';
    return { text: `${c.label}${v}`, color: '#00f2ff', Icon: Plus, glow: 'rgba(0,242,255,0.08)' };
  }
  if (c.category === 'numeric') {
    const d = c.delta ?? 0;
    const up = d > 0;
    return {
      text: `${c.label}  ${c.oldValue} → ${c.newValue}  ${up ? '+' : ''}${d}`,
      color: up ? '#4ade80' : d < 0 ? '#f87171' : '#e2e8f0',
      Icon: up ? TrendingUp : TrendingDown,
      glow: up ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
    };
  }
  const oldS = typeof c.oldValue === 'string' ? c.oldValue : '';
  const newS = typeof c.newValue === 'string' ? c.newValue : '';
  const t = oldS && newS ? `${c.label}  ${oldS} → ${newS}` : `${c.label} 已变更`;
  return { text: t, color: '#94a3b8', Icon: Edit3, glow: 'rgba(0,242,255,0.04)' };
}

export default function VariableDiffModal({ isOpen, onClose, changes }: Props) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 200 }}>
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[420px] max-h-[72vh] flex flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(8,16,24,0.98) 0%, rgba(4,8,14,0.99) 100%)',
            border: '1px solid rgba(0,242,255,0.12)',
            boxShadow: `0 0 0 1px rgba(0,242,255,0.03), 0 8px 48px rgba(0,0,0,0.6), 0 0 80px rgba(0,242,255,0.04)`,
          }}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(0,242,255,0.5)] to-transparent" />

          {/* Header */}
          <div className="relative shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-[#00f2ff] shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[#00f2ff] animate-ping opacity-20" />
              </div>
              <h2 className="font-display font-black text-xs md:text-sm tracking-[0.15em] text-[#00f2ff]/90 uppercase">变量更新</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/25 hover:text-[#00f2ff] transition-colors p-1.5 rounded hover:bg-white/[0.04]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-1">
            {changes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 rounded-full border border-white/[0.06] flex items-center justify-center bg-white/[0.01]">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                </div>
                <p className="text-white/15 font-display text-xs tracking-[0.1em]">本次无变量更新</p>
              </div>
            ) : (
              changes.map((c, i) => {
                const d = describe(c);
                const Icon = d.Icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25, ease: 'easeOut' }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-white/[0.02]"
                    style={{ background: `linear-gradient(90deg, ${d.glow}, transparent)` }}
                  >
                    <Icon size={14} style={{ color: d.color, opacity: 0.8 }} className="shrink-0" />
                    <span
                      className="text-[13px] md:text-[14px] font-mono leading-relaxed"
                      style={{ color: d.color, opacity: 0.85 }}
                    >
                      {d.text}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
