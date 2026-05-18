import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Share2, Heart, Zap, Radio, Activity } from 'lucide-react';
import { SocialNode } from '../../types';
import { Modal } from '../Feedback';
import { useSillytavern } from '../../hooks/useSillytavern';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';

// ─── Type Constants ─────────────────────────────────────────────

type RelationType = '盟友' | '中立' | '敌对' | '未知';

interface TypeVisuals { text: string; border: string; bg: string; glow: string }

const TYPE_VISUALS: Record<RelationType, TypeVisuals> = {
  '盟友': { text: 'text-aether-cyan', border: 'border-aether-cyan', bg: 'bg-aether-cyan/10', glow: 'shadow-[0_0_15px_rgba(0,242,255,0.4)]' },
  '中立': { text: 'text-aether-blue', border: 'border-aether-blue', bg: 'bg-aether-blue/10', glow: '' },
  '敌对': { text: 'text-red-400', border: 'border-red-500/60', bg: 'bg-red-500/10', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
  '未知': { text: 'text-white/50', border: 'border-white/20', bg: 'bg-white/5', glow: '' },
};

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

const NODE_COLORS = ['#00f2ff', '#a78bfa'];

// ─── Helpers ────────────────────────────────────────────────────

function getVisuals(node: SocialNode): TypeVisuals {
  return TYPE_VISUALS[node.type as RelationType] || TYPE_VISUALS['未知'];
}
function getLevelColor(level: number): string {
  if (level >= 70) return 'bg-aether-cyan';
  if (level >= 40) return 'bg-aether-blue';
  return 'bg-red-500';
}

// ─── Live-data types ────────────────────────────────────────────

interface LiveNode {
  id: string; name: string; relation: string; type: RelationType; level: number;
  x: number; y: number; size: number; color: string;
}
interface LiveEdge { from: string; to: string; stroke: string; opacity: number }

// ─── Component ─────────────────────────────────────────────────

export default function SocialPage() {
  const ss = useSillytavern();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;
  const socialData: Record<string, { 关系: string; 社交圈?: Record<string, string> }> =
    liveVars?.['主角']?.['社交'] ?? defaults.主角?.社交 ?? {};

  const [selectedNode, setSelectedNode] = useState<LiveNode | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphBounds, setGraphBounds] = useState({ width: 800, height: 600 });

  // ── Measure container ──
  useEffect(() => {
    const el = graphRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setGraphBounds({ width: rect.width, height: rect.height });
    const obs = new ResizeObserver((e) => {
      const { width, height } = e[0].contentRect;
      setGraphBounds((p) => (p.width !== width || p.height !== height ? { width, height } : p));
    });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  // ── Animation: avatars first, then lines ──
  useEffect(() => {
    setAnimPhase(0);
    const t = setTimeout(() => setAnimPhase(1), 900);
    return () => clearTimeout(t);
  }, [socialData]);

  // ── Layout (exactly like original MOCK_SOCIAL) ──
  const centerX = graphBounds.width / 2;
  const centerY = graphBounds.height / 2;
  const radiusX = Math.min(graphBounds.width * 0.35, 280);
  const radiusY = Math.min(graphBounds.height * 0.28, 190);

  const nodesWithPositions = useMemo((): LiveNode[] => {
    const entries = Object.entries(socialData);
    if (entries.length === 0) return [];
    return entries.map(([name, data], i) => {
      const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
      const level = getLevelHint(data.关系);
      return {
        id: name, name,
        relation: data.关系,
        type: inferType(data.关系),
        level,
        x: Math.cos(angle) * radiusX + centerX,
        y: Math.sin(angle) * radiusY + centerY,
        size: 42 + (level / 100) * 20,
        color: NODE_COLORS[i % NODE_COLORS.length],
      };
    });
  }, [socialData, radiusX, radiusY, centerX, centerY]);

  // Position lookup map (exactly like original positionMap)
  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodesWithPositions.forEach((n) => map.set(n.id, { x: n.x, y: n.y }));
    return map;
  }, [nodesWithPositions]);

  // ── Edges: 我→person + person↔person (社交圈) ──
  const edgeData = useMemo((): LiveEdge[] => {
    const edges: LiveEdge[] = [];
    const nameSet = new Set(nodesWithPositions.map((n) => n.name));
    for (const [name, data] of Object.entries(socialData)) {
      edges.push({ from: '我', to: name, stroke: '#00f2ff', opacity: 0.45 });
      if (data.社交圈) {
        for (const [friend] of Object.entries(data.社交圈)) {
          if (!nameSet.has(friend)) continue;
          const dup = edges.find((e) => (e.from === name && e.to === friend) || (e.from === friend && e.to === name));
          if (!dup) edges.push({ from: name, to: friend, stroke: '#a78bfa', opacity: 0.5 });
        }
      }
    }
    return edges;
  }, [socialData, nodesWithPositions]);

  // ── Modal ──
  const selNodeSn: SocialNode | null = selectedNode ? {
    id: selectedNode.id, name: selectedNode.name,
    relation: selectedNode.relation, type: selectedNode.type, level: selectedNode.level,
  } as SocialNode : null;
  const selVisuals = selNodeSn ? getVisuals(selNodeSn) : null;

  // ── Render ──
  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-6 relative">
      {/* ─── Header ─── */}
      <div className="relative z-10 glass-panel p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-aether-cyan/10 border border-aether-cyan/30 rounded-full flex items-center justify-center shrink-0">
            <Users className="text-aether-cyan" size={24} />
          </div>
          <div>
            <h2 className="font-display text-2xl tracking-[0.2em] text-aether-cyan">社交关系</h2>
          </div>
        </div>
      </div>

      {/* ─── Graph Area ─── */}
      <div
        ref={graphRef}
        className="flex-1 relative glass-panel border-glow overflow-hidden bg-aether-dark/30"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,242,255,0.06) 1px, transparent 1px)', backgroundSize: '30px 30px' }}
      >
        {/* ─── Nodes + Edges Layer ─── */}
        <div className="absolute inset-0" style={{ zIndex: 2 }}>

          {/* ===== Phase 1: Connection lines (exact original style + animation) ===== */}
          <AnimatePresence>
            {animPhase >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="absolute inset-0">
                {edgeData.map((edge, i) => {
                  const p1 = edge.from === '我' ? { x: centerX, y: centerY } : positionMap.get(edge.from);
                  const p2 = positionMap.get(edge.to);
                  if (!p1 || !p2) return null;
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  return (
                    <motion.div
                      key={`edge-${i}`}
                      className="absolute pointer-events-none"
                      style={{
                        left: p1.x,
                        top: p1.y,
                        height: 2.5,
                        background: edge.stroke,
                        opacity: edge.opacity,
                        transform: `rotate(${angle}deg)`,
                        transformOrigin: '0 50%',
                        borderRadius: '2px',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: length }}
                      transition={{ duration: 0.5, delay: i * 0.15, ease: 'easeOut' }}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Centre: "我" node (EXACT copy of original positioning) ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
            className="absolute pointer-events-none"
            style={{
              left: centerX,
              top: centerY,
              marginLeft: -50,
              marginTop: -50,
            }}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full" style={{ boxShadow: '0 0 40px rgba(0,242,255,0.12)', animation: 'pulse-slow 3s ease-in-out infinite' }} />
              <div className="w-20 h-20 rounded-full bg-aether-dark/90 border-2 border-aether-cyan flex items-center justify-center shadow-[0_0_30px_rgba(0,242,255,0.3)] backdrop-blur-sm relative">
                <span className="font-display text-2xl font-bold text-aether-cyan" style={{ textShadow: '0 0 12px rgba(0,242,255,0.6)' }}>我</span>
              </div>
            </div>
          </motion.div>

          {/* ── Phase 0: Character nodes (exact original style, no name labels) ── */}
          {nodesWithPositions.map((node, i) => {
            const v = TYPE_VISUALS[node.type];
            const fontSize = Math.max(13, node.size * 0.35);
            return (
              <motion.button
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.3 + i * 0.15 }}
                style={{
                  position: 'absolute',
                  left: node.x - node.size / 2,
                  top: node.y - node.size / 2,
                  width: node.size,
                  height: node.size,
                }}
                onClick={() => setSelectedNode(node)}
                className="clickable group"
                aria-label={`选择 ${node.name}`}
              >
                <div className={`w-full h-full rounded-full border-2 bg-aether-dark/80 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:scale-110 ${v.border} ${v.glow} hover-glow`}>
                  <span className={`font-display font-bold ${v.text}`} style={{ fontSize }}>{node.name[0]}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── Detail Modal ─── */}
      <Modal isOpen={!!selectedNode} onClose={() => setSelectedNode(null)} title="个体共鸣档案">
        {selNodeSn && selVisuals && (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className={`relative w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl font-bold font-display shrink-0 ${selVisuals.border} ${selVisuals.text} ${selVisuals.glow}`}>
                {selNodeSn.name[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-3">
                  <h3 className="text-2xl font-display font-bold text-white truncate">{selNodeSn.name}</h3>
                  <span className={`text-[9px] px-2 py-0.5 rounded-sm font-mono tracking-wider uppercase shrink-0 ${selVisuals.bg} ${selVisuals.text} border ${selVisuals.border}`}>{selNodeSn.type}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Share2 size={12} className="text-aether-blue shrink-0" />
                  <span className="text-xs text-aether-blue/80 font-mono tracking-wider">{selNodeSn.relation}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-aether-blue font-mono tracking-wider">
                <span className="uppercase flex items-center gap-1.5"><Activity size={10} className="text-aether-blue" />共鸣度</span>
                <span className="text-white/80">{selNodeSn.level}%</span>
              </div>
              <div className="h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${selNodeSn.level}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                  className={`h-full rounded-full ${getLevelColor(selNodeSn.level)}`}
                  style={selNodeSn.level >= 50 ? { boxShadow: '0 0 8px rgba(0,242,255,0.4)' } : undefined} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-aether-cyan/[0.04] border border-aether-cyan/20 rounded-sm hover:bg-aether-cyan/[0.06] transition-colors">
                <Heart size={16} className="text-aether-cyan mb-2" />
                <p className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-1">社交关系</p>
                <p className="text-sm font-medium text-white/90">{selNodeSn.type}</p>
                <p className="text-[10px] text-white/40 font-mono mt-1">关系: {selNodeSn.relation}</p>
              </div>
              <div className="p-4 bg-aether-blue/[0.04] border border-aether-blue/20 rounded-sm hover:bg-aether-blue/[0.06] transition-colors">
                <Zap size={16} className="text-aether-blue mb-2" />
                <p className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-1">共鸣等级</p>
                <p className="text-sm font-medium text-white/90">Lv.{Math.floor(selNodeSn.level / 10) + 1}</p>
                <p className="text-[10px] text-white/40 font-mono mt-1">共鸣度 {selNodeSn.level}%</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <h4 className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-3 flex items-center gap-1.5">
                <Radio size={10} />社交档案
              </h4>
              <div className="relative pl-4 border-l border-aether-cyan/20">
                <p className="text-sm text-white/60 leading-relaxed italic">
                  与「{selNodeSn.name}」的关系为「{selNodeSn.relation}」，共鸣等级 {selNodeSn.level}%。
                </p>
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="w-full py-4 bg-gradient-to-r from-aether-cyan/90 to-aether-cyan text-aether-dark font-display font-bold tracking-[0.3em] uppercase text-sm hover:opacity-90 transition-all relative overflow-hidden group clickable">
              <span className="relative z-10 flex items-center justify-center gap-3"><Radio size={16} />发起通讯</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </motion.button>
          </div>
        )}
      </Modal>

      <style>{`@keyframes pulse-slow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }`}</style>
    </div>
  );
}
