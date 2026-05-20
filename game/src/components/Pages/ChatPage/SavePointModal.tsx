import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, ChevronRight, Clock, MapPin, Users, Tag, FileText, GitBranch, Eye } from 'lucide-react';
import type { ChatMessage } from '../../../sillytavern/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onJumpToFloor: (messageId: string) => void;
}

interface SavePointFull {
  messageId: string;
  index: number;
  date: string;
  title: string;
  location: string;
  characters: string;
  description: string;
  relationships: string;
  tags: string[];
  importantInfo: string;
  hiddenClues: string;
  timestamp: number;
}

export default function SavePointModal({ isOpen, onClose, messages, onJumpToFloor }: Props) {
  const savePoints = useMemo<SavePointFull[]>(() => {
    return messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.role === 'assistant' && msg.parsed?.history)
      .map(({ msg, index }) => {
        const h = msg.parsed!.history!;
        return {
          messageId: msg.id,
          index,
          date: h.date,
          title: h.title,
          location: h.location,
          characters: h.characters,
          description: h.description,
          relationships: h.relationships,
          tags: h.tags,
          importantInfo: h.importantInfo,
          hiddenClues: h.hiddenClues,
          timestamp: msg.timestamp,
        };
      });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-aether-dark/92 backdrop-blur-xl"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[680px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
                     shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
        >
          {/* ── Top decorative accent line ── */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />
          <div className="absolute top-0 left-0 right-0 h-[40px] bg-gradient-to-b from-aether-cyan/[0.03] to-transparent pointer-events-none" />

          {/* ── Header ── */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4.5 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              {/* Animated indicator dot */}
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" />
              </div>
              <Save size={18} className="text-aether-cyan/80" />
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">
                存档点
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-white/15 tracking-wider">
                {savePoints.length} 个记录
              </span>
              <button
                onClick={onClose}
                className="text-white/20 hover:text-aether-cyan transition-colors p-1.5 clickable press-scale
                           hover:bg-aether-cyan/[0.06] rounded"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto">
            {savePoints.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                <div className="relative mb-5">
                  <div className="w-14 h-14 rounded-full border border-aether-cyan/10 flex items-center justify-center
                                  bg-aether-cyan/[0.02]">
                    <Save size={22} className="text-white/10" />
                  </div>
                  <div className="absolute inset-0 w-14 h-14 rounded-full border border-aether-cyan/5 animate-ping opacity-0" />
                </div>
                <p className="text-white/15 font-display text-sm tracking-[0.1em]">暂无存档点</p>
                <p className="text-white/6 text-[11px] font-mono mt-2 tracking-wide">
                  AI 将在剧情关键节点通过 {'<history>'} 标签自动生成存档点
                </p>
              </div>
            ) : (
              /* Timeline */
              <div className="relative px-6 py-6">
                {/* Timeline spine */}
                <div className="absolute left-[35px] top-6 bottom-6 w-[1px] bg-gradient-to-b
                                from-aether-cyan/25 via-aether-cyan/10 to-aether-cyan/5" />

                <div className="space-y-5">
                  {savePoints.map((sp, i) => (
                    <motion.div
                      key={sp.messageId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25, ease: 'easeOut' }}
                    >
                      <button
                        onClick={() => {
                          onJumpToFloor(sp.messageId);
                          onClose();
                        }}
                        className="w-full text-left group"
                      >
                        <div className="relative pl-14">
                          {/* Timeline dot */}
                          <div className="absolute left-[29px] top-3 w-[13px] h-[13px] rounded-full
                                          border-2 border-aether-cyan/40 bg-aether-deep
                                          shadow-[0_0_8px_rgba(0,242,255,0.12)]
                                          group-hover:border-aether-cyan/70 group-hover:shadow-[0_0_16px_rgba(0,242,255,0.25)]
                                          transition-all duration-300 z-10">
                            <div className="absolute inset-[3px] rounded-full bg-aether-cyan/30
                                            group-hover:bg-aether-cyan/50 transition-colors duration-300" />
                          </div>

                          {/* Card */}
                          <div className="border border-white/[0.05] bg-white/[0.01]
                                          group-hover:border-aether-cyan/15 group-hover:bg-aether-cyan/[0.02]
                                          transition-all duration-300 p-5
                                          shadow-[0_2px_8px_rgba(0,0,0,0.15)] group-hover:shadow-[0_4px_20px_rgba(0,242,255,0.04)]">
                            {/* ── Title row ── */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-[15px] font-display font-bold text-white/75
                                               group-hover:text-aether-cyan transition-colors duration-300
                                               tracking-[0.06em] leading-snug">
                                  {sp.title || '(无标题)'}
                                </h3>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] font-mono text-aether-cyan/35">
                                    第 {sp.index + 1} 回合
                                  </span>
                                  {sp.date && (
                                    <span className="text-[10px] font-mono text-white/20">
                                      {sp.date}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight size={15}
                                className="text-white/8 group-hover:text-aether-cyan/40 group-hover:translate-x-0.5
                                           transition-all duration-300 shrink-0 mt-1" />
                            </div>

                            {/* ── Meta grid ── */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                              {sp.location && (
                                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                                  <MapPin size={10} className="text-aether-purple/40 shrink-0" />
                                  <span className="truncate">{sp.location}</span>
                                </div>
                              )}
                              {sp.characters && (
                                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                                  <Users size={10} className="text-aether-blue/40 shrink-0" />
                                  <span className="truncate">{sp.characters}</span>
                                </div>
                              )}
                            </div>

                            {/* ── Description ── */}
                            {sp.description && (
                              <p className="text-[11px] text-white/45 leading-relaxed mb-3
                                            line-clamp-2 font-sans tracking-[0.02em]">
                                {sp.description}
                              </p>
                            )}

                            {/* ── Tags ── */}
                            {sp.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {sp.tags.map((tag, ti) => (
                                  <span key={ti}
                                    className="text-[9px] px-2 py-0.5 rounded-sm
                                               bg-aether-cyan/[0.05] border border-aether-cyan/[0.08]
                                               text-aether-cyan/45 font-mono tracking-wide
                                               group-hover:border-aether-cyan/15 group-hover:text-aether-cyan/55
                                               transition-colors duration-300">
                                    <Tag size={8} className="inline mr-1 opacity-40" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* ── Extra fields: relationships / important info / hidden clues ── */}
                            <div className="space-y-1 pt-2 border-t border-white/[0.03]">
                              {sp.relationships && (
                                <div className="flex items-start gap-1.5 text-[10px]">
                                  <GitBranch size={10} className="text-aether-gold/40 shrink-0 mt-0.5" />
                                  <span className="text-white/20 font-mono tracking-wide">{sp.relationships}</span>
                                </div>
                              )}
                              {sp.importantInfo && (
                                <div className="flex items-start gap-1.5 text-[10px]">
                                  <FileText size={10} className="text-aether-blue/40 shrink-0 mt-0.5" />
                                  <span className="text-white/20 font-mono tracking-wide">{sp.importantInfo}</span>
                                </div>
                              )}
                              {sp.hiddenClues && (
                                <div className="flex items-start gap-1.5 text-[10px]">
                                  <Eye size={10} className="text-aether-purple/40 shrink-0 mt-0.5" />
                                  <span className="text-white/15 font-mono tracking-wide italic">{sp.hiddenClues}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="relative shrink-0 px-6 py-3 border-t border-white/[0.04] bg-white/[0.005]">
            <p className="text-[9px] text-white/12 font-mono text-center tracking-wide">
              点击存档点跳转至对应楼层 · 变量将自动回溯至该时刻的快照
            </p>
          </div>

          {/* ── Bottom decorative line ── */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
