import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, ChevronLeft, BookOpen } from 'lucide-react';
import type { ChatMessage } from '../../../sillytavern/types';
import AetherModal from '../../shared/AetherModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  userName?: string;
}

const resolve = (s: string, name: string) =>
  name ? s.replace(/\{\{user\}\}/g, name).replace(/<user>/g, name) : s;

interface Chapter {
  id: string;
  title: string;
  maintext: string;
  userInput: string;
  userMsgId: string;
}

export default function PlotReaderModal({ isOpen, onClose, messages, userName = '' }: Props) {
  const chapters: Chapter[] = useMemo(() => {
    const r = (s: string) => resolve(s, userName);
    const result: Chapter[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const maintext = r((m.parsed?.maintext || m.content).trim());
      if (!maintext) continue;
      const title = r(m.parsed?.history?.title || '');
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
  }, [messages, userName]);

  const [page, setPage] = useState(0);
  const [userOpen, setUserOpen] = useState(false);

  // Reset page when opening
  const totalPages = chapters.length;
  const chapter = chapters[page] || null;

  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1));

  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="剧情回顾" zIndex={140}>
      {totalPages === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border border-aether-cyan/10 bg-aether-cyan/[0.03] flex items-center justify-center">
                  <BookOpen size={22} className="text-white/10" />
                </div>
              </div>
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

    </AetherModal>
  );
}
