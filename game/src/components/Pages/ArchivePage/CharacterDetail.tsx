import { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Shield, Zap, Database } from 'lucide-react';
import { Modal } from '../../Feedback';
import { getAffectionStage, getFriendlinessStage, getCorruptionStage } from '../../../sillytavern/social-stages';
import {
  CharacterCard,
  RATING_STYLES,
  ITEM_RANK_STYLES,
  CATEGORY_META,
  getStage,
  PROFICIENCY_STYLES,
} from './constants';

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
export default function CharacterDetail({ char }: { char: CharacterCard }) {
  const p = char.profile;
  const [selectedSkill, setSelectedSkill] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<any>(null);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [uterusOpen, setUterusOpen] = useState(false);

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

  // 子宫数据
  const uterus = p.子宫 as Record<string, any> | undefined;
  const uterusPhase = uterus?.['生理周期']?.['当前阶段'] as string | undefined;
  const uterusSemen = uterus?.['宫内精液'] as { 总量?: number; 来源列表?: Array<{ 来源: string; 容量: number; 注入时间: string }> } | undefined;
  const uterusPreg = uterus?.['怀孕状态'] as { 状态?: string; 父方?: string } | undefined;
  const hasUterus = !!uterusPhase;
  const uterusPregActive = uterusPreg?.['状态'] && uterusPreg['状态'] !== '未孕';
  const uterusHasSemen = (uterusSemen?.['总量'] ?? 0) > 0 && (uterusSemen?.['来源列表']?.length ?? 0) > 0;
  const uterusTitle = hasUterus
    ? (uterusPregActive
        ? `子宫 · ${uterusPreg!['状态']}`
        : `子宫 · ${uterusPhase}` + (uterusHasSemen ? ` · 体内 ${uterusSemen!['总量']}ml` : ''))
    : '';

  // 孕程进度
  const pregWeeks = uterusPregActive && uterus?.['怀孕状态']?.['受孕日期']
    ? Math.floor((Date.now() - new Date('2026-04-06').getTime()) / 86400000 / 7) + 2 : 0;
  const bodyAttr = p.身体属性;
  const baseAttr = p.基础属性;
  const specialAttr = p.特殊属性;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="px-4 md:px-12 py-6 md:py-8 space-y-8 md:space-y-10"
    >
      {/* ===== Hero Header ===== */}
      <div className="border-l-4 border-aether-cyan pl-6 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-tighter text-white/90">{char.name}</h1>
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

      {/* ===== Libido (female only) ===== */}
      {isFemale && p.性欲值 !== undefined && (
        <section className="space-y-2">
          <SectionHeader title="性欲值" Icon={Zap} />
          <div className="space-y-1.5">
            <div className="h-2 bg-white/[0.04] border border-white/[0.08] overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400/40 to-amber-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((p.性欲值 / 100) * 100, 100)}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              />
              <span className="absolute right-0 -top-5 text-[10px] font-mono text-amber-300/70 tabular-nums">
                {p.性欲值}
              </span>
            </div>
            <div className="flex justify-between text-[8px] font-mono text-white/12">
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>
        </section>
      )}

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

      {/* ===== Status Effects ===== */}
      {hasStatus && (
        <section className="space-y-3">
          <SectionHeader title="状态" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(p.状态 as Record<string, any>).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setSelectedStatus({ name: key, ...val })}
                className="text-xs font-mono px-4 py-1.5 bg-aether-cyan/[0.08] border border-aether-cyan/40 text-white/85 hover:bg-aether-cyan/[0.14] hover:border-aether-cyan/60 shadow-[0_0_8px_rgba(0,242,255,0.12)] hover:shadow-[0_0_14px_rgba(0,242,255,0.22)] transition-all clickable font-bold"
              >
                {key}
              </button>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
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

      {/* ===== 身体开发 (collapsed by default, female only) ===== */}
      {p.身体开发 && Object.keys(p.身体开发).length > 0 && (
        <section className="border border-dashed border-pink-400/15 bg-pink-400/[0.02] px-5 py-4 space-y-4">
          <button
            onClick={() => setBodyOpen(!bodyOpen)}
            className="flex items-center gap-3 w-full text-left group"
          >
            <span className="font-display text-sm tracking-[0.15em] uppercase text-pink-300/60 group-hover:text-pink-300/85 transition-colors">
              身体开发
            </span>
            <div className="flex-1 h-px bg-[repeating-linear-gradient(to_right,transparent,transparent_3px,rgba(244,114,182,0.15)_3px,rgba(244,114,182,0.15)_5px)]" />
            <span className="text-[10px] font-mono text-pink-300/30 group-hover:text-pink-300/50 transition-colors shrink-0">
              {bodyOpen ? '收起 ▲' : '展开 ▼'}
            </span>
          </button>
          {bodyOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 overflow-hidden"
            >
              {Object.entries(p.身体开发 as Record<string, any>).map(([part, data]) => (
                <div key={part} className="p-3 border border-pink-400/25 bg-black/45">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-display font-bold text-pink-300/70">{part}</span>
                    <span className="text-[10px] font-mono text-pink-300/40">{data.使用次数}次</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/35 leading-relaxed">{data.描述}</p>
                </div>
              ))}
            </motion.div>
          )}
        </section>
      )}

      {/* ===== 子宫 ===== */}
      {hasUterus && (
        <section className="border border-pink-400/10 bg-gradient-to-b from-pink-400/[0.03] to-transparent overflow-hidden">
          <button
            onClick={() => setUterusOpen(!uterusOpen)}
            className="flex items-center gap-3 w-full text-left group px-5 py-4 hover:bg-pink-400/[0.02] transition-colors"
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              uterusPregActive ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]' :
              uterusPhase === '排卵期' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' :
              uterusPhase === '经期' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]' :
              'bg-sky-400/60'
            }`} />
            <span className="font-display text-sm tracking-[0.1em] text-pink-200/65 group-hover:text-pink-200/90 transition-colors">
              {uterusTitle}
            </span>
            <div className="flex-1 h-px bg-[repeating-linear-gradient(to_right,transparent,transparent_3px,rgba(244,114,182,0.12)_3px,rgba(244,114,182,0.12)_5px)]" />
            <span className="text-[9px] font-mono text-pink-300/25 group-hover:text-pink-300/45 transition-colors shrink-0">
              {uterusOpen ? '收起 ▲' : '展开 ▼'}
            </span>
          </button>
          {uterusOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4">

                {/* ── 怀孕状态卡片 ── */}
                {uterusPregActive && (
                  <div className="relative overflow-hidden border border-rose-400/15 bg-gradient-to-br from-rose-400/[0.06] to-rose-400/[0.01] p-4">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-400/[0.03] rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="relative flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono tracking-[0.2em] text-rose-300/40 uppercase">妊娠</span>
                          <span className={`text-xs font-display font-bold ${
                            uterusPreg!['状态'] === '受精' ? 'text-violet-300' :
                            uterusPreg!['状态'] === '早孕' ? 'text-rose-300' :
                            uterusPreg!['状态'] === '中孕' ? 'text-rose-400' :
                            uterusPreg!['状态'] === '晚孕' ? 'text-red-400' :
                            'text-amber-300'
                          }`}>{uterusPreg!['状态']}</span>
                          <span className="text-[10px] font-mono text-rose-300/25">· 第 {pregWeeks} 周</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-white/20">
                          <span>父方 <span className="text-white/40">{uterusPreg!['父方'] || '—'}</span></span>
                          <span className="text-white/10">|</span>
                          <span>受孕 <span className="text-white/40">{uterus?.['怀孕状态']?.['受孕日期'] || '—'}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 宫内精液卡片 ── */}
                {uterusHasSemen && (
                  <div className="border border-rose-400/10 bg-rose-400/[0.02] p-4">
                    <span className="text-[9px] font-mono tracking-[0.12em] text-rose-300/40 uppercase">宫内精液</span>
                    <div className="mt-2 space-y-1.5">
                      {uterusSemen!['来源列表']?.map((src, i) => {
                        const shortDate = src.注入时间
                          ? src.注入时间.replace(/^\d{4}年/, '').replace(/日-.*$/, '日').replace(/日$/, '').replace(/月/, '/').replace(/日/, '')
                          : '';
                        return (
                          <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-white/30">
                            <span className="text-white/45">{src.来源}</span>
                            <span className="text-white/10">·</span>
                            <span className="text-rose-200/50 tabular-nums">{src.容量} ml</span>
                            {shortDate && (
                              <>
                                <span className="text-white/10">·</span>
                                <span className="text-white/15" title={src.注入时间}>{shortDate}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </section>
      )}

      {/* ===== Skills ===== */}
      {hasSkills && (
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 border border-aether-cyan/40 flex items-center justify-center shrink-0">
              <Database size={16} className="text-aether-cyan" />
            </div>
            <h2 className="font-display text-xl tracking-widest uppercase text-white/90">技能</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-aether-cyan/30 to-transparent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-1">
            {Object.entries(p.技能 as Record<string, any>).map(([skillName, skillData]) => {
              const skillRank = skillData.等级 ? RATING_STYLES[skillData.等级] : null;
              const prof = skillData?.熟练度 ?? 0;
              const profStage = getStage(prof);
              const ps = PROFICIENCY_STYLES[profStage] || PROFICIENCY_STYLES['初窥'];
              return (
                <motion.button
                  key={skillName}
                  onClick={() => setSelectedSkill({ name: skillName, ...skillData })}
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                  className="relative p-4 bg-cyan-950/55 border border-cyan-400/25 hover:border-cyan-400/50 hover:scale-[1.02] hover:z-10 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] text-left group transition-all duration-200 overflow-hidden clickable shadow-[0_0_20px_rgba(6,182,212,0.06)]"
                >
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <div className="relative group/prof inline-flex" title={`${prof} / 999`}>
                      <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${ps.border} ${ps.bg} ${ps.text} ${ps.glow}`}>
                        {profStage}
                      </span>
                      <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/70 font-mono tracking-wider whitespace-nowrap opacity-0 group-hover/prof:opacity-100 transition-opacity pointer-events-none">
                        {prof} / 999
                      </span>
                    </div>
                    {skillRank && (
                      <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${skillRank.border} ${skillRank.bg} ${skillRank.text} ${skillRank.glow}`}>
                        {skillData.等级}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-28">
                    {skillName}
                  </h3>
                  <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">
                    {skillData.描述 || ''}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Equipment ===== */}
      {p.所持物品 && (['灵宝', '诡物', '物品'] as const).map((category) => {
        const items = p.所持物品[category] ?? {};
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-1">
              {itemEntries.map(([itemName, itemData]: [string, any]) => {
                const itemRating = itemData.等级 ? ITEM_RANK_STYLES[itemData.等级] : null;
                const qty = itemData.数量 ?? 1;
                return (
                  <motion.button
                    key={itemName}
                    onClick={() => setSelectedItem({ name: itemName, category, ...itemData })}
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                    className="relative p-5 bg-cyan-950/55 border border-cyan-400/25 hover:border-cyan-400/50 hover:scale-[1.02] hover:z-10 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] text-left group transition-all duration-200 overflow-hidden clickable shadow-[0_0_20px_rgba(6,182,212,0.06)]"
                  >
                    <div className="absolute top-3 right-3">
                      {itemRating && (
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold font-display border ${itemRating.border} ${itemRating.bg} ${itemRating.text} ${itemRating.glow}`}>
                          {itemData.等级}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-16 truncate">
                      {itemName}
                      <span className="text-[10px] font-mono text-white/25 ml-2">×{qty}</span>
                    </h3>
                    <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">
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
          const prof = selectedSkill?.熟练度 ?? 0;
          const stage = getStage(prof);
          return (
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedSkill.name}</h3>
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
                    <div className="space-y-1">
                      {Object.entries(selectedSkill.副作用 as Record<string, string>).map(([k, v]) => (
                        <p key={k} className="text-sm tracking-wide text-aether-red/80">{k}：{v}</p>
                      ))}
                    </div>
                  </div>
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
    </motion.div>
  );
}
