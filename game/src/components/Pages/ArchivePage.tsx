import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User } from 'lucide-react';
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

const RATING_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '灭世': { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/50', dot: 'bg-red-500' },
  '夷地': { bg: 'bg-red-400/10', text: 'text-red-400/80', border: 'border-red-400/30', dot: 'bg-red-400' },
  '覆国': { bg: 'bg-orange-400/10', text: 'text-orange-400', border: 'border-orange-400/35', dot: 'bg-orange-400' },
  '摧城': { bg: 'bg-amber-400/10', text: 'text-amber-400', border: 'border-amber-400/30', dot: 'bg-amber-400' },
  '撼山': { bg: 'bg-yellow-400/10', text: 'text-yellow-400', border: 'border-yellow-400/30', dot: 'bg-yellow-400' },
  '磐岩': { bg: 'bg-green-400/10', text: 'text-green-400', border: 'border-green-400/30', dot: 'bg-green-400' },
  '凝石': { bg: 'bg-cyan-400/10', text: 'text-cyan-400', border: 'border-cyan-400/30', dot: 'bg-cyan-400' },
  '聚砂': { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-400/25', dot: 'bg-blue-400' },
  '微尘': { bg: 'bg-slate-400/8', text: 'text-slate-400', border: 'border-slate-400/20', dot: 'bg-slate-400' },
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

  // Filter by search
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

  // Clear selection when search changes
  const handleSearch = (v: string) => {
    setSearch(v);
    setSelected(null);
  };

  return (
    <div className="h-full flex relative overflow-hidden">
      {/* ==================== LEFT PANEL — Character List ==================== */}
      <div className="w-64 md:w-72 shrink-0 border-r border-white/[0.05] flex flex-col"
        style={{ background: 'linear-gradient(180deg, rgba(10,16,28,0.6) 0%, rgba(6,10,18,0.75) 100%)' }}>
        {/* Header */}
        <div className="px-4 pt-5 pb-3 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.4)]" />
            <h2 className="font-display text-base tracking-[0.12em] text-aether-cyan/90">角色档案</h2>
            <span className="text-[10px] font-mono text-white/20 ml-auto">{totalChars}人</span>
          </div>

          {/* Search */}
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

        {/* Character list */}
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
                {/* Group label */}
                <div className="flex items-center gap-2 mb-1.5 px-2">
                  <span className="text-[9px] font-mono text-aether-cyan/40 tracking-[0.1em] uppercase">
                    {GROUP_LABELS[groupKey] ?? groupKey}
                  </span>
                  <span className="text-[9px] font-mono text-white/15">{cards.length}</span>
                </div>

                {/* Character items */}
                <div className="space-y-0.5">
                  {cards.map((char) => {
                    const p = char.profile;
                    const ratingStyle = p.评级 ? RATING_STYLES[p.评级] : null;
                    const isActive = selected?.name === char.name;
                    const isFemale = p.好感值 !== undefined;
                    const affection = p.好感值 ?? p.友善值 ?? 0;
                    const stage = isFemale ? getAffectionStage(affection) : getFriendlinessStage(affection);

                    return (
                      <motion.button
                        key={char.name}
                        onClick={() => setSelected(char)}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all group
                          ${isActive
                            ? 'bg-aether-cyan/[0.06] border border-aether-cyan/20'
                            : 'border border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]'
                          }`}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <motion.div
                            layoutId="activeChar"
                            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-aether-cyan rounded-r-full shadow-[0_0_6px_rgba(0,242,255,0.5)]"
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          />
                        )}

                        {/* Avatar placeholder */}
                        <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-all
                          ${isActive ? 'bg-aether-cyan/15' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'}`}>
                          <User size={13} className={isActive ? 'text-aether-cyan/60' : 'text-white/20'} />
                        </div>

                        {/* Name + indicators */}
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
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ratingStyle.dot}`} />
                          )}
                        </div>

                        {/* Affection indicator */}
                        <span className="text-[9px] font-mono shrink-0" style={{ color: stage.color, opacity: 0.5 }}>
                          {affection}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom decorative bar */}
        <div className="shrink-0 px-4 py-3">
          <div className="h-px bg-gradient-to-r from-transparent via-aether-cyan/10 to-transparent" />
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
   CHARACTER DETAIL — Dossier View
   ============================================================ */
function CharacterDetail({ char }: { char: CharacterCard }) {
  const p = char.profile;
  const isFemale = p.好感值 !== undefined;
  const affection = p.好感值 ?? p.友善值 ?? 0;
  const stage = isFemale ? getAffectionStage(affection) : getFriendlinessStage(affection);
  const corrStage = isFemale && p.堕落值 !== undefined ? getCorruptionStage(p.堕落值) : null;
  const ratingStyle = p.评级 ? RATING_STYLES[p.评级] : null;

  // Normalize value to 0-100% for progress bar
  const affectionPct = ((affection + 200) / 400) * 100; // -200..200 → 0..100%
  const corrPct = corrStage ? (p.堕落值 / 500) * 100 : 0;

  const hasSocialCircle = p.社交圈 && Object.keys(p.社交圈).length > 0;
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
      className="px-6 md:px-8 py-6 space-y-6 max-w-2xl"
    >
      {/* ===== Hero Header ===== */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-display font-bold text-white/90 tracking-wide">{char.name}</h1>
          <span className="text-[13px] font-mono text-white/35">{p.年龄}岁</span>
          {p.梦境NPC && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-400/12 text-purple-300/70 border border-purple-400/20">
              梦境NPC
            </span>
          )}
          {ratingStyle && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ratingStyle.bg} ${ratingStyle.text} ${ratingStyle.border}`}>
              {p.评级}
            </span>
          )}
        </div>
        <p className="text-[12px] font-mono text-white/55 leading-relaxed">{p.身份}</p>
      </div>

      {/* ===== Affection / Friendliness ===== */}
      <SectionCard>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/30">{isFemale ? '好感阶段' : '友善阶段'}</span>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-display font-bold italic tracking-wide" style={{ color: stage.color }}>
                {stage.name}
              </span>
              <span className="text-[11px] font-mono" style={{ color: stage.color, opacity: 0.6 }}>{affection}</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${stage.color}60, ${stage.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${affectionPct}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="flex justify-between text-[8px] font-mono text-white/12">
            <span>-200</span><span>0</span><span>200</span>
          </div>
        </div>
      </SectionCard>

      {/* ===== Corruption (female only) ===== */}
      {corrStage && (
        <SectionCard>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/30">堕落阶段</span>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-display font-bold italic tracking-wide" style={{ color: corrStage.color }}>
                  {corrStage.name}
                </span>
                <span className="text-[11px] font-mono" style={{ color: corrStage.color, opacity: 0.6 }}>{p.堕落值}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${corrStage.color}60, ${corrStage.color})` }}
                initial={{ width: 0 }}
                animate={{ width: `${corrPct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              />
            </div>
            <div className="flex justify-between text-[8px] font-mono text-white/12">
              <span>0</span><span>250</span><span>500</span>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ===== Social Circle ===== */}
      {hasSocialCircle && (
        <SectionCard label="社交圈">
          <div className="flex flex-wrap gap-2">
            {Object.entries(p.社交圈 as Record<string, string>).map(([who, rel]) => (
              <span key={who}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/55">
                <span className="text-white/25">{who}</span>
                <span className="text-white/15 mx-1">·</span>
                {rel as string}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ===== Status Effects ===== */}
      {hasStatus && (
        <SectionCard label="状态">
          <div className="space-y-2">
            {Object.entries(p.状态 as Record<string, any>).map(([key, val]) => (
              <div key={key} className="flex items-start gap-3">
                <span className="text-[10px] font-mono text-amber-300/70 shrink-0">{key}</span>
                <span className="text-[10px] font-mono text-white/40">{val.描述}</span>
                {val.持续时间 && (
                  <span className="text-[9px] font-mono text-white/20 ml-auto shrink-0">{val.持续时间}</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ===== Body Attributes ===== */}
      {bodyAttr && (
        <SectionCard label="身体属性">
          <div className="grid grid-cols-3 gap-4">
            {(['生命', '能量', 'SAN'] as const).map(key => {
              const attr = bodyAttr[key] as { 当前: number; 上限: number } | undefined;
              if (!attr) return null;
              const pct = (attr.当前 / attr.上限) * 100;
              const colors: Record<string, string> = {
                '生命': '#ef4444', '能量': '#3b82f6', 'SAN': '#a78bfa',
              };
              const c = colors[key];
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[9px] font-mono text-white/30">{key}</span>
                    <span className="text-[10px] font-mono text-white/50">{attr.当前}/{attr.上限}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}40, ${c})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ===== Base + Special Attributes ===== */}
      {(baseAttr || specialAttr) && (
        <SectionCard label="属性">
          <div className="grid grid-cols-3 gap-x-6 gap-y-2.5">
            {baseAttr && (['力量', '体质', '精神', '敏捷'] as const).map(key => {
              const v = baseAttr[key];
              if (v === undefined) return null;
              return (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-white/30">{key}</span>
                  <span className="text-[11px] font-mono text-white/60">{v}</span>
                </div>
              );
            })}
            {specialAttr && (['幸运', '魅力'] as const).map(key => {
              const v = specialAttr[key];
              if (v === undefined) return null;
              return (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-white/30">{key}</span>
                  <span className="text-[11px] font-mono text-amber-300/60">{v}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ===== Skills ===== */}
      {hasSkills && (
        <SectionCard label="技能">
          <div className="space-y-3">
            {Object.entries(p.技能 as Record<string, any>).map(([skillName, skill]) => {
              const skillRating = RATING_STYLES[skill.等级];
              return (
                <div key={skillName} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-display text-white/70">{skillName}</span>
                    {skillRating && (
                      <span className={`text-[8px] font-mono px-1.5 py-px rounded border ${skillRating.bg} ${skillRating.text} ${skillRating.border}`}>
                        {skill.等级}
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-white/20 ml-auto">熟练 {skill.熟练度}</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/40 leading-relaxed">{skill.描述}</p>
                  {skill.分支 && Object.keys(skill.分支).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-2 border-l border-white/[0.04]">
                      {Object.entries(skill.分支 as Record<string, any>).map(([branchName, branch]) => (
                        <span key={branchName}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/[0.04] text-white/45">
                          {branchName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ===== Equipment ===== */}
      {p.奇物 && (
        <SectionCard label="奇物">
          <div className="space-y-3">
            {(Object.entries(p.奇物 as Record<string, Record<string, any>>)).map(([category, items]) => {
              const itemEntries = Object.entries(items);
              if (itemEntries.length === 0) return null;
              const catLabel: Record<string, string> = { '灵宝': '灵宝', '诡物': '诡物', '物品': '物品' };
              return (
                <div key={category} className="space-y-2">
                  <span className="text-[9px] font-mono text-aether-cyan/40">{catLabel[category] ?? category}</span>
                  {itemEntries.map(([itemName, item]) => {
                    const itemRating = item.等级 ? RATING_STYLES[item.等级] : null;
                    return (
                      <div key={itemName} className="pl-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-display text-white/65">{itemName}</span>
                          {itemRating && (
                            <span className={`text-[8px] font-mono px-1.5 py-px rounded border ${itemRating.bg} ${itemRating.text} ${itemRating.border}`}>
                              {item.等级}
                            </span>
                          )}
                          {item.数量 && <span className="text-[9px] font-mono text-white/20">×{item.数量}</span>}
                        </div>
                        {item.描述 && <p className="text-[10px] font-mono text-white/40">{item.描述}</p>}
                        {item.效果 && typeof item.效果 === 'object' && (
                          <div className="space-y-0.5">
                            {Object.entries(item.效果 as Record<string, string>).map(([effKey, effVal]) => (
                              <p key={effKey} className="text-[9px] font-mono text-white/35">
                                <span className="text-white/20">{effKey}：</span>{effVal}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

/* ============================================================
   SECTION CARD — Reusable detail section wrapper
   ============================================================ */
function SectionCard({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.05] p-4"
      style={{ background: 'linear-gradient(180deg, rgba(10,16,28,0.5) 0%, rgba(6,10,18,0.55) 100%)' }}>
      {label && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono text-aether-cyan/40 tracking-[0.1em] uppercase">{label}</span>
          <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/[0.06] to-transparent" />
        </div>
      )}
      {children}
    </div>
  );
}
