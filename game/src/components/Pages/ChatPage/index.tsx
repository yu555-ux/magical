import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, Clock, X } from 'lucide-react';
import ChatHeader from './ChatHeader';
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
  const [isFocused, setIsFocused] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location] = useState('新东京枢纽');
  const [weather] = useState({ icon: '晴', temp: 22, humidity: 45 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-create chat
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

  // Latest assistant message & parsed data
  const latestAssistant = useMemo(() => {
    const msgs = ss.activeChat?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') return msgs[i];
    }
    return null;
  }, [ss.activeChat?.messages]);

  const thinking = isStreaming
    ? ss.streamState.thinking
    : (latestAssistant?.parsed?.thinking ?? '');
  const maintext = isStreaming
    ? ss.streamState.maintext
    : (latestAssistant?.parsed?.maintext ?? latestAssistant?.content ?? '');
  const options = isStreaming
    ? ss.streamState.options
    : (latestAssistant?.parsed?.options ?? []);

  // History messages (all messages before latest assistant, not including user either)
  const historyMessages = useMemo(() => {
    const msgs = ss.activeChat?.messages ?? [];
    if (msgs.length <= 1) return [];
    return msgs.slice(0, -1).filter(m => m.role !== 'system');
  }, [ss.activeChat?.messages]);

  /* send */
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    setInput('');
    try {
      await ss.sendGameMessage(msg);
    } catch (err) {
      addNotification?.('发送失败', String(err), 'error');
    }
  }, [input, isStreaming, ss, addNotification]);

  /* keyboard */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const msgCount = ss.activeChat?.messages?.length ?? 0;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col w-full glass-panel border-glow relative overflow-hidden">
        {/* HUD corner brackets */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-aether-cyan/30 pointer-events-none z-20" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-aether-cyan/30 pointer-events-none z-20" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-aether-cyan/20 pointer-events-none z-20" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-aether-cyan/20 pointer-events-none z-20" />

        <ChatHeader currentTime={currentTime} location={location} weather={weather} />

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 px-5 py-2 border-b border-aether-border/15 shrink-0">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-aether-cyan transition-colors font-display tracking-wide"
          >
            <Clock size={13} /> 历史 ({msgCount})
          </button>
          <span className="flex-1" />
          {isStreaming && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-[10px] text-aether-cyan/60 font-mono"
            >
              AI 生成中...
            </motion.span>
          )}
        </div>

        {/* ── Thinking fold ── */}
        {thinking && (
          <div className="px-5 pt-3">
            <button
              onClick={() => setThinkingOpen(!thinkingOpen)}
              className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/45 transition-colors font-display tracking-wide"
            >
              {thinkingOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              思考过程
              {isStreaming && (
                <span className="w-1.5 h-1.5 rounded-full bg-aether-cyan/60 animate-pulse ml-1" />
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
                  <pre className="mt-2 text-[11px] text-white/30 whitespace-pre-wrap leading-relaxed bg-aether-dark/30 border border-aether-border/10 rounded p-3 font-sans max-h-40 overflow-y-auto">
                    {thinking}
                    {isStreaming && <span className="text-aether-cyan animate-pulse">▍</span>}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Main text pane ── */}
        <div className="flex-1 overflow-y-auto px-5 md:px-10 py-6">
          {!maintext && !isStreaming ? (
            /* Empty state */
            <div className="h-full flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-8 max-w-sm"
              >
                <div className="relative inline-flex items-center justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }} className="absolute w-28 h-28 border border-aether-cyan/[0.08]" />
                  <motion.div animate={{ rotate: -360 }} transition={{ duration: 16, repeat: Infinity, ease: 'linear' }} className="absolute w-20 h-20 border border-aether-cyan/[0.18]" />
                  <div className="w-20 h-20 border border-aether-cyan/30 rotate-45 flex items-center justify-center bg-aether-dark/40 shadow-[0_0_40px_rgba(0,242,255,0.06)]">
                    <span className="-rotate-45 font-display text-lg font-black text-aether-cyan/50 tracking-widest">AE</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="font-display text-3xl font-black text-aether-cyan tracking-[0.12em] drop-shadow-[0_0_16px_rgba(0,242,255,0.2)]">
                    以太链接
                  </h2>
                  <p className="text-[13px] text-white/20 font-mono tracking-[0.15em]">
                    :: 输入指令开始探索 ::
                  </p>
                </div>
              </motion.div>
            </div>
          ) : (
            /* Main text display */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-[680px] mx-auto"
            >
              <div className="text-[15px] text-white/75 leading-[1.9] whitespace-pre-wrap font-sans tracking-[0.03em]">
                {maintext}
                {isStreaming && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="text-aether-cyan"
                  >
                    ▍
                  </motion.span>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Options ── */}
          {options.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[680px] mx-auto mt-6 space-y-2"
            >
              {options.map((opt, i) => (
                <button
                  key={i}
                  disabled={isStreaming}
                  onClick={() => handleSend(opt)}
                  className="w-full text-left px-4 py-3 rounded border border-aether-border/20 bg-aether-dark/40 hover:border-aether-cyan/40 hover:bg-aether-cyan/[0.04] transition-all text-[14px] text-white/60 hover:text-white/85 font-display tracking-wide disabled:opacity-30 disabled:cursor-not-allowed group"
                >
                  <span className="text-aether-cyan/50 font-mono text-[11px] mr-2 group-hover:text-aether-cyan/80 transition-colors">
                    [{i + 1}]
                  </span>
                  {opt}
                </button>
              ))}
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 bg-aether-deep/90 border-t border-aether-border/15">
          <div className="p-3 md:p-4 flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="输入行动推进剧情..."
              disabled={isStreaming}
              className={`flex-1 bg-transparent px-4 py-2.5 text-[14px] text-white/75 font-display tracking-[0.06em] placeholder:text-white/20 disabled:opacity-40 focus:outline-none border transition-all ${
                isFocused
                  ? 'border-aether-cyan/40 shadow-[0_0_12px_rgba(0,242,255,0.06)]'
                  : 'border-white/10 hover:border-white/15'
              }`}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 px-5 py-2.5 bg-aether-cyan/15 border border-aether-cyan/30 text-aether-cyan font-display text-xs tracking-widest hover:bg-aether-cyan/25 hover:shadow-[0_0_16px_rgba(0,242,255,0.2)] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* ── History Drawer ── */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHistoryOpen(false)}
            className="fixed inset-0 z-[120] bg-aether-dark/80 backdrop-blur-sm"
          >
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-0 bottom-0 w-[340px] glass-panel border-r border-aether-border/30 overflow-y-auto"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-aether-border/20">
                <h3 className="font-display font-bold text-xs text-aether-cyan tracking-[0.15em] uppercase">对话历史</h3>
                <button onClick={() => setHistoryOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-3 space-y-1">
                {historyMessages.length === 0 ? (
                  <p className="text-center text-white/15 text-xs py-12">暂无历史记录</p>
                ) : (
                  historyMessages.map((m, i) => (
                    <div key={m.id} className="border-b border-white/[0.04] pb-2 mb-2 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] text-white/20 font-mono">#{i + 1}</span>
                        <span className={`text-[10px] font-mono ${m.role === 'user' ? 'text-aether-blue/50' : 'text-aether-purple/50'}`}>
                          {m.role === 'user' ? '▲ 玩家' : '▼ AI'}
                        </span>
                        <span className="text-[9px] text-white/15 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/35 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                        {m.parsed?.maintext || m.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
