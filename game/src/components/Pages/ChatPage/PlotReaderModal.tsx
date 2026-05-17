import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, ChevronDown, ChevronRight, User, Bot } from 'lucide-react';
import type { ChatMessage } from '../../../sillytavern/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}

interface PlotEntry {
  id: string;
  timestamp: number;
  role: 'user' | 'assistant';
  content: string;
}

export default function PlotReaderModal({ isOpen, onClose, messages }: Props) {
  // Extract plot: user messages + assistant maintext only
  const entries: PlotEntry[] = useMemo(() => {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        const content =
          m.role === 'assistant'
            ? (m.parsed?.maintext || m.content)
            : m.content;
        return {
          id: m.id,
          timestamp: m.timestamp,
          role: m.role as 'user' | 'assistant',
          content: content.trim(),
        };
      })
      .filter((e) => e.content.length > 0);
  }, [messages]);

  // User entries start collapsed
  const [collapsedUsers, setCollapsedUsers] = useState<Set<string>>(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.role === 'user') set.add(e.id);
    });
    return set;
  });

  const toggleCollapse = (id: string) => {
    setCollapsedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[800px] max-h-[85vh] glass-panel border-glow overflow-hidden flex flex-col"
        >
          {/* Decorative top line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/40 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-aether-border/30 bg-aether-cyan/[0.03] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-30" />
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-aether-cyan" />
                <h2 className="font-display font-bold text-sm tracking-[0.2em] text-aether-cyan uppercase">
                  剧情回顾
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/20 font-mono">{entries.length} 幕</span>
              <button
                onClick={onClose}
                className="text-white/30 hover:text-aether-cyan transition-colors p-1.5 clickable press-scale"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BookOpen size={40} className="text-white/10 mb-4" />
                <p className="text-white/20 text-sm font-display tracking-wide">暂无剧情记录</p>
                <p className="text-white/10 text-xs mt-1">开始对话后，剧情将在此展示</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-[1px] bg-gradient-to-b from-aether-cyan/30 via-aether-border/20 to-aether-cyan/10" />

                <div className="space-y-6">
                  {entries.map((entry, idx) => {
                    const isUser = entry.role === 'user';
                    const isCollapsed = collapsedUsers.has(entry.id);
                    const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                        className="relative pl-12"
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-[14px] top-1.5 w-[11px] h-[11px] rounded-full border-2 ${
                            isUser
                              ? 'bg-aether-dark border-aether-blue/40'
                              : 'bg-aether-dark border-aether-cyan/50 shadow-[0_0_8px_rgba(0,242,255,0.15)]'
                          }`}
                        >
                          {!isUser && (
                            <div className="absolute inset-0 rounded-full bg-aether-cyan/20 animate-pulse" />
                          )}
                        </div>

                        {/* Role + time */}
                        <div className="flex items-center gap-2 mb-2">
                          {isUser ? (
                            <User size={12} className="text-aether-blue/60" />
                          ) : (
                            <Bot size={12} className="text-aether-cyan/60" />
                          )}
                          <span className={`text-[10px] font-mono tracking-wide ${isUser ? 'text-aether-blue/50' : 'text-aether-cyan/50'}`}>
                            {isUser ? '玩家' : '剧情'}
                          </span>
                          <span className="text-[10px] text-white/15 font-mono">{time}</span>
                          {idx === 0 && (
                            <span className="text-[9px] bg-aether-cyan/10 text-aether-cyan/40 px-1.5 py-0.5 rounded-full font-mono">起始</span>
                          )}
                        </div>

                        {/* Content */}
                        <div className={`relative ${isUser ? '' : ''}`}>
                          {isUser ? (
                            <div>
                              <button
                                onClick={() => toggleCollapse(entry.id)}
                                className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/45 transition-colors font-display tracking-wide"
                              >
                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                玩家发言
                              </button>
                              <AnimatePresence>
                                {!isCollapsed && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <p className="mt-2 text-[13px] text-white/45 leading-relaxed whitespace-pre-wrap bg-aether-dark/30 border border-aether-border/10 rounded p-3">
                                      {entry.content}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <p className="text-[14px] text-white/75 leading-[1.8] whitespace-pre-wrap font-sans tracking-[0.02em]">
                              {entry.content}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Decorative bottom line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
