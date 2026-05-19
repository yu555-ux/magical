import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Diamond } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

/* ─── Butterfly particle helper ─── */
function Butterflies({ count, delay }: { count: number; delay: number }) {
  const colors = [
    { bg: '#00f2ff', glow: '0 0 5px rgba(0,242,255,0.5)' },
    { bg: '#a78bfa', glow: '0 0 5px rgba(167,139,250,0.4)' },
    { bg: '#f472b6', glow: '0 0 5px rgba(244,114,182,0.35)' },
    { bg: '#34d399', glow: '0 0 5px rgba(52,211,153,0.35)' },
  ];
  return (
    <>
      {[...Array(count)].map((_, i) => {
        const c = colors[i % colors.length];
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${15 + Math.random() * 70}%`,
              top: `${60 + Math.random() * 30}%`,
              background: c.bg,
              boxShadow: c.glow,
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{
              opacity: [0, 0.45, 0.15, 0],
              y: [0, -60 - Math.random() * 80, -140 - Math.random() * 60],
              x: [0, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 40],
              scale: [0.6, 1.2, 0.4],
            }}
            transition={{
              duration: 4 + Math.random() * 5,
              repeat: Infinity,
              delay: delay + i * 0.7 + Math.random() * 2,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </>
  );
}

export default function EntryOverlay({ onComplete }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [scanAngle, setScanAngle] = useState(0);

  // Phase timing
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 1400);
    const t2 = setTimeout(() => setPhase('exit'), 3200);
    const t3 = setTimeout(() => onComplete(), 3900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  // Scan ring animation
  useEffect(() => {
    const interval = setInterval(() => {
      setScanAngle(a => (a + 0.8) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(2px)' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[9999] bg-[#000a0d] flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_25%,_rgba(0,0,0,0.7)_100%)]" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,242,255,0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,242,255,0.15) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 65%)',
          }}
        />

        {/* ─── Butterfly particles ─── */}
        <Butterflies count={8} delay={0} />

        {/* ─── Scanning ring ─── */}
        <motion.div
          className="absolute w-[340px] h-[340px] rounded-full pointer-events-none"
          style={{
            border: '1px solid rgba(0,242,255,0.06)',
            boxShadow: '0 0 60px rgba(0,242,255,0.02)',
          }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Sweeping arc */}
        <div className="absolute w-[340px] h-[340px] rounded-full pointer-events-none overflow-hidden opacity-25">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from ${scanAngle}deg, transparent 0deg, rgba(0,242,255,0.15) 8deg, transparent 16deg, transparent 360deg)`,
            }}
          />
        </div>

        {/* ─── Logo assembly ─── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: phase === 'exit' ? 0 : 1,
            scale: phase === 'enter' ? 1 : phase === 'exit' ? 1.08 : 1,
          }}
          transition={{
            opacity: { duration: 0.5, ease: 'easeOut' },
            scale: { duration: 1, ease: [0.22, 1, 0.36, 1] },
          }}
          className="relative inline-flex items-center justify-center mb-14 z-10"
        >
          {/* Ring 1 — outermost, slow CW */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            className="absolute w-36 h-36 rounded-full"
            style={{
              border: '1px dashed rgba(0,242,255,0.07)',
            }}
          />
          {/* Ring 2 — medium, CCW */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute w-28 h-28 rounded-full"
            style={{
              border: '1px solid rgba(0,242,255,0.12)',
            }}
          />
          {/* Ring 3 — inner, fast CW */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
            className="absolute w-22 h-22 rounded-full"
            style={{
              border: '1px solid rgba(0,242,255,0.18)',
            }}
          />
          {/* Ring 4 — innermost accent */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            className="absolute w-18 h-18 rounded-full"
            style={{
              border: '1px dotted rgba(0,242,255,0.1)',
            }}
          />

          {/* ─── Center square — the emblem ─── */}
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
            className="w-14 h-14 border border-aether-cyan/30 rotate-45 flex items-center justify-center"
            style={{
              background: 'rgba(0,10,13,0.85)',
              boxShadow: `
                0 0 32px rgba(0,242,255,0.08),
                inset 0 0 16px rgba(0,242,255,0.03)
              `,
            }}
          >
            {/* Diamond crystal — 鉴灵碑 symbol, counter-rotates to stay upright */}
            <motion.div
              animate={{ rotate: [0, -360] }}
              transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
              className="flex items-center justify-center"
            >
              <Diamond
                size={22}
                className="text-aether-cyan/50"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(0,242,255,0.2))',
                }}
                strokeWidth={1.5}
              />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ─── Title ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{
            opacity: phase === 'exit' ? 0 : 1,
            y: phase === 'enter' ? 0 : 0,
          }}
          transition={{
            opacity: { duration: 0.5, delay: 0.5, ease: 'easeOut' },
            y: { duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] },
          }}
          className="text-center space-y-3 z-10"
        >
          <h1
            className="font-display text-4xl font-black tracking-[0.22em] text-aether-cyan/75 select-none"
            style={{ textShadow: '0 0 28px rgba(0,242,255,0.1)' }}
          >
            梦 · 异常
          </h1>
          <div className="w-10 h-[1px] mx-auto bg-gradient-to-r from-transparent via-aether-cyan/25 to-transparent" />
          <p className="text-[10px] font-mono tracking-[0.35em] text-white/10 select-none">
            异常事物管理局
          </p>
        </motion.div>

        {/* Bottom scanning line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: phase === 'exit' ? 0 : 1 }}
          transition={{ duration: 0.9, delay: 1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 w-40 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent"
        />

        {/* Corner accents */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'exit' ? 0 : 0.3 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="absolute top-6 left-6 w-6 h-6 border-t border-l border-aether-cyan/20 pointer-events-none"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'exit' ? 0 : 0.3 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="absolute top-6 right-6 w-6 h-6 border-t border-r border-aether-cyan/20 pointer-events-none"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'exit' ? 0 : 0.3 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="absolute bottom-6 left-6 w-6 h-6 border-b border-l border-aether-cyan/20 pointer-events-none"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'exit' ? 0 : 0.3 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="absolute bottom-6 right-6 w-6 h-6 border-b border-r border-aether-cyan/20 pointer-events-none"
        />
      </motion.div>
    </AnimatePresence>
  );
}
