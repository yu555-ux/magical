import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, ChevronRight, ChevronDown, Clock, MapPin, Users, Lightbulb, Eye } from 'lucide-react';
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
  sequence: number;
  title: string;
  world: string;
  date: string;
  location: string;
  characters: string;
  description: string;
  keyInfo: string[];
  foreshadowing: string[];
  timestamp: number;
}

interface TimelineGroup {
  world: string;
  label: string;
  colorClass: string;
  dotGlow: string;
  badgeClass: string;
  points: SavePointFull[];
}

export default function SavePointModal({ isOpen, onClose, messages, onJumpToFloor }: Props) {
  const [expandedFs, setExpandedFs] = useState<Set<string>>(new Set());

  const timelines = useMemo<TimelineGroup[]>(() => {
    const raw = messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.role === 'assistant' && msg.parsed?.history)
      .map(({ msg, index }) => {
        const h = msg.parsed!.history!;
        return {
          messageId: msg.id,
          index,
          sequence: 0, // will be reassigned per-world
          title: h.title,
          world: h.world,
          date: h.date,
          location: h.location,
          characters: h.characters,
          description: h.description,
          keyInfo: h.keyInfo,
          foreshadowing: h.foreshadowing,
          timestamp: msg.timestamp,
        };
      });

    const reality = raw.filter(p => p.world === '现实');
    const dream = raw.filter(p => p.world === '梦境');
    const other = raw.filter(p => p.world !== '现实' && p.world !== '梦境');

    // Assign per-world sequence numbers
    for (let i = 0; i < reality.length; i++) reality[i] = { ...reality[i], sequence: i + 1 };
    for (let i = 0; i < dream.length; i++) dream[i] = { ...dream[i], sequence: i + 1 };
    // Fallback: treat unknown worlds as reality
    for (let i = 0; i < other.length; i++) other[i] = { ...other[i], sequence: reality.length + i + 1 };

    const groups: TimelineGroup[] = [
      {
        world: '现实',
        label: '现实世界',
        colorClass: 'border-aether-cyan/40 bg-aether-deep',
        dotGlow: 'shadow-[0_0_8px_rgba(0,242,255,0.12)] group-hover:shadow-[0_0_16px_rgba(0,242,255,0.25)]',
        badgeClass: 'bg-aether-blue/10 text-aether-blue/60 border-aether-blue/20',
        points: [...reality, ...other],
      },
      {
        world: '梦境',
        label: '梦境世界',
        colorClass: 'border-aether-purple/40 bg-aether-deep',
        dotGlow: 'shadow-[0_0_8px_rgba(168,85,247,0.12)] group-hover:shadow-[0_0_16px_rgba(168,85,247,0.25)]',
        badgeClass: 'bg-aether-purple/10 text-aether-purple/60 border-aether-purple/20',
        points: dream,
      },
    ];

    return groups;
  }, [messages]);

  const totalPoints = timelines.reduce((s, t) => s + t.points.length, 0);

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
          className="relative w-full max-w-[780px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
                     shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
        >
          {/* ── Top decorative accent line ── */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />
          <div className="absolute top-0 left-0 right-0 h-[40px] bg-gradient-to-b from-aether-cyan/[0.03] to-transparent pointer-events-none" />

          {/* ── Header ── */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4.5 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" />
              </div>
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">
                存档点
              </h2>
            </div>
            <div className="flex items-center gap-3">
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
            {totalPoints === 0 ? (
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
              /* Dual timeline */
              <div className="px-6 py-6 space-y-10">
                {timelines.map((tl) => (
                  <div key={tl.world}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-5">
                      <div className={`w-2 h-2 rounded-full ${
                        tl.world === '现实' ? 'bg-aether-cyan' : 'bg-aether-purple'
                      } shadow-[0_0_6px_rgba(0,242,255,0.3)]`} />
                      <span className="text-[13px] font-display font-bold tracking-[0.1em] text-white/40 uppercase">
                        {tl.label}
                      </span>
                      <span className="text-[11px] font-mono text-white/15">
                        ({tl.points.length} 节)
                      </span>
                    </div>

                    {tl.points.length === 0 ? (
                      <p className="text-white/10 text-[12px] font-mono tracking-wide pl-4">（暂无记录）</p>
                    ) : (
                      <div className="relative">
                        {/* Timeline spine */}
                        <div className={`absolute left-[29px] top-2 bottom-2 w-[1px] bg-gradient-to-b ${
                          tl.world === '现实'
                            ? 'from-aether-cyan/25 via-aether-cyan/10 to-aether-cyan/5'
                            : 'from-aether-purple/25 via-aether-purple/10 to-aether-purple/5'
                        }`} />

                        <div className="space-y-7">
                          {tl.points.map((sp, i) => (
                            <motion.div
                              key={sp.messageId}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25, ease: 'easeOut' }}
                            >
                              <div
                                onClick={() => {
                                  onJumpToFloor(sp.messageId);
                                  onClose();
                                }}
                                className="w-full text-left group cursor-pointer"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onJumpToFloor(sp.messageId);
                                    onClose();
                                  }
                                }}
                              >
                                <div className="relative pl-14">
                                  {/* Timeline dot */}
                                  <div className={`absolute left-[23px] top-3 w-[13px] h-[13px] rounded-full
                                                  border-2 ${tl.colorClass}
                                                  ${tl.dotGlow}
                                                  transition-all duration-300 z-10`}>
                                    <div className={`absolute inset-[3px] rounded-full transition-colors duration-300 ${
                                      tl.world === '现实'
                                        ? 'bg-aether-cyan/30 group-hover:bg-aether-cyan/50'
                                        : 'bg-aether-purple/30 group-hover:bg-aether-purple/50'
                                    }`} />
                                  </div>

                                  {/* Card */}
                                  <div className="border border-white/[0.05] bg-white/[0.01]
                                                  group-hover:border-aether-cyan/15 group-hover:bg-aether-cyan/[0.02]
                                                  transition-all duration-300 p-7
                                                  shadow-[0_2px_8px_rgba(0,0,0,0.15)] group-hover:shadow-[0_4px_20px_rgba(0,242,255,0.04)]">
                                    {/* ── Title row ── */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <h3 className="text-[18px] font-display font-bold text-white/75
                                                         group-hover:text-aether-cyan transition-colors duration-300
                                                         tracking-[0.06em] leading-snug">
                                            {sp.title || '(无标题)'}
                                          </h3>
                                          {sp.world && (
                                            <span className={`text-[11px] px-2 py-0.5 rounded-sm font-mono tracking-wide shrink-0 ${tl.badgeClass}`}>
                                              {sp.world}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                          <span className="text-[13px] font-mono text-aether-cyan/35">
                                            第 {sp.sequence} 节
                                          </span>
                                          {sp.date && (
                                            <span className="text-[13px] font-mono text-white/20">
                                              {sp.date}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <ChevronRight size={18}
                                        className="text-white/8 group-hover:text-aether-cyan/40 group-hover:translate-x-0.5
                                                   transition-all duration-300 shrink-0 mt-1" />
                                    </div>

                                    {/* ── Meta grid ── */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                                      {sp.location && (
                                        <div className="flex items-center gap-2 text-[13px] text-white/25">
                                          <MapPin size={13} className="text-aether-purple/40 shrink-0" />
                                          <span className="truncate">{sp.location}</span>
                                        </div>
                                      )}
                                      {sp.characters && (
                                        <div className="flex items-center gap-2 text-[13px] text-white/25">
                                          <Users size={13} className="text-aether-blue/40 shrink-0" />
                                          <span className="truncate">{sp.characters}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* ── Description ── */}
                                    {sp.description && (
                                      <p className="text-[14px] text-white/45 leading-relaxed mb-4
                                                    line-clamp-3 font-sans tracking-[0.02em]">
                                        {sp.description}
                                      </p>
                                    )}

                                    {/* ── Key info & Foreshadowing ── */}
                                    {(sp.keyInfo.length > 0 || sp.foreshadowing.length > 0) && (
                                      <div className="space-y-1.5 pt-3 border-t border-white/[0.04]">
                                        {sp.keyInfo.map((item, ki) => (
                                          <div key={`ki-${ki}`} className="flex items-start gap-2 text-[12px]">
                                            <Lightbulb size={12} className="text-aether-gold/50 shrink-0 mt-0.5" />
                                            <span className="text-white/30 font-mono tracking-wide">{item}</span>
                                          </div>
                                        ))}
                                        {sp.foreshadowing.length > 0 && (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedFs(prev => {
                                                  const next = new Set(prev);
                                                  if (next.has(sp.messageId)) next.delete(sp.messageId);
                                                  else next.add(sp.messageId);
                                                  return next;
                                                });
                                              }}
                                              className="flex items-center gap-1.5 text-[12px] text-white/18 hover:text-white/35 transition-colors font-mono tracking-wide"
                                            >
                                              {expandedFs.has(sp.messageId)
                                                ? <ChevronDown size={12} className="text-aether-purple/40" />
                                                : <ChevronRight size={12} className="text-aether-purple/40" />
                                              }
                                              <Eye size={12} className="text-aether-purple/40 shrink-0" />
                                              伏笔 ({sp.foreshadowing.length})
                                            </button>
                                            {expandedFs.has(sp.messageId) && (
                                              <div className="space-y-1 pl-6">
                                                {sp.foreshadowing.map((item, fi) => (
                                                  <div key={`fs-${fi}`} className="flex items-start gap-2 text-[12px]">
                                                    <span className="text-white/20 font-mono tracking-wide italic">{item}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="relative shrink-0 px-6 py-3 border-t border-white/[0.04] bg-white/[0.005]">
            <p className="text-[11px] text-white/12 font-mono text-center tracking-wide">
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
