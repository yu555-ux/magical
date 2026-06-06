import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../Feedback';
import { useSS } from '../../hooks/SillytavernContext';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';
import { deepResolveMacros } from '../../sillytavern/prompt-assembler';

import { getAffectionStage, getFriendlinessStage, getCorruptionStage } from '../../sillytavern/social-stages';

const NODE_COLOR = '#00f2ff';

/* ===== Helpers ===== */
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
interface LiveNode { id: string; name: string; relation: string; x: number; y: number; size: number }
interface LiveEdge { from: string; to: string; label: string; stroke: string; opacity: number; dash?: boolean }

/* ============================================================
   SOCIAL PAGE
   ============================================================ */
export default function SocialPage() {
  const ss = useSS();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;
  const playerName = ss.settings?.userName || '我';
  const characterName = ss.settings?.characterName ?? 'AI';

  // Resolve macros in displayed variable values
  const socialData: Record<string, { 关系: string }> = useMemo(() => {
    const raw = liveVars?.['主角']?.['社交'] ?? defaults.主角?.社交 ?? {};
    return deepResolveMacros(raw, playerName, characterName);
  }, [liveVars, defaults, playerName, characterName]);
  const charData: Record<string, any> = useMemo(() => {
    const raw = liveVars?.['主要人物'] ?? defaults.主要人物 ?? {};
    return deepResolveMacros(raw, playerName, characterName);
  }, [liveVars, defaults, playerName, characterName]);

  const [selectedNode, setSelectedNode] = useState<LiveNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LiveNode | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphBounds, setGraphBounds] = useState({ width: 800, height: 600 });

  // ── Pan / drag ──
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef({ x: 0, y: 0 });
  const hasPanned = useRef(false);

  const handleGraphPointerDown = (e: React.PointerEvent) => {
    // Don't start drag on buttons (nodes / modal trigger)
    if ((e.target as HTMLElement).closest('button')) return;
    panOrigin.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    hasPanned.current = false;
    setIsPanning(true);
  };
  const handleGraphPointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panOrigin.current.x;
    const dy = e.clientY - panOrigin.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasPanned.current = true;
    setPanOffset({ x: dx, y: dy });
  };
  const handleGraphPointerUp = () => setIsPanning(false);

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
  const orbitR = Math.min(graphBounds.width, graphBounds.height) * (graphBounds.width < 768 ? 0.44 : 0.30);

  const nodesWithPositions = useMemo((): LiveNode[] => {
    // Mutual filter: must be in 主角.社交 AND have {{user}} in their 社交圈
    const entries = Object.entries(socialData).filter(([name]) => {
      const profile = findCharProfile(charData, name);
      if (!profile?.社交圈) return false;
      const sc = profile.社交圈;
      return '{{user}}' in sc || '<user>' in sc || (playerName && playerName in sc);
    });
    if (entries.length === 0) return [];
    return entries.map(([name, data], i) => {
      const n = entries.length;
      const angle = (-90 + i * (360 / n)) * (Math.PI / 180);
      // Affection/friendliness drives both distance and size
      const profile = findCharProfile(charData, name);
      const aff = profile ? (profile.好感值 ?? profile.友善值 ?? 0) : 0;
      const isMobile = graphBounds.width < 768;
      const distFactor = isMobile
        ? 1.8 - ((aff + 200) / 400) * 0.7   // mobile: 1.1~1.8 节点离中心更远
        : 1.6 - ((aff + 200) / 400) * 1.0;  // desktop: 0.6~1.6
      const r = orbitR * distFactor;
      const baseSize = isMobile ? 26 : 44;
      const sizeRange = isMobile ? 0.3 : 0.4;
      const sizeScale = isMobile ? 0.25 : 0.3;
      return {
        id: name, name, relation: data.关系,
        x: Math.cos(angle) * r + cx,
        y: Math.sin(angle) * r + cy,
        size: baseSize + (sizeRange + ((aff + 200) / 400) * sizeScale) * baseSize,
      };
    });
  }, [socialData, orbitR, cx, cy, charData, playerName]);

  // Reset pan when node count changes
  const prevNodeCount = useRef(0);
  useEffect(() => {
    const count = nodesWithPositions.length;
    if (count !== prevNodeCount.current) {
      setPanOffset({ x: 0, y: 0 });
      prevNodeCount.current = count;
    }
  }, [nodesWithPositions.length]);

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
      const profile = findCharProfile(charData, name);
      if (profile?.社交圈) {
        for (const [friend, rel] of Object.entries(profile.社交圈 as Record<string, string>)) {
          if (!nameSet.has(friend)) continue;
          const dup = edges.find((e) => (e.from === name && e.to === friend) || (e.from === friend && e.to === name));
          if (!dup) edges.push({ from: name, to: friend, label: rel, stroke: '#a78bfa', opacity: 0.2, dash: true });
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
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,242,255,0.04) 0%, transparent 65%), rgba(3,5,10,0.7)', cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={handleGraphPointerDown}
        onPointerMove={handleGraphPointerMove}
        onPointerUp={handleGraphPointerUp}
        onPointerLeave={handleGraphPointerUp}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-aether-cyan/[0.02] to-transparent" />
        <CornerMark tl /><CornerMark tr /><CornerMark bl /><CornerMark br />

        <div className="absolute inset-0" style={{
          zIndex: 2,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transition: isPanning ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
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
                  // Perpendicular offset above line + rotation along line direction
                  const perpX = -dy / len * 16;
                  const perpY = dx / len * 16;
                  const mx = p1.x + dx / 2 + perpX, my = p1.y + dy / 2 + perpY;
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
                      {/* Label above line, rotated along direction */}
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                        className="absolute pointer-events-none"
                        style={{ left: mx, top: my, transform: `translate(-50%, -50%) rotate(${labelAng}deg)` }}>
                        <span className="text-[9px] font-mono tracking-wider whitespace-nowrap"
                          style={{ color: edge.stroke, textShadow: `0 0 4px ${edge.stroke}20` }}>
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
              <div className="absolute rounded-full" style={{ width: graphBounds.width < 768 ? 70 : 120, height: graphBounds.width < 768 ? 70 : 120, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'radial-gradient(circle, rgba(0,242,255,0.06) 0%, transparent 70%)', animation: 'pulse-slow 3s ease-in-out infinite' }} />
              <div className={`relative rounded-full flex items-center justify-center border-2 border-aether-cyan ${graphBounds.width < 768 ? 'w-12 h-12' : 'w-20 h-20'}`}
                style={{ background: 'linear-gradient(135deg, rgba(0,30,40,0.95), rgba(0,8,14,0.98))', boxShadow: `0 0 36px ${NODE_COLOR}40, 0 0 80px ${NODE_COLOR}12` }}>
                <span className="font-display font-bold text-aether-cyan select-none whitespace-nowrap" style={{ fontSize: Math.max(10, (graphBounds.width < 768 ? 13 : 20) - playerName.length * 2), textShadow: `0 0 16px ${NODE_COLOR}80` }}>{playerName}</span>
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
                <span className="font-display font-bold select-none whitespace-nowrap" style={{ fontSize: Math.max(10, (graphBounds.width < 768 ? 13 : 16) - node.name.length * 1.5), color: NODE_COLOR, textShadow: `0 0 8px ${NODE_COLOR}35` }}>{node.name}</span>
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
          <div className="space-y-2.5 md:space-y-5 w-full md:min-w-[430px] md:max-w-[520px]">
            {/* ── Hero: avatar + name + identity ── */}
            <div className="flex gap-2.5 md:gap-5">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ margin: '-6px', boxShadow: `0 0 28px ${NODE_COLOR}25` }} />
                <div className="w-12 h-12 md:w-20 md:h-20 rounded-full border-2 flex items-center justify-center text-xl md:text-3xl font-bold font-display"
                  style={{ borderColor: `${NODE_COLOR}70`, color: NODE_COLOR, background: 'linear-gradient(135deg, rgba(0,30,40,0.95), rgba(0,8,14,0.98))', boxShadow: `0 0 20px ${NODE_COLOR}20` }}>
                  {selectedNode.name[0]}
                </div>
              </div>
              <div className="min-w-0 pt-0 md:pt-1">
                <div className="flex items-center gap-1 md:gap-2 flex-wrap mb-0 md:mb-1">
                  <h3 className="text-sm md:text-xl font-display font-bold text-white/95 tracking-wide">{selectedNode.name}</h3>
                  <span className="text-[9px] md:text-[12px] font-mono text-white/45 font-bold">{selProfile.年龄}岁</span>
                  {selProfile.梦境NPC && <span className="text-[7px] md:text-[8px] font-mono px-1 md:px-1.5 py-0.5 rounded bg-purple-400/12 text-purple-300/70 border border-purple-400/20">梦境NPC</span>}
                </div>
                <p className="text-[10px] md:text-[12px] text-white/80 font-mono leading-relaxed">{selProfile.身份}</p>
              </div>
            </div>

            {/* ── Affection & Corruption bars ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
              <div className="p-2 md:p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-baseline justify-between mb-0.5 md:mb-1">
                  <span className="text-[8px] md:text-[9px] font-mono text-white/70 tracking-[0.08em] uppercase">{selIsFemale ? '好感' : '友善'}</span>
                  <span className="text-[11px] md:text-[15px] font-display font-bold italic tracking-[0.1em]" style={{ color: selAffStage.color, textShadow: `0 0 16px ${selAffStage.color}30` }}>{selAffStage.name}</span>
                </div>
                <span className="text-[9px] md:text-[11px] font-mono" style={{ color: selAffStage.color, opacity: 0.85 }}>{selAffection}</span>
                <div className="mt-1 h-1 md:h-1.5 rounded-full overflow-hidden" style={{ background: `${selAffStage.color}10` }}>
                  <div
                    className="h-full rounded-full" style={{ width: `${Math.abs(selAffection) / 200 * 100}%`, background: `linear-gradient(90deg, ${selAffStage.color}80, ${selAffStage.color})` }} />
                </div>
              </div>
              {selIsFemale && selCorruption !== undefined && (
                <div className="p-2 md:p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                  <div className="flex items-baseline justify-between mb-0.5 md:mb-1">
                    <span className="text-[8px] md:text-[9px] font-mono text-white/70 tracking-[0.08em] uppercase">堕落</span>
                    <span className="text-[11px] md:text-[15px] font-display font-bold italic tracking-[0.1em]" style={{ color: selCorrStage!.color, textShadow: `0 0 16px ${selCorrStage!.color}30` }}>{selCorrStage!.name}</span>
                  </div>
                  <span className="text-[9px] md:text-[11px] font-mono" style={{ color: selCorrStage!.color, opacity: 0.85 }}>{selCorruption}</span>
                  <div className="mt-1 h-1 md:h-1.5 rounded-full overflow-hidden" style={{ background: `${selCorrStage!.color}10` }}>
                    <div
                      className="h-full rounded-full" style={{ width: `${selCorruption / 500 * 100}%`, background: `linear-gradient(90deg, ${selCorrStage!.color}80, ${selCorrStage!.color})` }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

            {/* ── Status: location / action / thought ── */}
            <div className="space-y-1 md:space-y-2.5">
              <InfoRow label="位置" value={selProfile.当前位置} />
              <InfoRow label="行动" value={selProfile.当前行动} />
              <InfoRow label="想法" value={selProfile.当前想法} muted />
            </div>

            {/* ── Status effects ── */}
            {Object.keys(selProfile.状态).length > 0 && (
              <div className="space-y-1">
                <span className="text-[7px] md:text-[9px] font-mono text-white/70 tracking-[0.12em] uppercase">状态效果</span>
                {(Object.entries(selProfile.状态) as [string, { 描述?: string; 持续时间?: string }][]).map(([name, s]) => (
                  <div key={name} className="flex items-center gap-1.5 md:gap-3 px-2 md:px-3 py-1 md:py-2 rounded-lg border border-white/[0.04] bg-white/[0.01]">
                    <div className="w-1 h-1 rounded-full bg-aether-cyan/50 shrink-0" />
                    <span className="text-[9px] md:text-[11px] font-mono text-white/80">{name}</span>
                    <span className="ml-auto text-[7px] md:text-[9px] font-mono text-white/50 truncate">{s.描述} · {s.持续时间}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

            {/* ── Social relation ── */}
            {selSocial && (
              <div className="p-2.5 md:p-4 rounded-xl border border-aether-cyan/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.025), rgba(0,242,255,0.005))' }}>
                <span className="text-[7px] md:text-[9px] font-mono text-aether-cyan/70 tracking-[0.1em] uppercase">社交关系</span>
                <div className="mt-1 md:mt-2 space-y-1 md:space-y-2">
                  {/* Relationship to me: 玩家名 + 关系 */}
                  <div className="flex items-baseline gap-1 md:gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-aether-cyan/50 shrink-0" />
                    <span className="text-[11px] md:text-[13px] font-display text-white/80 font-bold tracking-wider">{playerName}</span>
                    <span className="text-[9px] md:text-[11px] font-mono text-white/55">{selSocial.关系}</span>
                  </div>
                  {/* Social circle: 人名 + 关系 — skip self (already shown as primary above) */}
                  {selProfile?.社交圈 && Object.entries(selProfile.社交圈 as Record<string, string>)
                    .filter(([name]) => name !== playerName && name !== '{{user}}' && name !== '<user>')
                    .map(([name, rel]) => (
                    <div key={name} className="flex items-baseline gap-1 md:gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-aether-cyan/35 shrink-0" />
                      <span className="text-[11px] md:text-[13px] font-display text-white/65 font-bold tracking-wider">{name}</span>
                      <span className="text-[9px] md:text-[11px] font-mono text-white/55">{rel}</span>
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
    <div className="flex items-start gap-1.5 md:gap-3 px-2 md:px-3 py-1 md:py-2 rounded-lg border border-white/[0.03] bg-white/[0.005]">
      <span className="text-[7px] md:text-[9px] font-mono text-white/55 tracking-[0.1em] uppercase shrink-0 w-6 md:w-8 pt-0.5">{label}</span>
      <span className={`text-[10px] md:text-[12px] font-mono leading-relaxed ${muted ? 'text-white/85 italic' : 'text-white'}`}>{value}</span>
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
