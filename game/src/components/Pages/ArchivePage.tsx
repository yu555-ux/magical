import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { FileText } from 'lucide-react';
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

const RATING_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  '灭世': { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/50' },
  '夷地': { bg: 'bg-red-400/10', text: 'text-red-400/80', border: 'border-red-400/30' },
  '覆国': { bg: 'bg-orange-400/10', text: 'text-orange-400', border: 'border-orange-400/35' },
  '摧城': { bg: 'bg-amber-400/10', text: 'text-amber-400', border: 'border-amber-400/30' },
  '撼山': { bg: 'bg-yellow-400/10', text: 'text-yellow-400', border: 'border-yellow-400/30' },
  '磐岩': { bg: 'bg-green-400/10', text: 'text-green-400', border: 'border-green-400/30' },
  '凝石': { bg: 'bg-cyan-400/10', text: 'text-cyan-400', border: 'border-cyan-400/30' },
  '聚砂': { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-400/25' },
  '微尘': { bg: 'bg-slate-400/8', text: 'text-slate-400', border: 'border-slate-400/20' },
};

/* ============================================================
   ARCHIVE PAGE
   ============================================================ */
export default function ArchivePage() {
  const ss = useSillytavern();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;
  const charData: Record<string, any> = liveVars?.['主要人物'] ?? defaults.主要人物 ?? {};

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

  const groupEntries = Object.entries(groups);
  const totalChars = groupEntries.reduce((sum, [, cards]) => sum + cards.length, 0);

  return (
    <div className="h-full flex flex-col p-3 md:p-5 space-y-4 relative overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-2 shrink-0">
        <div className="w-1 h-5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.4)]" />
        <h2 className="font-display text-lg tracking-[0.12em] text-aether-cyan/90">角色档案</h2>
        <span className="text-[10px] font-mono text-white/20">{totalChars}人</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
        {groupEntries.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-[12px] font-mono text-white/20">暂无角色数据</span>
          </div>
        ) : (
          groupEntries.map(([groupKey, cards], gi) => (
            <motion.div
              key={groupKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.08, duration: 0.35 }}
            >
              {/* Group label */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-[10px] font-mono text-aether-cyan/50 tracking-[0.1em] uppercase">
                  {GROUP_LABELS[groupKey] ?? groupKey}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/[0.08] to-transparent" />
              </div>

              {/* Character cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {cards.map((char, ci) => (
                  <CharacterCard key={char.name} char={char} delay={gi * 0.08 + ci * 0.06} />
                ))}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   CHARACTER CARD
   ============================================================ */
function CharacterCard({ char, delay }: { char: CharacterCard; delay: number }) {
  const p = char.profile;
  const isFemale = p.好感值 !== undefined;
  const affection = p.好感值 ?? p.友善值 ?? 0;
  const stage = isFemale ? getAffectionStage(affection) : getFriendlinessStage(affection);
  const corrStage = isFemale && p.堕落值 !== undefined ? getCorruptionStage(p.堕落值) : null;
  const ratingStyle = p.评级 ? RATING_STYLES[p.评级] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl overflow-hidden border border-white/[0.05]"
      style={{ background: 'linear-gradient(180deg, rgba(10,16,28,0.85) 0%, rgba(6,10,18,0.9) 100%)' }}
    >
      {/* Top accent */}
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${stage.color}60, transparent)` }} />

      <div className="px-4 py-3.5 space-y-3">
        {/* Name + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[14px] font-display font-bold text-white/90 tracking-wide">{char.name}</h3>
          <span className="text-[11px] font-mono text-white/35">{p.年龄}岁</span>
          {p.梦境NPC && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-400/12 text-purple-300/70 border border-purple-400/20">梦境NPC</span>
          )}
          {ratingStyle && (
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${ratingStyle.bg} ${ratingStyle.text} ${ratingStyle.border}`}>
              {p.评级}
            </span>
          )}
        </div>

        {/* Identity */}
        <p className="text-[11px] font-mono text-white/55 leading-relaxed">{p.身份}</p>

        {/* Affection / Friendliness */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-white/30">{isFemale ? '好感' : '友善'}</span>
          <span className="text-[13px] font-display font-bold italic tracking-wide" style={{ color: stage.color }}>
            {stage.name}
          </span>
          <span className="text-[10px] font-mono ml-auto" style={{ color: stage.color, opacity: 0.6 }}>{affection}</span>
        </div>

        {/* Corruption (female only) */}
        {corrStage && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-white/30">堕落</span>
            <span className="text-[11px] font-display font-bold italic tracking-wide" style={{ color: corrStage.color }}>
              {corrStage.name}
            </span>
            <span className="text-[10px] font-mono ml-auto" style={{ color: corrStage.color, opacity: 0.6 }}>{p.堕落值}</span>
          </div>
        )}

        {/* Location + Action */}
        <div className="space-y-1 pt-1 border-t border-white/[0.04]">
          <div className="flex items-start gap-2">
            <span className="text-[9px] font-mono text-white/25 uppercase shrink-0 w-8">位置</span>
            <span className="text-[10px] font-mono text-white/60">{p.当前位置}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[9px] font-mono text-white/25 uppercase shrink-0 w-8">行动</span>
            <span className="text-[10px] font-mono text-white/60">{p.当前行动}</span>
          </div>
          {p.当前想法 && (
            <div className="flex items-start gap-2">
              <span className="text-[9px] font-mono text-white/25 uppercase shrink-0 w-8">想法</span>
              <span className="text-[10px] font-mono text-white/40 italic">{p.当前想法}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
