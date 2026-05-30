import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Skull,
  Database,
  Diamond,
  Package,
  Zap,
} from 'lucide-react';
import { Modal } from '../Feedback';
import { getDatabase } from '../../sillytavern/database';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';
import { moveItem } from '../../sillytavern/variables';

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
export default function PersonaPage() {
  const [selectedSkill, setSelectedSkill] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<any>(null);
  const [genitalOpen, setGenitalOpen] = useState(false);
  const [protagonist, setProtagonist] = useState<Record<string, any>>({});

  // Read latest chat variables directly from IndexedDB
  useEffect(() => {
    const db = getDatabase();
    const refresh = async () => {
      try {
        const chats = await db.chats.toArray();
        const latest = chats[chats.length - 1];
        setProtagonist(latest?.variables?.主角 ?? {});
      } catch { /* DB not ready yet */ }
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);
  const body = protagonist?.身体属性 ?? {};
  const bars = [
    { name: '生命', current: body?.生命?.当前 ?? 0, max: body?.生命?.上限 ?? 100, color: 'bg-red-500' },
    { name: '体力', current: body?.体力?.当前 ?? 0, max: body?.体力?.上限 ?? 100, color: 'bg-pink-400' },
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
  const 超凡资源 = protagonist?.资源?.超凡资源;
  const statuses = protagonist?.状态 ?? {};
  const genitals = protagonist?.性器 ?? (DEFAULT_WORLD_VARS as any).主角?.性器 ?? {};
  const 持有物品 = protagonist?.持有物品 ?? {};
  const skills = protagonist?.技能 ?? {};

  const PROFICIENCY_STAGES = ['初窥', '粗浅', '掌握', '熟练', '小成', '入门', '精进', '深谙', '登峰', '造极'];
  const getStage = (proficiency: number) => PROFICIENCY_STAGES[Math.min(Math.floor(proficiency / 100), 9)];
  const PROFICIENCY_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
    初窥: { text: 'text-gray-400',   border: 'border-gray-400/40',   glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',   bg: 'bg-gray-400/10' },
    粗浅: { text: 'text-stone-400',  border: 'border-stone-400/45',  glow: 'shadow-[0_0_9px_rgba(168,162,158,0.25)]',  bg: 'bg-stone-400/10' },
    掌握: { text: 'text-teal-400',   border: 'border-teal-400/45',   glow: 'shadow-[0_0_10px_rgba(45,212,191,0.3)]',   bg: 'bg-teal-400/10' },
    熟练: { text: 'text-cyan-400',   border: 'border-cyan-400/45',   glow: 'shadow-[0_0_10px_rgba(34,211,238,0.3)]',   bg: 'bg-cyan-400/10' },
    小成: { text: 'text-sky-400',    border: 'border-sky-400/50',    glow: 'shadow-[0_0_11px_rgba(56,189,248,0.35)]',  bg: 'bg-sky-400/10' },
    入门: { text: 'text-blue-400',   border: 'border-blue-400/50',   glow: 'shadow-[0_0_12px_rgba(96,165,250,0.35)]',  bg: 'bg-blue-400/10' },
    精进: { text: 'text-indigo-400', border: 'border-indigo-400/50', glow: 'shadow-[0_0_13px_rgba(129,140,248,0.4)]',bg: 'bg-indigo-400/10' },
    深谙: { text: 'text-purple-400', border: 'border-purple-400/50', glow: 'shadow-[0_0_14px_rgba(168,85,247,0.4)]', bg: 'bg-purple-400/10' },
    登峰: { text: 'text-amber-300',  border: 'border-amber-400/50',  glow: 'shadow-[0_0_15px_rgba(251,191,36,0.45)]', bg: 'bg-amber-400/10' },
    造极: { text: 'text-orange-400', border: 'border-orange-400/50', glow: 'shadow-[0_0_16px_rgba(251,146,60,0.5)]', bg: 'bg-orange-400/10' },
  };

  const SKILL_RANK_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
    灭世: { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10' },
    夷地: { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10' },
    覆国: { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10' },
    摧城: { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10' },
    撼地: { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10' },
    磐岩: { text: 'text-yellow-400',border: 'border-yellow-400/50',glow: 'shadow-[0_0_11px_rgba(250,204,21,0.35)]',bg: 'bg-yellow-400/10' },
    凝石: { text: 'text-green-400', border: 'border-green-400/50', glow: 'shadow-[0_0_10px_rgba(74,222,128,0.3)]', bg: 'bg-green-400/10' },
    聚砂: { text: 'text-purple-400',border: 'border-purple-400/50',glow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)]',bg: 'bg-purple-400/10' },
    微尘: { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10' },
  };

  const ITEM_RANK_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
    灭世: { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10' },
    绝域: { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10' },
    倾国: { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10' },
    祸城: { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10' },
    凶煞: { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10' },
    微末: { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10' },
  };

  // Rating color derivation
  const ratingStyle = SKILL_RANK_STYLES[rating] || SKILL_RANK_STYLES['微尘'];
  const ratingGlowColors: Record<string, string> = {
    灭世: '#ef4444', 夷地: '#fb7185', 覆国: '#f472b6', 摧城: '#fb923c', 撼地: '#fcd34d',
    磐岩: '#facc15', 凝石: '#4ade80', 聚砂: '#c084fc', 微尘: '#9ca3af',
  };
  const ratingGlow = ratingGlowColors[rating] || '#00f2ff';

  return (
    <main className="h-full overflow-y-auto px-4 md:px-12 py-8 space-y-20 scroll-smooth bg-aether-deep">
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
        <div className="border-l-4 border-aether-cyan pl-6 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl md:text-4xl font-black tracking-tighter text-white/90">
              个人信息
            </span>
            <span className="text-sm text-white/30 font-display italic tracking-wide">({age}岁)</span>
          </div>
          <motion.p
            animate={{ textShadow: [
              `0 0 10px ${ratingGlow}60`,
              `0 0 28px ${ratingGlow}`,
              `0 0 10px ${ratingGlow}60`,
            ] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className={`font-display font-black text-2xl tracking-tighter italic ${ratingStyle.text}`}
          >
            {rating}
          </motion.p>
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

        {/* currency strip */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 py-3 px-5 border border-white/[0.06] bg-aether-dark/30">
          {money && (
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold text-white/80 tabular-nums">
                <AnimatedCounter value={money?.数值 ?? 0} />
              </span>
              <span className="text-[11px] text-white/40 font-mono tracking-wide">{money?.单位 || '元'}</span>
            </div>
          )}
          {超凡资源 && Object.entries(超凡资源 as Record<string, number>).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/40 font-mono tracking-wide">{k}</span>
              <span className={`font-display text-sm font-bold tabular-nums ${k === '尸气' ? 'text-aether-red' : 'text-aether-gold'}`}>
                <AnimatedCounter value={v as number} />
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ============================================================
          STATUS EFFECTS
          ============================================================ */}
      {Object.keys(statuses).length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 border border-aether-cyan/40 flex items-center justify-center shrink-0">
              <Zap size={16} className="text-aether-cyan" />
            </div>
            <h2 className="font-display text-xl tracking-widest uppercase text-white/90">状态</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statuses).map(([key, val]: [string, any]) => (
              <button
                key={key}
                onClick={() => setSelectedStatus({ name: key, ...val })}
                className="text-xs font-mono px-4 py-1.5 bg-aether-cyan/[0.08] border border-aether-cyan/40 text-white/85 hover:bg-aether-cyan/[0.14] hover:border-aether-cyan/60 shadow-[0_0_8px_rgba(0,242,255,0.12)] hover:shadow-[0_0_14px_rgba(0,242,255,0.22)] transition-all clickable font-bold"
              >
                {key}
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* ============================================================
          SECTION 2 — SKILLS
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
          <h2 className="font-display text-xl tracking-widest uppercase text-white/90">技能</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
        </div>

        {Object.keys(skills).length === 0 ? (
          <div className="p-12 border border-dashed border-aether-border/30 flex flex-col items-center justify-center text-center gap-3">
            <Database size={32} className="text-white/10" />
            <p className="text-xs text-white/30 font-display tracking-wider">暂无技能</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-1">
            {Object.entries(skills).map(([skillName, skillData]: [string, any]) => {
              const rank = skillData?.等级 || '微尘';
              const rs = SKILL_RANK_STYLES[rank] || SKILL_RANK_STYLES['微尘'];
              return (
                <motion.button
                  key={skillName}
                  onClick={() => setSelectedSkill({ name: skillName, ...skillData })}
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                  className="relative p-5 bg-cyan-950/55 border border-cyan-400/25 hover:border-cyan-400/50 hover:scale-[1.02] hover:z-10 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] text-left group transition-all duration-200 overflow-hidden clickable shadow-[0_0_20px_rgba(6,182,212,0.06)]"
                >
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {(() => {
                      const stage = getStage(skillData?.熟练度 ?? 0);
                      const ps = PROFICIENCY_STYLES[stage] || PROFICIENCY_STYLES['初窥'];
                      return (
                      <div className="relative group inline-flex" title={`${skillData?.熟练度 ?? 0} / 999`}>
                        <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${ps.border} ${ps.bg} ${ps.text} ${ps.glow}`}>
                          {stage}
                        </span>
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/70 font-mono tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {skillData?.熟练度 ?? 0} / 999
                        </span>
                      </div>
                    )})()}
                    <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${rs.border} ${rs.bg} ${rs.text} ${rs.glow}`}>
                      {rank}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-28">
                    {skillName}
                  </h3>
                  <p className="text-[11px] font-mono text-aether-cyan/50 tracking-wider mt-1">
                    消耗 {skillData?.消耗能量 ?? 0} 能量
                  </p>
                  <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">
                    {skillData?.描述 || ''}
                  </p>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* ============================================================
          SECTION 3 — 所持物品
          ============================================================ */}
      {(['灵宝', '诡物', '物品'] as const).map((category) => {
        const items = 持有物品?.[category] ?? {};
        const keys = Object.keys(items);
        if (keys.length === 0) return null;
        const catLabel = category;
        const CatIcon = category === '灵宝' ? Diamond : category === '诡物' ? Skull : Package;
        return (
        <React.Fragment key={category}>
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="space-y-6 pb-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border border-aether-cyan/40 flex items-center justify-center shrink-0">
                <CatIcon size={16} className="text-aether-cyan" />
              </div>
              <h2 className="font-display text-xl tracking-widest uppercase text-white/90">{catLabel}</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-1">
              {Object.entries(items).map(([itemName, itemData]: [string, any]) => {
                const rank = itemData?.等级 || '';
                const irs = ITEM_RANK_STYLES[rank] || null;
                const qty = itemData?.数量 ?? 1;
                return (
                  <motion.button
                    key={itemName}
                    onClick={() => setSelectedItem({ name: itemName, category, ...itemData })}
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                    className="relative p-5 bg-cyan-950/55 border border-cyan-400/25 hover:border-cyan-400/50 hover:scale-[1.02] hover:z-10 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] text-left group transition-all duration-200 overflow-hidden clickable shadow-[0_0_20px_rgba(6,182,212,0.06)]"
                  >
                    <div className="absolute top-3 right-3">
                      {irs && (
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold font-display border ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>
                          {rank}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-16 truncate">
                      {itemName}
                      <span className="text-[10px] font-mono text-white/25 ml-2">×{qty}</span>
                      {itemData?.梦境物品 === true && (
                        <span className="text-[8px] px-1 py-0.5 rounded font-display tracking-wider border border-purple-400/20 bg-purple-400/6 text-purple-300/60 ml-1.5 align-middle">梦境</span>
                      )}
                    </h3>
                    <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">
                      {itemData?.描述 || ''}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        </React.Fragment>
        );
      })}

      {/* ============================================================
          GENITAL STATUS (collapsed by default)
          ============================================================ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
        className="border border-dashed border-pink-400/15 bg-pink-400/[0.02] px-5 py-4 space-y-4"
      >
        <button
          onClick={() => setGenitalOpen(!genitalOpen)}
          className="flex items-center gap-3 w-full text-left group"
        >
          <span className="font-display text-sm tracking-[0.15em] uppercase text-pink-300/60 group-hover:text-pink-300/85 transition-colors">
            性器状态
          </span>
          <div className="flex-1 h-px bg-[repeating-linear-gradient(to_right,transparent,transparent_3px,rgba(244,114,182,0.15)_3px,rgba(244,114,182,0.15)_5px)]" />
          <span className="text-[10px] font-mono text-pink-300/30 group-hover:text-pink-300/50 transition-colors shrink-0">
            {genitalOpen ? '收起 ▲' : '展开 ▼'}
          </span>
        </button>
        {genitalOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-2 gap-3 overflow-hidden"
          >
            {Object.keys(genitals).length > 0 ? (
              Object.entries(genitals).map(([key, value]: [string, any]) => (
                <div key={key} className="p-3 border border-pink-400/20 bg-black/40">
                  <span className="text-[10px] font-mono text-pink-300/40">{key}</span>
                  <p className="text-lg font-display font-bold text-pink-300/70 mt-0.5">{value}</p>
                </div>
              ))
            ) : (
              <p className="text-[11px] font-mono text-pink-300/25 col-span-2 text-center py-4">暂无数据</p>
            )}
          </motion.div>
        )}
      </motion.section>

      {/* ==============================================================
          MODALS
          ============================================================== */}
      <Modal isOpen={!!selectedSkill} onClose={() => setSelectedSkill(null)} title="技能详情">
        {selectedSkill && (() => {
          const rank = selectedSkill?.等级 || '微尘';
          const rs = SKILL_RANK_STYLES[rank] || SKILL_RANK_STYLES['微尘'];
          const branches = selectedSkill?.分支 || {};
          const prof = selectedSkill?.熟练度 ?? 0;
          const stage = getStage(prof);
          return (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedSkill.name}</h3>
                <p className="text-[11px] font-mono text-aether-cyan/50 tracking-wider mt-1">
                  消耗 {selectedSkill?.消耗能量 ?? 0} 能量
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative group inline-flex" title={`${prof} / 999`}>
                  <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${(PROFICIENCY_STYLES[stage] || PROFICIENCY_STYLES['初窥']).border} ${(PROFICIENCY_STYLES[stage] || PROFICIENCY_STYLES['初窥']).bg} ${(PROFICIENCY_STYLES[stage] || PROFICIENCY_STYLES['初窥']).text} ${(PROFICIENCY_STYLES[stage] || PROFICIENCY_STYLES['初窥']).glow}`}>
                    {stage}
                  </span>
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/70 font-mono tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {prof} / 999
                  </span>
                </div>
                <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${rs.border} ${rs.bg} ${rs.text} ${rs.glow}`}>
                  {rank}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {selectedSkill?.描述 && (
                <div><h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4><p className="text-sm text-white/80 leading-relaxed">{selectedSkill.描述}</p></div>
              )}
              {selectedSkill?.使用要求 && (
                <div className="p-4 bg-aether-cyan/[0.05] border-l-2 border-aether-cyan"><h4 className="text-[10px] text-aether-cyan uppercase tracking-widest mb-1 font-mono">使用要求</h4><p className="text-sm font-medium tracking-wide text-white/90">{selectedSkill.使用要求}</p></div>
              )}
              {selectedSkill?.副作用 && (
                <div className="p-4 bg-aether-red/[0.05] border-l-2 border-aether-red"><h4 className="text-[10px] text-aether-red uppercase tracking-widest mb-1 font-mono">副作用</h4><p className="text-sm tracking-wide text-aether-red/80">{selectedSkill.副作用}</p></div>
              )}
              {Object.keys(branches).length > 0 && (
                <div>
                  <h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-3 font-mono">分支</h4>
                  <div className="space-y-3">
                    {Object.entries(branches).map(([bName, bData]: [string, any]) => (
                      <div key={bName} className="p-3 bg-black/40 border border-white/5">
                        <h5 className="text-xs font-display font-bold text-white/70 mb-1">{bName}</h5>
                        {bData?.描述 && <p className="text-[11px] text-white/50 leading-relaxed mb-1">{bData.描述}</p>}
                        {bData?.效果 && <p className="text-[11px] text-aether-cyan/70 leading-relaxed">{bData.效果}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )})()}
      </Modal>

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.category === '灵宝' ? '灵宝详情' : selectedItem?.category === '诡物' ? '诡物详情' : '物品详情'}>
        {selectedItem && (() => {
          const rank = selectedItem?.等级 || '';
          const irs = ITEM_RANK_STYLES[rank] || null;
          return (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedItem.name}</h3>
                <p className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">数量: {selectedItem?.数量 ?? 1}</p>
              </div>
              {irs && (
                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold font-display border ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>
                  {rank}
                </span>
              )}
            </div>
            <div className="space-y-4">
              {selectedItem?.描述 && (
                <div><h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4><p className="text-sm text-white/80 leading-relaxed">{selectedItem.描述}</p></div>
              )}
              {selectedItem?.效果 && Object.keys(selectedItem.效果).length > 0 && (
                <div>
                  <h4 className="text-[10px] text-aether-green uppercase tracking-widest mb-3 font-mono">效果</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedItem.效果 as Record<string, string>).map(([k, v]) => (
                      <div key={k} className="p-3 bg-aether-green/[0.04] border border-aether-green/20">
                        <h5 className="text-[11px] font-display font-bold text-aether-green/70 mb-1">{k}</h5>
                        <p className="text-[11px] text-white/60 leading-relaxed">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedItem?.规则 && Object.keys(selectedItem.规则).length > 0 && (
                <div>
                  <h4 className="text-[10px] text-aether-purple uppercase tracking-widest mb-3 font-mono">规则</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedItem.规则 as Record<string, string>).map(([k, v]) => (
                      <div key={k} className="p-3 bg-aether-purple/[0.04] border border-aether-purple/20">
                        <h5 className="text-[11px] font-display font-bold text-aether-purple/70 mb-1">{k}</h5>
                        <p className="text-[11px] text-white/60 leading-relaxed">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedItem?.副作用 && Object.keys(selectedItem.副作用).length > 0 && (
                <div>
                  <h4 className="text-[10px] text-aether-red uppercase tracking-widest mb-3 font-mono">副作用</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedItem.副作用 as Record<string, string>).map(([k, v]) => (
                      <div key={k} className="p-3 bg-aether-red/[0.04] border border-aether-red/20">
                        <h5 className="text-[11px] font-display font-bold text-aether-red/70 mb-1">{k}</h5>
                        <p className="text-[11px] text-white/60 leading-relaxed">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={async () => {
                  const ok = await moveItem(selectedItem.name, selectedItem.category, 'unequip');
                  if (ok) setSelectedItem(null);
                }}
                className="px-4 py-2 text-xs font-display tracking-wider border border-aether-red/40 text-aether-red hover:bg-aether-red/10 transition-all"
              >
                卸下
              </button>
            </div>
          </div>
        )})()}
      </Modal>

      <Modal isOpen={!!selectedStatus} onClose={() => setSelectedStatus(null)} title="状态详情">
        {selectedStatus && (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedStatus.name}</h3>
              {selectedStatus.持续时间 && (
                <span className="text-xs font-mono text-white/30 shrink-0 mt-1">{selectedStatus.持续时间}</span>
              )}
            </div>
            {selectedStatus.描述 && (
              <div>
                <h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4>
                <p className="text-sm text-white/80 leading-relaxed">{selectedStatus.描述}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}
