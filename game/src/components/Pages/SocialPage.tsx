import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Share2, Heart, Zap, Radio, Activity } from 'lucide-react';
import { SocialNode } from '../../types';
import { MOCK_SOCIAL } from '../../mockData';
import { Modal } from '../Feedback';

// ─── Type Constants ─────────────────────────────────────────────

type RelationType = '盟友' | '中立' | '敌对' | '未知';

interface TypeVisuals {
  text: string;
  border: string;
  bg: string;
  glow: string;
}

const TYPE_VISUALS: Record<RelationType, TypeVisuals> = {
  '盟友': { text: 'text-aether-cyan', border: 'border-aether-cyan', bg: 'bg-aether-cyan/10', glow: 'shadow-[0_0_15px_rgba(0,242,255,0.4)]' },
  '中立': { text: 'text-aether-blue', border: 'border-aether-blue', bg: 'bg-aether-blue/10', glow: '' },
  '敌对': { text: 'text-red-400', border: 'border-red-500/60', bg: 'bg-red-500/10', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
  '未知': { text: 'text-white/50', border: 'border-white/20', bg: 'bg-white/5', glow: '' },
};

const SPECIAL_SKILLS: Record<string, string> = {
  n1: '以太引导',
  n2: '战术渗透',
  n3: '暗网入侵',
  n4: '后勤统筹',
  n5: '情报分析',
};

const BACKGROUND_STORIES: Record<string, string> = {
  n1: '引导者「林雪」是最早响应以太信号的共鸣者之一，对Aether Link架构有着超越常人的理解。她的引导使你在混沌的信息洪流中找到了方向。',
  n2: '雇佣兵「克里斯」游离于各方势力之间，只为最高报价提供服务。他的战斗技巧无可挑剔，但忠诚度始终是一个变量。',
  n3: '宿敌「黑鸢」曾是Aether Link的早期成员，因理念分歧而决裂。如今她活跃在暗网深处，不断破坏你的行动节点。',
  n4: '后勤官「苏姗」是团队的稳定基石，负责物资调配与情报归档。她那近乎偏执的条理性，确保了每一次行动的顺利进行。',
  n5: '情报商「泽维尔」掌握着地下世界最灵敏的信息网络。只要价格合适，他能为你找到任何你想要的数据——但请谨慎对待交易的分寸。',
};

const RELATION_DESCRIPTIONS: Record<string, string> = {
  '盟友': '值得信赖的伙伴',
  '敌对': '保持警惕',
  '中立': '利益往来者',
  '未知': '数据不足',
};

// ─── Helpers ────────────────────────────────────────────────────

function getVisuals(node: SocialNode): TypeVisuals {
  return TYPE_VISUALS[node.type as RelationType] || TYPE_VISUALS['未知'];
}

function getLevelColor(level: number): string {
  if (level >= 70) return 'bg-aether-cyan';
  if (level >= 40) return 'bg-aether-blue';
  return 'bg-red-500';
}

function getEdgeStyle(typeA: string, typeB: string): { stroke: string; opacity: number } {
  if (typeA === '敌对' || typeB === '敌对') return { stroke: '#ef4444', opacity: 0.25 };
  if (typeA === '中立' || typeB === '中立') return { stroke: '#00a8cc', opacity: 0.35 };
  return { stroke: '#00f2ff', opacity: 0.5 };
}

// ─── Component ─────────────────────────────────────────────────

export default function SocialPage() {
  const [selectedNode, setSelectedNode] = useState<SocialNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphBounds, setGraphBounds] = useState({ width: 800, height: 600 });

  // Pre-compute modal visuals for cleaner JSX
  const selVisuals = selectedNode ? getVisuals(selectedNode) : null;

  // ── Measure & watch container dimensions ──
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setGraphBounds({ width: rect.width, height: rect.height });

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setGraphBounds((prev) =>
        prev.width !== width || prev.height !== height
          ? { width, height }
          : prev
      );
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Layout ──
  const centerX = graphBounds.width / 2;
  const centerY = graphBounds.height / 2;
  const radiusX = Math.min(graphBounds.width * 0.35, 280);
  const radiusY = Math.min(graphBounds.height * 0.28, 190);

  const nodesWithPositions = useMemo(() => {
    return MOCK_SOCIAL.nodes.map((node, i) => {
      const angle = (i / MOCK_SOCIAL.nodes.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...node,
        x: Math.cos(angle) * radiusX + centerX,
        y: Math.sin(angle) * radiusY + centerY,
        size: 42 + (node.level / 100) * 20,
      };
    });
  }, [radiusX, radiusY, centerX, centerY]);

  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodesWithPositions.forEach((n) => map.set(n.id, { x: n.x, y: n.y }));
    return map;
  }, [nodesWithPositions]);

  const getNodeById = (id: string): SocialNode =>
    MOCK_SOCIAL.nodes.find((n) => n.id === id)!;

  // ── Edge styles with type-based colouring ──
  const edgeData = useMemo(() => {
    return MOCK_SOCIAL.edges.map(([from, to]) => ({
      from,
      to,
      style: getEdgeStyle(getNodeById(from).type, getNodeById(to).type),
    }));
  }, []);

  // ── Hovered node details (for tooltip) ──
  const hoveredNode = hoveredNodeId
    ? nodesWithPositions.find((n) => n.id === hoveredNodeId)
    : null;

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
            <h2 className="font-display text-2xl tracking-[0.2em] text-aether-cyan">
              社交关系
            </h2>
          </div>
        </div>
      </div>

      {/* ─── Graph Area ─── */}
      <div
        ref={graphRef}
        className="flex-1 relative glass-panel border-glow overflow-hidden bg-aether-dark/30"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(0,242,255,0.06) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      >

        {/* ─── Nodes + Edges Layer (shared coordinate space) ─── */}
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          {/* ── Player-to-character connections ── */}
          {[nodesWithPositions[0], nodesWithPositions[3]].map((target, i) => {
            if (!target) return null;
            const dx = target.x - centerX;
            const dy = target.y - centerY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <div
                key={`player-edge-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: centerX,
                  top: centerY,
                  width: length,
                  height: 2.5,
                  background: '#00f2ff',
                  opacity: 0.45,
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: '0 50%',
                  borderRadius: '2px',
                }}
              />
            );
          })}

          {/* ── Character-to-character connection lines ── */}
          {edgeData.map((edge, i) => {
            const p1 = positionMap.get(edge.from);
            const p2 = positionMap.get(edge.to);
            if (!p1 || !p2) return null;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <div
                key={`edge-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: p1.x,
                  top: p1.y,
                  width: length,
                  height: 2.5,
                  background: edge.style.stroke,
                  opacity: edge.style.opacity + 0.15,
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: '0 50%',
                  borderRadius: '2px',
                }}
              />
            );
          })}

          {/* ── Centre: Player "我" node ── */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: centerX,
              top: centerY,
              marginLeft: -50,
              marginTop: -50,
            }}
          >
            <div className="relative flex items-center justify-center">

              {/* Outer glow aura */}
              <div
                className="absolute w-24 h-24 rounded-full animate-pulse-slow"
                style={{
                  boxShadow: '0 0 40px rgba(0,242,255,0.12)',
                }}
              />
              {/* Core node */}
              <div className="w-20 h-20 rounded-full bg-aether-dark/90 border-2 border-aether-cyan flex items-center justify-center shadow-[0_0_30px_rgba(0,242,255,0.3)] backdrop-blur-sm relative">
                <span
                  className="font-display text-2xl font-bold text-aether-cyan"
                  style={{ textShadow: '0 0 12px rgba(0,242,255,0.6)' }}
                >
                  我
                </span>
              </div>
            </div>
          </div>

          {/* ── Character nodes ── */}
          {nodesWithPositions.map((node, i) => {
            const v = getVisuals(node);
            const fontSize = Math.max(13, node.size * 0.35);
            return (
              <motion.button
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  damping: 14,
                  stiffness: 200,
                  delay: 0.4 + i * 0.12,
                }}
                style={{
                  position: 'absolute',
                  left: node.x - node.size / 2,
                  top: node.y - node.size / 2,
                  width: node.size,
                  height: node.size,
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => setSelectedNode(node)}
                className="clickable"
                aria-label={`选择 ${node.name}`}
              >
                <div
                  className={`w-full h-full rounded-full border-2 bg-aether-dark/80 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:scale-110 ${v.border} ${v.glow} hover-glow`}
                >
                  <span
                    className={`font-display font-bold ${v.text}`}
                    style={{ fontSize }}
                  >
                    {node.name[0]}
                  </span>
                </div>
              </motion.button>
            );
          })}

          {/* ─── Hover Tooltip ─── */}
          <AnimatePresence>
            {hoveredNode && (
              <TooltipContent
                key={`ttp-${hoveredNode.id}`}
                node={hoveredNode}
                visuals={getVisuals(hoveredNode)}
                barColor={getLevelColor(hoveredNode.level)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Detail Modal ─── */}
      <Modal
        isOpen={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        title="个体共鸣档案"
      >
        {selectedNode && selVisuals && (
          <ModalContent
            node={selectedNode}
            visuals={selVisuals}
            barColor={getLevelColor(selectedNode.level)}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Tooltip Sub-component ──────────────────────────────────────

function TooltipContent({
  node,
  visuals,
  barColor,
}: {
  node: { id: string; name: string; relation: string; type: string; level: number; size: number; x: number; y: number };
  visuals: TypeVisuals;
  barColor: string;
}) {
  const tooltipY = node.y - node.size / 2 - 10;
  const isNearTop = tooltipY < 80;
  const finalY = isNearTop ? node.y + node.size / 2 + 10 : tooltipY;

  return (
    <motion.div
      initial={{ opacity: 0, y: isNearTop ? -8 : 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: isNearTop ? -8 : 8, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute pointer-events-none z-50"
      style={{
        left: node.x,
        top: finalY,
        transform: `translate(-50%, ${isNearTop ? '0%' : '-100%'})`,
      }}
    >
      <div className="glass-panel px-4 py-3 min-w-[180px] border-aether-cyan/30 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
        {/* Header: name + type badge */}
        <div className="flex items-center justify-between mb-2 gap-3">
          <span className={`font-display text-sm font-bold ${visuals.text}`}>
            {node.name}
          </span>
          <span
            className={`text-[9px] px-2 py-0.5 rounded-sm font-mono tracking-wider uppercase shrink-0 ${visuals.bg} ${visuals.text} border ${visuals.border}`}
          >
            {node.type}
          </span>
        </div>

        {/* Relation */}
        <div className="text-[10px] text-white/50 font-mono tracking-wider mb-2">
          {node.relation}
        </div>

        {/* Level bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] text-white/40 font-mono">
            <span>共鸣度</span>
            <span>{node.level}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 border border-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${node.level}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${barColor}`}
              style={
                node.level >= 70
                  ? { boxShadow: '0 0 6px rgba(0,242,255,0.5)' }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Arrow */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0
          ${
            isNearTop
              ? 'bottom-full border-b-[6px] border-b-aether-cyan/30 border-l-[6px] border-r-[6px] border-l-transparent border-r-transparent'
              : 'top-full border-t-[6px] border-t-aether-cyan/30 border-l-[6px] border-r-[6px] border-l-transparent border-r-transparent'
          }`}
      />
    </motion.div>
  );
}

// ─── Modal Content Sub-component ────────────────────────────────

function ModalContent({
  node,
  visuals,
  barColor,
}: {
  node: SocialNode;
  visuals: TypeVisuals;
  barColor: string;
}) {
  const skill = SPECIAL_SKILLS[node.id] || '未知能力';
  const story = BACKGROUND_STORIES[node.id] || '该个体的背景数据正在收集中……';

  return (
    <div className="space-y-6">
      {/* Avatar + Name row */}
      <div className="flex items-center gap-6">
        <div
          className={`relative w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl font-bold font-display shrink-0 ${visuals.border} ${visuals.text} ${visuals.glow}`}
        >
          {node.name[0]}

        </div>
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-3">
            <h3 className="text-2xl font-display font-bold text-white truncate">
              {node.name}
            </h3>
            <span
              className={`text-[9px] px-2 py-0.5 rounded-sm font-mono tracking-wider uppercase shrink-0 ${visuals.bg} ${visuals.text} border ${visuals.border}`}
            >
              {node.type}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Share2 size={12} className="text-aether-blue shrink-0" />
            <span className="text-xs text-aether-blue/80 font-mono tracking-wider">
              {node.relation}
            </span>
          </div>
        </div>
      </div>

      {/* Loyalty / Resonance bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] text-aether-blue font-mono tracking-wider">
          <span className="uppercase flex items-center gap-1.5">
            <Activity size={10} className="text-aether-blue" />
            共鸣度
          </span>
          <span className="text-white/80">{node.level}%</span>
        </div>
        <div className="h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${node.level}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            className={`h-full rounded-full ${barColor}`}
            style={
              node.level >= 50
                ? { boxShadow: '0 0 8px rgba(0,242,255,0.4)' }
                : undefined
            }
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-aether-cyan/[0.04] border border-aether-cyan/20 rounded-sm hover:bg-aether-cyan/[0.06] transition-colors">
          <Heart size={16} className="text-aether-cyan mb-2" />
          <p className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-1">
            社交关系
          </p>
          <p className="text-sm font-medium text-white/90">{node.type}</p>
          <p className="text-[10px] text-white/40 font-mono mt-1">
            {RELATION_DESCRIPTIONS[node.type] || '数据不足'}
          </p>
        </div>
        <div className="p-4 bg-aether-blue/[0.04] border border-aether-blue/20 rounded-sm hover:bg-aether-blue/[0.06] transition-colors">
          <Zap size={16} className="text-aether-blue mb-2" />
          <p className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-1">
            特殊机能
          </p>
          <p className="text-sm font-medium text-white/90">{skill}</p>
          <p className="text-[10px] text-white/40 font-mono mt-1">
            等级 {Math.floor(node.level / 10) + 1}
          </p>
        </div>
      </div>

      {/* Background story */}
      <div className="pt-4 border-t border-white/5">
        <h4 className="text-[10px] text-aether-blue font-mono tracking-wider uppercase mb-3 flex items-center gap-1.5">
          <Radio size={10} />
          背景情报摘要
        </h4>
        <div className="relative pl-4 border-l border-aether-cyan/20">
          <p className="text-sm text-white/60 leading-relaxed italic">
            {story}
          </p>
        </div>
      </div>

      {/* Action button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 bg-gradient-to-r from-aether-cyan/90 to-aether-cyan text-aether-dark font-display font-bold tracking-[0.3em] uppercase text-sm hover:opacity-90 transition-all relative overflow-hidden group clickable"
      >
        <span className="relative z-10 flex items-center justify-center gap-3">
          <Radio size={16} />
          发起通讯
        </span>
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      </motion.button>
    </div>
  );
}
