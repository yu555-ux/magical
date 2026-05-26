import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import type { ChatMessage } from '../../../sillytavern/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}

interface Chapter {
  id: string;
  title: string;
  maintext: string;
  userInput: string;
  userMsgId: string;
}

export default function PlotReaderModal({ isOpen, onClose, messages }: Props) {
  const chapters: Chapter[] = useMemo(() => {
    const result: Chapter[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const maintext = (m.parsed?.maintext || m.content).trim();
      if (!maintext) continue;
      const title = m.parsed?.history?.title || '';
      // Find preceding user message
      let userInput = '';
      let userMsgId = '';
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === 'user') {
          userInput = messages[j].content.trim();
          userMsgId = messages[j].id;
          break;
        }
      }
      result.push({ id: m.id, title, maintext, userInput, userMsgId });
    }
    return result;
  }, [messages]);

  const [page, setPage] = useState(0);
  const [userOpen, setUserOpen] = useState(false);

  // Reset page when opening
  const totalPages = chapters.length;
  const chapter = chapters[page] || null;

  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1));

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
          className="absolute inset-0 bg-aether-dark/92 backdrop-blur-xl"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[720px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
        >
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />
          <div className="absolute top-0 left-0 right-0 h-[40px] bg-gradient-to-b from-aether-cyan/[0.03] to-transparent pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4.5 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" />
              </div>
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">
                剧情回顾
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/20 hover:text-aether-cyan transition-colors p-1.5 clickable press-scale hover:bg-aether-cyan/[0.06] rounded"
            >
              <X size={17} />
            </button>
          </div>

          {/* Body */}
          {totalPages === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/15 text-sm font-display tracking-wide">暂无剧情记录</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Page nav top */}
              <div className="flex items-center justify-between px-8 py-4 shrink-0 border-b border-aether-cyan/[0.06]">
                <button
                  onClick={goPrev}
                  disabled={page === 0}
                  className="flex items-center gap-1.5 text-[13px] text-white/25 hover:text-aether-cyan disabled:text-white/6 disabled:cursor-default transition-colors font-display tracking-wider"
                >
                  <ChevronLeft size={16} />
                  上一节
                </button>
                <span className="text-[12px] font-mono text-aether-cyan/30 tracking-wider">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={goNext}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1.5 text-[13px] text-white/25 hover:text-aether-cyan disabled:text-white/6 disabled:cursor-default transition-colors font-display tracking-wider"
                >
                  下一节
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Reading area */}
              <div className="flex-1 overflow-y-auto px-10 pb-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={chapter?.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    {/* Chapter title */}
                    {chapter?.title && (
                      <h3 className="text-[22px] font-display font-bold text-white/80 tracking-[0.08em] leading-snug mb-8 text-center">
                        {chapter.title}
                      </h3>
                    )}

                    {/* Maintext body */}
                    <div className="text-[16px] text-white/70 leading-[2.1] whitespace-pre-wrap font-sans tracking-[0.03em]">
                      {chapter?.maintext}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* User input toggle at bottom */}
              {chapter?.userInput && (
                <div className="shrink-0 border-t border-aether-cyan/[0.08] px-8 py-3.5 bg-aether-cyan/[0.01]">
                  <button
                    onClick={() => setUserOpen(!userOpen)}
                    className="flex items-center gap-1.5 text-[12px] text-white/18 hover:text-white/35 transition-colors font-display tracking-wide"
                  >
                    {userOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    玩家发言
                  </button>
                  <AnimatePresence>
                    {userOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-3 text-[14px] text-white/35 leading-relaxed whitespace-pre-wrap bg-aether-dark/30 border border-aether-cyan/[0.06] rounded px-4 py-3">
                          {chapter.userInput}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Bottom decorative line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent z-10" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
