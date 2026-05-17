import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu } from 'lucide-react';
import MessageBubble from './MessageBubble';
import type { DisplayItem } from './types';

interface MessageListProps {
  displayItems: DisplayItem[];
  isTyping: boolean;
  copiedIdx: number | null;
  onCopy: (content: string, idx: number) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function MessageList({
  displayItems,
  isTyping,
  copiedIdx,
  onCopy,
  messagesEndRef,
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth bg-aether-dark/30">
      {displayItems.length === 0 && !isTyping ? (
        /* ---------- EMPTY STATE ---------- */
        <div className="h-full flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center space-y-8 max-w-sm"
          >
            {/* logo rings */}
            <div className="relative inline-flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
                className="absolute w-28 h-28 border border-aether-cyan/[0.08]"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                className="absolute w-20 h-20 border border-aether-cyan/[0.18]"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute w-12 h-12 border border-dashed border-aether-cyan/[0.12]"
              />
              <div className="w-20 h-20 border border-aether-cyan/30 rotate-45 flex items-center justify-center bg-aether-dark/40 backdrop-blur-sm shadow-[0_0_40px_rgba(0,242,255,0.06)]">
                <Cpu size={36} className="-rotate-45 text-aether-cyan/80" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-3xl font-black text-aether-cyan tracking-[0.12em] drop-shadow-[0_0_16px_rgba(0,242,255,0.2)]">
                以太链接
              </h2>
              <p className="text-[13px] text-aether-blue/40 font-mono tracking-[0.2em]">
                :: 神经链接待激活 ::
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
              <div className="w-1 h-1 rotate-45 border border-aether-cyan/20" />
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
            </div>

            <p className="text-[13px] text-white/20 leading-[1.8] font-sans tracking-wide max-w-xs">
              输入指令以建立神经链接。系统将为您提供实时环境分析、战术支持和情报检索服务。
            </p>

            <motion.div
              animate={{ opacity: [0.25, 0.7, 0.25] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center justify-center gap-2.5 text-[10px] text-aether-blue/35 font-mono tracking-[0.12em]"
            >
              <span className="w-1 h-1 bg-aether-cyan/40 rounded-full" />
              等待指令输入...
            </motion.div>
          </motion.div>
        </div>
      ) : (
        /* ---------- MESSAGE LIST ---------- */
        <div className="space-y-1">
          {displayItems.map((item) => {
            if (item.type === 'sep') {
              return (
                <div
                  key={`sep-${item.date.getTime()}`}
                  className="flex items-center gap-4 py-5"
                >
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-border/15 to-transparent" />
                  <div className="flex items-center gap-2 text-[9px] text-white/15 font-mono tracking-[0.15em]">
                    <div className="w-1 h-1 rotate-45 border border-white/20" />
                    {item.label}
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-aether-border/15 to-transparent" />
                </div>
              );
            }

            return (
              <MessageBubble
                key={`msg-${item.idx}-${item.msg.timestamp.getTime()}`}
                msg={item.msg}
                idx={item.idx}
                copiedIdx={copiedIdx}
                onCopy={onCopy}
              />
            );
          })}

          {/* ---------- TYPING INDICATOR ---------- */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="flex justify-start mb-3"
              >
                <div
                  className="border border-aether-cyan/15 bg-aether-cyan/[0.03] px-5 py-3.5 flex items-center gap-2"
                  style={{ borderRadius: '2px 12px 12px 12px' }}
                >
                  <motion.div
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: 0 }}
                    className="w-1.5 h-1.5 rounded-full bg-aether-cyan/50"
                  />
                  <motion.div
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: 0.18 }}
                    className="w-1.5 h-1.5 rounded-full bg-aether-cyan/50"
                  />
                  <motion.div
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: 0.36 }}
                    className="w-1.5 h-1.5 rounded-full bg-aether-cyan/50"
                  />
                  <span className="ml-2 text-[11px] text-white/25 font-sans tracking-wide">
                    正在输入...
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
