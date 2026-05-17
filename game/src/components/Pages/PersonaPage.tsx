import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  MOCK_SKILLS,
  MOCK_ITEMS,
} from '../../mockData';
import {
  Shield,
  Database,
  Diamond,
} from 'lucide-react';
import { Modal } from '../Feedback';
import type { Skill, Item } from '../../types';

/* ==============================================================
   TYPE / CONSTANT HELPERS
   ============================================================== */

const RANK_STYLES: Record<
  string,
  { text: string; border: string; glow: string; bg: string }
> = {
  S: { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]', bg: 'bg-amber-400/10' },
  A: { text: 'text-purple-400', border: 'border-purple-400/50', glow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)]', bg: 'bg-purple-400/10' },
  B: { text: 'text-blue-400',  border: 'border-blue-400/50',  glow: 'shadow-[0_0_12px_rgba(96,165,250,0.35)]',  bg: 'bg-blue-400/10' },
  C: { text: 'text-gray-400', border: 'border-gray-400/40', glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]', bg: 'bg-gray-400/10' },
};

const RARITY_STYLES: Record<string, { text: string; border: string; glow: string }> = {
  传世: { text: 'rarity-legendary', border: 'border-orange-400/50', glow: 'rarity-glow-legendary' },
  罕见: { text: 'rarity-rare',      border: 'border-purple-400/50', glow: 'rarity-glow-rare' },
  普通: { text: 'rarity-common',    border: 'border-white/20',       glow: 'rarity-glow-common' },
  劣质: { text: 'rarity-poor',      border: 'border-gray-500/30',    glow: 'rarity-glow-poor' },
};

/* ==============================================================
   ANIMATED COUNTER
   ============================================================== */
function AnimatedCounter({ value, duration = 1000, suffix = '' }: { value: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    let raf: number;
    const fn = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) raf = requestAnimationFrame(fn);
    };
    raf = requestAnimationFrame(fn);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return <span ref={ref}>{(inView ? count : 0).toLocaleString('zh-CN')}{suffix}</span>;
}

/* ==============================================================
   BAR COMPONENT
   ============================================================== */
function StatBar({ label, current, max, color, delay }: { label: string; current: number; max: number; color: string; delay: number }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end text-[11px] font-display tracking-widest">
        <span className="text-white/50">{label}</span>
        <span className="text-aether-cyan font-mono text-[10px] tabular-nums">
          <AnimatedCounter value={current} /> / {max.toLocaleString('zh-CN')}
        </span>
      </div>
      <div className="h-2.5 bg-white/[0.04] border border-white/[0.08] relative overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: 'easeOut', delay }}
          className={`h-full relative overflow-hidden ${color}`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-scanline" />
        </motion.div>
      </div>
    </div>
  );
}

/* ==============================================================
   ATTRIBUTE CARD
   ============================================================== */
function AttrCard({ name, value, accent }: { name: string; value: number; accent: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', damping: 14, stiffness: 200 }}
      className="relative p-4 border border-aether-border/20 bg-white/[0.02] group hover:border-aether-cyan/40 hover:bg-aether-cyan/[0.03] hover:shadow-[0_0_20px_rgba(0,242,255,0.06)] transition-all duration-300"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-white/45 font-display tracking-wide group-hover:text-white/70 transition-colors">{name}</span>
        <span className={`text-xl font-display font-bold transition-colors tabular-nums ${accent}`}>
          <AnimatedCounter value={value} />
        </span>
      </div>
    </motion.div>
  );
}

/* ==============================================================
   MAIN COMPONENT
   ============================================================== */
export default function PersonaPage({ variables }: { variables?: Record<string, any> }) {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const protagonist = variables?.主角 ?? {};
  const body = protagonist?.身体属性 ?? {};
  const bars = [
    { name: '生命', current: body?.生命?.当前 ?? 0, max: body?.生命?.上限 ?? 100, color: 'bg-red-500' },
    { name: '能量', current: body?.能量?.当前 ?? 0, max: body?.能量?.上限 ?? 100, color: 'bg-cyan-400' },
    { name: 'SAN',  current: body?.SAN?.当前 ?? 0,  max: body?.SAN?.上限 ?? 100,  color: 'bg-aether-green' },
  ];

  const base = protagonist?.基础属性 ?? {};
  const spec = protagonist?.特殊属性 ?? {};
  const stats = [
    { name: '力量', value: base?.力量 ?? 0, accent: 'text-white group-hover:text-aether-cyan' },
    { name: '体质', value: base?.体质 ?? 0, accent: 'text-white group-hover:text-aether-cyan' },
    { name: '精神', value: base?.精神 ?? 0, accent: 'text-white group-hover:text-aether-cyan' },
    { name: '敏捷', value: base?.敏捷 ?? 0, accent: 'text-white group-hover:text-aether-cyan' },
    { name: '幸运', value: spec?.幸运 ?? 0, accent: 'text-amber-400 group-hover:text-amber-300' },
    { name: '魅力', value: spec?.魅力 ?? 0, accent: 'text-purple-400 group-hover:text-purple-300' },
  ];

  const rating: string = protagonist?.评级 || '--';
  const age: number = protagonist?.年龄 ?? 0;

  const money = protagonist?.资源?.金钱;
  const超凡资源 = protagonist?.资源?.超凡资源;

  return (
    <main className="h-full overflow-y-auto px-4 md:px-12 py-8 space-y-20 scroll-smooth">
      {/* ============================================================
          SECTION 1 — RATINGS & ATTRIBUTES
          ============================================================ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="space-y-8"
      >
        {/* heading row */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-l-4 border-aether-cyan pl-6">
          <div className="flex items-center gap-4">
            <span className="font-display text-3xl md:text-4xl font-black tracking-tighter text-white/90 italic">
              个体评级
            </span>
            <motion.span
              animate={{ boxShadow: ['0 0 10px rgba(0,242,255,0.3)', '0 0 28px rgba(0,242,255,0.7)', '0 0 10px rgba(0,242,255,0.3)'] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="inline-block px-4 py-1 bg-gradient-to-br from-aether-cyan/20 to-aether-blue/20 border border-aether-cyan/60 text-aether-cyan font-display font-black text-3xl md:text-4xl tracking-tighter"
            >
              {rating}
            </motion.span>
          </div>
          {/* age */}
          <div className="flex items-center gap-2 text-white/30">
            <span className="text-[10px] font-mono tracking-[0.12em] uppercase">AGE</span>
            <span className="font-display text-lg font-bold text-white/50">{age}</span>
          </div>
        </div>

        {/* currency strip */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 py-3 px-5 border border-white/[0.06] bg-aether-dark/30">
          {money && (
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-white/40 font-mono tracking-wide">{money?.单位 || '元'}</span>
              <span className="font-display text-sm font-bold text-white/80 tabular-nums">
                <AnimatedCounter value={money?.数值 ?? 0} />
              </span>
            </div>
          )}
          {超凡资源 && Object.entries(超凡资源 as Record<string, number>).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2.5">
              <span className="text-[11px] text-white/40 font-mono tracking-wide">{k}</span>
              <span className="font-display text-sm font-bold text-aether-gold tabular-nums">
                <AnimatedCounter value={v as number} />
              </span>
            </div>
          ))}
        </div>

        {/* stat bars */}
        <div className="space-y-4 w-full">
          {bars.map((bar, i) => (
            <React.Fragment key={bar.name}><StatBar label={bar.name} current={bar.current} max={bar.max} color={bar.color} delay={0.2 + i * 0.1} /></React.Fragment>
          ))}
        </div>

        {/* attribute cards — 2 rows × 3 cols */}
        <div className="grid grid-cols-3 gap-3 w-full mt-2">
          {stats.map((stat) => (
            <React.Fragment key={stat.name}><AttrCard name={stat.name} value={stat.value} accent={stat.accent} /></React.Fragment>
          ))}
        </div>
      </motion.section>

      {/* divider */}
      <div className="flex items-center gap-4 opacity-30">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent" />
        <Diamond size={12} className="text-aether-cyan rotate-45" />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent" />
      </div>

      {/* ============================================================
          SECTION 2 — SKILLS (still mock for now)
          ============================================================ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border border-aether-cyan/40 flex items-center justify-center shrink-0">
            <Database size={16} className="text-aether-cyan" />
          </div>
          <h2 className="font-display text-xl tracking-widest uppercase text-white/90">掌握技能</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MOCK_SKILLS.map((skill) => {
            const rs = RANK_STYLES[skill.rank] || RANK_STYLES.C;
            return (
              <motion.button
                key={skill.id}
                onClick={() => setSelectedSkill(skill)}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                className="relative p-5 glass-panel text-left group border border-aether-border/30 hover:border-aether-cyan/40 transition-colors overflow-hidden clickable"
              >
                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center justify-center w-9 h-9 text-sm font-black font-display border ${rs.border} ${rs.bg} ${rs.text} ${rs.glow}`}>{skill.rank}</span>
                </div>
                <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-12">{skill.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-[9px] px-2 py-0.5 font-mono uppercase tracking-wider ${skill.type === '主动' ? 'text-aether-cyan border border-aether-cyan/30 bg-aether-cyan/10' : 'text-aether-blue border border-aether-blue/30 bg-aether-blue/10'}`}>{skill.type}</span>
                </div>
                <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">{skill.description}</p>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* divider */}
      <div className="flex items-center gap-4 opacity-30">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent" />
        <Diamond size={12} className="text-aether-cyan rotate-45" />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent" />
      </div>

      {/* ============================================================
          SECTION 3 — EQUIPMENT (still mock for now)
          ============================================================ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="space-y-6 pb-20"
      >
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border border-aether-cyan/40 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-aether-cyan" />
          </div>
          <h2 className="font-display text-xl tracking-widest uppercase text-white/90">当前装备</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
        </div>

        {MOCK_ITEMS.length === 0 ? (
          <div className="p-12 border border-dashed border-aether-border/30 flex flex-col items-center justify-center text-center gap-3">
            <Shield size={32} className="text-white/10" />
            <p className="text-xs text-white/30 font-display tracking-wider">暂无装备物品</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_ITEMS.slice(0, 3).map((item) => {
              const rarity = RARITY_STYLES[item.rarity] || RARITY_STYLES.普通;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  whileHover={{ y: -3 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                  className="relative p-5 glass-panel text-left group border border-aether-border/30 hover:border-aether-cyan/40 transition-colors overflow-hidden clickable"
                >
                  <div className="absolute top-3 right-3">
                    <span className={`shrink-0 text-[9px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 border ${rarity.border} ${rarity.text}`}>{item.rarity}</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-16 truncate">{item.name}</h3>
                  <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">{item.description}</p>
                  <div className="mt-3 pt-3 border-t border-aether-border/20 flex items-center gap-4">
                    <span className="text-[10px] font-mono text-aether-blue/50 tracking-wide">{item.category}</span>
                    <span className="text-[10px] font-mono text-white/25">x{item.quantity}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* ==============================================================
          MODALS
          ============================================================== */}
      <Modal isOpen={!!selectedSkill} onClose={() => setSelectedSkill(null)} title="技能详情">
        {selectedSkill && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedSkill.name}</h3>
                <p className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">{selectedSkill.id.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-xs font-bold font-display border ${RANK_STYLES[selectedSkill.rank]?.border} ${RANK_STYLES[selectedSkill.rank]?.text} ${RANK_STYLES[selectedSkill.rank]?.bg}`}>{selectedSkill.rank} 级机能</span>
                <span className={`text-[9px] px-2 py-1 font-mono uppercase tracking-wider ${selectedSkill.type === '主动' ? 'text-aether-cyan border border-aether-cyan/30 bg-aether-cyan/10' : 'text-aether-blue border border-aether-blue/30 bg-aether-blue/10'}`}>{selectedSkill.type}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div><h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4><p className="text-sm text-white/80 leading-relaxed">"{selectedSkill.description}"</p></div>
              <div className="p-4 bg-aether-cyan/[0.05] border-l-2 border-aether-cyan"><h4 className="text-[10px] text-aether-cyan uppercase tracking-widest mb-1 font-mono">战术效果</h4><p className="text-sm font-medium tracking-wide text-white/90">{selectedSkill.effect}</p></div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                <div className="p-3 bg-black/40 border border-white/5"><span className="text-aether-blue/60 uppercase tracking-wider">技能类型</span><p className="text-white/70 mt-0.5">{selectedSkill.type === '主动' ? '主动释放' : '常驻被动'}</p></div>
                <div className="p-3 bg-black/40 border border-white/5"><span className="text-aether-blue/60 uppercase tracking-wider">机能等级</span><p className={`mt-0.5 font-bold ${RANK_STYLES[selectedSkill.rank]?.text || 'text-white/70'}`}>{selectedSkill.rank}</p></div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title="物资详情">
        {selectedItem && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedItem.name}</h3>
                <p className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">{selectedItem.id.toUpperCase()} / 数量: {selectedItem.quantity}</p>
              </div>
              <span className={`text-xs font-bold font-mono uppercase px-3 py-1 border ${RARITY_STYLES[selectedItem.rarity]?.border || 'border-white/20'} ${RARITY_STYLES[selectedItem.rarity]?.text || 'text-white/70'}`}>{selectedItem.rarity}</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed italic">"{selectedItem.description}"</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-black/40 border border-white/10"><span className="text-[9px] uppercase text-aether-blue font-mono tracking-wider block mb-1">种类</span><span className="text-sm text-white/80 font-display">{selectedItem.category}</span></div>
              <div className="p-3 bg-black/40 border border-white/10"><span className="text-[9px] uppercase text-aether-blue font-mono tracking-wider block mb-1">品质</span><span className={`text-sm font-bold font-display ${RARITY_STYLES[selectedItem.rarity]?.text || 'text-white/70'}`}>{selectedItem.rarity}</span></div>
              <div className="p-3 bg-black/40 border border-white/10"><span className="text-[9px] uppercase text-aether-blue font-mono tracking-wider block mb-1">持有数量</span><span className="text-sm text-white/80 font-display">x{selectedItem.quantity}</span></div>
              <div className="p-3 bg-black/40 border border-white/10"><span className="text-[9px] uppercase text-aether-blue font-mono tracking-wider block mb-1">耐久度</span><span className="text-sm text-white/80 font-display">100%</span></div>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
