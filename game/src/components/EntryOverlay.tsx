import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onComplete: () => void;
}

/* ============================================================
   STACKED SQUARES CONFIG
   ============================================================ */
interface SquareConfig {
  size: number;
  speed: number;
  direction: 1 | -1;
  borderWidth: number;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  glow: number;
}

const SQUARES: SquareConfig[] = [
  { size: 300, speed: 40, direction: 1,  borderWidth: 1,   borderColor: 'rgba(0,242,255,0.06)', borderStyle: 'dashed', glow: 0 },
  { size: 250, speed: 32, direction: -1, borderWidth: 1,   borderColor: 'rgba(0,242,255,0.10)', borderStyle: 'solid',  glow: 0 },
  { size: 195, speed: 24, direction: 1,  borderWidth: 1,   borderColor: 'rgba(0,242,255,0.16)', borderStyle: 'dotted', glow: 0 },
  { size: 145, speed: 18, direction: -1, borderWidth: 1.5, borderColor: 'rgba(0,242,255,0.22)', borderStyle: 'solid',  glow: 2 },
  { size: 100, speed: 13, direction: 1,  borderWidth: 1.5, borderColor: 'rgba(0,242,255,0.28)', borderStyle: 'dashed', glow: 4 },
  { size: 60,  speed: 8,  direction: -1, borderWidth: 2,   borderColor: 'rgba(0,242,255,0.38)', borderStyle: 'solid',  glow: 8 },
  { size: 30,  speed: 5,  direction: 1,  borderWidth: 2,   borderColor: 'rgba(0,242,255,0.50)', borderStyle: 'solid',  glow: 14 },
];

/* ============================================================
   PARTICLE GENERATOR
   ============================================================ */
const COLORS = [
  { bg: '#00f2ff', glow: '0 0 5px rgba(0,242,255,0.55)' },
  { bg: '#a78bfa', glow: '0 0 4px rgba(167,139,250,0.45)' },
  { bg: '#f472b6', glow: '0 0 4px rgba(244,114,182,0.4)' },
  { bg: '#34d399', glow: '0 0 4px rgba(52,211,153,0.35)' },
  { bg: '#fbbf24', glow: '0 0 4px rgba(251,191,36,0.3)' },
];

function makeParticle(i: number) {
  const c = COLORS[i % COLORS.length];
  return {
    ...c,
    size: 0.8 + Math.random() * 1.2,
    left: 18 + Math.random() * 64,
    top: 50 + Math.random() * 40,
    driftX: (Math.random() - 0.5) * 70,
    driftY: -40 - Math.random() * 90,
    duration: 3 + Math.random() * 6,
    delay: Math.random() * 5,
  };
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function EntryOverlay({ onComplete }: Props) {
  const [phase, setPhase] = useState<'logo' | 'menu' | 'exit'>('logo');
  const particles = useMemo(() => Array.from({ length: 18 }, (_, i) => makeParticle(i)), []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('menu'), 2200);
    return () => clearTimeout(t1);
  }, []);

  const logoY = phase === 'menu' || phase === 'exit' ? -100 : 0;
  const logoScale = phase === 'menu' || phase === 'exit' ? 0.55 : 1;
  const logoOpacity = phase === 'exit' ? 0 : 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(3px) saturate(0.3)' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[9999] bg-[#000a0d] flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_18%,_rgba(0,0,0,0.6)_100%)]" />

        {/* Subtle floor grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,242,255,0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,242,255,0.2) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 60%)',
          }}
        />

        {/* Corner accents */}
        {['top-6 left-6', 'top-6 right-6', 'bottom-6 left-6', 'bottom-6 right-6'].map((pos, i) => {
          const [v, h] = pos.split(' ');
          const bv = v === 'top-6' ? 'border-t' : 'border-b';
          const bh = h === 'left-6' ? 'border-l' : 'border-r';
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.22 }}
              transition={{ delay: 1 + i * 0.1, duration: 0.6 }}
              className={`absolute ${v} ${h} w-7 h-7 ${bv} ${bh} border-aether-cyan/18 pointer-events-none`}
            />
          );
        })}

        {/* ═══════════════════════════════════
            STACKED ROTATING SQUARES — LOGO
            ═══════════════════════════════════ */}
        <motion.div
          className="relative flex items-center justify-center z-10"
          animate={{ y: logoY, scale: logoScale, opacity: logoOpacity }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {SQUARES.map((cfg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, rotate: cfg.direction === 1 ? -12 : 12 }}
              animate={{
                opacity: 1,
                rotate: cfg.direction === 1 ? 360 : -360,
              }}
              transition={{
                opacity: { duration: 0.45, delay: 0.08 + i * 0.06, ease: 'easeOut' },
                rotate: { duration: cfg.speed, repeat: Infinity, ease: 'linear', delay: i * 0.15 },
              }}
              className="absolute rounded-[2px]"
              style={{
                width: cfg.size,
                height: cfg.size,
                border: `${cfg.borderWidth}px ${cfg.borderStyle} ${cfg.borderColor}`,
                boxShadow: cfg.glow > 0
                  ? `0 0 ${cfg.glow}px rgba(0,242,255,${cfg.glow * 0.014})`
                  : 'none',
              }}
            />
          ))}

          {/* Center crystal */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute flex items-center justify-center"
          >
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
        </motion.div>

        {/* ═══════════════════════════════════
            MENU BUTTONS
            ═══════════════════════════════════ */}
        <motion.div
          className="flex flex-col items-center gap-4 z-10"
          initial={{ opacity: 0 }}
          animate={{
            opacity: phase === 'menu' ? 1 : 0,
            y: phase === 'menu' ? 0 : 20,
          }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ pointerEvents: phase === 'menu' ? 'auto' : 'none' }}
        >
          {/* "开始新游戏" — primary */}
          <motion.button
            onClick={() => { setPhase('exit'); setTimeout(onComplete, 650); }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="relative px-12 py-3.5 font-display text-base tracking-[0.2em] text-aether-cyan/90
                       border border-aether-cyan/30 bg-aether-cyan/[0.04]
                       hover:border-aether-cyan/50 hover:bg-aether-cyan/[0.08]
                       hover:shadow-[0_0_24px_rgba(0,242,255,0.15)]
                       transition-all duration-300 clickable select-none"
          >
            开始新游戏
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                boxShadow: 'inset 0 0 20px rgba(0,242,255,0.04)',
              }}
            />
          </motion.button>

          {/* "继续游戏" — secondary */}
          <motion.button
            onClick={() => { setPhase('exit'); setTimeout(onComplete, 650); }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="px-10 py-2.5 font-display text-sm tracking-[0.15em] text-white/25
                       border border-white/[0.06] hover:border-aether-cyan/20
                       hover:text-aether-cyan/50 hover:bg-aether-cyan/[0.02]
                       transition-all duration-300 clickable select-none"
          >
            继续游戏
          </motion.button>
        </motion.div>

        {/* ═══════════════════════════════════
            PARTICLE SWARM
            ═══════════════════════════════════ */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              background: p.bg,
              boxShadow: p.glow,
            }}
            initial={{ opacity: 0, y: 15 }}
            animate={{
              opacity: [0, 0.5, 0.1, 0],
              y: [0, p.driftY * 0.5, p.driftY],
              x: [0, p.driftX * 0.4, p.driftX],
              scale: [0.4, 1, 0.25],
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
