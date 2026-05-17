import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { formatFullLabel, isSameDay, distanceMinutes } from './types';
import type { ChatMessage, DisplayItem } from './types';
import { useSillytavern } from '../../../hooks/useSillytavern';

export default function ChatPage({
  addNotification,
}: {
  addNotification?: (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success',
  ) => void;
}) {
  const ss = useSillytavern();
  const [input, setInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location] = useState('新东京枢纽');
  const [weather] = useState({ icon: '晴', temp: 22, humidity: 45 });
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-create a chat if none active
  useEffect(() => {
    if (ss.initialized && !ss.activeChat) {
      ss.createChat('新对话');
    }
  }, [ss.initialized, ss.activeChat]);

  /* live clock */
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* auto-scroll */
  const isStreaming = ss.streamState.isStreaming;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ss.activeChat?.messages, isStreaming]);

  // Map SillyTavern messages to display format
  const displayItems: DisplayItem[] = useMemo(() => {
    const msgs = ss.activeChat?.messages ?? [];
    if (msgs.length === 0) return [];

    const items: DisplayItem[] = [];
    let displayIdx = 0;

    for (let i = 0; i < msgs.length; i++) {
      const stMsg = msgs[i];
      // Convert SillyTavern message to ChatMessage for display
      const displayContent = stMsg.role === 'assistant'
        ? (stMsg.parsed?.maintext || stMsg.content)
        : stMsg.content;

      const chatMsg: ChatMessage = {
        role: stMsg.role as 'user' | 'assistant',
        content: displayContent,
        timestamp: new Date(stMsg.timestamp),
      };

      if (i > 0) {
        const prevTs = new Date(msgs[i - 1].timestamp);
        const currTs = new Date(stMsg.timestamp);
        if (!isSameDay(prevTs, currTs) || distanceMinutes(prevTs, currTs) > 5) {
          items.push({ type: 'sep', label: formatFullLabel(currTs), date: currTs });
        }
      }

      items.push({ type: 'msg', msg: chatMsg, idx: displayIdx++ });
    }

    return items;
  }, [ss.activeChat?.messages]);

  // Extract latest assistant's thinking from SillyTavern message
  const latestAssistant = useMemo(() => {
    const msgs = ss.activeChat?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') return msgs[i];
    }
    return null;
  }, [ss.activeChat?.messages]);

  const thinking = isStreaming ? ss.streamState.thinking : (latestAssistant?.parsed?.thinking ?? '');
  const aiOptions = isStreaming ? ss.streamState.options : (latestAssistant?.parsed?.options ?? []);

  /* send */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    try {
      await ss.sendGameMessage(text);
      addNotification?.('AI 回复', '系统已生成新的剧情内容。', 'info');
    } catch (err) {
      addNotification?.('发送失败', String(err), 'error');
    }
  }, [input, isStreaming, ss, addNotification]);

  /* copy */
  const handleCopy = useCallback(async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  /* keyboard */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col w-full glass-panel border-glow relative overflow-hidden">
        {/* HUD corner brackets */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-aether-cyan/30 pointer-events-none z-20" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-aether-cyan/30 pointer-events-none z-20" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-aether-cyan/20 pointer-events-none z-20" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-aether-cyan/20 pointer-events-none z-20" />

        <ChatHeader
          currentTime={currentTime}
          location={location}
          weather={weather}
        />

        {/* Thinking fold */}
        {thinking && (
          <div className="px-4 md:px-6 pt-2">
            <button
              onClick={() => setThinkingOpen(!thinkingOpen)}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 transition-colors font-display tracking-wide"
            >
              {thinkingOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              思考过程
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-aether-cyan/50 ml-1"
                >
                  ●
                </motion.span>
              )}
            </button>
            <AnimatePresence>
              {thinkingOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <pre className="mt-2 text-[12px] text-white/35 whitespace-pre-wrap font-sans leading-relaxed bg-aether-dark/40 border border-aether-border/15 rounded p-3">
                    {thinking}
                    {isStreaming && <span className="st-cursor text-aether-cyan">▍</span>}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <MessageList
          displayItems={displayItems}
          isTyping={isStreaming}
          copiedIdx={copiedIdx}
          onCopy={handleCopy}
          messagesEndRef={messagesEndRef}
        />

        <InputArea
          input={input}
          setInput={setInput}
          isTyping={isStreaming}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          optionsOpen={optionsOpen}
          setOptionsOpen={setOptionsOpen}
          inputRef={inputRef}
          aiOptions={aiOptions}
        />
      </div>
    </div>
  );
}
