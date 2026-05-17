import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_MAP } from '../../mockData';
import {
  ZoomIn, ZoomOut, ArrowLeft
} from 'lucide-react';
import { MapPoint } from '../../types';

/* ===== Type color config ===== */
interface PointColorSet {
  primary: string;
  glow: string;
  text: string;
  border: string;
  bg: string;
  label: string;
}

const POINT_COLORS: Record<MapPoint['type'], PointColorSet> = {
  '城市': {
    primary: '#22c55e',
    glow: 'rgba(34,197,94,0.6)',
    text: 'text-green-400',
    border: 'border-green-400',
    bg: 'bg-green-400/20',
    label: '低危',
  },
  '据点': {
    primary: '#eab308',
    glow: 'rgba(234,179,8,0.6)',
    text: 'text-yellow-400',
    border: 'border-yellow-400/70',
    bg: 'bg-yellow-400/20',
    label: '中危',
  },
  '遗迹': {
    primary: '#00a8cc',
    glow: 'rgba(0,168,204,0.6)',
    text: 'text-aether-blue',
    border: 'border-aether-blue',
    bg: 'bg-aether-blue/20',
    label: '高危',
  },
  '未知': {
    primary: '#ef4444',
    glow: 'rgba(239,68,68,0.6)',
    text: 'text-red-400',
    border: 'border-red-500/60',
    bg: 'bg-red-500/20',
    label: '极高危',
  },
};

function getDangerLevel(type: MapPoint['type']): { label: string; color: string } {
  switch (type) {
    case '未知': return { label: '极高', color: 'text-red-400' };
    case '遗迹': return { label: '高', color: 'text-aether-blue' };
    case '据点': return { label: '中', color: 'text-yellow-400' };
    case '城市': return { label: '低', color: 'text-green-400' };
  }
}

/* ===== Floating particles ===== */
interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

const PARTICLES: Particle[] = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 10,
  duration: 8 + Math.random() * 10,
  size: 1.5 + Math.random() * 2.5,
  opacity: 0.1 + Math.random() * 0.3,
}));

/* ===== Zoom limits ===== */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

/* ===== Map canvas dimensions ===== */
const CANVAS_W = 800;
const CANVAS_H = 600;

/* ===== Map canvas reference dimensions ===== */
export default function MapPage() {
  const [layerStack, setLayerStack] = useState<MapPoint[][]>([MOCK_MAP]);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);
  const [cardOrigin, setCardOrigin] = useState<{ x: number; y: number } | null>(null);
  const [cardVisible, setCardVisible] = useState(false);

  const currentLayer = layerStack[layerStack.length - 1];
  const isSubMap = layerStack.length > 1;

  // Reset card visibility when selectedPoint changes
  useEffect(() => {
    if (selectedPoint && !selectedPoint.subPoints) {
      // Small delay to allow mount before animating
      const t = setTimeout(() => setCardVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setCardVisible(false);
    }
  }, [selectedPoint]);

  const handlePointClick = useCallback(
    (point: MapPoint, e: React.MouseEvent) => {
      e.stopPropagation();

      setSelectedPoint(point);
      setCardOrigin({ x: e.clientX, y: e.clientY });
      setCardVisible(false);
    },
    [],
  );

  const goBack = useCallback(() => {
    setLayerStack((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
    setSelectedPoint(null);
    setCardOrigin(null);
    setCardVisible(false);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  }, []);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragMoved.current = false;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx - pan.x) > 2 || Math.abs(dy - pan.y) > 2) {
      dragMoved.current = true;
    }
    setPan({ x: dx, y: dy });
  }, [isDragging, pan]);

  const handlePanEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const dismissCard = useCallback(() => {
    if (dragMoved.current) return;
    setSelectedPoint(null);
    setCardOrigin(null);
    setCardVisible(false);
  }, []);

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-aether-deep">

      {/* ===== Floating Back Button ===== */}
      <AnimatePresence>
        {isSubMap && (
          <motion.button
            key="back-btn"
            initial={{ opacity: 0, x: -12, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.9 }}
            onClick={goBack}
            className="absolute top-6 left-6 z-10 p-2.5 glass-panel hover:border-aether-cyan/60 text-aether-cyan transition-all hover-glow clickable press-scale"
            aria-label="返回上级地图"
          >
            <ArrowLeft size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ===== Map Canvas ===== */}
      <div
        className={`absolute inset-0 overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onClick={dismissCard}
      >
        {/* Fixed frame — border + corners + subtle grid */}
        <div
          className="absolute inset-0 border border-aether-border/10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        >
          <CornerBracket position="top-left" />
          <CornerBracket position="top-right" />
          <CornerBracket position="bottom-left" />
          <CornerBracket position="bottom-right" />
        </div>

        {/* Scalable content — buildings + points (zoom & pan) */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div className="w-full h-full relative">
            <BuildingLayer />

            <AnimatePresence mode="wait">
              <motion.div
                key={layerStack.length}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {currentLayer.map((point) => (
                  <PointMarker
                    key={point.id}
                    point={point}
                    isSelected={selectedPoint?.id === point.id}
                    onClick={(e) => handlePointClick(point, e)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ===== Point Info Card (animated from click position) ===== */}
        <AnimatePresence>
          {selectedPoint && !selectedPoint.subPoints && cardOrigin && cardVisible && (
            <PointInfoCard
              key={selectedPoint.id}
              point={selectedPoint}
              origin={cardOrigin}
              onClose={dismissCard}
              onNavigate={() => {
                // Placeholder for navigation action
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ===== Footer Controls ===== */}
      <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-2 pointer-events-none">
        {/* Zoom controls */}
        <div className="glass-panel overflow-hidden pointer-events-auto flex flex-col items-center">
          <button
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="p-2.5 border-b border-aether-border/20 hover:text-aether-cyan text-aether-blue disabled:opacity-25 disabled:cursor-not-allowed transition-all clickable hover:bg-aether-cyan/5"
            aria-label="放大"
          >
            <ZoomIn size={18} />
          </button>
          <div className="py-1.5 px-2 border-b border-aether-border/20 text-center w-full">
            <span className="text-[10px] font-mono text-aether-cyan/80 font-bold">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <button
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="p-2.5 hover:text-aether-cyan text-aether-blue disabled:opacity-25 disabled:cursor-not-allowed transition-all clickable hover:bg-aether-cyan/5"
            aria-label="缩小"
          >
            <ZoomOut size={18} />
          </button>
        </div>

      </div>

      <style>{`
        @keyframes float-up {
          0%   { transform: translateY(100vh) translateX(0px); opacity: 0; }
          8%   { opacity: 0.35; }
          85%  { opacity: 0.35; }
          100% { transform: translateY(-15vh) translateX(8px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Building Outlines Layer
   ============================================================ */

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  variant: 'tall' | 'wide' | 'square' | 'small';
}

const BUILDINGS: Building[] = [
  { x: 20, y: 20, w: 14, h: 16, variant: 'tall' },
  { x: 50, y: 44, w: 16, h: 18, variant: 'tall' },
  { x: 10, y: 62, w: 14, h: 15, variant: 'wide' },
  { x: 70, y: 12, w: 13, h: 15, variant: 'tall' },
  { x: 38, y: 76, w: 15, h: 14, variant: 'wide' },
  { x: 82, y: 68, w: 10, h: 13, variant: 'square' },
];

function BuildingLayer() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      {BUILDINGS.map((b, i) => (
        <rect
          key={i}
          x={`${b.x}%`}
          y={`${b.y}%`}
          width={`${b.w}%`}
          height={`${b.h}%`}
          fill="rgba(60,65,70,0.55)"
          rx="0.15"
        />
      ))}
    </svg>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

/* -------- Point Marker -------- */
function PointMarker({
  point,
  isSelected,
  onClick,
}: {
  point: MapPoint;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const colors = POINT_COLORS[point.type];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ left: `${(point.x / CANVAS_W) * 100}%`, top: `${(point.y / CANVAS_H) * 100}%` }}
      className="absolute group -translate-x-1/2 -translate-y-1/2 z-10"
    >
      <button
        onClick={onClick}
        className="relative flex flex-col items-center justify-center clickable"
        aria-label={point.name}
      >
        {/* Circular marker */}
        <div
          className={`rounded-full border-2 transition-all duration-300 group-hover:scale-150 ${
            isSelected
              ? `${colors.bg} ${colors.border} scale-125`
              : 'border-white/50 bg-white/10 group-hover:border-aether-cyan group-hover:bg-aether-cyan/20'
          }`}
          style={{
            width: 14,
            height: 14,
            ...(isSelected ? {
              backgroundColor: colors.primary + '40',
              borderColor: colors.primary,
              boxShadow: `0 0 18px ${colors.glow}`,
            } : {
              borderColor: colors.primary + '99',
              backgroundColor: colors.primary + '20',
              boxShadow: `0 0 8px ${colors.glow}`,
            }),
          }}
        />

        {/* Label — dim always, bright tooltip on hover */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <span className="whitespace-nowrap text-[10px] font-display tracking-widest text-white/25 transition-all duration-300 group-hover:text-white group-hover:drop-shadow-[0_0_6px_rgba(0,242,255,0.4)]">
            {point.name}
          </span>
        </div>

      </button>
    </motion.div>
  );
}

/* -------- Point Info Card -------- */
function PointInfoCard({
  point,
  origin,
  onClose,
  onNavigate,
}: {
  point: MapPoint;
  origin: { x: number; y: number };
  onClose: () => void;
  onNavigate: () => void;
}) {
  const colors = POINT_COLORS[point.type];
  const danger = getDangerLevel(point.type);

  // Compute a readable final position (clamped to viewport)
  const cardW = 288; // w-72
  const cardH = 380; // approximate height
  const margin = 20;

  // We'll use fixed positioning relative to the viewport, and animate
  // from the click origin to a clamped comfortable position.
  const targetX = Math.max(margin, Math.min(origin.x - cardW / 2, window.innerWidth - cardW - margin));
  const targetY = Math.max(margin, Math.min(origin.y - cardH / 2, window.innerHeight - cardH - margin));

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.85,
        x: origin.x - cardW / 2,
        y: origin.y - cardH / 2,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        x: targetX,
        y: targetY,
      }}
      exit={{
        opacity: 0,
        scale: 0.85,
        x: origin.x - cardW / 2,
        y: origin.y - cardH / 2,
      }}
      transition={{ type: 'spring', damping: 26, stiffness: 280, mass: 0.8 }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-30 w-72 glass-panel overflow-hidden"
      style={{ borderLeft: `3px solid ${colors.primary}` }}
    >
      {/* Card header */}
      <div className="p-4 pb-3 border-b border-aether-border/10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-bold text-base text-aether-cyan uppercase tracking-wider truncate mr-2">
            {point.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-[10px] h-[10px] rotate-45 shrink-0"
            style={{ backgroundColor: colors.primary }}
          />
          <span className={`text-[9px] font-mono tracking-wider ${colors.text}`}>
            {point.type}
          </span>
          <span className="text-[7px] text-white/20 font-mono ml-auto">
            ID: {point.id}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="特征类型" value={point.type} className={colors.text} />
          <MiniStat label="危险评级" value={danger.label} className={danger.color} />
          <MiniStat label="坐标" value={`${point.x}, ${point.y}`} className="text-aether-cyan/70" />
          <MiniStat label="覆盖面积" value={`~${Math.floor(Math.random() * 50 + 10)} km²`} className="text-aether-cyan/70" />
        </div>

        {/* Description */}
        <div className="relative pt-3 border-t border-white/5">
          <p className="text-[10px] text-white/50 italic leading-relaxed font-mono">
            &ldquo;以太波动检测结果显示该区域存在大量未知的历史残留。建议携带基础防护服。&rdquo;
          </p>
        </div>

        {/* Action button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNavigate}
          className="w-full py-2.5 border border-aether-cyan/50 text-[10px] text-aether-cyan font-display tracking-[0.3em] uppercase hover:bg-aether-cyan/10 hover:shadow-[0_0_20px_rgba(0,242,255,0.1)] transition-all"
        >
          开始导航
        </motion.button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1 text-white/30 hover:text-aether-cyan transition-colors clickable text-xs"
        aria-label="关闭信息卡"
      >
        ✕
      </button>
    </motion.div>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="p-2 bg-black/30 border border-white/5">
      <p className="text-[7px] font-mono text-white/30 tracking-wider uppercase">{label}</p>
      <p className={`text-[11px] font-display mt-0.5 tracking-wide ${className ?? 'text-white/60'}`}>
        {value}
      </p>
    </div>
  );
}

/* -------- Corner Bracket -------- */
function CornerBracket({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  const style: React.CSSProperties = {
    position: 'absolute',
    ...(isTop ? { top: 8 } : { bottom: 8 }),
    ...(isLeft ? { left: 8 } : { right: 8 }),
    width: 20,
    height: 20,
    pointerEvents: 'none' as const,
  };

  return (
    <div style={style}>
      {/* Horizontal line */}
      <div
        className="absolute bg-aether-cyan/25"
        style={{
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          height: 1,
          width: '100%',
        }}
      />
      {/* Vertical line */}
      <div
        className="absolute bg-aether-cyan/25"
        style={{
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: 1,
          height: '100%',
        }}
      />
    </div>
  );
}

/* -------- Atmospheric Background -------- */
function MapBackground() {
  return (
    <>
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #00f2ff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="absolute bottom-0 rounded-full bg-aether-cyan"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animation: `float-up ${p.duration}s ease-in-out ${p.delay}s infinite`,
              boxShadow: `0 0 ${p.size * 2}px rgba(0,242,255,${p.opacity * 0.6})`,
            }}
          />
        ))}
      </div>

      {/* Tech-line decorations at edges */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/25 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/25 to-transparent pointer-events-none" />
      <div className="absolute top-0 bottom-0 left-[60px] w-[1px] bg-gradient-to-b from-transparent via-aether-cyan/8 to-transparent pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-[60px] w-[1px] bg-gradient-to-b from-transparent via-aether-cyan/8 to-transparent pointer-events-none" />

      {/* Fog / gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-aether-cyan/[0.025] via-transparent to-aether-cyan/[0.015] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-aether-cyan/[0.008] to-transparent pointer-events-none" />
    </>
  );
}
