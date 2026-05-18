import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users } from 'lucide-react';
import { Modal } from '../Feedback';
import { useSillytavern } from '../../hooks/useSillytavern';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';

/* ===== Constants ===== */
type RelationType = '盟友' | '中立' | '敌对' | '未知';
interface TypeVisuals { text: string; border: string; bg: string; glow: string }

const TYPE_VISUALS: Record<RelationType, TypeVisuals> = {
  '盟友': { text: 'text-aether-cyan', border: 'border-aether-cyan', bg: 'bg-aether-cyan/10', glow: 'shadow-[0_0_15px_rgba(0,242,255,0.4)]' },
  '中立': { text: 'text-aether-blue', border: 'border-aether-blue', bg: 'bg-aether-blue/10', glow: '' },
  '敌对': { text: 'text-red-400', border: 'border-red-500/60', bg: 'bg-red-500/10', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
  '未知': { text: 'text-white/50', border: 'border-white/20', bg: 'bg-white/5', glow: '' },
};

const NODE_COLOR = '#00f2ff';

/* ===== Affection / Corruption stages ===== */
const AFFECTION_STAGES = [
  { min: -200, max: -150, name: '厌恶', color: '#ef4444' },
  { min: -150, max: -100, name: '敌视', color: '#f97316' },
  { min: -100, max: -50,  name: '冷淡', color: '#9ca3af' },
  { min: -50,  max: 0,    name: '平淡', color: '#eab308' },
  { min: 0,    max: 50,   name: '友善', color: '#22c55e' },
  { min: 50,   max: 100,  name: '亲密', color: '#3b82f6' },
  { min: 100,  max: 150,  name: '倾心', color: '#a78bfa' },
  { min: 150,  max: 200,  name: '挚爱', color: '#f472b6' },
];

const CORRUPTION_STAGES = [
  { min: 0,   max: 100, name: '纯洁', color: '#22c55e' },
  { min: 100, max: 200, name: '动摇', color: '#eab308' },
  { min: 200, max: 300, name: '微骚', color: '#f97316' },
  { min: 300, max: 400, name: '淫靡', color: '#ef4444' },
  { min: 400, max: 500, name: '欲奴', color: '#a855f7' },
];

const FRIENDLINESS_STAGES = [
  { min: -200, max: -150, name: '敌视', color: '#ef4444' },
  { min: -150, max: -100, name: '厌恶', color: '#f97316' },
  { min: -100, max: -50,  name: '疏远', color: '#9ca3af' },
  { min: -50,  max: 0,    name: '平淡', color: '#eab308' },
  { min: 0,    max: 50,   name: '友善', color: '#22c55e' },
  { min: 50,   max: 100,  name: '信任', color: '#3b82f6' },
  { min: 100,  max: 150,  name: '知己', color: '#a78bfa' },
  { min: 150,  max: 200,  name: '生死之交', color: '#f472b6' },
];

function getAffectionStage(v: number) { return AFFECTION_STAGES.find((s) => v >= s.min && v <= s.max) ?? AFFECTION_STAGES[3]; }
function getFriendlinessStage(v: number) { return FRIENDLINESS_STAGES.find((s) => v >= s.min && v <= s.max) ?? FRIENDLINESS_STAGES[3]; }
function getCorruptionStage(v: number) { return CORRUPTION_STAGES.find((s) => v >= s.min && v <= s.max) ?? CORRUPTION_STAGES[0]; }

/* ===== Helpers ===== */
function inferType(rel: string): RelationType {
  if (/母|父|姐|妹|兄|弟|家|亲/.test(rel)) return '盟友';
  if (/敌|仇|恨|杀/.test(rel)) return '敌对';
  return '未知';
}
function getLevelHint(rel: string): number {
  if (/母|父/.test(rel)) return 90;
  if (/姐|妹|兄|弟/.test(rel)) return 78;
  return 50;
}

function findCharProfile(chars: any, name: string): any | null {
  for (const [, groups] of Object.entries(chars)) {
    if (!groups || typeof groups !== 'object') continue;
    for (const [, members] of Object.entries(groups as Record<string, any>)) {
      if (!members || typeof members !== 'object') continue;
      if (members[name]) return members[name];
    }
  }
  return null;
}

/* ===== Local types ===== */
interface LiveNode { id: string; name: string; relation: string; type: RelationType; level: number; x: number; y: number; size: number }
interface LiveEdge { from: string; to: string; label: string; stroke: string; opacity: number; dash?: boolean }

/* ============================================================
   SOCIAL PAGE
   ============================================================ */
export default function SocialPage() {
  const ss = useSillytavern();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;
  const socialData: Record<string, { 关系: string; 社交圈?: Record<string, string> }> =
    liveVars?.['主角']?.['社交'] ?? defaults.主角?.社交 ?? {};
  const charData: Record<string, any> = liveVars?.['主要人物'] ?? defaults.主要人物 ?? {};
  const playerName = ss.settings?.userName ?? '我';

  const [selectedNode, setSelectedNode] = useState<LiveNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LiveNode | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphBounds, setGraphBounds] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = graphRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setGraphBounds({ width: rect.width, height: rect.height });
    const obs = new ResizeObserver((e) => { const { width, height } = e[0].contentRect; setGraphBounds((p) => (p.width !== width || p.height !== height ? { width, height } : p)); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setAnimPhase(0);
    const t = setTimeout(() => setAnimPhase(1), 800);
    return () => clearTimeout(t);
  }, [socialData]);

  // ── Layout ──
  const cx = graphBounds.width / 2;
  const cy = graphBounds.height / 2;
  const orbitR = Math.min(graphBounds.width, graphBounds.height) * 0.30;

  const nodesWithPositions = useMemo((): LiveNode[] => {
    const entries = Object.entries(socialData);
    if (entries.length === 0) return [];
    return entries.map(([name, data], i) => {
      const angle = (-90 + i * 120) * (Math.PI / 180);
      const level = getLevelHint(data.关系);
      return {
        id: name, name, relation: data.关系, type: inferType(data.关系), level,
        x: Math.cos(angle) * orbitR + cx,
        y: Math.sin(angle) * orbitR + cy,
        size: 48 + (level / 100) * 18,
      };
    });
  }, [socialData, orbitR, cx, cy]);

  const posMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    nodesWithPositions.forEach((n) => m.set(n.id, { x: n.x, y: n.y }));
    return m;
  }, [nodesWithPositions]);

  const edgeData = useMemo((): LiveEdge[] => {
    const edges: LiveEdge[] = [];
    const nameSet = new Set(nodesWithPositions.map((n) => n.name));
    for (const [name, data] of Object.entries(socialData)) {
      edges.push({ from: '我', to: name, label: data.关系, stroke: NODE_COLOR, opacity: 0.4 });
      if (data.社交圈) {
        for (const [friend, rel] of Object.entries(data.社交圈)) {
          if (!nameSet.has(friend)) continue;
          const dup = edges.find((e) => (e.from === name && e.to === friend) || (e.from === friend && e.to === name));
          if (!dup) edges.push({ from: name, to: friend, label: rel, stroke: '#a78bfa', opacity: 0.3, dash: true });
        }
      }
    }
    return edges;
  }, [socialData, nodesWithPositions]);

  const getPos = (id: string) => id === '我' ? { x: cx, y: cy } : (posMap.get(id) ?? null);

  // ── Selected character full profile ──
  const selProfile = selectedNode ? findCharProfile(charData, selectedNode.name) : null;
  const selSocial = selectedNode ? socialData[selectedNode.name] ?? null : null;
  const selAffection = selProfile ? (selProfile.好感值 ?? selProfile.友善值 ?? 0) : 0;
  const selCorruption = selProfile?.堕落值 ?? 0;
  const selIsFemale = selProfile && selProfile.好感值 !== undefined;
  const selAffStage = selIsFemale ? getAffectionStage(selAffection) : getFriendlinessStage(selAffection);
  const selCorrStage = selIsFemale ? getCorruptionStage(selCorruption) : null;

  // ── Hover tooltip data ──
  const hoverProfile = hoveredNode ? findCharProfile(charData, hoveredNode.name) : null;
  const hoverAffection = hoverProfile ? (hoverProfile.好感值 ?? hoverProfile.友善值 ?? 0) : 0;
  const hoverCorruption = hoverProfile?.堕落值 ?? 0;
  const isFemaleHover = hoverProfile && hoverProfile.好感值 !== undefined;
  const affStage = isFemaleHover ? getAffectionStage(hoverAffection) : getFriendlinessStage(hoverAffection);
  const corrStage = isFemaleHover ? getCorruptionStage(hoverCorruption) : null;

  const isTopLevel = animPhase >= 1;

  return (
    <div className="h-full flex flex-col p-3 md:p-5 space-y-3 relative">
      {/* ── Header ── */}
      <div className="relative z-10 flex items-center gap-3 px-2">
        <div className="w-1 h-5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.4)]" />
        <h2 className="font-display text-lg tracking-[0.12em] text-aether-cyan/90">社交关系</h2>
        <span className="text-[10px] font-mono text-white/20">{nodesWithPositions.length}人</span>
      </div>

      {/* ── Graph ── */}
      <div ref={graphRef} className="flex-1 relative overflow-hidden rounded-xl border border-white/[0.04]"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,242,255,0.04) 0%, transparent 65%), rgba(3,5,10,0.7)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-aether-cyan/[0.02] to-transparent" />
        <CornerMark tl /><CornerMark tr /><CornerMark bl /><CornerMark br />

        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          {/* ===== Lines (Phase 1) ===== */}
          <AnimatePresence>
            {isTopLevel && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="absolute inset-0">
                {edgeData.map((edge, i) => {
                  const p1 = getPos(edge.from), p2 = getPos(edge.to);
                  if (!p1 || !p2) return null;
                  const dx = p2.x - p1.x, dy = p2.y - p1.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const ang = Math.atan2(dy, dx) * (180 / Math.PI);
                  const mx = p1.x + dx / 2, my = p1.y + dy / 2;
                  const labelAng = dx < 0 ? ang + 180 : ang;
                  return (
                    <React.Fragment key={`e-${i}`}>
                      <motion.div className="absolute pointer-events-none"
                        style={{
                          left: p1.x, top: p1.y, height: 3,
                          background: edge.dash
                            ? `repeating-linear-gradient(90deg, ${edge.stroke} 0, ${edge.stroke} 6px, transparent 6px, transparent 10px)`
                            : edge.stroke,
                          opacity: edge.opacity, transform: `rotate(${ang}deg)`, transformOrigin: '0 50%', borderRadius: '2px',
                        }}
                        initial={{ width: 0 }} animate={{ width: len }}
                        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} />
                      {/* Label along the line */}
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                        className="absolute pointer-events-none"
                        style={{
                          left: mx, top: my,
                          transform: `translate(-50%, -50%) rotate(${labelAng}deg)`,
                        }}>
                        <span className="text-[9px] font-mono tracking-wider whitespace-nowrap"
                          style={{ color: edge.stroke, opacity: 0.6, textShadow: `0 0 4px ${edge.stroke}30` }}>
                          {edge.label}
                        </span>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ===== Orbit rings ===== */}
          <div className="absolute pointer-events-none" style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)' }}>
            <div className="rounded-full border border-aether-cyan/[0.06]" style={{ width: orbitR * 2, height: orbitR * 2 }} />
          </div>
          <div className="absolute pointer-events-none" style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)' }}>
            <div className="rounded-full border border-aether-cyan/[0.04]" style={{ width: orbitR * 1.3, height: orbitR * 1.3 }} />
          </div>

          {/* ===== Centre "我" ===== */}
          <div className="absolute pointer-events-none" style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)' }}>
            <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 160, delay: 0.1 }}>
              <div className="absolute rounded-full" style={{ width: 120, height: 120, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'radial-gradient(circle, rgba(0,242,255,0.06) 0%, transparent 70%)', animation: 'pulse-slow 3s ease-in-out infinite' }} />
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center border-2 border-aether-cyan"
                style={{ background: 'linear-gradient(135deg, rgba(0,30,40,0.95), rgba(0,8,14,0.98))', boxShadow: `0 0 36px ${NODE_COLOR}40, 0 0 80px ${NODE_COLOR}12` }}>
                <span className="font-display text-2xl font-bold text-aether-cyan select-none" style={{ textShadow: `0 0 16px ${NODE_COLOR}80` }}>{playerName[0]}</span>
              </div>
            </motion.div>
          </div>

          {/* ===== Character nodes (Phase 0) ===== */}
          {nodesWithPositions.map((node, i) => (
            <motion.button key={node.id}
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 13, stiffness: 180, delay: 0.25 + i * 0.2 }}
              style={{ position: 'absolute', left: node.x - node.size / 2, top: node.y - node.size / 2, width: node.size, height: node.size }}
              onClick={() => setSelectedNode(node)}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              className="clickable group z-10" aria-label={node.name}>
              <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500"
                style={{ margin: '-10px', boxShadow: `0 0 32px ${NODE_COLOR}30`, background: `${NODE_COLOR}04`, borderRadius: '50%' }} />
              <div className="w-full h-full rounded-full border-2 flex items-center justify-center transition-all duration-400 group-hover:scale-110"
                style={{ borderColor: `${NODE_COLOR}80`, background: 'linear-gradient(135deg, rgba(6,12,20,0.92), rgba(3,6,12,0.95))', boxShadow: `0 0 18px ${NODE_COLOR}20` }}>
                <span className="font-display font-bold select-none" style={{ fontSize: Math.max(14, node.size * 0.3), color: NODE_COLOR, textShadow: `0 0 8px ${NODE_COLOR}35` }}>{node.name[0]}</span>
              </div>
            </motion.button>
          ))}

          {/* ===== Hover Tooltip ===== */}
          <AnimatePresence>
            {hoveredNode && hoverProfile && (
              <motion.div
                key={hoveredNode.id}
                initial={{ opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.94 }}
                transition={{ type: 'spring', damping: 22, stiffness: 340, mass: 0.6 }}
                className="absolute z-50 pointer-events-none"
                style={{
                  left: hoveredNode.x,
                  top: hoveredNode.y + hoveredNode.size / 2 + 16,
                  transform: 'translate(-50%, 0)',
                }}>
                <div
                  className="relative rounded-xl overflow-hidden backdrop-blur-xl"
                  style={{
                    minWidth: 170,
                    background: 'linear-gradient(180deg, rgba(10,16,28,0.96) 0%, rgba(6,10,18,0.98) 100%)',
                    border: '1px solid rgba(0,242,255,0.12)',
                    boxShadow: '0 0 0 1px rgba(0,242,255,0.04), 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(0,242,255,0.04)',
                  }}>
                  {/* Accent line */}
                  <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,242,255,0.5), transparent)' }} />

                  <div className="px-4 py-3">
                    {/* Name */}
                    <p className="text-[13px] font-display font-bold text-white/85 tracking-wide mb-3">
                      {hoveredNode.name}
                    </p>

                    {/* Affection / Friendliness — stage name as hero */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[9px] font-mono text-white/28 tracking-[0.08em] uppercase">{isFemaleHover ? '好感' : '友善'}</span>
                        <span className="text-xl font-display font-bold italic tracking-[0.12em]" style={{ color: affStage.color, textShadow: `0 0 20px ${affStage.color}40, 0 0 40px ${affStage.color}15` }}>{affStage.name}</span>
                      </div>
                      <span className="text-[10px] font-mono tracking-tight" style={{ color: affStage.color, opacity: 0.5 }}>{hoverAffection}</span>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${Math.abs(hoverAffection) / 200 * 100}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${affStage.color}60, ${affStage.color})`, boxShadow: `0 0 6px ${affStage.color}30` }} />
                      </div>
                    </div>

                    {/* Corruption — stage name as hero (female only) */}
                    {isFemaleHover && hoverCorruption !== undefined && (
                      <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[9px] font-mono text-white/28 tracking-[0.08em] uppercase">堕落</span>
                          <span className="text-xl font-display font-bold italic tracking-[0.12em]" style={{ color: corrStage!.color, textShadow: `0 0 20px ${corrStage!.color}40, 0 0 40px ${corrStage!.color}15` }}>{corrStage!.name}</span>
                        </div>
                        <span className="text-[10px] font-mono tracking-tight" style={{ color: corrStage!.color, opacity: 0.5 }}>{hoverCorruption}</span>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${hoverCorruption / 500 * 100}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${corrStage!.color}50, ${corrStage!.color})`, boxShadow: `0 0 6px ${corrStage!.color}25` }} />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Modal ── */}
      <Modal isOpen={!!selectedNode} onClose={() => setSelectedNode(null)} title="">
        {selectedNode && selProfile && (
          <div className="space-y-5" style={{ minWidth: 430, maxWidth: 520 }}>
            {/* ── Hero: avatar + name + identity ── */}
            <div className="flex gap-5">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ margin: '-8px', boxShadow: `0 0 28px ${NODE_COLOR}25` }} />
                <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl font-bold font-display"
                  style={{ borderColor: `${NODE_COLOR}70`, color: NODE_COLOR, background: 'linear-gradient(135deg, rgba(0,30,40,0.95), rgba(0,8,14,0.98))', boxShadow: `0 0 20px ${NODE_COLOR}20` }}>
                  {selectedNode.name[0]}
                </div>
              </div>
              <div className="min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-xl font-display font-bold text-white/95 tracking-wide">{selectedNode.name}</h3>
                  <span className="text-[12px] font-mono text-white/45 font-bold">{selProfile.年龄}岁</span>
                  {selProfile.梦境NPC && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-400/12 text-purple-300/70 border border-purple-400/20">梦境NPC</span>}
                </div>
                <p className="text-[12px] text-white/80 font-mono leading-relaxed">{selProfile.身份}</p>
              </div>
            </div>

            {/* ── Affection & Corruption bars ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[9px] font-mono text-white/70 tracking-[0.08em] uppercase">{selIsFemale ? '好感' : '友善'}</span>
                  <span className="text-[15px] font-display font-bold italic tracking-[0.1em]" style={{ color: selAffStage.color, textShadow: `0 0 16px ${selAffStage.color}30` }}>{selAffStage.name}</span>
                </div>
                <span className="text-[11px] font-mono" style={{ color: selAffStage.color, opacity: 0.85 }}>{selAffection}</span>
                <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: `${selAffStage.color}10` }}>
                  <div
                    className="h-full rounded-full" style={{ width: `${Math.abs(selAffection) / 200 * 100}%`, background: `linear-gradient(90deg, ${selAffStage.color}80, ${selAffStage.color})` }} />
                </div>
              </div>
              {selIsFemale && selCorruption !== undefined && (
                <div className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[9px] font-mono text-white/70 tracking-[0.08em] uppercase">堕落</span>
                    <span className="text-[15px] font-display font-bold italic tracking-[0.1em]" style={{ color: selCorrStage!.color, textShadow: `0 0 16px ${selCorrStage!.color}30` }}>{selCorrStage!.name}</span>
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: selCorrStage!.color, opacity: 0.85 }}>{selCorruption}</span>
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: `${selCorrStage!.color}10` }}>
                    <div
                      className="h-full rounded-full" style={{ width: `${selCorruption / 500 * 100}%`, background: `linear-gradient(90deg, ${selCorrStage!.color}80, ${selCorrStage!.color})` }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

            {/* ── Status: location / action / thought ── */}
            <div className="space-y-2.5">
              <InfoRow label="位置" value={selProfile.当前位置} />
              <InfoRow label="行动" value={selProfile.当前行动} />
              <InfoRow label="想法" value={selProfile.当前想法} muted />
            </div>

            {/* ── Status effects ── */}
            {Object.keys(selProfile.状态).length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono text-white/70 tracking-[0.12em] uppercase">状态效果</span>
                {Object.entries(selProfile.状态).map(([name, s]) => (
                  <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.01]">
                    <div className="w-1 h-1 rounded-full bg-aether-cyan/50 shrink-0" />
                    <span className="text-[11px] font-mono text-white/80">{name}</span>
                    <span className="ml-auto text-[9px] font-mono text-white/50">{s.描述} · {s.持续时间}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

            {/* ── Social relation ── */}
            {selSocial && (
              <div className="p-4 rounded-xl border border-aether-cyan/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.025), rgba(0,242,255,0.005))' }}>
                <span className="text-[9px] font-mono text-aether-cyan/70 tracking-[0.1em] uppercase">社交关系</span>
                <div className="mt-2 space-y-2">
                  {/* Relationship to me: 玩家名 + 关系 */}
                  <div className="flex items-baseline gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-aether-cyan/50 shrink-0" />
                    <span className="text-[13px] font-display text-white/80 font-bold tracking-wider">{playerName}</span>
                    <span className="text-[11px] font-mono text-white/55">{selSocial.关系}</span>
                  </div>
                  {/* Social circle: 人名 + 关系 — same format */}
                  {selSocial.社交圈 && Object.entries(selSocial.社交圈).map(([name, rel]) => (
                    <div key={name} className="flex items-baseline gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-aether-cyan/35 shrink-0" />
                      <span className="text-[13px] font-display text-white/65 font-bold tracking-wider">{name}</span>
                      <span className="text-[11px] font-mono text-white/55">{rel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <style>{`@keyframes pulse-slow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }`}</style>
    </div>
  );
}

function InfoRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-lg border border-white/[0.03] bg-white/[0.005]">
      <span className="text-[9px] font-mono text-white/55 tracking-[0.1em] uppercase shrink-0 w-8 pt-0.5">{label}</span>
      <span className={`text-[12px] font-mono leading-relaxed ${muted ? 'text-white/85 italic' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function CornerMark(p: { tl?: boolean; tr?: boolean; bl?: boolean; br?: boolean }) {
  const isTop = !!(p.tl || p.tr), isLeft = !!(p.tl || p.bl);
  return (
    <div className="absolute pointer-events-none" style={{ [isTop ? 'top' : 'bottom']: 6, [isLeft ? 'left' : 'right']: 6, width: 14, height: 14 }}>
      <div className="absolute bg-aether-cyan/12" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, height: 1, width: '100%' }} />
      <div className="absolute bg-aether-cyan/12" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 1, height: '100%' }} />
    </div>
  );
}
