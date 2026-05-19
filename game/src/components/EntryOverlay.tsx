import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const BOOT_LINES = [
  { text: '联邦异常事物监督管理局', delay: 200, cls: 'text-aether-cyan text-2xl tracking-[0.3em]' },
  { text: 'Federal Anomaly Supervision & Containment Agency', delay: 600, cls: 'text-white/15 text-[9px] tracking-[0.2em]' },
  { text: '', delay: 400, cls: '' },
  { text: '伪装身份: 联邦气象观测局及各地分局', delay: 400, cls: 'text-white/20 text-[10px] tracking-wider' },
  { text: '', delay: 300, cls: '' },
  { text: '> 初始化神经连接协议 [AETHER_LINK]', delay: 500, cls: 'text-aether-cyan/60 text-[11px] font-mono' },
  { text: '> 正在建立以太共振通道...', delay: 300, cls: 'text-aether-cyan/50 text-[11px] font-mono' },
  { text: '> 共振频率 47.3Hz — 稳定', delay: 400, cls: 'text-aether-green/60 text-[11px] font-mono' },
  { text: '> 鉴灵碑同步完成 — 覆盖范围: 夏城', delay: 350, cls: 'text-aether-cyan/50 text-[11px] font-mono' },
  { text: '', delay: 200, cls: '' },
  { text: '> 安全许可等级: ████████ 已授权', delay: 500, cls: 'text-aether-gold/60 text-[11px] font-mono' },
  { text: '> 认知过滤已激活 — 未授权者无法读取此终端', delay: 400, cls: 'text-aether-red/50 text-[11px] font-mono' },
  { text: '', delay: 300, cls: '' },
  { text: '收容异常 · 维持秩序', delay: 600, cls: 'text-white/30 text-sm tracking-[0.5em]' },
];

interface Props {
  onComplete: () => void;
}

export default function EntryOverlay({ onComplete }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [phase, setPhase] = useState<'boot' | 'scan' | 'done'>('boot');
  const [scanProgress, setScanProgress] = useState(0);
  const [showButterfly, setShowButterfly] = useState(false);

  // Typing animation
  useEffect(() => {
    if (phase !== 'boot') return;
    if (visibleLines >= BOOT_LINES.length) {
      setTimeout(() => setPhase('scan'), 600);
      return;
    }
    const line = BOOT_LINES[visibleLines];
    const timer = setTimeout(() => setVisibleLines(v => v + 1), line.delay);
    return () => clearTimeout(timer);
  }, [visibleLines, phase]);

  // Scan progress
  useEffect(() => {
    if (phase !== 'scan') return;
    if (scanProgress >= 100) {
      setShowButterfly(true);
      setTimeout(() => {
        setPhase('done');
        setTimeout(onComplete, 800);
      }, 1200);
      return;
    }
    const timer = setTimeout(() => setScanProgress(p => Math.min(p + 1.5, 100)), 20);
    return () => clearTimeout(timer);
  }, [phase, scanProgress, onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[9999] bg-aether-dark flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
            <div className="absolute inset-0 animate-scanline bg-gradient-to-b from-transparent via-aether-cyan/50 to-transparent" />
          </div>

          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,242,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,242,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px',
            }}
          />

          {/* Corner decorators */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-aether-cyan/30" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-aether-cyan/30" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-aether-cyan/30" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-aether-cyan/30" />

          {/* Content */}
          <div className="relative z-10 w-full max-w-xl px-8 space-y-1 font-mono">
            {/* Phase: Boot */}
            {phase === 'boot' && (
              <div className="space-y-1">
                {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className={line.cls}
                  >
                    {line.text || ' '}
                    {line.text.includes('>') && i === visibleLines - 1 && (
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

            {/* Phase: Scan */}
            {phase === 'scan' && (
              <div className="space-y-6">
                {BOOT_LINES.map((line, i) => (
                  <p key={i} className={line.cls}>
                    {line.text || ' '}
                  </p>
                ))}
                <div className="space-y-2 pt-4">
                  <div className="flex items-center gap-3">
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-aether-cyan text-[10px] font-mono"
                    >
                      ● 环境扫描中...
                    </motion.span>
                    <span className="text-[10px] font-mono text-white/30">{Math.round(scanProgress)}%</span>
                  </div>
                  <div className="h-[1px] w-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-aether-cyan/80 via-aether-cyan to-aether-blue"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-white/10">
                    <span>以太浓度: {Math.round(scanProgress * 0.02 * 100) / 100}ppm</span>
                    <span>异常读数: {scanProgress > 60 ? '正常' : '扫描中'}</span>
                    <span>蝶烬计数: {Math.round(scanProgress * 0.3)}</span>
                  </div>
                </div>

                {/* Butterfly particles during scan */}
                {scanProgress > 40 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: Math.random() * 400 - 200, y: Math.random() * 400 - 200 }}
                        animate={{
                          opacity: [0, 0.6, 0],
                          x: [Math.random() * 200 - 100, Math.random() * 300 - 150],
                          y: [Math.random() * 200 - 100, Math.random() * 200 - 200],
                        }}
                        transition={{
                          duration: 2 + Math.random() * 3,
                          repeat: Infinity,
                          repeatType: 'loop',
                          delay: Math.random() * 2,
                        }}
                        className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full"
                        style={{
                          background: i < 4 ? '#00f2ff' : i < 6 ? '#a78bfa' : '#f472b6',
                          boxShadow: i < 4
                            ? '0 0 6px rgba(0,242,255,0.6)'
                            : i < 6
                              ? '0 0 6px rgba(167,139,250,0.6)'
                              : '0 0 6px rgba(244,114,182,0.6)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Butterfly bloom on completion */}
          {showButterfly && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
            >
              <motion.div
                animate={{ opacity: [0, 0.15, 0], scale: [0.5, 1.5, 2] }}
                transition={{ duration: 2, ease: 'easeOut' }}
                className="w-32 h-32 rounded-full bg-aether-cyan/20 blur-3xl"
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
