import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Activity, MapPin, MessageCircle, Heart, HeartCrack } from 'lucide-react';
import { Modal } from '../Feedback';
import { useSillytavern } from '../../hooks/useSillytavern';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';

/* ===== Types ===== */
interface CharacterProfile {
  检索词?: string[];
  梦境NPC?: boolean;
  年龄: number;
  身份: string;
  评级?: string;
  好感值?: number;
  友善值?: number;
  堕落值?: number;
  当前位置: string;
  当前行动: string;
  当前想法: string;
  状态: Record<string, { 描述: string; 持续时间: string }>;
}

interface SocialPersonData {
  关系: string;
  社交圈?: Record<string, string>;
}

interface SocialNodeRender {
  id: string;
  name: string;
  relation: string;
  type: '盟友' | '中立' | '敌对' | '未知';
  level: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface SocialEdgeRender {
  from: string;
  to: string;
  label: string;
  stroke: string;
  opacity: number;
}

/* ===== Color palette ===== */
const NODE_COLORS = ['#00f2ff', '#a78bfa', '#f59e0b', '#f472b6', '#22c55e', '#3b82f6', '#14b8a6', '#ef4444'];

/* ===== Helpers ===== */
function inferType(relation: string): '盟友' | '中立' | '敌对' | '未知' {
  if (/母|父|姐|妹|兄|弟|家|亲/.test(relation)) return '盟友';
  if (/敌|仇|恨|杀/.test(relation)) return '敌对';
  if (/同|友|识|顾/.test(relation)) return '中立';
  return '未知';
}
function getLevelHint(relation: string): number {
  if (/母|父/.test(relation)) return 90;
  if (/姐|妹|兄|弟/.test(relation)) return 78;
  if (/友|同/.test(relation)) return 55;
  return 30;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/* ===== Lookup ===== */
function findCharacter(
  chars: any, name: string,
): { profile: CharacterProfile; category: string } | null {
  for (const [gender, groups] of Object.entries(chars)) {
    if (!groups || typeof groups !== 'object') continue;
    for (const [group, members] of Object.entries(groups as Record<string, any>)) {
      if (!members || typeof members !== 'object') continue;
      if (members[name]) {
        return { profile: members[name] as CharacterProfile, category: `${gender}·${group}` };
      }
    }
  }
  return null;
}

/* ===== Rating badge colors ===== */
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

function RatingBadge({ rating }: { rating: string }) {
  const s = RATING_STYLES[rating] ?? RATING_STYLES['微尘'];
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${s.bg} ${s.text} ${s.border} tracking-wider`}>
      {rating}
    </span>
  );
}

/* ============================================================
   SOCIAL PAGE
   ============================================================ */
export default function SocialPage() {
  const ss = useSillytavern();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;

  const socialData: Record<string, SocialPersonData> =
    liveVars?.['主角']?.['社交'] ?? defaults.主角?.社交 ?? {};
  const characterData: Record<string, any> =
    liveVars?.['主要人物'] ?? defaults.主要人物 ?? {};

  const [selectedNode, setSelectedNode] = useState<SocialNodeRender | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphBounds, setGraphBounds] = useState({ width: 800, height: 600 });

  // ── Container size ──
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setGraphBounds({ width: rect.width, height: rect.height });
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setGraphBounds((prev) => (prev.width !== width || prev.height !== height ? { width, height } : prev));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Animation phases ──
  useEffect(() => {
    setAnimPhase(0);
    const t1 = setTimeout(() => setAnimPhase(1), 800);
    const t2 = setTimeout(() => setAnimPhase(2), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [socialData]);

  // ── Build nodes & edges ──
  const { nodes, edges } = useMemo(() => {
    const entries = Object.entries(socialData);
    if (entries.length === 0) return { nodes: [] as SocialNodeRender[], edges: [] as SocialEdgeRender[] };

    const cx = graphBounds.width / 2;
    const cy = graphBounds.height / 2;
    const rx = Math.min(graphBounds.width * 0.30, 240);
    const ry = Math.min(graphBounds.height * 0.25, 170);

    const nodeList: SocialNodeRender[] = entries.map(([name, data], i) => {
      const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: name, name,
        relation: data.关系,
        type: inferType(data.关系),
        level: getLevelHint(data.关系),
        x: Math.cos(angle) * rx + cx,
        y: Math.sin(angle) * ry + cy,
        size: 44 + Math.random() * 8,
        color: NODE_COLORS[i % NODE_COLORS.length],
      };
    });

    const nameSet = new Set(nodeList.map((n) => n.name));
    const edgeList: SocialEdgeRender[] = [];
    for (const [name, data] of entries) {
      edgeList.push({ from: '我', to: name, label: data.关系, stroke: '#00f2ff', opacity: 0.55 });
      if (data.社交圈) {
        for (const [friend, rel] of Object.entries(data.社交圈)) {
          if (!nameSet.has(friend)) continue;
          const dup = edgeList.find((e) =>
            (e.from === name && e.to === friend) || (e.from === friend && e.to === name),
          );
          if (!dup) edgeList.push({ from: name, to: friend, label: rel, stroke: '#a78bfa', opacity: 0.45 });
        }
      }
    }

    return { nodes: nodeList, edges: edgeList };
  }, [socialData, graphBounds]);

  const cx = graphBounds.width / 2;
  const cy = graphBounds.height / 2;

  const getPos = (id: string) => {
    if (id === '我') return { x: cx, y: cy };
    const n = nodes.find((x) => x.id === id);
    return n ? { x: n.x, y: n.y } : null;
  };

  // ── Lookup selected character profile & social info ──
  const charResult = selectedNode ? findCharacter(characterData, selectedNode.name) : null;
  const charProfile = charResult?.profile ?? null;
  const charCategory = charResult?.category ?? '';
  const charSocial = selectedNode ? (socialData[selectedNode.name] ?? null) : null;
  const affection = charProfile ? (charProfile.好感值 ?? charProfile.友善值 ?? 0) : 0;
  const isFemale = charCategory.startsWith('女性');

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-6 relative">
      {/* ── Header ── */}
      <div className="relative z-10 glass-panel p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-aether-cyan/10 border border-aether-cyan/30 rounded-full flex items-center justify-center shrink-0">
            <Users className="text-aether-cyan" size={20} />
          </div>
          <div>
            <h2 className="font-display text-xl tracking-[0.15em] text-aether-cyan">社交关系</h2>
            <p className="text-[10px] text-white/30 font-mono tracking-wider mt-0.5">{nodes.length} 位关联人物</p>
          </div>
        </div>
      </div>

      {/* ── Graph ── */}
      <div
        ref={graphRef}
        className="flex-1 relative glass-panel border-glow overflow-hidden bg-aether-dark/30"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,242,255,0.06) 1px, transparent 1px)', backgroundSize: '30px 30px' }}
      >
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          {/* Phase 2: Lines */}
          <AnimatePresence>
            {animPhase >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="absolute inset-0">
                {edges.map((edge, i) => {
                  const p1 = getPos(edge.from), p2 = getPos(edge.to);
                  if (!p1 || !p2) return null;
                  const dx = p2.x - p1.x, dy = p2.y - p1.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                  const ek = `${edge.from}-${edge.to}`;
                  const hov = hoveredEdge === ek;
                  return (
                    <React.Fragment key={ek}>
                      <motion.div className="absolute pointer-events-none"
                        style={{ left: p1.x, top: p1.y, width: 0, height: 2, background: edge.stroke, opacity: edge.opacity, transform: `rotate(${angle}deg)`, transformOrigin: '0 50%', borderRadius: '2px' }}
                        animate={{ width: length }} transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }} />
                      {animPhase >= 2 && (
                        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: hov ? 1 : 0.8, scale: 1 }} transition={{ duration: 0.35, delay: i * 0.06 }}
                          className="absolute pointer-events-auto cursor-default" style={{ left: mx, top: my, transform: 'translate(-50%, -50%)' }}
                          onMouseEnter={() => setHoveredEdge(ek)} onMouseLeave={() => setHoveredEdge(null)}>
                          <span className="block text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap transition-all duration-200"
                            style={{ color: edge.stroke, backgroundColor: `${edge.stroke}10`, border: `1px solid ${edge.stroke}30`, boxShadow: hov ? `0 0 10px ${edge.stroke}20` : 'none' }}>{edge.label}</span>
                        </motion.div>
                      )}
                    </React.Fragment>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center "我" */}
          <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className="absolute pointer-events-none" style={{ left: cx - 50, top: cy - 50 }}>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full" style={{ boxShadow: '0 0 40px rgba(0,242,255,0.12)', animation: 'pulse-slow 3s ease-in-out infinite' }} />
              <div className="w-20 h-20 rounded-full bg-aether-dark/90 border-2 border-aether-cyan flex items-center justify-center shadow-[0_0_30px_rgba(0,242,255,0.3)] backdrop-blur-sm relative z-10">
                <span className="font-display text-2xl font-bold text-aether-cyan" style={{ textShadow: '0 0 12px rgba(0,242,255,0.6)' }}>我</span>
              </div>
            </div>
          </motion.div>

          {/* Phase 1: Avatars */}
          {nodes.map((node, i) => (
            <motion.button key={node.id}
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.3 + i * 0.1 }}
              style={{ position: 'absolute', left: node.x - node.size / 2, top: node.y - node.size / 2, width: node.size, height: node.size }}
              onClick={() => setSelectedNode(node)} className="clickable group" aria-label={`选择 ${node.name}`}>
              <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: `0 0 20px ${node.color}40` }} />
              <div className="w-full h-full rounded-full border-2 bg-aether-dark/85 backdrop-blur-sm flex items-center justify-center transition-all duration-300 group-hover:scale-115"
                style={{ borderColor: `${node.color}99`, boxShadow: `0 0 12px ${node.color}30` }}>
                <span className="font-display font-bold" style={{ fontSize: Math.max(13, node.size * 0.32), color: node.color }}>{node.name[0]}</span>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 pointer-events-none">
                <span className="text-[10px] font-mono text-white/35 tracking-wider whitespace-nowrap transition-all duration-300 group-hover:text-white/70">{node.name}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ================================================================
          REDESIGNED CHARACTER PROFILE MODAL
          ================================================================ */}
      <Modal isOpen={!!selectedNode} onClose={() => setSelectedNode(null)} title="">
        {selectedNode && charProfile && (
          <div className="space-y-5" style={{ minWidth: 420, maxWidth: 500 }}>
            {/* ── Header: Name + Identity ── */}
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-bold font-display shrink-0"
                style={{ borderColor: `${selectedNode.color}80`, color: selectedNode.color, boxShadow: `0 0 16px ${selectedNode.color}30` }}>
                {selectedNode.name[0]}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-display font-bold text-white">{selectedNode.name}</h3>
                  <span className="text-[12px] font-mono text-white/30">{charProfile.年龄}岁</span>
                  {charProfile.梦境NPC && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-300/70 border border-purple-400/25">梦境NPC</span>
                  )}
                </div>
                <p className="text-[12px] text-white/50 font-mono mt-1 leading-relaxed">{charProfile.身份}</p>
                {charProfile.评级 && <div className="mt-1.5"><RatingBadge rating={charProfile.评级} /></div>}
              </div>
            </div>

            {/* ── Affection & Corruption bars ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono text-white/35 tracking-wider uppercase">
                    {isFemale ? '好感值' : '友善值'}
                  </span>
                  <span className={`text-[11px] font-mono font-bold ${affection >= 0 ? 'text-aether-cyan' : 'text-red-400'}`}>
                    {affection > 0 ? '+' : ''}{affection}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div initial={{ width: 0 }}
                    animate={{ width: `${clamp(Math.abs(affection), 0, 200) / 2}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${affection >= 0 ? 'bg-aether-cyan' : 'bg-red-500'}`}
                    style={{ boxShadow: affection >= 0 ? '0 0 6px rgba(0,242,255,0.4)' : '0 0 6px rgba(239,68,68,0.4)' }} />
                </div>
              </div>
              {isFemale && charProfile.堕落值 !== undefined && (
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-mono text-white/35 tracking-wider uppercase">堕落值</span>
                    <span className={`text-[11px] font-mono font-bold ${(charProfile.堕落值 ?? 0) > 50 ? 'text-red-400' : 'text-white/50'}`}>
                      {charProfile.堕落值}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div initial={{ width: 0 }}
                      animate={{ width: `${clamp(charProfile.堕落值 ?? 0, 0, 500) / 5}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-red-400/60"
                      style={{ boxShadow: (charProfile.堕落值 ?? 0) > 50 ? '0 0 6px rgba(239,68,68,0.3)' : 'none' }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Location + Status ── */}
            <div className="space-y-2 p-3 rounded-lg border border-white/[0.05] bg-white/[0.01]">
              <div className="flex items-center gap-2 text-[10px] font-mono text-white/35">
                <MapPin size={12} className="text-aether-cyan/40 shrink-0" />
                <span className="text-white/55">{charProfile.当前位置}</span>
              </div>
              <div className="flex items-start gap-2 text-[10px] font-mono text-white/35">
                <Activity size={12} className="text-aether-cyan/40 shrink-0 mt-0.5" />
                <span className="text-white/55">{charProfile.当前行动}</span>
              </div>
              <div className="flex items-start gap-2 text-[10px] font-mono text-white/35">
                <MessageCircle size={12} className="text-aether-cyan/40 shrink-0 mt-0.5" />
                <span className="text-white/45 italic">{charProfile.当前想法}</span>
              </div>
            </div>

            {/* ── Status effects ── */}
            {Object.keys(charProfile.状态).length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono text-white/25 tracking-wider uppercase">状态</span>
                {Object.entries(charProfile.状态).map(([name, s]) => (
                  <div key={name} className="flex items-center justify-between p-2 rounded border border-white/[0.05] bg-white/[0.01]">
                    <span className="text-[11px] font-mono text-white/60">{name}</span>
                    <span className="text-[9px] font-mono text-white/30">{s.描述} · {s.持续时间}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Social: relation to me ── */}
            {charSocial && (
              <div className="p-3 rounded-lg border border-aether-cyan/10 bg-aether-cyan/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <Heart size={12} className="text-aether-cyan/50" />
                  <span className="text-[9px] font-mono text-aether-cyan/50 tracking-wider uppercase">与我的关系</span>
                </div>
                <p className="text-[13px] font-display text-aether-cyan/80 font-bold tracking-wide">{charSocial.关系}</p>
              </div>
            )}

            {/* ── Social: connections ── */}
            {charSocial?.社交圈 && Object.keys(charSocial.社交圈).length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono text-white/25 tracking-wider uppercase">社交圈</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(charSocial.社交圈).map(([name, rel]) => (
                    <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
                      <span className="text-[11px] font-display text-white/70">{name}</span>
                      <span className="text-[9px] font-mono text-white/30">{rel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {!charProfile && (
              <p className="text-[11px] text-white/20 font-mono text-center py-6">
                该角色暂无详细的档案信息
              </p>
            )}
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
