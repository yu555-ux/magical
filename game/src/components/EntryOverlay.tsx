import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onComplete: () => void;
}

/* ============================================================
   CONFIG — stacked squares
   ============================================================ */
interface SquareConfig {
  size: number;       // px
  speed: number;      // seconds per full rotation
  direction: 1 | -1;  // 1=CW, -1=CCW
  borderWidth: number;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  glowIntensity: number;
}

const RINGS: SquareConfig[] = [
  { size: 300, speed: 40, direction: 1,  borderWidth: 1, borderColor: 'rgba(0,242,255,0.06)', borderStyle: 'dashed', opacity: 0.6,  glowIntensity: 0 },
  { size: 250, speed: 32, direction: -1, borderWidth: 1, borderColor: 'rgba(0,242,255,0.10)', borderStyle: 'solid',  opacity: 0.7,  glowIntensity: 0 },
  { size: 195, speed: 24, direction: 1,  borderWidth: 1, borderColor: 'rgba(0,242,255,0.16)', borderStyle: 'dotted', opacity: 0.8,  glowIntensity: 0 },
  { size: 145, speed: 18, direction: -1, borderWidth: 1.5, borderColor: 'rgba(0,242,255,0.22)', borderStyle: 'solid',  opacity: 0.85, glowIntensity: 2 },
  { size: 100, speed: 13, direction: 1,  borderWidth: 1.5, borderColor: 'rgba(0,242,255,0.28)', borderStyle: 'dashed', opacity: 0.9,  glowIntensity: 4 },
  { size: 60,  speed: 8,  direction: -1, borderWidth: 2,   borderColor: 'rgba(0,242,255,0.38)', borderStyle: 'solid',  opacity: 1,    glowIntensity: 8 },
  { size: 30,  speed: 5,  direction: 1,  borderWidth: 2,   borderColor: 'rgba(0,242,255,0.50)', borderStyle: 'solid',  opacity: 1,    glowIntensity: 12 },
];

/* ============================================================
   PARTICLE SWARM
   ============================================================ */
const PARTICLE_PRESETS = [
  { bg: '#00f2ff', glow: '0 0 5px rgba(0,242,255,0.6)',   size: 1.5 },
  { bg: '#a78bfa', glow: '0 0 5px rgba(167,139,250,0.5)', size: 1.2 },
  { bg: '#f472b6', glow: '0 0 5px rgba(244,114,182,0.45)', size: 1.0 },
  { bg: '#34d399', glow: '0 0 4px rgba(52,211,153,0.4)',  size: 0.8 },
  { bg: '#fbbf24', glow: '0 0 4px rgba(251,191,36,0.35)', size: 1.0 },
];

function particle(i: number) {
  const p = PARTICLE_PRESETS[i % PARTICLE_PRESETS.length];
  const startX = 20 + Math.random() * 60;    // % from left
  const startY = 55 + Math.random() * 35;    // % from top
  const duration = 3.5 + Math.random() * 6;
  const driftX = (Math.random() - 0.5) * 80;
  const driftY = -40 - Math.random() * 100;
  return { ...p, startX, startY, duration, driftX, driftY, delay: Math.random() * 5 };
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function EntryOverlay({ onComplete }: Props) {
  const [phase, setPhase] = useState<'show' | 'exit'>('show');
  const [scanAngle, setScanAngle] = useState(0);
  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => particle(i)), []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), 2800);
    const t2 = setTimeout(() => onComplete(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  useEffect(() => {
    const iv = setInterval(() => setScanAngle(a => (a + 0.6) % 360), 25);
    return () => clearInterval(iv);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(3px) saturate(0.3)' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[9999] bg-[#000a0d] flex items-center justify-center overflow-hidden"
      >
        {/* ─── Radial vignette ─── */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_15%,_rgba(0,0,0,0.65)_100%)]" />

        {/* ─── Subtle grid floor ─── */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,242,255,0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,242,255,0.2) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            maskImage: 'radial-gradient(ellipse at center, black 25%, transparent 60%)',
          }}
        />

        {/* ─── Scanning arc ─── */}
        <div className="absolute w-[380px] h-[380px] rounded-full pointer-events-none overflow-hidden opacity-30">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from ${scanAngle}deg, transparent 0deg, rgba(0,242,255,0.2) 6deg, transparent 16deg, transparent 360deg)`,
            }}
          />
        </div>

        {/* ─── Outer breathing halo ─── */}
        <motion.div
          className="absolute w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ border: '1px solid rgba(0,242,255,0.04)' }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* ─── Corner bracket accents ─── */}
        {['top-6 left-6', 'top-6 right-6', 'bottom-6 left-6', 'bottom-6 right-6'].map((pos, i) => {
          const [v, h] = pos.split(' ');
          const bv = v === 'top-6' ? 'border-t' : 'border-b';
          const bh = h === 'left-6' ? 'border-l' : 'border-r';
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              transition={{ delay: 1 + i * 0.1, duration: 0.6 }}
              className={`absolute ${v} ${h} w-7 h-7 ${bv} ${bh} border-aether-cyan/20 pointer-events-none`}
            />
          );
        })}

        {/* ═══════════════════════════════════════════
            STACKED ROTATING SQUARES
            ═══════════════════════════════════════════ */}
        <div className="relative flex items-center justify-center z-10">
          {RINGS.map((cfg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, rotate: cfg.direction === 1 ? -15 : 15 }}
              animate={{
                opacity: cfg.opacity,
                rotate: cfg.direction === 1 ? 360 : -360,
              }}
              transition={{
                opacity: { duration: 0.5, delay: 0.1 + i * 0.08, ease: 'easeOut' },
                rotate: {
                  duration: cfg.speed,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: i * 0.2,
                },
              }}
              className="absolute rounded-[2px]"
              style={{
                width: cfg.size,
                height: cfg.size,
                border: `${cfg.borderWidth}px ${cfg.borderStyle} ${cfg.borderColor}`,
                boxShadow: cfg.glowIntensity > 0
                  ? `0 0 ${cfg.glowIntensity}px rgba(0,242,255,${cfg.glowIntensity * 0.015})`
                  : 'none',
              }}
            />
          ))}

          {/* ─── Center crystal (鉴灵碑) ─── */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute flex items-center justify-center"
          >
            {/* Inner diamond */}
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="w-3.5 h-3.5"
              style={{
                background: 'rgba(0,242,255,0.15)',
                border: '1px solid rgba(0,242,255,0.5)',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 16px rgba(0,242,255,0.25), 0 0 40px rgba(0,242,255,0.08)',
              }}
            />
          </motion.div>
        </div>

        {/* ─── Particle swarm ─── */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${p.startX}%`,
              top: `${p.startY}%`,
              width: p.size,
              height: p.size,
              background: p.bg,
              boxShadow: p.glow,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: [0, 0.55, 0.12, 0],
              y: [0, p.driftY * 0.5, p.driftY],
              x: [0, p.driftX * 0.4, p.driftX],
              scale: [0.5, 1.1, 0.3],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
