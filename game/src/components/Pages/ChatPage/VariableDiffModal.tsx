import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Plus, Minus, Edit3 } from 'lucide-react';
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

export default function VariableDiffModal({ isOpen, onClose, changes }: Props) {
  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="变量变更">
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
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                className={`flex items-center gap-3 px-3 md:px-4 py-2.5 rounded-lg border ${
                  isRemove ? 'border-red-400/10 bg-red-400/[0.02]' :
                  c.category === 'add' ? 'border-aether-cyan/10 bg-aether-cyan/[0.02]' :
                  'border-white/[0.04] bg-white/[0.01]'
                }`}
              >
                <div className={`shrink-0 ${isUp ? 'text-aether-green' : isRemove ? 'text-red-400/60' : meta.color}`}>
                  <Icon size={isNum ? 15 : 13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] md:text-[12px] font-display tracking-wide text-white/65 truncate">{c.label}</p>
                </div>
                <div className="shrink-0 text-right">
                  {isRemove ? (
                    <span className="text-[10px] font-mono text-red-400/50">已移除</span>
                  ) : isNum ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-white/25">{c.oldValue}</span>
                      <span className="text-[9px] text-white/10">→</span>
                      <span className={`text-[11px] font-display font-bold ${isUp ? 'text-aether-green' : 'text-red-400'}`}>{c.newValue}</span>
                      <span className={`text-[9px] font-mono ml-0.5 ${isUp ? 'text-aether-green/60' : 'text-red-400/60'}`}>
                        {isUp ? '+' : ''}{c.delta}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-aether-cyan/60">
                      {c.category === 'add' ? (typeof c.newValue === 'number' ? c.newValue : '新增') : '变更'}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
      <div className="shrink-0 px-4 py-2.5 border-t border-aether-cyan/10 bg-aether-cyan/[0.01] flex items-center justify-between">
        <span className="text-[9px] font-mono text-white/20">共 {changes.length} 项变更</span>
        <button onClick={onClose} className="text-[10px] font-display tracking-wider text-aether-cyan/50 hover:text-aether-cyan transition-colors">关闭</button>
      </div>
    </AetherModal>
  );
}
