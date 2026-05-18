import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Share2, Heart, Zap, Radio, Activity } from 'lucide-react';
import { Modal } from '../Feedback';
import { useSillytavern } from '../../hooks/useSillytavern';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';

/* ===== Type config ===== */
type RelationType = '盟友' | '中立' | '敌对' | '未知';

interface TypeVisuals { text: string; border: string; bg: string; glow: string }

const TYPE_VISUALS: Record<RelationType, TypeVisuals> = {
  '盟友': { text: 'text-aether-cyan', border: 'border-aether-cyan', bg: 'bg-aether-cyan/10', glow: 'shadow-[0_0_15px_rgba(0,242,255,0.4)]' },
  '中立': { text: 'text-aether-blue', border: 'border-aether-blue', bg: 'bg-aether-blue/10', glow: '' },
  '敌对': { text: 'text-red-400', border: 'border-red-500/60', bg: 'bg-red-500/10', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
  '未知': { text: 'text-white/50', border: 'border-white/20', bg: 'bg-white/5', glow: '' },
};

/* ===== Data types from variables ===== */
interface SocialPersonData {
  关系: string;
  社交圈?: Record<string, string>;
}

interface SocialNodeRender {
  id: string;
  name: string;
  relation: string;
  type: RelationType;
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

/* ===== Color palette for nodes ===== */
const NODE_COLORS = ['#00f2ff', '#a78bfa', '#f59e0b', '#f472b6', '#22c55e', '#3b82f6', '#14b8a6', '#ef4444'];

function inferType(relation: string): RelationType {
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

/* ============================================================
   SOCIAL PAGE
   ============================================================ */
export default function SocialPage() {
  const ss = useSillytavern();
  const liveVars = ss.activeChat?.variables;
  const socialData: Record<string, SocialPersonData> =
    liveVars?.['主角']?.['社交'] ?? (DEFAULT_WORLD_VARS as any).主角?.社交 ?? {};

  const [selectedNode, setSelectedNode] = useState<SocialNodeRender | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [animPhase, setAnimPhase] = useState(0); // 0=avatars, 1=lines, 2=labels
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphBounds, setGraphBounds] = useState({ width: 800, height: 600 });

  // ── Observe container size ──
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setGraphBounds({ width: rect.width, height: rect.height });
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setGraphBounds((prev) => (prev.width !== width || prev.height !== height ? { width, height } : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
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

    const centerX = graphBounds.width / 2;
    const centerY = graphBounds.height / 2;
    const radiusX = Math.min(graphBounds.width * 0.30, 240);
    const radiusY = Math.min(graphBounds.height * 0.25, 170);

    const nodeList: SocialNodeRender[] = entries.map(([name, data], i) => {
      const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: name,
        name,
        relation: data.关系,
        type: inferType(data.关系),
        level: getLevelHint(data.关系),
        x: Math.cos(angle) * radiusX + centerX,
        y: Math.sin(angle) * radiusY + centerY,
        size: 44 + Math.random() * 8,
        color: NODE_COLORS[i % NODE_COLORS.length],
      };
    });

    // Build edges: 我→person + person→person (社交圈)
    const edgeList: SocialEdgeRender[] = [];
    const nameSet = new Set(nodeList.map((n) => n.name));

    for (const [name, data] of entries) {
      // Edge from "我" to person
      edgeList.push({ from: '我', to: name, label: data.关系, stroke: '#00f2ff', opacity: 0.55 });

      // Edges from person to their social circle
      if (data.社交圈) {
        for (const [friendName, relLabel] of Object.entries(data.社交圈)) {
          if (!nameSet.has(friendName)) continue;
          const dup = edgeList.find(
            (e) => (e.from === name && e.to === friendName) || (e.from === friendName && e.to === name),
          );
          if (!dup) {
            edgeList.push({ from: name, to: friendName, label: relLabel, stroke: '#a78bfa', opacity: 0.45 });
          }
        }
      }
    }

    return { nodes: nodeList, edges: edgeList };
  }, [socialData, graphBounds]);

  const centerX = graphBounds.width / 2;
  const centerY = graphBounds.height / 2;

  // Position helper
  const getPos = (id: string): { x: number; y: number } | null => {
    if (id === '我') return { x: centerX, y: centerY };
    const n = nodes.find((x) => x.id === id);
    return n ? { x: n.x, y: n.y } : null;
  };

  const selNode = selectedNode;
  const selVisuals: TypeVisuals | null = selNode ? TYPE_VISUALS[selNode.type] : null;

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-6 relative">
      {/* ── Header ── */}
      <div className="relative z-10 glass-panel p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-aether-cyan/10 border border-aether-cyan/30 rounded-full flex items-center justify-center shrink-0">
            <Users className="text-aether-cyan" size={24} />
          </div>
          <div>
            <h2 className="font-display text-2xl tracking-[0.2em] text-aether-cyan">社交关系</h2>
            <p className="text-[10px] text-white/30 font-mono tracking-wider mt-0.5">
              {nodes.length} 位关联人物
            </p>
          </div>
        </div>
      </div>

      {/* ── Graph Area ── */}
      <div
        ref={graphRef}
        className="flex-1 relative glass-panel border-glow overflow-hidden bg-aether-dark/30"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,242,255,0.06) 1px, transparent 1px)', backgroundSize: '30px 30px' }}
      >
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          {/* ===== Phase 2: Connection lines ===== */}
          <AnimatePresence>
            {animPhase >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="absolute inset-0">
                {edges.map((edge, i) => {
                  const p1 = getPos(edge.from);
                  const p2 = getPos(edge.to);
                  if (!p1 || !p2) return null;
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  const edgeKey = `${edge.from}-${edge.to}`;
                  const isHovered = hoveredEdge === edgeKey;

                  return (
                    <React.Fragment key={edgeKey}>
                      {/* Line */}
                      <motion.div
                        className="absolute pointer-events-none"
                        style={{
                          left: p1.x, top: p1.y,
                          width: 0, height: 2,
                          background: edge.stroke,
                          opacity: edge.opacity,
                          transform: `rotate(${angle}deg)`,
                          transformOrigin: '0 50%',
                          borderRadius: '2px',
                        }}
                        animate={{ width: length }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      />

                      {/* Phase 3: Relationship label on edge midpoint */}
                      {animPhase >= 2 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: isHovered ? 1 : 0.8, scale: 1 }}
                          transition={{ duration: 0.35, delay: i * 0.06 }}
                          className="absolute pointer-events-auto cursor-default"
                          style={{ left: midX, top: midY, transform: 'translate(-50%, -50%)' }}
                          onMouseEnter={() => setHoveredEdge(edgeKey)}
                          onMouseLeave={() => setHoveredEdge(null)}
                        >
                          <span
                            className="block text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap transition-all duration-200"
                            style={{
                              color: edge.stroke,
                              backgroundColor: `${edge.stroke}10`,
                              border: `1px solid ${edge.stroke}30`,
                              boxShadow: isHovered ? `0 0 10px ${edge.stroke}20` : 'none',
                            }}
                          >
                            {edge.label}
                          </span>
                        </motion.div>
                      )}
                    </React.Fragment>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ===== Centre: "我" node ===== */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className="absolute pointer-events-none"
            style={{ left: centerX - 50, top: centerY - 50 }}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full" style={{ boxShadow: '0 0 40px rgba(0,242,255,0.12)', animation: 'pulse-slow 3s ease-in-out infinite' }} />
              <div className="w-20 h-20 rounded-full bg-aether-dark/90 border-2 border-aether-cyan flex items-center justify-center shadow-[0_0_30px_rgba(0,242,255,0.3)] backdrop-blur-sm relative z-10">
                <span className="font-display text-2xl font-bold text-aether-cyan" style={{ textShadow: '0 0 12px rgba(0,242,255,0.6)' }}>我</span>
              </div>
            </div>
          </motion.div>

          {/* ===== Phase 1: Character avatar nodes ===== */}
          {nodes.map((node, i) => {
            const v = TYPE_VISUALS[node.type];
            return (
              <motion.button
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.3 + i * 0.1 }}
                style={{ position: 'absolute', left: node.x - node.size / 2, top: node.y - node.size / 2, width: node.size, height: node.size }}
                onClick={() => setSelectedNode(node)}
                className="clickable group"
                aria-label={`选择 ${node.name}`}
              >
                {/* Outer glow */}
                <div
                  className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ boxShadow: `0 0 20px ${node.color}40` }}
                />
                {/* Avatar circle */}
                <div
                  className="w-full h-full rounded-full border-2 bg-aether-dark/85 backdrop-blur-sm flex items-center justify-center transition-all duration-300 group-hover:scale-115"
                  style={{ borderColor: `${node.color}99`, boxShadow: `0 0 12px ${node.color}30` }}
                >
                  <span className="font-display font-bold" style={{ fontSize: Math.max(13, node.size * 0.32), color: node.color }}>
                    {node.name[0]}
                  </span>
                </div>
                {/* Name label below */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 pointer-events-none">
                  <span className="text-[10px] font-mono text-white/35 tracking-wider whitespace-nowrap transition-all duration-300 group-hover:text-white/70">
                    {node.name}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <Modal isOpen={!!selectedNode} onClose={() => setSelectedNode(null)} title="个体共鸣档案">
        {selectedNode && selVisuals && (
          <div className="space-y-6">
            {/* Avatar + Name */}
            <div className="flex items-center gap-6">
              <div
                className="relative w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl font-bold font-display shrink-0"
                style={{ borderColor: `${selectedNode.color}80`, color: selectedNode.color, boxShadow: `0 0 18px ${selectedNode.color}30` }}
              >
                {selectedNode.name[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-3">
                  <h3 className="text-2xl font-display font-bold text-white truncate">{selectedNode.name}</h3>
                  <span className={`text-[9px] px-2 py-0.5 rounded-sm font-mono tracking-wider uppercase shrink-0 ${selVisuals.bg} ${selVisuals.text} border ${selVisuals.border}`}>
                    {selectedNode.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Share2 size={12} className="text-aether-blue shrink-0" />
                  <span className="text-xs text-aether-blue/80 font-mono tracking-wider">{selectedNode.relation}</span>
                </div>
              </div>
            </div>

            {/* Resonance bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-aether-blue font-mono tracking-wider">
                <span className="uppercase flex items-center gap-1.5"><Activity size={10} className="text-aether-blue" />共鸣度</span>
                <span className="text-white/80">{selectedNode.level}%</span>
              </div>
              <div className="h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${selectedNode.level}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                  className="h-full rounded-full" style={{ backgroundColor: selectedNode.color, boxShadow: `0 0 8px ${selectedNode.color}50` }} />
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-aether-cyan/[0.04] border border-aether-cyan/20 rounded-sm">
                <Heart size={16} className="text-aether-cyan mb-2" />
                <p className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-1">社交关系</p>
                <p className="text-sm font-medium text-white/90">{selectedNode.type}</p>
                <p className="text-[10px] text-white/40 font-mono mt-1">{selectedNode.relation}</p>
              </div>
              <div className="p-4 bg-aether-blue/[0.04] border border-aether-blue/20 rounded-sm">
                <Zap size={16} className="text-aether-blue mb-2" />
                <p className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-1">关联人物</p>
                <p className="text-sm font-medium text-white/90">
                  {edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).length} 人
                </p>
                <p className="text-[10px] text-white/40 font-mono mt-1">社交圈</p>
              </div>
            </div>

            {/* Connected people */}
            <div className="pt-4 border-t border-white/5">
              <h4 className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-3 flex items-center gap-1.5">
                <Radio size={10} />社交圈
              </h4>
              <div className="space-y-2">
                {edges
                  .filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
                  .map((e) => {
                    const other = e.from === selectedNode.id ? e.to : e.from;
                    return (
                      <div key={other} className="flex items-center gap-3 p-2 bg-white/[0.02] rounded border border-white/5">
                        <div className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold" style={{ borderColor: `${NODE_COLORS[nodes.findIndex((n) => n.id === other) % NODE_COLORS.length]}60`, color: NODE_COLORS[nodes.findIndex((n) => n.id === other) % NODE_COLORS.length] }}>
                          {other[0]}
                        </div>
                        <span className="text-sm text-white/70 font-display">{other}</span>
                        <span className="ml-auto text-[10px] text-white/35 font-mono">{e.label}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="w-full py-4 bg-gradient-to-r from-aether-cyan/90 to-aether-cyan text-aether-dark font-display font-bold tracking-[0.3em] uppercase text-sm hover:opacity-90 transition-all relative overflow-hidden group clickable"
            >
              <span className="relative z-10 flex items-center justify-center gap-3"><Radio size={16} />发起通讯</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </motion.button>
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
