import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onComplete: () => void;
}

export default function EntryOverlay({ onComplete }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 1200);
    const t2 = setTimeout(() => setPhase('exit'), 2800);
    const t3 = setTimeout(() => onComplete(), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed inset-0 z-[9999] bg-[#000a0d] flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Subtle radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%)]" />

        {/* Butterfly particles — sparse, natural */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${20 + (i * 13) % 70}%`,
              top: `${30 + (i * 11) % 50}%`,
              background: i < 3 ? '#00f2ff' : i < 5 ? '#a78bfa' : '#f472b6',
              boxShadow: i < 3
                ? '0 0 4px rgba(0,242,255,0.5)'
                : i < 5
                  ? '0 0 4px rgba(167,139,250,0.5)'
                  : '0 0 4px rgba(244,114,182,0.4)',
            }}
            animate={{
              opacity: [0, 0.5, 0],
              x: [0, (i % 2 === 0 ? 40 : -40), 0],
              y: [-20, -60, -100],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              delay: i * 0.6,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* ─── Logo — rotating square mark ─── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: phase === 'exit' ? 0 : 1,
            scale: phase === 'enter' ? 1 : 1,
          }}
          transition={{
            opacity: { duration: 0.6, ease: 'easeOut' },
            scale: { duration: 1, ease: [0.22, 1, 0.36, 1] },
          }}
          className="relative inline-flex items-center justify-center mb-12"
        >
          {/* Outer orbit — clockwise */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute w-32 h-32 border border-aether-cyan/[0.08] rounded-full"
          />
          {/* Inner orbit — counter-clockwise */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            className="absolute w-24 h-24 border border-aether-cyan/[0.15] rounded-full"
          />
          {/* Mid ring — clockwise, offset speed */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            className="absolute w-20 h-20 border border-dashed border-aether-cyan/[0.1] rounded-full"
          />
          {/* Center square — the emblem */}
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border border-aether-cyan/25 rotate-45 flex items-center justify-center bg-[#000a0d]/80"
            style={{ boxShadow: '0 0 48px rgba(0,242,255,0.06), inset 0 0 24px rgba(0,242,255,0.03)' }}
          >
            <span
              className="-rotate-45 font-display text-xl font-black text-aether-cyan/45 tracking-widest select-none"
              style={{ textShadow: '0 0 12px rgba(0,242,255,0.15)' }}
            >
              异
            </span>
          </motion.div>
        </motion.div>

        {/* ─── Title ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: phase === 'exit' ? 0 : 1,
            y: phase === 'enter' ? 0 : 0,
          }}
          transition={{
            opacity: { duration: 0.6, delay: 0.4, ease: 'easeOut' },
            y: { duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] },
          }}
          className="text-center space-y-4"
        >
          <h1
            className="font-display text-4xl font-black tracking-[0.25em] text-aether-cyan/80 select-none"
            style={{ textShadow: '0 0 24px rgba(0,242,255,0.12)' }}
          >
            梦 · 异常
          </h1>
          <p className="text-[11px] font-mono tracking-[0.3em] text-white/12 select-none">
            异常管理局
          </p>
        </motion.div>

        {/* Bottom accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: phase === 'exit' ? 0 : 1 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent"
        />
      </motion.div>
    </AnimatePresence>
  );
}
