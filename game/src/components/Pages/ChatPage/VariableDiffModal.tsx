import { motion } from 'motion/react';
import { TrendingUp, Plus, Minus, Edit3 } from 'lucide-react';
import type { VarChange } from '../../../sillytavern/types';
import AetherModal from '../../shared/AetherModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  changes: VarChange[];
}

const CAT_META: Record<string, { Icon: any; color: string }> = {
  numeric: { Icon: TrendingUp, color: 'text-aether-green' },
  text:    { Icon: Edit3,       color: 'text-aether-cyan' },
  add:     { Icon: Plus,        color: 'text-aether-cyan' },
  remove:  { Icon: Minus,       color: 'text-red-400/60' },
};

/** 构建 "谁 · 什么变了 + 数值变化" 的完整描述 */
function describe(c: VarChange): string {
  if (c.category === 'remove') {
    return `${c.label} 已移除`;
  }
  if (c.category === 'add') {
    const v = typeof c.newValue === 'number' ? c.newValue : '';
    return `${c.label}${v ? ` → ${v}` : ' 新增'}`;
  }
  if (c.category === 'numeric') {
    const d = c.delta ?? 0;
    const sign = d > 0 ? '+' : '';
    return `${c.label}  ${c.oldValue} → ${c.newValue}  ${sign}${d}`;
  }
  // text
  const oldS = typeof c.oldValue === 'string' ? c.oldValue : '';
  const newS = typeof c.newValue === 'string' ? c.newValue : '';
  if (oldS && newS) return `${c.label}  ${oldS} → ${newS}`;
  return `${c.label} 已变更`;
}

export default function VariableDiffModal({ isOpen, onClose, changes }: Props) {
  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="变量更新">
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-1.5">
        {changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-white/20 font-display text-sm tracking-wide">无变更记录</p>
          </div>
        ) : (
          changes.map((c, i) => {
            const meta = CAT_META[c.category] ?? CAT_META.text;
            const Icon = meta.Icon;
            const isNum = c.category === 'numeric';
            const isRemove = c.category === 'remove';
            const isUp = isNum && (c.delta ?? 0) > 0;
            const isDown = isNum && (c.delta ?? 0) < 0;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                className={`flex items-center gap-3 px-3 md:px-4 py-3 rounded-lg border ${
                  isRemove ? 'border-red-400/10 bg-red-400/[0.02]' :
                  c.category === 'add' ? 'border-aether-cyan/10 bg-aether-cyan/[0.02]' :
                  'border-white/[0.04] bg-white/[0.01]'
                }`}
              >
                <Icon size={14} className={`shrink-0 ${
                  isUp ? 'text-aether-green' :
                  isDown ? 'text-red-400' :
                  isRemove ? 'text-red-400/60' : meta.color
                }`} />
                <span className={`flex-1 text-[12px] md:text-[13px] font-mono leading-relaxed ${
                  isRemove ? 'text-red-400/50' : 'text-white/70'
                }`}>
                  {describe(c)}
                </span>
              </motion.div>
            );
          })
        )}
      </div>
    </AetherModal>
  );
}
