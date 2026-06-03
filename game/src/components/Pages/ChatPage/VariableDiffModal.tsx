import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Plus, Minus, Edit3 } from 'lucide-react';
import type { VarChange } from '../../../sillytavern/types';
import AetherModal from '../../shared/AetherModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  changes: VarChange[];
}

/* 每类变更的样式 */
const STYLE = {
  numericUp:   { icon: TrendingUp,   bar: 'bg-aether-green/30',  text: 'text-aether-green' },
  numericDown: { icon: TrendingDown,  bar: 'bg-red-400/30',       text: 'text-red-400' },
  add:         { icon: Plus,          bar: 'bg-aether-cyan/30',   text: 'text-aether-cyan' },
  remove:      { icon: Minus,         bar: 'bg-red-400/20',       text: 'text-red-400/60' },
  text:        { icon: Edit3,         bar: 'bg-amber-400/20',     text: 'text-amber-300/70' },
};

function styleOf(c: VarChange) {
  if (c.category === 'remove') return STYLE.remove;
  if (c.category === 'add')    return STYLE.add;
  if (c.category === 'numeric') return (c.delta ?? 0) >= 0 ? STYLE.numericUp : STYLE.numericDown;
  return STYLE.text;
}

function fmt(v: any): string {
  if (typeof v === 'string') return v.length > 40 ? v.slice(0, 40) + '…' : v;
  if (typeof v === 'number') return String(v);
  if (v === null || v === undefined) return '—';
  return JSON.stringify(v).slice(0, 40);
}

export default function VariableDiffModal({ isOpen, onClose, changes }: Props) {
  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="变量更新" zIndex={200}>
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-1">
        {changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border border-white/[0.06] flex items-center justify-center bg-white/[0.01] mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
            <p className="text-white/15 font-display text-xs tracking-[0.1em]">本次无变量更新</p>
          </div>
        ) : (
          changes.map((c, i) => {
            const s = styleOf(c);
            const Icon = s.icon;
            const isNum = c.category === 'numeric';
            const isRemove = c.category === 'remove';
            const isAdd = c.category === 'add';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                className="flex items-stretch rounded-md overflow-hidden border border-white/[0.04] bg-white/[0.01]"
              >
                {/* 左侧色条 */}
                <div className={`w-1 shrink-0 ${s.bar}`} />

                <div className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0">
                  {/* 图标 */}
                  <Icon size={14} className={`shrink-0 ${s.text} opacity-70`} />

                  {/* 描述 */}
                  <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-display tracking-wide text-white/65 truncate">
                      {c.label}
                    </span>

                    {/* 值变化 */}
                    <span className="text-[13px] font-mono whitespace-nowrap">
                      {isRemove ? (
                        <span className="text-red-400/50">已移除</span>
                      ) : isAdd ? (
                        <span className="text-aether-cyan/70">{fmt(c.newValue)}</span>
                      ) : isNum ? (
                        <>
                          <span className="text-white/30">{fmt(c.oldValue)}</span>
                          <span className="text-white/15 mx-1">→</span>
                          <span className={s.text}>{fmt(c.newValue)}</span>
                          <span className={`ml-1.5 ${s.text} opacity-70`}>
                            {(c.delta ?? 0) > 0 ? '+' : ''}{c.delta}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-white/30 line-clamp-1">{fmt(c.oldValue)}</span>
                          <span className="text-white/15 mx-1">→</span>
                          <span className="text-amber-300/70 line-clamp-1">{fmt(c.newValue)}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </AetherModal>
  );
}
