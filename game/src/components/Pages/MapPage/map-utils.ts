import { MapLocationRender } from '../../../types';

/* ===== Rating / anomaly color config ===== */
export interface RatingColorSet { text: string; border: string; glow: string; bg: string; bar: string }
export const RATING_COLORS: Record<string, RatingColorSet> = {
  '灭世': { text: 'text-red-500',   border: 'border-red-500/60',   glow: 'shadow-[0_0_24px_rgba(239,68,68,0.6)]',    bg: 'bg-red-500/12',   bar: 'bg-red-500' },
  '绝域': { text: 'text-fuchsia-400',border: 'border-fuchsia-400/50',glow: 'shadow-[0_0_18px_rgba(217,70,219,0.45)]',bg: 'bg-fuchsia-400/10',bar: 'bg-fuchsia-400' },
  '倾国': { text: 'text-violet-400',border: 'border-violet-400/50',glow: 'shadow-[0_0_14px_rgba(167,139,250,0.4)]',bg: 'bg-violet-400/10', bar: 'bg-violet-400' },
  '祸城': { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_14px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10',bar: 'bg-orange-400' },
  '凶煞': { text: 'text-amber-400', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10', bar: 'bg-amber-400' },
  '微末': { text: 'text-slate-400', border: 'border-slate-400/30', glow: 'shadow-[0_0_6px_rgba(148,163,184,0.15)]',bg: 'bg-slate-400/5',  bar: 'bg-slate-400' },
};
export function getRating(label: string): RatingColorSet { return RATING_COLORS[label] ?? RATING_COLORS['微末']; }

/* ===== Zoom limits ===== */
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 5;
export const ZOOM_STEP = 0.15;
export const CANVAS_W = 800;
export const CANVAS_H = 600;

/* ===== Particles ===== */
export interface Particle { id: number; left: number; delay: number; duration: number; size: number; opacity: number }
export const PARTICLES: Particle[] = Array.from({ length: 24 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 10,
  duration: 8 + Math.random() * 10, size: 1.5 + Math.random() * 2.5, opacity: 0.1 + Math.random() * 0.3,
}));

/* ===== Viewport ===== */
export interface Viewport { x: number; y: number; w: number; h: number }
export function fitViewport(points: MapLocationRender[], paddingRatio = 0.6): Viewport {
  if (points.length === 0) return { x: -500, y: -500, w: 1000, h: 1000 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) { if (p.cx < minX) minX = p.cx; if (p.cx > maxX) maxX = p.cx; if (p.cy < minY) minY = p.cy; if (p.cy > maxY) maxY = p.cy; }
  let dx = maxX - minX || 10;
  let dy = maxY - minY;
  if (dx < dy * 0.05) dx = dy / (CANVAS_W / CANVAS_H);
  const padX = dx * paddingRatio, padY = dy * paddingRatio;
  const northRange = dx + padX * 2;
  const eastRange = dy + padY * 2;
  const aspect = CANVAS_W / CANVAS_H;
  let w: number, h: number;
  if (eastRange / northRange > aspect) { w = eastRange / aspect; h = eastRange; }
  else { w = northRange; h = northRange * aspect; }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
export function worldToScreen(wx: number, wy: number, vp: Viewport) {
  return {
    sx: ((wy - vp.y) / vp.h) * CANVAS_W,
    sy: CANVAS_H - ((wx - vp.x) / vp.w) * CANVAS_H,
  };
}

/* ===== Colors ===== */
export interface PointColorSet { primary: string; glow: string; bg: string }
export const DEPTH_COLORS: PointColorSet[] = [
  { primary: '#00f2ff', glow: 'rgba(0,242,255,0.5)',    bg: 'rgba(0,242,255,0.12)'   },
  { primary: '#3b82f6', glow: 'rgba(59,130,246,0.5)',    bg: 'rgba(59,130,246,0.12)'   },
  { primary: '#22c55e', glow: 'rgba(34,197,94,0.5)',     bg: 'rgba(34,197,94,0.12)'    },
  { primary: '#14b8a6', glow: 'rgba(20,184,166,0.5)',    bg: 'rgba(20,184,166,0.12)'   },
  { primary: '#a78bfa', glow: 'rgba(167,139,250,0.5)',   bg: 'rgba(167,139,250,0.12)'  },
  { primary: '#f59e0b', glow: 'rgba(245,158,11,0.5)',    bg: 'rgba(245,158,11,0.12)'   },
  { primary: '#f472b6', glow: 'rgba(244,114,182,0.5)',   bg: 'rgba(244,114,182,0.12)'  },
  { primary: '#ef4444', glow: 'rgba(239,68,68,0.5)',     bg: 'rgba(239,68,68,0.12)'    },
];
export const WORLD_COLORS: Record<string, PointColorSet> = {
  '蓝星':   { primary: '#00f2ff', glow: 'rgba(0,242,255,0.6)',  bg: 'rgba(0,242,255,0.14)' },
  '太虚界': { primary: '#f0a43c', glow: 'rgba(240,164,60,0.55)', bg: 'rgba(240,164,60,0.14)' },
};
export function pointStyle(depth: number, key?: string): PointColorSet {
  if (depth === 0 && key && WORLD_COLORS[key]) return WORLD_COLORS[key];
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

/* ===== Danger ===== */
export function getDangerLevel(point: MapLocationRender): number {
  const r = Object.keys(point.reality?.地点细节?.异常 ?? {});
  if (r.length > 0) return 1;
  const d = Object.values(point.dream?.地点细节?.异常 ?? {});
  if (d.some((a: any) => (a?.具现进度 ?? 0) >= 100)) return 2;
  return 0;
}
export const DANGER_STYLES: Record<number, { ring: string; glow: string; text: string }> = {
  0: { ring: 'transparent', glow: 'transparent', text: '' },
  1: { ring: 'rgba(239,68,68,0.45)', glow: 'rgba(239,68,68,0.3)', text: '现实异常' },
  2: { ring: 'rgba(239,68,68,0.8)', glow: 'rgba(239,68,68,0.55)', text: '高危异常' },
};

/* ===== Global search flatten ===== */
export interface FlatEntry { path: string[]; pathNames: string[]; node: MapLocationRender }
export function flattenTree(nodes: MapLocationRender[], parentPath: string[], parentNames: string[]): FlatEntry[] {
  let result: FlatEntry[] = [];
  for (const node of nodes) {
    const p = [...parentPath, node.key], n = [...parentNames, node.name];
    result.push({ path: p, pathNames: n, node });
    if (node.children.length > 0) result = result.concat(flattenTree(node.children, p, n));
  }
  return result;
}

/* ===== Floor grouping ===== */
export function groupByFloor(children: MapLocationRender[]): { label: string; key: string; nodes: MapLocationRender[] }[] | null {
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
      groups.push({ label: `Z:${zMid}`, key: `z-${zMin}`, nodes: [child] });
    }
  }
  for (const g of groups) {
    for (let i = 0; i < g.nodes.length; i++) {
      for (let j = i + 1; j < g.nodes.length; j++) {
        const a = g.nodes[i], b = g.nodes[j];
        const dx = a.cx - b.cx, dy = a.cy - b.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001 && dist >= 0) {
          (b as any).cx += 0.002;
        }
      }
    }
  }
  return groups.length > 1 ? groups : null;
}
