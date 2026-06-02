import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ZoomIn, ZoomOut, ArrowLeft, MapPin, Info, Skull, Crosshair, Search, X,
  AlertTriangle,
} from 'lucide-react';
import { MapLocationRender, MapAnomaly } from '../../types';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';
import { adaptMapTree, findNode } from '../../sillytavern/mapDataAdapter';
import { getDatabase } from '../../sillytavern/database';
import { useSS } from '../../hooks/SillytavernContext';
import { calcTravelInfo } from '../../sillytavern/map-distance';

/* ===== Rating / anomaly color config ===== */
interface RatingColorSet { text: string; border: string; glow: string; bg: string; bar: string }
const RATING_COLORS: Record<string, RatingColorSet> = {
  '灭世': { text: 'text-red-500',   border: 'border-red-500/60',   glow: 'shadow-[0_0_24px_rgba(239,68,68,0.6)]',    bg: 'bg-red-500/12',   bar: 'bg-red-500' },
  '绝域': { text: 'text-fuchsia-400',border: 'border-fuchsia-400/50',glow: 'shadow-[0_0_18px_rgba(217,70,219,0.45)]',bg: 'bg-fuchsia-400/10',bar: 'bg-fuchsia-400' },
  '倾国': { text: 'text-violet-400',border: 'border-violet-400/50',glow: 'shadow-[0_0_14px_rgba(167,139,250,0.4)]',bg: 'bg-violet-400/10', bar: 'bg-violet-400' },
  '祸城': { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_14px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10',bar: 'bg-orange-400' },
  '凶煞': { text: 'text-amber-400', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10', bar: 'bg-amber-400' },
  '微末': { text: 'text-slate-400', border: 'border-slate-400/30', glow: 'shadow-[0_0_6px_rgba(148,163,184,0.15)]',bg: 'bg-slate-400/5',  bar: 'bg-slate-400' },
};
function getRating(label: string): RatingColorSet { return RATING_COLORS[label] ?? RATING_COLORS['微末']; }

/* ===== Zoom limits ===== */
const ZOOM_MIN = 0.3; const ZOOM_MAX = 5; const ZOOM_STEP = 0.15;
const CANVAS_W = 800; const CANVAS_H = 600;

/* ===== Particles ===== */
interface Particle { id: number; left: number; delay: number; duration: number; size: number; opacity: number }
const PARTICLES: Particle[] = Array.from({ length: 24 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 10,
  duration: 8 + Math.random() * 10, size: 1.5 + Math.random() * 2.5, opacity: 0.1 + Math.random() * 0.3,
}));

/* ===== Viewport ===== */
interface Viewport { x: number; y: number; w: number; h: number }
function fitViewport(points: MapLocationRender[], paddingRatio = 0.6): Viewport {
  if (points.length === 0) return { x: -500, y: -500, w: 1000, h: 1000 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) { if (p.cx < minX) minX = p.cx; if (p.cx > maxX) maxX = p.cx; if (p.cy < minY) minY = p.cy; if (p.cy > maxY) maxY = p.cy; }
  let dx = maxX - minX || 10;
  let dy = maxY - minY;
  // When points share nearly same X (North), derive from Y (East) to keep viewport zoomed in
  if (dx < dy * 0.05) dx = dy / (CANVAS_W / CANVAS_H);
  const padX = dx * paddingRatio, padY = dy * paddingRatio;
  const northRange = dx + padX * 2;  // X → screen height
  const eastRange = dy + padY * 2;   // Y → screen width
  const aspect = CANVAS_W / CANVAS_H;
  let w: number, h: number;
  // eastRange / northRange should match aspect (screen width / screen height)
  if (eastRange / northRange > aspect) {
    // East too wide → expand North
    w = eastRange / aspect;
    h = eastRange;
  } else {
    // North too tall → expand East
    w = northRange;
    h = northRange * aspect;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function worldToScreen(wx: number, wy: number, vp: Viewport) {
  // +X=北→上, +Y=东→右
  return {
    sx: ((wy - vp.y) / vp.h) * CANVAS_W,
    sy: CANVAS_H - ((wx - vp.x) / vp.w) * CANVAS_H,
  };
}

/* ===== Colors ===== */
interface PointColorSet { primary: string; glow: string; bg: string }
const DEPTH_COLORS: PointColorSet[] = [
  { primary: '#00f2ff', glow: 'rgba(0,242,255,0.5)',    bg: 'rgba(0,242,255,0.12)'   }, // 0 世界
  { primary: '#3b82f6', glow: 'rgba(59,130,246,0.5)',    bg: 'rgba(59,130,246,0.12)'   }, // 1 大区
  { primary: '#22c55e', glow: 'rgba(34,197,94,0.5)',     bg: 'rgba(34,197,94,0.12)'    }, // 2 城市
  { primary: '#14b8a6', glow: 'rgba(20,184,166,0.5)',    bg: 'rgba(20,184,166,0.12)'   }, // 3 城区
  { primary: '#a78bfa', glow: 'rgba(167,139,250,0.5)',   bg: 'rgba(167,139,250,0.12)'  }, // 4 街区
  { primary: '#f59e0b', glow: 'rgba(245,158,11,0.5)',    bg: 'rgba(245,158,11,0.12)'   }, // 5 小区
  { primary: '#f472b6', glow: 'rgba(244,114,182,0.5)',   bg: 'rgba(244,114,182,0.12)'  }, // 6 地点
  { primary: '#ef4444', glow: 'rgba(239,68,68,0.5)',     bg: 'rgba(239,68,68,0.12)'    }, // 7 建筑
];
// World-level colors for top-level worlds
const WORLD_COLORS: Record<string, PointColorSet> = {
  '蓝星':   { primary: '#00f2ff', glow: 'rgba(0,242,255,0.6)',  bg: 'rgba(0,242,255,0.14)' },
  '太虚界': { primary: '#f0a43c', glow: 'rgba(240,164,60,0.55)', bg: 'rgba(240,164,60,0.14)' },
};
function pointStyle(depth: number, key?: string): PointColorSet {
  if (depth === 0 && key && WORLD_COLORS[key]) return WORLD_COLORS[key];
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

/* ===== Danger ===== */
function getDangerLevel(point: MapLocationRender): number {
  const r = Object.keys(point.reality.地点细节.异常);
  if (r.length > 0) return 1;
  const d = Object.values(point.dream.地点细节.异常);
  if (d.some((a) => a.具现进度 >= 100)) return 2;
  return 0;
}
const DANGER_STYLES: Record<number, { ring: string; glow: string; text: string }> = {
  0: { ring: 'transparent', glow: 'transparent', text: '' },
  1: { ring: 'rgba(239,68,68,0.45)', glow: 'rgba(239,68,68,0.3)', text: '现实异常' },
  2: { ring: 'rgba(239,68,68,0.8)', glow: 'rgba(239,68,68,0.55)', text: '高危异常' },
};

/* ===== Global search flatten ===== */
interface FlatEntry { path: string[]; pathNames: string[]; node: MapLocationRender }
function flattenTree(nodes: MapLocationRender[], parentPath: string[], parentNames: string[]): FlatEntry[] {
  let result: FlatEntry[] = [];
  for (const node of nodes) {
    const p = [...parentPath, node.key], n = [...parentNames, node.name];
    result.push({ path: p, pathNames: n, node });
    if (node.children.length > 0) result = result.concat(flattenTree(node.children, p, n));
  }
  return result;
}

/* ===== Floor grouping ===== */
function groupByFloor(children: MapLocationRender[]): { label: string; key: string; nodes: MapLocationRender[] }[] | null {
  if (children.length <= 1) return null;
  const sorted = [...children].sort((a, b) => {
    const az = (a.bounds.Z[0] + a.bounds.Z[1]) / 2;
    const bz = (b.bounds.Z[0] + b.bounds.Z[1]) / 2;
    return az - bz;
  });
  const groups: { label: string; key: string; nodes: MapLocationRender[] }[] = [];
  for (const child of sorted) {
    const zMin = child.bounds.Z[0], zMax = child.bounds.Z[1];
    let found = false;
    for (const group of groups) {
      for (const existing of group.nodes) {
        if (zMin <= existing.bounds.Z[1] && zMax >= existing.bounds.Z[0]) {
          group.nodes.push(child); found = true; break;
        }
      }
      if (found) break;
    }
    if (!found) {
      const zMid = ((zMin + zMax) / 2).toFixed(2);
      const label = `Z:${zMid}`;
      groups.push({ label, key: `z-${zMin}`, nodes: [child] });
    }
  }
  // Apply minimum spacing on same floor
  for (const g of groups) {
    for (let i = 0; i < g.nodes.length; i++) {
      for (let j = i + 1; j < g.nodes.length; j++) {
        const a = g.nodes[i], b = g.nodes[j];
        const dx = a.cx - b.cx, dy = a.cy - b.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001 && dist >= 0) {
          // Push b slightly to the right (adjacent rooms)
          (b as any).cx += 0.002;
        }
      }
    }
  }
  return groups.length > 1 ? groups : null;
}

/* ============================================================
   MAP PAGE
   ============================================================ */
export default function MapPage() {
  const ss = useSS();
  const [mapData, setMapData] = useState<Record<string, any>>(DEFAULT_WORLD_VARS.地图 as Record<string, any>);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [isDream, setIsDream] = useState<boolean>(false);

  // Poll live variables from DB
  const mapDataRef = useRef(JSON.stringify(DEFAULT_WORLD_VARS.地图));
  useEffect(() => {
    const db = getDatabase();
    const refresh = async () => {
      try {
        const chats = await db.chats.toArray();
        const vars = chats[chats.length - 1]?.variables ?? {};
        const raw = vars.地图 ? JSON.stringify(vars.地图) : '';
        if (raw && raw !== mapDataRef.current) {
          mapDataRef.current = raw;
          setMapData(JSON.parse(raw));
        }
        // Read current location
        const inDream = vars?.['世界']?.['梦境定位']?.['位于梦境'] === true;
        setIsDream(inDream);
        const loc = inDream
          ? (vars?.['世界']?.['梦境存档']?.['地点'] ?? '')
          : (vars?.['世界']?.['现实']?.['地点'] ?? '');
        setCurrentLocation(typeof loc === 'string' ? loc : '');
      } catch { /* DB not ready */ }
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  // Build the full tree (all worlds at top level)
  const mapTree = useMemo(() => {
    if (!mapData || Object.keys(mapData).length === 0) return [];
    return adaptMapTree(mapData);
  }, [mapData]);

  // Flatten for search
  const flatNodes = useMemo(() => flattenTree(mapTree, [], []), [mapTree]);

  const [navPath, setNavPath] = useState<string[]>([]);

  const currentNode = useMemo(() => {
    if (navPath.length === 0) return null;
    return findNode(mapTree, navPath);
  }, [mapTree, navPath]);

  const currentChildren = useMemo(() => {
    if (navPath.length === 0) return mapTree;
    return currentNode?.children ?? [];
  }, [mapTree, navPath, currentNode]);

  const navDepth = navPath.length;

  // --- Floor grouping ---
  const [selectedFloor, setSelectedFloor] = useState<number>(0);
  useEffect(() => { setSelectedFloor(0); }, [navPath]);

  // Check if current level has geographic coordinates (if not, use world layout)
  const childrenHaveBounds = currentChildren.some(c => c.hasBounds);

  const floorGroups = useMemo(() => {
    if (!childrenHaveBounds) return null;
    return groupByFloor(currentChildren);
  }, [currentChildren, childrenHaveBounds]);

  const visibleChildren = useMemo(() => {
    if (!floorGroups) return currentChildren;
    const idx = Math.min(selectedFloor, floorGroups.length - 1);
    return floorGroups[idx]?.nodes ?? currentChildren;
  }, [floorGroups, selectedFloor, currentChildren]);

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return flatNodes.filter(
      (e) => e.node.name.toLowerCase().includes(q) || e.node.searchTerms.some((t) => t.toLowerCase().includes(q)),
    ).slice(0, 12);
  }, [flatNodes, searchQuery]);

  // --- Viewport ---
  const [viewport, setViewport] = useState<Viewport>(() => fitViewport(mapTree, 1.2));
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const vp = fitViewport(visibleChildren, childrenHaveBounds ? 0.6 : 1.2);
    setViewport(vp); setZoom(1);
  }, [navDepth, visibleChildren]);

  // --- Selection & card ---
  const [selectedPoint, setSelectedPoint] = useState<MapLocationRender | null>(null);
  const [cardOrigin, setCardOrigin] = useState<{ x: number; y: number } | null>(null);
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    if (selectedPoint) { const t = setTimeout(() => setCardVisible(true), 30); return () => clearTimeout(t); }
    else setCardVisible(false);
  }, [selectedPoint]);

  // --- Pan ---
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragViewStart = useRef<Viewport>(viewport);
  const dragMoved = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    setIsDragging(true); dragMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragViewStart.current = { ...viewport };
  }, [viewport]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x, dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true;
    // +X=北→上, +Y=东→右
    const scaleEast = dragViewStart.current.h / CANVAS_W;   // East (Y) per screen pixel X
    const scaleNorth = dragViewStart.current.w / CANVAS_H;  // North (X) per screen pixel Y
    setViewport({
      x: dragViewStart.current.x - dy * scaleNorth,  // down→south(lower X)
      y: dragViewStart.current.y + dx * scaleEast,   // right→east(higher Y)
      w: dragViewStart.current.w, h: dragViewStart.current.h,
    });
  }, [isDragging, viewport]);

  const handlePanEnd = useCallback(() => setIsDragging(false), []);

  // ── Touch gestures ──
  const touchStartRef = useRef<{ x: number; y: number; dist: number; zoom: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    if (e.touches.length === 1) {
      setIsDragging(true); dragMoved.current = false;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragViewStart.current = { ...viewport };
      touchStartRef.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartRef.current = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2, dist: Math.sqrt(dx * dx + dy * dy), zoom };
    }
  }, [viewport, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true;
      const scaleEast = dragViewStart.current.h / CANVAS_W;
      const scaleNorth = dragViewStart.current.w / CANVAS_H;
      setViewport({
        x: dragViewStart.current.x - dy * scaleNorth,
        y: dragViewStart.current.y + dx * scaleEast,
        w: dragViewStart.current.w, h: dragViewStart.current.h,
      });
    } else if (e.touches.length === 2 && touchStartRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = touchStartRef.current.dist / dist;
      let next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(touchStartRef.current.zoom * ratio).toFixed(2)));
      const factor = zoom / next;
      setZoom(next);
      setViewport((vp) => ({ x: vp.x + vp.w * (1 - factor) / 2, y: vp.y + vp.h * (1 - factor) / 2, w: vp.w * factor, h: vp.h * factor }));
    }
  }, [isDragging, viewport, zoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    touchStartRef.current = null;
  }, []);

  // --- Point click ---
  const handlePointClick = useCallback((point: MapLocationRender, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPoint(point);
    setCardOrigin({ x: e.clientX, y: e.clientY });
    setCardVisible(false);
  }, []);

  // --- Enter ---
  const handleEnter = useCallback(() => {
    if (!selectedPoint || selectedPoint.children.length === 0) return;
    setNavPath((prev) => [...prev, selectedPoint.key]);
    setSelectedPoint(null); setCardOrigin(null); setCardVisible(false);
    setSearchQuery(''); setSearchOpen(false);
  }, [selectedPoint]);

  // --- Go To ---
  const handleGoTo = useCallback(() => {
    if (!selectedPoint || !currentLocation || !mapData) return;
    const info = calcTravelInfo(mapData, currentLocation, selectedPoint.name);
    if (!info) return;
    // Close card and send prompt
    setSelectedPoint(null); setCardOrigin(null); setCardVisible(false);
    ss.sendGameMessage(info.prompt);
  }, [selectedPoint, currentLocation, mapData, ss]);

  // --- Search select: navigate to node's parent & open card ---
  const handleSearchSelect = useCallback((entry: FlatEntry) => {
    const parentPath = entry.path.slice(0, -1);
    setNavPath(parentPath);
    setSelectedPoint(entry.node);
    setCardOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setCardVisible(false);
    setSearchQuery(''); setSearchOpen(false);
  }, []);

  // --- Go back ---
  const goBack = useCallback(() => {
    setNavPath((prev) => (prev.length <= 1 ? [] : prev.slice(0, -1)));
    setSelectedPoint(null); setCardOrigin(null); setCardVisible(false);
  }, []);

  const dismissCard = useCallback(() => {
    if (dragMoved.current) return;
    setSelectedPoint(null); setCardOrigin(null); setCardVisible(false);
  }, []);

  // --- Zoom ---
  const zoomIn = useCallback(() => setZoom((z) => {
    const next = Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)), factor = z / next;
    setViewport((vp) => ({ x: vp.x + vp.w * (1 - factor) / 2, y: vp.y + vp.h * (1 - factor) / 2, w: vp.w * factor, h: vp.h * factor }));
    return next;
  }), []);
  const zoomOut = useCallback(() => setZoom((z) => {
    const next = Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)), factor = z / next;
    setViewport((vp) => ({ x: vp.x + vp.w * (1 - factor) / 2, y: vp.y + vp.h * (1 - factor) / 2, w: vp.w * factor, h: vp.h * factor }));
    return next;
  }), []);

  const isTopLevel = navPath.length === 0;

  // Dynamic breadcrumb
  const breadcrumbSegs = useMemo(() => {
    const segs: { key: string; name: string }[] = [];
    let list = mapTree;
    for (const seg of navPath) {
      const n = list.find((x) => x.key === seg);
      if (!n) break;
      segs.push({ key: n.key, name: n.name });
      list = n.children;
    }
    return segs;
  }, [navPath, mapTree]);

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-aether-deep">

      {/* ===== Back Button ===== */}
      <AnimatePresence>
        {!isTopLevel && (
          <motion.button
            initial={{ opacity: 0, x: -12, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: 0.9 }}
            onClick={goBack}
            className="absolute top-6 left-6 z-20 p-2.5 glass-panel hover:border-aether-cyan/60 text-aether-cyan transition-all hover-glow clickable press-scale"
            aria-label="返回上级地图"
          ><ArrowLeft size={18} /></motion.button>
        )}
      </AnimatePresence>

      {/* ===== Breadcrumb — dynamic world root ===== */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        {isTopLevel ? (
          <div className="glass-panel px-4 py-1.5">
            <span className="text-[10px] font-mono text-aether-cyan/50 tracking-wider">选择世界</span>
          </div>
        ) : (
          <div className="glass-panel px-4 py-1.5 flex items-center gap-1.5">
            {breadcrumbSegs.map((seg, i) => (
              <React.Fragment key={seg.key}>
                {i > 0 && <span className="text-[8px] text-aether-cyan/30">/</span>}
                <span className={`text-[10px] font-mono tracking-wider ${i === breadcrumbSegs.length - 1 ? 'text-aether-cyan/90 font-bold' : 'text-aether-cyan/70'}`}>
                  {seg.name}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ===== Connected search ===== */}
      <div className="absolute top-6 right-6 z-20">
        <div className="relative">
          {/* Search box */}
          <div
            className={`flex items-center gap-2 px-3.5 py-2 border transition-all duration-300 ${
              searchOpen && searchResults.length > 0 ? 'rounded-t-lg border-b-0' : 'rounded-lg'
            }`}
            style={{
              background: 'rgba(6,8,14,0.97)',
              borderColor: searchOpen && searchQuery ? 'rgba(0,242,255,0.35)' : 'rgba(255,255,255,0.10)',
              boxShadow: searchOpen && searchQuery ? '0 0 16px rgba(0,242,255,0.06)' : 'none',
            }}
          >
            <Search size={14} className="text-aether-cyan/50 shrink-0" />
            <input
              type="text" value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="搜索全部地图..."
              className="bg-transparent text-[12px] font-mono text-white/80 placeholder:text-white/20 outline-none w-44 focus:w-56 transition-all duration-300"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="text-white/20 hover:text-white/60 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Results — directly connected to search box */}
          <AnimatePresence>
            {searchOpen && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-full left-0 right-0 max-h-72 overflow-y-auto custom-scrollbar rounded-b-lg border border-t-0"
                style={{
                  background: 'rgba(6,8,14,0.97)',
                  borderColor: 'rgba(0,242,255,0.35)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 12px rgba(0,242,255,0.04)',
                }}
              >
                {searchResults.map((entry) => (
                  <button
                    key={entry.path.join('/')}
                    onClick={() => handleSearchSelect(entry)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.03] last:border-b-0 flex items-center gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: pointStyle(0, entry.path[0]).primary, boxShadow: `0 0 5px ${pointStyle(0, entry.path[0]).glow}` }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-display text-white/70 truncate">{entry.node.name}</p>
                      <p className="text-[8px] font-mono text-white/25 truncate mt-0.5">
                        {entry.pathNames.join(' / ')}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* No-results state */}
          <AnimatePresence>
            {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute top-full left-0 right-0 rounded-b-lg border border-t-0"
                style={{ background: 'rgba(6,8,14,0.97)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <p className="text-[10px] text-white/20 font-mono text-center py-4">
                  未找到匹配 "{searchQuery}" 的地点
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click-outside for search */}
      {searchOpen && <div className="absolute inset-0 z-[15]" onClick={() => setSearchOpen(false)} />}

      {/* ===== Floor Selector ===== */}
      {floorGroups && floorGroups.length > 1 && (
        <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 glass-panel px-2 py-1">
          {floorGroups.map((g, i) => {
            const active = Math.min(selectedFloor, floorGroups.length - 1) === i;
            return (
              <button
                key={g.key}
                onClick={() => setSelectedFloor(i)}
                className={`px-3 py-1 text-[10px] font-mono tracking-wider transition-all ${
                  active
                    ? 'bg-aether-cyan/15 border border-aether-cyan/40 text-aether-cyan'
                    : 'border border-transparent text-white/30 hover:text-white/50 hover:border-white/10'
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ===== Map Canvas ===== */}
      <div
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handlePanStart} onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onClick={dismissCard}
      >
        <div className="absolute inset-0 border border-aether-border/10 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
          <CornerBracket position="top-left" /><CornerBracket position="top-right" />
          <CornerBracket position="bottom-left" /><CornerBracket position="bottom-right" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={navPath.join('/')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="absolute inset-0">
            {visibleChildren.map((point, idx) => {
              // World-level (no bounds): arrange evenly in a row
              let sx: number, sy: number;
              if (!childrenHaveBounds) {
                const count = visibleChildren.length;
                const spacing = CANVAS_W / (count + 1);
                sx = spacing * (idx + 1);
                sy = CANVAS_H / 2;
              } else {
                const pos = worldToScreen(point.cx, point.cy, viewport);
                sx = pos.sx; sy = pos.sy;
              }
              if (sx < -60 || sx > CANVAS_W + 60 || sy < -60 || sy > CANVAS_H + 60) return null;
              return (
                <PointMarker key={point.key} point={point} depth={navDepth}
                  isSelected={selectedPoint?.key === point.key}
                  isWorldLevel={!childrenHaveBounds}
                  style={{ left: `${(sx / CANVAS_W) * 100}%`, top: `${(sy / CANVAS_H) * 100}%` }}
                  onClick={(e) => handlePointClick(point, e)} />
              );
            })}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {selectedPoint && cardOrigin && cardVisible && (
            <LocationInfoCard key={selectedPoint.key} point={selectedPoint} origin={cardOrigin}
              hasChildren={selectedPoint.children.length > 0} onClose={dismissCard} onEnter={handleEnter}
              onGoTo={handleGoTo} canGoTo={!!currentLocation} />
          )}
        </AnimatePresence>
      </div>

      {/* ===== Zoom controls ===== */}
      <div className="absolute bottom-4 md:bottom-6 right-4 md:right-6 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="glass-panel overflow-hidden pointer-events-auto flex flex-col items-center w-10 md:w-9">
          <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} className="p-2 md:p-1.5 border-b border-aether-border/20 hover:text-aether-cyan text-aether-blue disabled:opacity-25 disabled:cursor-not-allowed transition-all clickable hover:bg-aether-cyan/5 flex justify-center" aria-label="放大"><ZoomIn size={16} /></button>
          <div className="py-1 border-b border-aether-border/20 text-center w-full"><span className="text-[9px] font-mono text-aether-cyan/80 font-bold leading-none">{Math.round(zoom * 100)}%</span></div>
          <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} className="p-2 md:p-1.5 hover:text-aether-cyan text-aether-blue disabled:opacity-25 disabled:cursor-not-allowed transition-all clickable hover:bg-aether-cyan/5 flex justify-center" aria-label="缩小"><ZoomOut size={16} /></button>
        </div>
      </div>

      <MapAtmosphere />
      <style>{`
        @keyframes float-up { 0%{transform:translateY(100vh) translateX(0px);opacity:0} 8%{opacity:.35} 85%{opacity:.35} 100%{transform:translateY(-15vh) translateX(8px);opacity:0} }
        @keyframes danger-pulse { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.85;transform:scale(1.25)} }
        @keyframes world-pulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
      `}</style>
    </div>
  );
}

/* ============================================================
   POINT MARKER
   ============================================================ */
function PointMarker({ point, depth, isSelected, style, onClick, isWorldLevel }: {
  point: MapLocationRender; depth: number; isSelected: boolean;
  style: React.CSSProperties; onClick: (e: React.MouseEvent) => void;
  isWorldLevel: boolean;
}) {
  const isWorld = isWorldLevel || !point.hasBounds;
  const colors = pointStyle(depth, isWorld ? point.key : undefined);
  const hasChildren = point.children.length > 0;
  const size = isWorld ? 22 : depth === 1 ? 16 : depth === 2 ? 14 : depth === 3 ? 13 : depth >= 6 ? 10 : 11;
  const danger = getDangerLevel(point);
  const dangerStyle = DANGER_STYLES[danger];

  return (
    <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 0.3 }} style={style} className="absolute group -translate-x-1/2 -translate-y-1/2 z-10">
      <button onClick={onClick} className="relative flex flex-col items-center justify-center clickable" aria-label={point.name}>
        {/* World-level glow ring */}
        {isWorld && (
          <div className="absolute rounded-full" style={{
            width: size * 5, height: size * 5,
            border: `1.5px solid ${colors.primary}30`,
            backgroundColor: colors.primary + '06',
            animation: 'world-pulse 3s ease-in-out infinite',
            boxShadow: `0 0 ${size * 3}px ${colors.glow}`,
          }} />
        )}
        {/* Children pulse ring */}
        {hasChildren && !isWorld && (
          <div className="absolute rounded-full animate-pulse" style={{ width: size * 3.5, height: size * 3.5, border: `1px solid ${colors.primary}20`, backgroundColor: colors.primary + '05' }} />
        )}
        {/* Danger ring */}
        {danger > 0 && (
          <div className="absolute rounded-full" style={{
            width: size * (danger === 2 ? 4 : 3), height: size * (danger === 2 ? 4 : 3),
            border: `1.5px solid ${dangerStyle.ring}`, boxShadow: `0 0 ${size * 2}px ${dangerStyle.glow}`,
            animation: 'danger-pulse 2s ease-in-out infinite',
          }} />
        )}
        {danger === 2 && (
          <div className="absolute -top-1 -right-1 z-10">
            <AlertTriangle size={size * 0.8} className="text-red-400" style={{ filter: 'drop-shadow(0 0 3px rgba(239,68,68,0.6))' }} />
          </div>
        )}
        <div className={`rounded-full border-2 transition-all duration-300 group-hover:scale-150 ${isSelected ? 'scale-125' : ''}`}
          style={{ width: size, height: size, borderColor: isSelected ? colors.primary : colors.primary + '99', backgroundColor: isSelected ? colors.primary + '40' : colors.primary + '20', boxShadow: `0 0 ${size * 1.2}px ${colors.glow}` }} />
        <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <span className={`whitespace-nowrap transition-all duration-300 group-hover:text-white ${isWorld ? 'text-[11px] font-bold text-white/35 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-[10px] font-display tracking-widest text-white/25 group-hover:drop-shadow-[0_0_6px_rgba(0,242,255,0.4)]'} ${danger > 0 ? 'text-red-300/40' : ''}`}>
            {point.name}
          </span>
          {danger > 0 && <span className="text-[7px] font-mono text-red-400/40 ml-1">{dangerStyle.text}</span>}
        </div>
      </button>
    </motion.div>
  );
}

/* ============================================================
   LOCATION INFO CARD
   ============================================================ */
function LocationInfoCard({ point, origin, hasChildren, onClose, onEnter, onGoTo, canGoTo }: {
  point: MapLocationRender; origin: { x: number; y: number };
  hasChildren: boolean; onClose: () => void; onEnter: () => void;
  onGoTo?: () => void; canGoTo?: boolean;
}) {
  const [layer, setLayer] = useState<'现实' | '梦境'>('现实');
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const detail = layer === '现实' ? point.reality : point.dream;
  const anomalies = Object.entries(detail.地点细节.异常);
  const hasAnomalies = anomalies.length > 0;
  const infoList = detail.地点细节.信息;
  const danger = getDangerLevel(point);

  const cardW = mobile ? window.innerWidth : 440;
  const cardH = mobile ? window.innerHeight * 0.7 : 600;
  const margin = mobile ? 0 : 20;
  const targetX = mobile ? 0 : Math.max(margin, Math.min(origin.x - cardW / 2, window.innerWidth - cardW - margin));
  const targetY = mobile ? window.innerHeight * 0.3 : Math.max(margin, Math.min(origin.y - cardH / 2, window.innerHeight - cardH - margin));
  const isDream = layer === '梦境';
  const accent = isDream ? '#a78bfa' : '#00f2ff';
  const accentGlow = isDream ? 'rgba(167,139,250,0.4)' : 'rgba(0,242,255,0.4)';

  // Mobile: bottom sheet
  if (mobile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-30 inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-xl"
        style={{
          maxHeight: '70vh',
          background: 'linear-gradient(180deg, rgba(12,16,24,0.98) 0%, rgba(8,10,16,0.98) 100%)',
          border: `1px solid ${danger >= 2 ? 'rgba(239,68,68,0.35)' : accent + '25'}`,
          borderBottom: 'none',
          boxShadow: danger >= 2 ? '0 -4px 40px rgba(239,68,68,0.12), 0 -8px 32px rgba(0,0,0,0.5)' : `0 -4px 40px ${accentGlow}10, 0 -8px 32px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        {/* Content (same as desktop below) */}
        {danger >= 2 && (
          <div className="shrink-0 px-4 py-1.5 flex items-center gap-2 bg-red-500/10 border-b border-red-500/20">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-[10px] font-mono text-red-400/80 tracking-wider">高危区域 — 梦境异常已完全具现</span>
          </div>
        )}
        {danger === 1 && (
          <div className="shrink-0 px-4 py-1.5 flex items-center gap-2 bg-red-500/6 border-b border-red-500/12">
            <AlertTriangle size={12} className="text-red-400/60" />
            <span className="text-[10px] font-mono text-red-400/60 tracking-wider">注意 — 现实世界存在异常活动</span>
          </div>
        )}
        <div className="shrink-0 px-4 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: `${accent}15`, backgroundColor: `${accent}06` }}>
          <MapPin size={14} style={{ color: accent }} />
          <h3 className="font-display font-bold text-base text-white/90 tracking-wide flex-1 min-w-0 truncate">{point.name}</h3>
          {!point.noDream && (
            <button onClick={() => setLayer((l) => (l === '现实' ? '梦境' : '现实'))}
              className="shrink-0 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-all duration-300 tracking-widest"
              style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}10` }}
            >{isDream ? '梦境' : '现实'}</button>
          )}
          <button onClick={onClose} className="shrink-0 p-1 rounded-full text-white/20 hover:text-white/70 hover:bg-white/10 transition-all" aria-label="关闭"><X size={15} /></button>
        </div>
        <CardBody detail={detail} accent={accent} point={point} anomalies={anomalies} hasAnomalies={hasAnomalies} infoList={infoList} />
        <div className="shrink-0 px-4 py-3 flex gap-3 border-t" style={{ borderColor: `${accent}15` }}>
          {hasChildren ? (
            <button onClick={onEnter} className="flex-1 py-3 rounded-lg font-display font-bold tracking-[0.2em] transition-all duration-300 clickable"
              style={{ color: accent, border: `1px solid ${accent}30`, backgroundColor: `${accent}08`, fontSize: '13px' }}
            >进 入</button>
          ) : (
            <button disabled className="flex-1 py-3 rounded-lg font-display font-bold tracking-[0.2em] opacity-25 cursor-not-allowed"
              style={{ color: accent, border: `1px solid ${accent}15`, backgroundColor: `${accent}04`, fontSize: '13px' }}>已是最深层级</button>
          )}
          <button onClick={onGoTo} disabled={!canGoTo || !onGoTo}
            className={`flex-1 py-3 rounded-lg font-display font-bold tracking-[0.2em] transition-all duration-300 clickable ${(!canGoTo || !onGoTo) ? 'opacity-25 cursor-not-allowed' : ''}`}
            style={{ color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', backgroundColor: 'rgba(245,158,11,0.06)', fontSize: '13px' }}
          >前 往</button>
        </div>
      </motion.div>
    );
  }

  // Desktop: floating card (original)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, x: origin.x - cardW / 2, y: origin.y - cardH / 2 }}
      animate={{ opacity: 1, scale: 1, x: targetX, y: targetY }}
      exit={{ opacity: 0, scale: 0.85, x: origin.x - cardW / 2, y: origin.y - cardH / 2 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280, mass: 0.8 }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-30 flex flex-col overflow-hidden rounded-lg"
      style={{
        width: cardW, maxHeight: cardH,
        background: 'linear-gradient(180deg, rgba(12,16,24,0.98) 0%, rgba(8,10,16,0.98) 100%)',
        border: `1px solid ${danger >= 2 ? 'rgba(239,68,68,0.35)' : accent + '25'}`,
        boxShadow: danger >= 2 ? '0 0 40px rgba(239,68,68,0.12), 0 8px 32px rgba(0,0,0,0.5)' : `0 0 40px ${accentGlow}10, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 ${accent}10`,
      }}
    >
      {danger >= 2 && (
        <div className="shrink-0 px-4 py-1.5 flex items-center gap-2 bg-red-500/10 border-b border-red-500/20">
          <AlertTriangle size={12} className="text-red-400" />
          <span className="text-[10px] font-mono text-red-400/80 tracking-wider">高危区域 — 梦境异常已完全具现</span>
        </div>
      )}
      {danger === 1 && (
        <div className="shrink-0 px-4 py-1.5 flex items-center gap-2 bg-red-500/6 border-b border-red-500/12">
          <AlertTriangle size={12} className="text-red-400/60" />
          <span className="text-[10px] font-mono text-red-400/60 tracking-wider">注意 — 现实世界存在异常活动</span>
        </div>
      )}
      <div className="shrink-0 px-5 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: `${accent}15`, backgroundColor: `${accent}06` }}>
        <MapPin size={15} style={{ color: accent }} />
        <h3 className="font-display font-bold text-lg text-white/90 tracking-wide flex-1 min-w-0 truncate">{point.name}</h3>
        {!point.noDream && (
          <button onClick={() => setLayer((l) => (l === '现实' ? '梦境' : '现实'))}
            className="shrink-0 text-[10px] font-mono font-bold px-3 py-1 rounded-full border transition-all duration-300 tracking-widest"
            style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}10` }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${accent}20`; e.currentTarget.style.borderColor = `${accent}60`; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${accent}10`; e.currentTarget.style.borderColor = `${accent}40`; }}
          >{isDream ? '梦境' : '现实'}</button>
        )}
        <button onClick={onClose} className="shrink-0 p-1 rounded-full text-white/20 hover:text-white/70 hover:bg-white/10 transition-all" aria-label="关闭"><X size={15} /></button>
      </div>
      <CardBody detail={detail} accent={accent} point={point} anomalies={anomalies} hasAnomalies={hasAnomalies} infoList={infoList} />
      <div className="shrink-0 px-5 py-3.5 flex gap-3 border-t" style={{ borderColor: `${accent}15` }}>
        {hasChildren ? (
          <button onClick={onEnter} className="flex-1 py-2.5 rounded-lg font-display font-bold tracking-[0.2em] transition-all duration-300"
            style={{ color: accent, border: `1px solid ${accent}30`, backgroundColor: `${accent}08`, fontSize: '13px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${accent}18`; e.currentTarget.style.borderColor = `${accent}60`; e.currentTarget.style.boxShadow = `0 0 24px ${accentGlow}25`; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${accent}08`; e.currentTarget.style.borderColor = `${accent}30`; e.currentTarget.style.boxShadow = 'none'; }}
          >进 入</button>
        ) : (
          <button disabled className="flex-1 py-2.5 rounded-lg font-display font-bold tracking-[0.2em] opacity-25 cursor-not-allowed"
            style={{ color: accent, border: `1px solid ${accent}15`, backgroundColor: `${accent}04`, fontSize: '13px' }}>已是最深层级</button>
        )}
        <button onClick={onGoTo} disabled={!canGoTo || !onGoTo}
          className={`flex-1 py-2.5 rounded-lg font-display font-bold tracking-[0.2em] transition-all duration-300 ${
            (!canGoTo || !onGoTo) ? 'opacity-25 cursor-not-allowed' : ''
          }`}
          style={{
            color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)',
            backgroundColor: 'rgba(245,158,11,0.06)', fontSize: '13px',
          }}
          onMouseEnter={(e) => {
            if (!canGoTo || !onGoTo) return;
            e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.14)';
            e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(245,158,11,0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.06)';
            e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          aria-label="前往">前 往</button>
      </div>
    </motion.div>
  );
}

/* ============================================================
   SHARED CARD BODY
   ============================================================ */
function CardBody({ detail, accent, point, anomalies, hasAnomalies, infoList }: {
  detail: any; accent: string; point: MapLocationRender;
  anomalies: [string, MapAnomaly][]; hasAnomalies: boolean; infoList: string[];
}) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-5 py-3 md:py-4 space-y-3 md:space-y-4">
      <div className="p-3 md:p-3.5 rounded-lg border" style={{ borderColor: `${accent}12`, backgroundColor: `${accent}04` }}>
        <p className="text-[11px] md:text-[12px] text-white/60 leading-relaxed font-mono tracking-wide">{detail.描述}</p>
      </div>
      {point.bounds && (
        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
          <MiniStat label="X 范围" value={`${point.bounds.X[0]} ~ ${point.bounds.X[1]}`} unit="km" accent={accent} />
          <MiniStat label="Y 范围" value={`${point.bounds.Y[0]} ~ ${point.bounds.Y[1]}`} unit="km" accent={accent} />
          <MiniStat label="Z 范围" value={`${point.bounds.Z[0]} ~ ${point.bounds.Z[1]}`} unit="km" accent={accent} />
        </div>
      )}
      {infoList.length > 0 && (
        <div className="p-3 md:p-3.5 rounded-lg border" style={{ borderColor: `${accent}15`, backgroundColor: `${accent}03` }}>
          <div className="flex items-center gap-1.5 mb-2 md:mb-2.5"><Info size={11} style={{ color: `${accent}80` }} /><span className="text-[9px] md:text-[10px] font-mono tracking-wider uppercase" style={{ color: `${accent}80` }}>信息</span></div>
          {infoList.map((info, i) => <p key={i} className="text-[10px] md:text-[11px] text-white/50 leading-relaxed font-mono pl-2 md:pl-3 mb-1 md:mb-1.5 last:mb-0" style={{ borderLeft: `2px solid ${accent}20` }}>{info}</p>)}
        </div>
      )}
      {hasAnomalies && (
        <div className="space-y-2 md:space-y-2.5">
          <div className="flex items-center gap-1.5"><Skull size={11} className="text-red-400/50" /><span className="text-[9px] md:text-[10px] font-mono text-red-400/50 tracking-wider uppercase">异常</span></div>
          {anomalies.map(([name, anomaly]) => <AnomalyCard key={name} name={name} anomaly={anomaly} />)}
        </div>
      )}
      {infoList.length === 0 && !hasAnomalies && <p className="text-[10px] md:text-[11px] text-white/20 italic font-mono text-center py-4">该区域暂无详细信息记录</p>}
    </div>
  );
}

/* ============================================================
   ANOMALY CARD
   ============================================================ */
function AnomalyCard({ name, anomaly }: { name: string; anomaly: MapAnomaly }) {
  const [expanded, setExpanded] = useState(false);
  const rating = getRating(anomaly.评级);
  const traits = Object.entries(anomaly.特性);
  const progress = Math.min(100, Math.max(0, anomaly.具现进度));
  const isFull = progress >= 100;
  return (
    <div className={`p-3.5 rounded-lg border transition-all ${rating.border} ${rating.bg} ${isFull ? 'border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]' : ''}`}>
      <div className="flex items-center gap-2"><Crosshair size={12} className={rating.text} /><span className="text-[12px] font-display font-bold text-white/80">{name}</span><span className={`ml-auto text-[10px] font-mono font-bold px-2 py-0.5 rounded ${rating.bg} ${rating.text} border ${rating.border}`}>{anomaly.评级}</span></div>
      <p className="text-[11px] text-white/55 leading-relaxed mt-2 font-mono">{anomaly.描述}</p>
      <div className="mt-2.5 flex items-center gap-2"><span className="text-[9px] font-mono text-white/30 whitespace-nowrap">具现进度</span><div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: isFull ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}><motion.div className={`h-full rounded-full ${isFull ? 'bg-red-500' : rating.bar}`} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} /></div><span className={`text-[10px] font-mono font-bold ${isFull ? 'text-red-400' : rating.text}`}>{progress}%{isFull && <span className="ml-0.5 text-[8px]">⚠</span>}</span></div>
      {traits.length > 0 && (<>
        <button onClick={() => setExpanded(!expanded)} className="mt-2.5 text-[10px] font-mono text-aether-cyan/50 hover:text-aether-cyan/80 transition-colors flex items-center gap-1"><span className="text-[11px]">{expanded ? '▾' : '▸'}</span>特性 ({traits.length})</button>
        <AnimatePresence>{expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="mt-3 space-y-3 pl-3 border-l border-white/5">
              {traits.map(([traitName, trait]) => (
                <div key={traitName}>
                  <p className="text-[11px] font-display text-white/65 font-bold">{traitName}</p>
                  <p className="text-[10px] text-white/40 leading-relaxed mt-1">{trait.描述}</p>
                  {trait.效果.length > 0 && <ul className="mt-1.5 space-y-0.5">{trait.效果.map((eff, i) => <li key={i} className="text-[10px] text-aether-cyan/50 font-mono pl-2 leading-relaxed">· {eff}</li>)}</ul>}
                </div>
              ))}
            </div>
          </motion.div>
        )}</AnimatePresence>
      </>)}
    </div>
  );
}

/* ============================================================
   MINI STAT / CORNER / ATMOSPHERE
   ============================================================ */
function MiniStat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent: string }) {
  return <div className="p-2.5 rounded border" style={{ borderColor: `${accent}12`, backgroundColor: 'rgba(0,0,0,0.25)' }}><p className="text-[8px] font-mono text-white/25 tracking-wider uppercase">{label}</p><p className="text-[11px] font-display mt-0.5 tracking-wide text-white/50">{value}{unit && <span className="text-[8px] text-white/20 ml-0.5">{unit}</span>}</p></div>;
}
function CornerBracket({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const isTop = position.startsWith('top'), isLeft = position.endsWith('left');
  return <div style={{ position: 'absolute', ...(isTop ? { top: 8 } : { bottom: 8 }), ...(isLeft ? { left: 8 } : { right: 8 }), width: 20, height: 20, pointerEvents: 'none' as const }}>
    <div className="absolute bg-aether-cyan/25" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, height: 1, width: '100%' }} />
    <div className="absolute bg-aether-cyan/25" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 1, height: '100%' }} />
  </div>;
}
function MapAtmosphere() {
  return (<>
    <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #00f2ff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
    <div className="absolute inset-0 pointer-events-none overflow-hidden">{PARTICLES.map((p) => <div key={p.id} className="absolute bottom-0 rounded-full bg-aether-cyan" style={{ left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, opacity: p.opacity, animation: `float-up ${p.duration}s ease-in-out ${p.delay}s infinite`, boxShadow: `0 0 ${p.size * 2}px rgba(0,242,255,${p.opacity * 0.6})` }} />)}</div>
    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/25 to-transparent pointer-events-none" />
    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/25 to-transparent pointer-events-none" />
    <div className="absolute top-0 bottom-0 left-[60px] w-[1px] bg-gradient-to-b from-transparent via-aether-cyan/8 to-transparent pointer-events-none" />
    <div className="absolute top-0 bottom-0 right-[60px] w-[1px] bg-gradient-to-b from-transparent via-aether-cyan/8 to-transparent pointer-events-none" />
    <div className="absolute inset-0 bg-gradient-to-b from-aether-cyan/[0.025] via-transparent to-aether-cyan/[0.015] pointer-events-none" />
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-aether-cyan/[0.008] to-transparent pointer-events-none" />
  </>);
}
