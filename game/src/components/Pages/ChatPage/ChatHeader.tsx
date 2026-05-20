import { useState, useMemo } from 'react';
import { Clock, MapPin, CloudSun, BookOpen, Eye, Hourglass, Moon, Save, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChatMessage } from '../../../sillytavern/types';

interface SavePointEntry {
  messageId: string;
  index: number;
  title: string;
  location: string;
  date: string;
  tags: string[];
}

interface ChatHeaderProps {
  variables?: Record<string, any>;
  messages?: ChatMessage[];
  onOpenReader?: () => void;
  onOpenVariables?: () => void;
  onJumpToFloor?: (messageId: string) => void;
}

function getDisplayData(vars: Record<string, any> | undefined) {
  const world = vars?.世界 ?? {};
  const inDream = world?.梦境定位?.位于梦境 === true;

  const source = inDream ? (world?.梦境存档 ?? {}) : (world?.现实 ?? {});
  const time = source?.时间 || '--';
  const location = source?.地点 || '--';
  const weather = source?.天气 || '--';

  const countdown = inDream
    ? (world?.倒计时?.离开梦境倒计时 || '--')
    : (world?.倒计时?.可进入梦境倒计时 || '--');
  const countdownLabel = inDream ? '离开梦境' : '进入梦境';

  return { time, location, weather, countdown, countdownLabel, inDream };
}

export default function ChatHeader({ variables, messages, onOpenReader, onOpenVariables, onJumpToFloor }: ChatHeaderProps) {
  const display = useMemo(() => getDisplayData(variables), [variables]);
  const [saveOpen, setSaveOpen] = useState(false);

  const savePoints = useMemo<SavePointEntry[]>(() => {
    if (!messages) return [];
    return messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.role === 'assistant' && msg.parsed?.history)
      .map(({ msg, index }) => ({
        messageId: msg.id,
        index,
        title: msg.parsed!.history!.title,
        location: msg.parsed!.history!.location,
        date: msg.parsed!.history!.date,
        tags: msg.parsed!.history!.tags,
      }));
  }, [messages]);

  const hasSavePoints = savePoints.length > 0;

  const iconColor = display.inDream ? 'text-aether-purple/60' : 'text-aether-blue/70';

  return (
    <div className="px-6 py-3.5 border-b border-aether-cyan/20 bg-aether-deep/90 flex items-center shrink-0 shadow-[0_1px_8px_rgba(0,242,255,0.03)] relative">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <Clock size={14} className={iconColor} />
          <span className="font-display text-[14px] text-white/60 tracking-[0.08em]">{display.time}</span>
        </div>
        <div className="w-px h-4 bg-aether-border/50" />
        <div className="flex items-center gap-2">
          <MapPin size={13} className={iconColor} />
          <span className="font-display text-[14px] text-white/65 tracking-[0.08em] max-w-[200px] truncate">{display.location}</span>
        </div>
        <div className="w-px h-4 bg-aether-border/50" />
        <div className="flex items-center gap-2">
          <CloudSun size={14} className={iconColor} />
          <span className="font-display text-[14px] text-white/55 tracking-[0.06em] max-w-[120px] truncate">{display.weather}</span>
        </div>
      </div>

      {/* Center: countdown */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        {display.inDream
          ? <Moon size={13} className="text-aether-purple/60" />
          : <Hourglass size={13} className="text-white/25" />
        }
        <span className="font-display text-[13px] text-white/35 tracking-[0.06em] whitespace-nowrap">
          {display.countdownLabel} {display.countdown}
        </span>
      </div>

      <div className="flex-1" />

      {/* Save button + dropdown */}
      {onJumpToFloor && (
        <div className="relative">
          <button
            onClick={() => setSaveOpen(!saveOpen)}
            className={`relative group flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors ${
              saveOpen
                ? 'text-aether-cyan bg-aether-cyan/[0.08]'
                : hasSavePoints
                  ? 'text-aether-cyan/70 hover:text-aether-cyan hover:bg-aether-cyan/[0.04]'
                  : 'text-white/25 hover:text-white/45 hover:bg-white/[0.02]'
            }`}
          >
            <Save size={17} />
            {hasSavePoints && (
              <span className="text-[10px] font-mono text-aether-cyan/40">{savePoints.length}</span>
            )}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              存档
            </span>
          </button>

          <AnimatePresence>
            {saveOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="fixed inset-0 z-[110]"
                  onClick={() => setSaveOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute right-0 top-full mt-2 w-[340px] max-h-[420px] overflow-y-auto
                             glass-panel border border-aether-cyan/20 shadow-[0_0_24px_rgba(0,0,0,0.4)]
                             bg-aether-deep/98 backdrop-blur-xl z-[115]"
                >
                  <div className="px-4 py-3 border-b border-aether-cyan/15 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3 bg-aether-cyan rounded-full shadow-[0_0_4px_rgba(0,242,255,0.3)]" />
                      <h3 className="font-display text-[11px] tracking-[0.12em] text-aether-cyan/70">存档点</h3>
                    </div>
                    <span className="text-[9px] font-mono text-white/20">{savePoints.length} 个记录</span>
                  </div>

                  {hasSavePoints ? (
                    <div className="py-1">
                      {savePoints.map((sp, i) => (
                        <button
                          key={sp.messageId}
                          onClick={() => {
                            onJumpToFloor(sp.messageId);
                            setSaveOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-aether-cyan/[0.04] transition-colors
                                     border-b border-white/[0.03] last:border-b-0 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-display font-bold text-white/70 group-hover:text-aether-cyan transition-colors truncate">
                                  {sp.title || '(无标题)'}
                                </span>
                                <span className="text-[9px] font-mono text-white/15 shrink-0">
                                  第{sp.index + 1}回合
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {sp.date && (
                                  <span className="text-[10px] text-white/25 font-mono">{sp.date}</span>
                                )}
                                {sp.location && (
                                  <span className="text-[10px] text-white/20 truncate max-w-[140px]">📍 {sp.location}</span>
                                )}
                              </div>
                              {sp.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {sp.tags.slice(0, 6).map((tag, ti) => (
                                    <span
                                      key={ti}
                                      className="text-[8px] px-1.5 py-0.5 bg-aether-cyan/[0.06] border border-aether-cyan/10 text-aether-cyan/45 font-mono"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <ChevronRight size={14} className="text-white/10 group-hover:text-aether-cyan/40 transition-colors shrink-0 mt-1" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <p className="text-[11px] text-white/15 font-display tracking-wide">暂无存档点</p>
                      <p className="text-[9px] text-white/8 font-mono mt-1">AI 将在剧情关键节点自动生成</p>
                    </div>
                  )}

                  <div className="px-4 py-2 border-t border-white/[0.04] bg-white/[0.01]">
                    <p className="text-[9px] text-white/15 font-mono leading-relaxed">
                      存档点由 AI 通过 <code className="text-aether-cyan/30">{'<history>'}</code> 标签自动生成，点击即可跳转并回溯变量
                    </p>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Variable viewer button */}
      {onOpenVariables && (
        <button
          onClick={onOpenVariables}
          className="relative group flex items-center gap-2 px-3 py-1.5 rounded-sm text-white/35 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.04]"
        >
          <Eye size={17} />
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            变量
          </span>
        </button>
      )}

      {/* Plot reader button */}
      {onOpenReader && (
        <button
          onClick={onOpenReader}
          className="relative group flex items-center gap-2 px-3 py-1.5 rounded-sm text-white/50 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.06]"
        >
          <BookOpen size={17} />
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            阅读
          </span>
        </button>
      )}
    </div>
  );
}
