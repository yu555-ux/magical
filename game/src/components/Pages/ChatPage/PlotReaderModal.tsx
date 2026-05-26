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
          className="absolute inset-0 bg-[#0a0a0f]/95 backdrop-blur-md"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[720px] max-h-[88vh] bg-[#0d0d14] border border-white/[0.06] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)]"
        >
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/30 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-aether-cyan/60 rounded-full" />
              <h2 className="font-display font-bold text-sm tracking-[0.2em] text-aether-cyan/70 uppercase">
                剧情回顾
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/20 hover:text-aether-cyan transition-colors p-1.5"
            >
              <X size={18} />
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
              <div className="flex items-center justify-between px-8 py-4 shrink-0">
                <button
                  onClick={goPrev}
                  disabled={page === 0}
                  className="flex items-center gap-1 text-[13px] text-white/30 hover:text-aether-cyan disabled:text-white/8 disabled:cursor-default transition-colors font-display tracking-wider"
                >
                  <ChevronLeft size={15} />
                  上一节
                </button>
                <span className="text-[12px] font-mono text-white/15 tracking-wider">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={goNext}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 text-[13px] text-white/30 hover:text-aether-cyan disabled:text-white/8 disabled:cursor-default transition-colors font-display tracking-wider"
                >
                  下一节
                  <ChevronRight size={15} />
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
                <div className="shrink-0 border-t border-white/[0.04] px-8 py-3">
                  <button
                    onClick={() => setUserOpen(!userOpen)}
                    className="flex items-center gap-1.5 text-[12px] text-white/20 hover:text-white/35 transition-colors font-display tracking-wide"
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
                        <p className="mt-3 text-[14px] text-white/35 leading-relaxed whitespace-pre-wrap bg-white/[0.02] border border-white/[0.04] rounded px-4 py-3">
                          {chapter.userInput}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Bottom accent */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
