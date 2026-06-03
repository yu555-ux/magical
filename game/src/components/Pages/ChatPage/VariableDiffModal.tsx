import { motion } from 'motion/react';
import type { VarChange } from '../../../sillytavern/types';
import AetherModal from '../../shared/AetherModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  changes: VarChange[];
}

function describe(c: VarChange): { text: string; color: string } {
  if (c.category === 'remove') {
    return { text: `${c.label} 已移除`, color: 'text-red-400/50' };
  }
  if (c.category === 'add') {
    const v = typeof c.newValue === 'number' ? ` → ${c.newValue}` : '';
    return { text: `${c.label}${v}`, color: 'text-aether-cyan/70' };
  }
  if (c.category === 'numeric') {
    const d = c.delta ?? 0;
    const sign = d > 0 ? '+' : '';
    const color = d > 0 ? 'text-aether-green' : d < 0 ? 'text-red-400' : 'text-white/70';
    return { text: `${c.label}  ${c.oldValue} → ${c.newValue}  ${sign}${d}`, color };
  }
  const oldS = typeof c.oldValue === 'string' ? c.oldValue : '';
  const newS = typeof c.newValue === 'string' ? c.newValue : '';
  if (oldS && newS) return { text: `${c.label}  ${oldS} → ${newS}`, color: 'text-white/60' };
  return { text: `${c.label} 已变更`, color: 'text-white/50' };
}

export default function VariableDiffModal({ isOpen, onClose, changes }: Props) {
  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="变量更新">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-0.5">
        {changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-white/20 font-display text-sm tracking-wide">本次无变量更新</p>
          </div>
        ) : (
          changes.map((c, i) => {
            const d = describe(c);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <span className="w-1 h-1 rounded-full shrink-0 bg-current opacity-40" />
                <span className={`text-[13px] md:text-[14px] font-mono leading-relaxed ${d.color}`}>
                  {d.text}
                </span>
              </motion.div>
            );
          })
        )}
      </div>
    </AetherModal>
  );
}
