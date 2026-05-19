import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User, Heart, Shield, Zap, Database, Diamond, Skull, Package } from 'lucide-react';
import { Modal } from '../Feedback';
import { useSillytavern } from '../../hooks/useSillytavern';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';
import { getAffectionStage, getFriendlinessStage, getCorruptionStage } from '../../sillytavern/social-stages';

/* ===== Helpers ===== */
interface CharacterCard {
  name: string; group: string; category: string; profile: any;
}

const GROUP_LABELS: Record<string, string> = {
  '女性-异人': '女性 · 异人',
  '女性-普通人': '女性 · 普通人',
  '男性-异人': '男性 · 异人',
  '男性-普通人': '男性 · 普通人',
};

const RATING_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
  '灭世': { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10' },
  '夷地': { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10' },
  '覆国': { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10' },
  '摧城': { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10' },
  '撼山': { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10' },
  '磐岩': { text: 'text-yellow-400',border: 'border-yellow-400/50',glow: 'shadow-[0_0_11px_rgba(250,204,21,0.35)]',bg: 'bg-yellow-400/10' },
  '凝石': { text: 'text-green-400', border: 'border-green-400/50', glow: 'shadow-[0_0_10px_rgba(74,222,128,0.3)]', bg: 'bg-green-400/10' },
  '聚砂': { text: 'text-purple-400',border: 'border-purple-400/50',glow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)]',bg: 'bg-purple-400/10' },
  '微尘': { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10' },
};

const ITEM_RANK_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
  '灭世': { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10' },
  '绝域': { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10' },
  '倾国': { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10' },
  '祸城': { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10' },
  '凶煞': { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10' },
  '微末': { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10' },
};

const CATEGORY_META: Record<string, { label: string; Icon: typeof Diamond }> = {
  '灵宝': { label: '灵宝', Icon: Diamond },
  '诡物': { label: '诡物', Icon: Skull },
  '物品': { label: '物品', Icon: Package },
};

/* ============================================================
   ARCHIVE PAGE
   ============================================================ */
export default function ArchivePage() {
  const ss = useSillytavern();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;
  const charData: Record<string, any> = liveVars?.['主要人物'] ?? defaults.主要人物 ?? {};

  const [selected, setSelected] = useState<CharacterCard | null>(null);
  const [search, setSearch] = useState('');

  // Flatten characters into cards grouped by category
  const groups = useMemo(() => {
    const result: Record<string, CharacterCard[]> = {};
    for (const [gender, genderData] of Object.entries(charData)) {
      if (!genderData || typeof genderData !== 'object') continue;
      for (const [group, members] of Object.entries(genderData as Record<string, any>)) {
        if (!members || typeof members !== 'object') continue;
        const groupKey = `${gender}-${group}`;
        const cards: CharacterCard[] = [];
        for (const [name, profile] of Object.entries(members as Record<string, any>)) {
          if (!profile || typeof profile !== 'object') continue;
          cards.push({ name, group: groupKey, category: GROUP_LABELS[groupKey] ?? groupKey, profile });
        }
        if (cards.length > 0) result[groupKey] = cards;
      }
    }
    return result;
  }, [charData]);

  const groupEntries: [string, CharacterCard[]][] = Object.entries(groups);
  const totalChars = groupEntries.reduce((sum, [, cards]) => sum + cards.length, 0);

  const filteredGroups: [string, CharacterCard[]][] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupEntries;
    return groupEntries
      .map(([key, cards]) => [
        key,
        cards.filter((c: CharacterCard) => c.name.toLowerCase().includes(q) || c.profile.检索词?.some((k: string) => k.toLowerCase().includes(q))),
      ] as [string, CharacterCard[]])
      .filter(([, cards]) => cards.length > 0);
  }, [groupEntries, search]);

  const handleSearch = (v: string) => {
    setSearch(v);
    setSelected(null);
  };

  return (
    <div className="h-full flex relative overflow-hidden bg-gradient-to-b from-aether-deep/95 via-aether-dark/80 to-aether-dark/60">
      {/* ==================== LEFT PANEL — Character List ==================== */}
      <div className="w-64 md:w-72 shrink-0 border-r border-aether-border/30 flex flex-col bg-aether-dark/40">
        <div className="px-4 pt-5 pb-3 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.4)]" />
            <h2 className="font-display text-base tracking-[0.12em] text-aether-cyan/90">角色档案</h2>
            <span className="text-[10px] font-mono text-white/20 ml-auto">{totalChars}人</span>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="搜索角色…"
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-md pl-8 pr-3 py-1.5
                         text-[11px] font-mono text-white/70 placeholder:text-white/15
                         focus:outline-none focus:border-aether-cyan/30 focus:bg-white/[0.05]
                         transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] font-mono text-white/20">
                {search ? '无匹配角色' : '暂无角色数据'}
              </span>
            </div>
          ) : (
            filteredGroups.map(([groupKey, cards]) => (
              <div key={groupKey}>
                <div className="flex items-center gap-2 mb-1.5 px-2">
                  <span className="text-[9px] font-mono text-aether-cyan/40 tracking-[0.1em] uppercase">
                    {GROUP_LABELS[groupKey] ?? groupKey}
                  </span>
                  <span className="text-[9px] font-mono text-white/15">{cards.length}</span>
                </div>
                <div className="space-y-0.5">
                  {cards.map((char) => {
                    const p = char.profile;
                    const ratingStyle = p.评级 ? RATING_STYLES[p.评级] : null;
                    const isActive = selected?.name === char.name;
                    const isFemale = p.好感值 !== undefined;
                    const affection = p.好感值 ?? p.友善值 ?? 0;
                    const stage = isFemale ? getAffectionStage(affection) : getFriendlinessStage(affection);
                    return (
                      <button
                        key={char.name}
                        onClick={() => setSelected(char)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors group relative
                          ${isActive
                            ? 'bg-aether-cyan/[0.06] border border-aether-cyan/20'
                            : 'border border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]'
                          }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-aether-cyan rounded-r-full shadow-[0_0_6px_rgba(0,242,255,0.5)]" />
                        )}
                        <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-colors
                          ${isActive ? 'bg-aether-cyan/15' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'}`}>
                          <User size={13} className={isActive ? 'text-aether-cyan/60' : 'text-white/20'} />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`text-[13px] font-display truncate transition-colors
                            ${isActive ? 'text-aether-cyan/90 font-bold' : 'text-white/70 group-hover:text-white/85'}`}>
                            {char.name}
                          </span>
                          {p.梦境NPC && (
                            <span className="text-[7px] font-mono px-1 py-px rounded shrink-0 bg-purple-400/10 text-purple-300/60 border border-purple-400/15">
                              梦
                            </span>
                          )}
                          {ratingStyle && (
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ratingStyle.bg} border ${ratingStyle.border}`} />
                          )}
                        </div>
                        <span className="text-[9px] font-mono shrink-0" style={{ color: stage.color, opacity: 0.5 }}>
                          {affection}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ==================== RIGHT PANEL — Character Detail ==================== */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {selected ? (
            <CharacterDetail key={selected.name} char={selected} />
          ) : (
            <EmptyState />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY STATE
   ============================================================ */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col items-center justify-center gap-4"
    >
      <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
        <User size={28} className="text-white/10" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[13px] font-display text-white/25 tracking-wide">选择角色</p>
        <p className="text-[10px] font-mono text-white/12">从左侧列表中选择一个角色查看详细档案</p>
      </div>
    </motion.div>
  );
}

/* ============================================================
   SECTION HEADER — text + gradient line, no icon
   ============================================================ */
function SectionHeader({ title, large, Icon }: { title: string; large?: boolean; Icon?: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex items-center gap-4">
      {Icon && <Icon size={16} className="text-aether-cyan/60 shrink-0" />}
      <h2 className={`font-display tracking-widest uppercase ${large ? 'text-xl text-white/90' : 'text-base text-white/70'}`}>
        {title}
      </h2>
      <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
    </div>
  );
}

/* ============================================================
   CHARACTER DETAIL — Dossier View
   ============================================================ */
function CharacterDetail({ char }: { char: CharacterCard }) {
  const p = char.profile;
  const [selectedSkill, setSelectedSkill] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const isFemale = p.好感值 !== undefined;
  const affection = p.好感值 ?? p.友善值 ?? 0;
  const stage = isFemale ? getAffectionStage(affection) : getFriendlinessStage(affection);
  const corrStage = isFemale && p.堕落值 !== undefined ? getCorruptionStage(p.堕落值) : null;
  const ratingStyle = p.评级 ? RATING_STYLES[p.评级] : null;

  const affectionPct = ((affection + 200) / 400) * 100;
  const corrPct = corrStage ? (p.堕落值 / 500) * 100 : 0;

  const clothing = p.着装 as Record<string, { 名称: string; 描述: string }> | undefined;
  const hasSocialCircle = p.社交圈 && Object.keys(p.社交圈).length > 0;
  const hasClothing = clothing && Object.keys(clothing).length > 0;
  const hasStatus = p.状态 && Object.keys(p.状态).length > 0;
  const hasSkills = p.技能 && Object.keys(p.技能).length > 0;
  const bodyAttr = p.身体属性;
  const baseAttr = p.基础属性;
  const specialAttr = p.特殊属性;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="px-6 md:px-12 py-8 space-y-10"
    >
      {/* ===== Hero Header ===== */}
      <div className="border-l-4 border-aether-cyan pl-6 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-display text-3xl font-black tracking-tighter text-white/90">{char.name}</h1>
          <span className="text-sm text-white/30 font-display italic tracking-wide">({p.年龄}岁)</span>
          {p.梦境NPC && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-purple-400/12 text-purple-300/70 border border-purple-400/20">
              梦境NPC
            </span>
          )}
        </div>
        {ratingStyle && (
          <span className={`inline-flex items-center justify-center px-3 py-0.5 text-xs font-bold font-display border ${ratingStyle.border} ${ratingStyle.bg} ${ratingStyle.text} ${ratingStyle.glow}`}>
            {p.评级}
          </span>
        )}
        <p className="text-sm text-white/55 leading-relaxed font-mono">{p.身份}</p>
      </div>

      {/* ===== Affection / Friendliness ===== */}
      <section className="space-y-2">
        <SectionHeader title={isFemale ? '好感阶段' : '友善阶段'} Icon={Heart} />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xl font-display font-bold italic tracking-wide" style={{ color: stage.color }}>
              {stage.name}
            </span>
            <span className="text-sm font-mono" style={{ color: stage.color, opacity: 0.6 }}>{affection}</span>
          </div>
          <div className="h-2 bg-white/[0.04] border border-white/[0.08] overflow-hidden">
            <motion.div
              className="h-full"
              style={{ background: `linear-gradient(90deg, ${stage.color}40, ${stage.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${affectionPct}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="flex justify-between text-[8px] font-mono text-white/12">
            <span>-200</span><span>0</span><span>200</span>
          </div>
        </div>
      </section>

      {/* ===== Corruption (female only) ===== */}
      {corrStage && (
        <section className="space-y-2">
          <SectionHeader title="堕落阶段" Icon={Shield} />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xl font-display font-bold italic tracking-wide" style={{ color: corrStage.color }}>
                {corrStage.name}
              </span>
              <span className="text-sm font-mono" style={{ color: corrStage.color, opacity: 0.6 }}>{p.堕落值}</span>
            </div>
            <div className="h-2 bg-white/[0.04] border border-white/[0.08] overflow-hidden">
              <motion.div
                className="h-full"
                style={{ background: `linear-gradient(90deg, ${corrStage.color}40, ${corrStage.color})` }}
                initial={{ width: 0 }}
                animate={{ width: `${corrPct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              />
            </div>
            <div className="flex justify-between text-[8px] font-mono text-white/12">
              <span>0</span><span>250</span><span>500</span>
            </div>
          </div>
        </section>
      )}

      {/* ===== Clothing (female only) ===== */}
      {hasClothing && (
        <section className="space-y-4">
          <SectionHeader title="着装" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(clothing!).map(([slot, item]) => (
              <div key={slot}
                className="p-3 border border-aether-border/20 bg-white/[0.02] hover:border-aether-cyan/40 hover:bg-aether-cyan/[0.03] transition-all duration-300">
                <span className="text-[10px] font-mono text-aether-cyan/50">{slot}</span>
                <p className="text-xs font-display text-white/70 mt-1 font-bold">{item.名称}</p>
                <p className="text-[10px] font-mono text-white/35 mt-0.5 leading-relaxed">{item.描述}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== Body + Base/Special Attributes (merged, no divider) ===== */}
      {(bodyAttr || baseAttr || specialAttr) && (
        <section className="space-y-4">
          <SectionHeader title="属性" Icon={Zap} />
          {bodyAttr && (
            <div className="space-y-4">
              {(['生命', '能量', 'SAN'] as const).map(key => {
                const attr = bodyAttr[key] as { 当前: number; 上限: number } | undefined;
                if (!attr) return null;
                const pct = attr.上限 > 0 ? (attr.当前 / attr.上限) * 100 : 0;
                const colors: Record<string, string> = { '生命': 'bg-red-500', '能量': 'bg-cyan-400', 'SAN': 'bg-aether-green' };
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between items-end text-[11px] font-display tracking-widest">
                      <span className="text-white/50">{key}</span>
                      <span className="text-aether-cyan font-mono text-[10px] tabular-nums">
                        {attr.当前} / {attr.上限}
                      </span>
                    </div>
                    <div className="h-2 bg-white/[0.04] border border-white/[0.08] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full ${colors[key]}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(baseAttr || specialAttr) && (
            <div className="grid grid-cols-3 gap-3">
              {baseAttr && (['力量', '体质', '精神', '敏捷'] as const).map(key => {
                const v = baseAttr[key];
                if (v === undefined) return null;
                return (
                  <div key={key}
                    className="p-4 border border-aether-border/20 bg-white/[0.02] hover:border-aether-cyan/40 hover:bg-aether-cyan/[0.03] transition-all duration-300">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-white/45 font-display tracking-wide">{key}</span>
                      <span className="text-xl font-display font-bold text-white tabular-nums">{v}</span>
                    </div>
                  </div>
                );
              })}
              {specialAttr && (['幸运', '魅力'] as const).map(key => {
                const v = specialAttr[key];
                if (v === undefined) return null;
                const accent = key === '幸运' ? 'text-amber-400' : 'text-purple-400';
                return (
                  <div key={key}
                    className="p-4 border border-aether-border/20 bg-white/[0.02] hover:border-aether-cyan/40 hover:bg-aether-cyan/[0.03] transition-all duration-300">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-white/45 font-display tracking-wide">{key}</span>
                      <span className={`text-xl font-display font-bold tabular-nums ${accent}`}>{v}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ===== Status Effects ===== */}
      {hasStatus && (
        <section className="space-y-4">
          <SectionHeader title="状态" />
          <div className="space-y-2">
            {Object.entries(p.状态 as Record<string, any>).map(([key, val]) => (
              <div key={key} className="flex items-start gap-3 p-3 bg-aether-cyan/[0.03] border border-aether-cyan/10">
                <span className="text-[11px] font-mono text-aether-cyan/70 shrink-0">{key}</span>
                <span className="text-[11px] font-mono text-white/45">{val.描述}</span>
                {val.持续时间 && (
                  <span className="text-[9px] font-mono text-white/20 ml-auto shrink-0">{val.持续时间}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== Social Circle ===== */}
      {hasSocialCircle && (
        <section className="space-y-4">
          <SectionHeader title="社交圈" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(p.社交圈 as Record<string, string>).map(([who, rel]) => (
              <span key={who}
                className="text-[10px] font-mono px-3 py-1.5 bg-white/[0.02] border border-aether-border/20 text-white/55">
                <span className="text-white/30">{who}</span>
                <span className="text-white/15 mx-1.5">·</span>
                {rel as string}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ===== Skills ===== */}
      {hasSkills && (
        <section className="space-y-6">
          <SectionHeader title="技能" large Icon={Database} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(p.技能 as Record<string, any>).map(([skillName, skill]) => {
              const skillRating = RATING_STYLES[skill.等级];
              return (
                <motion.button
                  key={skillName}
                  onClick={() => setSelectedSkill({ name: skillName, ...skill })}
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                  className="p-5 glass-panel text-left group border border-aether-border/30 hover:border-aether-cyan/40 transition-colors overflow-hidden clickable"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-20">
                      {skillName}
                    </h3>
                    <div className="flex items-center gap-1.5 absolute top-3 right-3">
                      {skillRating && (
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold font-display border ${skillRating.border} ${skillRating.bg} ${skillRating.text}`}>
                          {skill.等级}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] font-mono text-white/45 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">
                    {skill.描述}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-white/25">
                    <span>消耗 {skill.消耗能量 ?? 0} 能量</span>
                    <span className="ml-auto">熟练 {skill.熟练度}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Equipment ===== */}
      {p.奇物 && (['灵宝', '诡物', '物品'] as const).map((category) => {
        const items = p.奇物[category] ?? {};
        const itemEntries = Object.entries(items);
        if (itemEntries.length === 0) return null;
        const meta = CATEGORY_META[category];
        const CatIcon = meta.Icon;
        return (
          <section key={category} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border border-aether-cyan/40 flex items-center justify-center shrink-0">
                <CatIcon size={16} className="text-aether-cyan" />
              </div>
              <h2 className="font-display text-xl tracking-widest uppercase text-white/90">{meta.label}</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
              {itemEntries.map(([itemName, itemData]: [string, any]) => {
                const itemRating = itemData.等级 ? ITEM_RANK_STYLES[itemData.等级] : null;
                return (
                  <motion.button
                    key={itemName}
                    onClick={() => setSelectedItem({ name: itemName, category, ...itemData })}
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                    className="p-5 glass-panel text-left group border border-aether-border/30 hover:border-aether-cyan/40 transition-colors overflow-hidden clickable"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-16 truncate">
                        {itemName}
                        {itemData.数量 && <span className="text-[10px] font-mono text-white/25 ml-2">×{itemData.数量}</span>}
                      </h3>
                      <div className="absolute top-3 right-3">
                        {itemRating && (
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold font-display border ${itemRating.border} ${itemRating.bg} ${itemRating.text}`}>
                            {itemData.等级}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] font-mono text-white/45 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">
                      {itemData.描述 || ''}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ============================================================
          MODALS
          ============================================================ */}
      <Modal isOpen={!!selectedSkill} onClose={() => setSelectedSkill(null)} title="技能详情">
        {selectedSkill && (() => {
          const rank = selectedSkill?.等级 || '微尘';
          const rs = RATING_STYLES[rank] || RATING_STYLES['微尘'];
          const branches = selectedSkill?.分支 || {};
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
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold font-display border ${rs.border} ${rs.bg} ${rs.text} ${rs.glow}`}>
                    {rank}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {selectedSkill?.描述 && (
                  <div>
                    <h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4>
                    <p className="text-sm text-white/80 leading-relaxed">{selectedSkill.描述}</p>
                  </div>
                )}
                {selectedSkill?.使用要求 && (
                  <div className="p-4 bg-aether-cyan/[0.05] border-l-2 border-aether-cyan">
                    <h4 className="text-[10px] text-aether-cyan uppercase tracking-widest mb-1 font-mono">使用要求</h4>
                    <p className="text-sm font-medium tracking-wide text-white/90">{selectedSkill.使用要求}</p>
                  </div>
                )}
                {selectedSkill?.副作用 && (
                  <div className="p-4 bg-aether-red/[0.05] border-l-2 border-aether-red">
                    <h4 className="text-[10px] text-aether-red uppercase tracking-widest mb-1 font-mono">副作用</h4>
                    <p className="text-sm tracking-wide text-aether-red/80">{selectedSkill.副作用}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-[11px] font-mono text-white/40">
                  <span>熟练度：{selectedSkill?.熟练度 ?? 0}</span>
                </div>
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
          );
        })()}
      </Modal>

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.category === '灵宝' ? '灵宝详情' : selectedItem?.category === '诡物' ? '诡物详情' : '物品详情'}>
        {selectedItem && (() => {
          const rank = selectedItem?.等级 || '';
          const irs = rank ? ITEM_RANK_STYLES[rank] : null;
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
                  <div>
                    <h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4>
                    <p className="text-sm text-white/80 leading-relaxed">{selectedItem.描述}</p>
                  </div>
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
            </div>
          );
        })()}
      </Modal>
    </motion.div>
  );
}
