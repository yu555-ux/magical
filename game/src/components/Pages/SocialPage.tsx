import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Activity, MapPin, MessageCircle, Heart } from 'lucide-react';
import { Modal } from '../Feedback';
import { useSillytavern } from '../../hooks/useSillytavern';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';

/* ===== Types ===== */
interface CharacterProfile {
  检索词?: string[]; 梦境NPC?: boolean; 年龄: number; 身份: string; 评级?: string;
  好感值?: number; 友善值?: number; 堕落值?: number;
  当前位置: string; 当前行动: string; 当前想法: string;
  状态: Record<string, { 描述: string; 持续时间: string }>;
}
interface SocialPersonData { 关系: string; 社交圈?: Record<string, string> }
interface SocialNodeRender { id: string; name: string; relation: string; type: string; level: number; x: number; y: number; size: number; color: string }
interface SocialEdgeRender { from: string; to: string; label: string; stroke: string; opacity: number }

/* ===== Constants ===== */
const NODE_COLORS = ['#00f2ff', '#a78bfa', '#f59e0b', '#f472b6', '#22c55e', '#3b82f6', '#14b8a6', '#ef4444'];
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

/* ===== Helpers ===== */
function inferType(rel: string) {
  if (/母|父|姐|妹|兄|弟|家|亲/.test(rel)) return '盟友';
  if (/敌|仇|恨|杀/.test(rel)) return '敌对';
  if (/同|友|识|顾/.test(rel)) return '中立';
  return '未知';
}
function getLevelHint(rel: string) { if (/母|父/.test(rel)) return 90; if (/姐|妹|兄|弟/.test(rel)) return 78; if (/友|同/.test(rel)) return 55; return 30; }
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function findCharacter(chars: any, name: string): { profile: CharacterProfile; category: string } | null {
  for (const [gender, groups] of Object.entries(chars)) {
    if (!groups || typeof groups !== 'object') continue;
    for (const [group, members] of Object.entries(groups as Record<string, any>)) {
      if (!members || typeof members !== 'object') continue;
      if (members[name]) return { profile: members[name] as CharacterProfile, category: `${gender}·${group}` };
    }
  }
  return null;
}

function RatingBadge({ rating }: { rating: string }) {
  const s = RATING_STYLES[rating] ?? RATING_STYLES['微尘'];
  return <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border tracking-wider ${s.bg} ${s.text} ${s.border}`}>{rating}</span>;
}

/* ============================================================
   SOCIAL PAGE
   ============================================================ */
export default function SocialPage() {
  const ss = useSillytavern();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;
  const socialData: Record<string, SocialPersonData> = liveVars?.['主角']?.['社交'] ?? defaults.主角?.社交 ?? {};
  const characterData: Record<string, any> = liveVars?.['主要人物'] ?? defaults.主要人物 ?? {};

  const [selectedNode, setSelectedNode] = useState<SocialNodeRender | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
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
    setAnimPhase(0); const t1 = setTimeout(() => setAnimPhase(1), 800); const t2 = setTimeout(() => setAnimPhase(2), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [socialData]);

  const { nodes, edges } = useMemo(() => {
    const entries = Object.entries(socialData);
    if (entries.length === 0) return { nodes: [] as SocialNodeRender[], edges: [] as SocialEdgeRender[] };
    const cx = graphBounds.width / 2, cy = graphBounds.height / 2;
    const rx = Math.min(graphBounds.width * 0.32, 260), ry = Math.min(graphBounds.height * 0.28, 200);

    const nodeList: SocialNodeRender[] = entries.map(([name, data], i) => {
      const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: name, name, relation: data.关系, type: inferType(data.关系), level: getLevelHint(data.关系),
        x: Math.cos(angle) * rx + cx, y: Math.sin(angle) * ry + cy,
        size: 48 + (getLevelHint(data.关系) / 100) * 16, color: NODE_COLORS[i % NODE_COLORS.length],
      };
    });

    const nameSet = new Set(nodeList.map((n) => n.name));
    const edgeList: SocialEdgeRender[] = [];
    for (const [name, data] of entries) {
      edgeList.push({ from: '我', to: name, label: data.关系, stroke: '#00f2ff', opacity: 0.5 });
      if (data.社交圈) for (const [friend, rel] of Object.entries(data.社交圈)) {
        if (!nameSet.has(friend)) continue;
        if (!edgeList.some((e) => (e.from === name && e.to === friend) || (e.from === friend && e.to === name)))
          edgeList.push({ from: name, to: friend, label: rel, stroke: '#a78bfa', opacity: 0.4 });
      }
    }
    return { nodes: nodeList, edges: edgeList };
  }, [socialData, graphBounds]);

  const cx = graphBounds.width / 2, cy = graphBounds.height / 2;
  const getPos = (id: string) => id === '我' ? { x: cx, y: cy } : (() => { const n = nodes.find((x) => x.id === id); return n ? { x: n.x, y: n.y } : null; })();

  const charResult = selectedNode ? findCharacter(characterData, selectedNode.name) : null;
  const charProfile = charResult?.profile ?? null;
  const charCategory = charResult?.category ?? '';
  const charSocial = selectedNode ? (socialData[selectedNode.name] ?? null) : null;
  const affection = charProfile ? (charProfile.好感值 ?? charProfile.友善值 ?? 0) : 0;
  const isFemale = charCategory.startsWith('女性');

  return (
    <div className="h-full flex flex-col p-3 md:p-6 space-y-4 relative">
      {/* ── Header ── */}
      <div className="relative z-10 flex items-center gap-2.5 px-1">
        <div className="w-1 h-4 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.4)]" />
        <h2 className="font-display text-base tracking-[0.12em] text-aether-cyan/90">社交关系</h2>
        <span className="text-[10px] font-mono text-white/20 ml-1">{nodes.length}人</span>
      </div>

      {/* ── Graph ── */}
      <div ref={graphRef} className="flex-1 relative overflow-hidden rounded-lg border border-white/[0.04]"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,242,255,0.04) 0%, transparent 70%), rgba(3,5,10,0.6)' }}>
        {/* Atmospheric layers */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aether-cyan/10 to-transparent" />
        <CornerMark position="tl" /><CornerMark position="tr" /><CornerMark position="bl" /><CornerMark position="br" />

        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          {/* Phase 2: Lines */}
          <AnimatePresence>
            {animPhase >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="absolute inset-0">
                {edges.map((edge, i) => {
                  const p1 = getPos(edge.from), p2 = getPos(edge.to);
                  if (!p1 || !p2) return null;
                  const dx = p2.x - p1.x, dy = p2.y - p1.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const ang = Math.atan2(dy, dx) * (180 / Math.PI);
                  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                  const ek = `${edge.from}-${edge.to}`, hov = hoveredEdge === ek;
                  return (
                    <React.Fragment key={ek}>
                      <motion.div className="absolute pointer-events-none"
                        style={{ left: p1.x, top: p1.y, width: 0, height: 1.5, background: `linear-gradient(90deg, ${edge.stroke}40, ${edge.stroke})`, opacity: edge.opacity, transform: `rotate(${ang}deg)`, transformOrigin: '0 50%', borderRadius: '1px' }}
                        animate={{ width: len }} transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }} />
                      {animPhase >= 2 && (
                        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: hov ? 1 : 0.75, scale: 1 }} transition={{ duration: 0.3, delay: i * 0.06 }}
                          className="absolute cursor-default" style={{ left: mx, top: my, transform: 'translate(-50%, -50%)' }}
                          onMouseEnter={() => setHoveredEdge(ek)} onMouseLeave={() => setHoveredEdge(null)}>
                          <span className="block text-[9px] font-mono tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap backdrop-blur-sm transition-all duration-200"
                            style={{ color: edge.stroke, backgroundColor: `${edge.stroke}12`, border: `1px solid ${edge.stroke}25`, boxShadow: hov ? `0 0 12px ${edge.stroke}20` : 'none' }}>{edge.label}</span>
                        </motion.div>
                      )}
                    </React.Fragment>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center "我" */}
          <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 180, delay: 0.15 }}
            className="absolute pointer-events-none" style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)' }}>
            <div className="relative">
              <div className="absolute inset-0 rounded-full" style={{ margin: '-30px', boxShadow: '0 0 60px rgba(0,242,255,0.08)', animation: 'pulse-slow 3s ease-in-out infinite' }} />
              <div className="absolute inset-0 rounded-full" style={{ margin: '-12px', border: '1px solid rgba(0,242,255,0.12)', animation: 'pulse-ring 4s ease-in-out infinite' }} />
              <div className="w-18 h-18 rounded-full flex items-center justify-center border-2 border-aether-cyan shadow-[0_0_28px_rgba(0,242,255,0.35)]"
                style={{ width: 72, height: 72, background: 'linear-gradient(135deg, rgba(0,20,30,0.9), rgba(0,5,10,0.95))' }}>
                <span className="font-display text-2xl font-bold text-aether-cyan" style={{ textShadow: '0 0 14px rgba(0,242,255,0.5)' }}>我</span>
              </div>
            </div>
          </motion.div>

          {/* Phase 1: Character nodes */}
          {nodes.map((node, i) => (
            <motion.button key={node.id}
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.3 + i * 0.12 }}
              style={{ position: 'absolute', left: node.x, top: node.y, transform: 'translate(-50%, -50%)', width: node.size, height: node.size }}
              onClick={() => setSelectedNode(node)} className="clickable group z-10" aria-label={node.name}>
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-400"
                style={{ margin: '-8px', boxShadow: `0 0 28px ${node.color}35`, background: `${node.color}06`, borderRadius: '50%' }} />
              {/* Node circle */}
              <div className="w-full h-full rounded-full border-2 flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                style={{ borderColor: `${node.color}99`, background: 'rgba(4,8,16,0.9)', boxShadow: `0 0 14px ${node.color}25` }}>
                <span className="font-display font-bold select-none" style={{ fontSize: Math.max(14, node.size * 0.3), color: node.color, textShadow: `0 0 8px ${node.color}40` }}>{node.name[0]}</span>
              </div>
              {/* Name label */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 pointer-events-none">
                <span className="text-[10px] font-mono text-white/30 tracking-wider whitespace-nowrap transition-all duration-300 group-hover:text-white/65 group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{node.name}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ================================================================
          CHARACTER PROFILE MODAL
          ================================================================ */}
      <Modal isOpen={!!selectedNode} onClose={() => setSelectedNode(null)} title="">
        {selectedNode && charProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" style={{ minWidth: 440, maxWidth: 520 }}>
            {/* ── Hero section ── */}
            <div className="flex gap-5">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ margin: '-6px', boxShadow: `0 0 24px ${selectedNode.color}20` }} />
                <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl font-bold font-display"
                  style={{ borderColor: `${selectedNode.color}70`, color: selectedNode.color, background: 'linear-gradient(135deg, rgba(8,12,20,0.95), rgba(4,6,14,0.98))', boxShadow: `0 0 20px ${selectedNode.color}20` }}>
                  {selectedNode.name[0]}
                </div>
              </div>
              <div className="min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-xl font-display font-bold text-white/95 tracking-wide">{selectedNode.name}</h3>
                  <span className="text-[12px] font-mono text-white/30 font-bold">{charProfile.年龄}岁</span>
                  {charProfile.梦境NPC && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-400/12 text-purple-300/70 border border-purple-400/20">梦境NPC</span>}
                  {charProfile.评级 && <RatingBadge rating={charProfile.评级} />}
                </div>
                <p className="text-[12px] text-white/45 font-mono leading-relaxed">{charProfile.身份}</p>
              </div>
            </div>

            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 gap-3">
              <StatBar label={isFemale ? '好感值' : '友善值'} value={affection} min={-200} max={200}
                color={affection >= 0 ? '#00f2ff' : '#ef4444'} />
              {isFemale && charProfile.堕落值 !== undefined && (
                <StatBar label="堕落值" value={charProfile.堕落值 ?? 0} min={0} max={500}
                  color="#ef4444" warn={50} />
              )}
            </div>

            {/* ── Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* ── Status block ── */}
            <div className="space-y-3">
              <InfoLine label="位置" content={charProfile.当前位置} />
              <InfoLine label="行动" content={charProfile.当前行动} />
              <InfoLine label="想法" content={charProfile.当前想法} muted />
            </div>

            {/* ── Status effects ── */}
            {Object.keys(charProfile.状态).length > 0 && (
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-white/20 tracking-[0.15em] uppercase">状态效果</span>
                {Object.entries(charProfile.状态).map(([name, s]) => (
                  <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.01]">
                    <div className="w-1 h-1 rounded-full bg-aether-cyan/50 shrink-0" />
                    <span className="text-[12px] font-mono text-white/60">{name}</span>
                    <span className="ml-auto text-[9px] font-mono text-white/25">{s.描述} · {s.持续时间}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* ── Social relation ── */}
            {charSocial && (
              <div className="p-4 rounded-xl border border-aether-cyan/[0.08]"
                style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.03), rgba(0,242,255,0.01))' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Heart size={13} className="text-aether-cyan/50" />
                  <span className="text-[9px] font-mono text-aether-cyan/50 tracking-[0.12em] uppercase">与我的关系</span>
                </div>
                <p className="text-[15px] font-display text-aether-cyan/85 font-bold tracking-wider">{charSocial.关系}</p>

                {charSocial.社交圈 && Object.keys(charSocial.社交圈).length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/[0.04]">
                    <span className="text-[8px] font-mono text-white/20 tracking-[0.12em] uppercase">社交圈</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(charSocial.社交圈).map(([name, rel]) => (
                        <div key={name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                          <span className="text-[11px] font-display text-white/65">{name}</span>
                          <span className="text-[8px] font-mono text-white/25">· {rel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </Modal>

      <style>{`
        @keyframes pulse-slow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes pulse-ring { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.7;transform:scale(1.03)} }
      `}</style>
    </div>
  );
}

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */

function StatBar({ label, value, min, max, color, warn }: { label: string; value: number; min: number; max: number; color: string; warn?: number }) {
  const pct = clamp((Math.abs(value - (min < 0 ? 0 : min))) / (max - min) * 100, 2, 100);
  const danger = warn !== undefined && value > warn;
  return (
    <div className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono text-white/30 tracking-[0.1em] uppercase">{label}</span>
        <span className="text-[12px] font-mono font-bold" style={{ color }}>{min < 0 && value > 0 ? '+' : ''}{value}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: `${color}12`, border: `1px solid ${color}15` }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}90, ${color})`, boxShadow: danger ? `0 0 8px ${color}40` : `0 0 4px ${color}20` }} />
      </div>
    </div>
  );
}

function InfoLine({ label, content, muted }: { label: string; content: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-lg border border-white/[0.03] bg-white/[0.005]">
      <span className="text-[9px] font-mono text-white/20 tracking-[0.1em] uppercase shrink-0 w-10 pt-0.5">{label}</span>
      <span className={`text-[12px] font-mono leading-relaxed ${muted ? 'text-white/35 italic' : 'text-white/55'}`}>{content}</span>
    </div>
  );
}

function CornerMark({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = position.startsWith('t'), left = position.endsWith('l');
  return (
    <div className="absolute pointer-events-none" style={{ [top ? 'top' : 'bottom']: 6, [left ? 'left' : 'right']: 6, width: 14, height: 14 }}>
      <div className="absolute bg-aether-cyan/15" style={{ [top ? 'top' : 'bottom']: 0, [left ? 'left' : 'right']: 0, height: 1, width: '100%' }} />
      <div className="absolute bg-aether-cyan/15" style={{ [top ? 'top' : 'bottom']: 0, [left ? 'left' : 'right']: 0, width: 1, height: '100%' }} />
    </div>
  );
}
