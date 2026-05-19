import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const BOOT_LINES = [
  { text: '联 邦 异 常 事 物 监 督 管 理 局', delay: 200, cls: 'text-aether-cyan text-xl tracking-[0.25em]' },
  { text: 'Federal Anomaly Supervision & Containment Agency', delay: 500, cls: 'text-white/12 text-[8px] tracking-[0.15em]' },
  { text: '', delay: 300, cls: '' },
  { text: '伪装身份 · 联邦气象观测局及各地分局', delay: 350, cls: 'text-white/18 text-[10px] tracking-wider' },
  { text: '', delay: 250, cls: '' },
  { text: '> 鉴灵碑阵列同步中...', delay: 400, cls: 'text-aether-cyan/50 text-[11px] font-mono' },
  { text: '> 夏城分局 · 覆盖范围确认', delay: 300, cls: 'text-aether-cyan/45 text-[11px] font-mono' },
  { text: '> 异常监测网络已激活', delay: 300, cls: 'text-aether-green/55 text-[11px] font-mono' },
  { text: '> 梦境蝶烬读数 · 波动正常', delay: 300, cls: 'text-aether-cyan/45 text-[11px] font-mono' },
  { text: '', delay: 200, cls: '' },
  { text: '> 安全许可 ████████ · 已授权', delay: 400, cls: 'text-aether-gold/50 text-[11px] font-mono' },
  { text: '> 认知过滤已激活 · 未授权访问将被追溯', delay: 350, cls: 'text-aether-red/45 text-[11px] font-mono' },
  { text: '', delay: 250, cls: '' },
  { text: '收 容 异 常   ·   维 持 秩 序', delay: 500, cls: 'text-white/25 text-sm tracking-[0.4em]' },
];

interface Props {
  onComplete: () => void;
}

export default function EntryOverlay({ onComplete }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [phase, setPhase] = useState<'boot' | 'scan' | 'done'>('boot');
  const [scanProgress, setScanProgress] = useState(0);
  const [logoVisible, setLogoVisible] = useState(false);
  const [showBloom, setShowBloom] = useState(false);

  // Typewriter boot sequence
  useEffect(() => {
    if (phase !== 'boot') return;
    if (visibleLines >= BOOT_LINES.length) {
      setTimeout(() => setPhase('scan'), 500);
      return;
    }
    const line = BOOT_LINES[visibleLines];
    const timer = setTimeout(() => setVisibleLines(v => v + 1), line.delay);
    return () => clearTimeout(timer);
  }, [visibleLines, phase]);

  // Show logo after scan starts
  useEffect(() => {
    if (phase === 'scan') {
      setTimeout(() => setLogoVisible(true), 300);
    }
  }, [phase]);

  // Scan progress
  useEffect(() => {
    if (phase !== 'scan') return;
    if (scanProgress >= 100) {
      setShowBloom(true);
      setTimeout(() => {
        setPhase('done');
        setTimeout(onComplete, 700);
      }, 1000);
      return;
    }
    const timer = setTimeout(() => setScanProgress(p => Math.min(p + 1.2, 100)), 22);
    return () => clearTimeout(timer);
  }, [phase, scanProgress, onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[9999] bg-aether-dark flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
            <div className="absolute inset-0 animate-scanline bg-gradient-to-b from-transparent via-aether-cyan/50 to-transparent" />
          </div>

          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,242,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,242,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px',
            }}
          />

          {/* Corner L-brackets */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-aether-cyan/25" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-aether-cyan/25" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-aether-cyan/25" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-aether-cyan/25" />

          {/* ─── AE Rotating Square Logo ─── */}
          <div className="relative z-10 mb-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={logoVisible ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="relative inline-flex items-center justify-center"
            >
              {/* Outer ring — clockwise */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute w-24 h-24 border border-aether-cyan/[0.10]"
              />
              {/* Inner ring — counter-clockwise */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                className="absolute w-16 h-16 border border-aether-cyan/[0.22]"
              />
              {/* Center square — 45° rotated, the "AE" mark */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 border border-aether-cyan/35 rotate-45 flex items-center justify-center bg-aether-dark/60 shadow-[0_0_36px_rgba(0,242,255,0.08)]"
              >
                <span className="-rotate-45 font-display text-base font-black text-aether-cyan/50 tracking-widest">
                  异
                </span>
              </motion.div>
            </motion.div>
          </div>

          {/* ─── Terminal text ─── */}
          <div className="relative z-10 w-full max-w-xl px-8 space-y-1 font-mono">
            {/* Phase: Boot — typewriter */}
            {phase === 'boot' && (
              <div className="space-y-1">
                {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -3 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.12 }}
                    className={line.cls}
                  >
                    {line.text || ' '}
                    {line.text.startsWith('>') && i === visibleLines - 1 && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                        className="text-aether-cyan"
                      >
                        █
                      </motion.span>
                    )}
                  </motion.p>
                ))}
              </div>
            )}

            {/* Phase: Scan — full text + progress */}
            {phase === 'scan' && (
              <div className="space-y-5">
                {BOOT_LINES.map((line, i) => (
                  <p key={i} className={line.cls}>
                    {line.text || ' '}
                  </p>
                ))}
                {/* Scan progress bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-3">
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-aether-cyan text-[10px] font-mono"
                    >
                      ● 区域异常扫描中...
                    </motion.span>
                    <span className="text-[10px] font-mono text-white/25">{Math.round(scanProgress)}%</span>
                  </div>
                  <div className="h-[1px] w-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-aether-cyan/70 via-aether-cyan to-aether-blue"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-white/10">
                    <span>蝶烬密度: {Math.round(scanProgress * 0.35)}/km²</span>
                    <span>异常读数: {scanProgress > 50 ? '正常' : '扫描中…'}</span>
                    <span>覆盖区域: 夏城·锦荣区</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Butterfly particles */}
          {scanProgress > 30 && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0, 0.5, 0],
                    x: [Math.random() * 160 - 80, Math.random() * 240 - 120],
                    y: [Math.random() * 120 - 60, Math.random() * 200 - 180],
                  }}
                  transition={{
                    duration: 2.5 + Math.random() * 3,
                    repeat: Infinity,
                    repeatType: 'loop',
                    delay: Math.random() * 3,
                    ease: 'easeInOut',
                  }}
                  className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full"
                  style={{
                    background: i < 5 ? '#00f2ff' : i < 8 ? '#a78bfa' : '#f472b6',
                    boxShadow: i < 5
                      ? '0 0 5px rgba(0,242,255,0.5)'
                      : i < 8
                        ? '0 0 5px rgba(167,139,250,0.5)'
                        : '0 0 5px rgba(244,114,182,0.4)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Bloom ring on completion */}
          {showBloom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
            >
              <motion.div
                animate={{ opacity: [0, 0.12, 0], scale: [0.4, 1.4, 2] }}
                transition={{ duration: 2, ease: 'easeOut' }}
                className="w-40 h-40 rounded-full bg-aether-cyan/15 blur-3xl"
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
