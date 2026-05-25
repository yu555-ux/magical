import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings2 } from 'lucide-react';
import type { PresetParamsCardProps } from './types';
import type { PresetParams } from '../../../sillytavern/types';

function NumberField({ label, value, onChange, step = 1, min, max }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  return (
    <label className="flex items-center gap-2 bg-aether-dark/40 border border-aether-border/15 rounded px-2 py-1">
      <span className="text-[9px] text-white/20 shrink-0 font-mono">{label}</span>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        step={step} min={min} max={max}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-white/55 focus:outline-none text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
    </label>
  );
}

function CheckField({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="accent-aether-purple h-3 w-3 shrink-0" />
      <span className={`text-[9px] font-mono transition-colors ${checked ? 'text-white/40' : 'text-white/15'}`}>{label}</span>
    </label>
  );
}

export default function PresetParamsCard({ params, onChange }: PresetParamsCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className={`rounded-lg border mb-3 overflow-hidden transition-all ${
      expanded ? 'border-aether-purple/20 bg-aether-dark/30' : 'border-aether-border/10 bg-aether-dark/20'
    }`}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-aether-purple/[0.03] transition-colors">
        <Settings2 size={14} className="text-aether-purple/40 shrink-0" />
        <span className="text-xs font-display font-medium text-white/55">预设参数</span>
        <span className="text-[9px] text-white/15 ml-auto">{expanded ? '▴ 收起' : '▾ 展开'}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden border-t border-aether-border/8">
            <div className="px-3 py-3 space-y-3">
              <div>
                <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">采样参数</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                  <NumberField label="温度" value={params.temperature} onChange={v => onChange({ temperature: v })} step={0.1} min={0} max={2} />
                  <NumberField label="Top P" value={params.top_p} onChange={v => onChange({ top_p: v })} step={0.05} min={0} max={1} />
                  <NumberField label="Top K" value={params.top_k} onChange={v => onChange({ top_k: v })} min={0} max={1000} />
                  <NumberField label="Top A" value={params.top_a} onChange={v => onChange({ top_a: v })} step={0.05} min={0} max={1} />
                  <NumberField label="Min P" value={params.min_p} onChange={v => onChange({ min_p: v })} step={0.05} min={0} max={1} />
                  <NumberField label="频率惩罚" value={params.frequency_penalty} onChange={v => onChange({ frequency_penalty: v })} step={0.1} min={-2} max={2} />
                  <NumberField label="存在惩罚" value={params.presence_penalty} onChange={v => onChange({ presence_penalty: v })} step={0.1} min={-2} max={2} />
                  <NumberField label="重复惩罚" value={params.repetition_penalty} onChange={v => onChange({ repetition_penalty: v })} step={0.1} min={1} max={2} />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">上下文</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                  <NumberField label="最大上下文" value={params.openai_max_context} onChange={v => onChange({ openai_max_context: v })} min={1000} max={4000000} />
                  <NumberField label="最大输出Token" value={params.openai_max_tokens} onChange={v => onChange({ openai_max_tokens: v })} min={256} max={128000} />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">选项</span>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <CheckField label="流式输出" checked={params.stream_openai} onChange={v => onChange({ stream_openai: v })} />
                  <CheckField label="引号包裹" checked={params.wrap_in_quotes} onChange={v => onChange({ wrap_in_quotes: v })} />
                  <CheckField label="解锁上下文" checked={params.max_context_unlocked} onChange={v => onChange({ max_context_unlocked: v })} />
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/20">名字行为</span>
                    <input type="number" value={params.names_behavior}
                      onChange={e => onChange({ names_behavior: Number(e.target.value) })}
                      className="w-14 bg-aether-dark/60 border border-aether-border/25 rounded px-1.5 py-0.5 text-[10px] text-white/55 focus:outline-none focus:border-aether-purple/50 transition-all" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
