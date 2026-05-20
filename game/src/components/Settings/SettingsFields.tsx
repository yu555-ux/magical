import { useState } from 'react';
import { ChevronRight, Hash, Loader2 } from 'lucide-react';

export function SectionHeader({ icon: Icon, label, accent }: { icon: any; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-1 h-5 rounded-full ${accent}`} />
      <Icon size={16} className={accent.replace('bg-', 'text-')} />
      <span className="font-display text-xs tracking-widest uppercase text-white/50">{label}</span>
    </div>
  );
}

export function InputRow({ label, value, onChange, placeholder, type = 'text', hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-medium text-white/40 mb-1.5 tracking-wide uppercase">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/15
                   focus:outline-none focus:border-aether-cyan/60 focus:ring-1 focus:ring-aether-cyan/30 transition-all font-mono" />
      {hint && <span className="block text-[10px] text-white/25 mt-1">{hint}</span>}
    </label>
  );
}

export function TextAreaRow({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-medium text-white/40 mb-1.5 tracking-wide uppercase">{label}</span>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/15
                   focus:outline-none focus:border-aether-cyan/60 focus:ring-1 focus:ring-aether-cyan/30 transition-all resize-none" />
    </label>
  );
}

export function StatPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-aether-cyan/15 text-aether-cyan px-1.5 py-0.5 rounded-full font-mono">
      <Hash size={9} />{count}
    </span>
  );
}

export function ActionButton({ busy, onClick, label, variant }: {
  busy: boolean; onClick: () => void; label: string; variant?: 'primary' | 'secondary';
}) {
  const isSecondary = variant === 'secondary';
  return (
    <button onClick={onClick} disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide transition-all disabled:opacity-40 ${
        isSecondary
          ? 'border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-border/50'
          : 'bg-aether-cyan/15 border border-aether-cyan/30 text-aether-cyan hover:bg-aether-cyan/25'
      }`}>
      {busy && <Loader2 size={12} className="animate-spin" />}
      {label}
      {!busy && !isSecondary && <ChevronRight size={12} />}
    </button>
  );
}

export function NumField({ label, value, onChange, step, min, max, fallback }: {
  label: string; value: number | undefined; onChange: (n: number) => void;
  step?: number; min?: number; max?: number; fallback: number;
}) {
  return (
    <label className="flex-1 min-w-[130px]">
      <span className="block text-[10px] text-white/30 mb-1">{label}</span>
      <input type="number" step={step ?? 1} value={value ?? fallback}
        onChange={e => { const n = Number(e.target.value); if (!isNaN(n)) onChange(Math.min(max ?? 1e9, Math.max(min ?? -1e9, n))); }}
        className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1.5 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-purple/60" />
    </label>
  );
}

export function ChipInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) { setDraft(''); return; }
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <label className="block">
      <span className="block text-[10px] text-white/30 mb-1">{label}</span>
      <div className="flex flex-wrap gap-1.5 bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 min-h-[34px]
                      focus-within:border-aether-cyan/60 transition-all">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-aether-cyan/10 border border-aether-cyan/20 text-aether-cyan/70 px-2 py-0.5 rounded font-mono">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-aether-cyan/40 hover:text-aether-red transition-colors">&times;</button>
          </span>
        ))}
        <input type="text" value={draft} placeholder={values.length === 0 ? (placeholder ?? '输入后回车添加') : ''}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          onBlur={add}
          className="bg-transparent border-none outline-none text-xs text-white/60 placeholder:text-white/15 flex-1 min-w-[80px] py-0.5" />
      </div>
    </label>
  );
}
