import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, Send, Square, X } from 'lucide-react';
import ChatHeader from './ChatHeader';
import PlotReaderModal from './PlotReaderModal';
import VariableViewerModal from './VariableViewerModal';
import SavePointModal from './SavePointModal';
import PromptViewerModal from './PromptViewerModal';
import { useSillytavern } from '../../../hooks/useSillytavern';
import { deepResolveMacros } from '../../../sillytavern/prompt-assembler';

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

  // Resolve {{user}}/<user>/{{char}} macros for UI display
  const resolvedVariables = useMemo(() => {
    const vars = ss.activeChat?.variables;
    if (!vars) return undefined;
    return deepResolveMacros(vars, ss.settings?.userName ?? '用户', ss.settings?.characterName ?? 'AI');
  }, [ss.activeChat?.variables, ss.settings?.userName, ss.settings?.characterName]);

  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [varViewerOpen, setVarViewerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [rawViewOpen, setRawViewOpen] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [editedRaw, setEditedRaw] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-create chat
  useEffect(() => {
    if (ss.initialized && !ss.activeChat) {
      ss.createChat('新对话');
    }
  }, [ss.initialized, ss.activeChat]);

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

  // Clean and cap options: strip "N|" prefix, limit to 5
  const savePointCount = useMemo(() => {
    const msgs = ss.activeChat?.messages ?? [];
    return msgs.filter(m => m.role === 'assistant' && m.parsed?.history).length;
  }, [ss.activeChat?.messages]);

  const cleanOption = (raw: string) => raw.replace(/^[^|｜]*[|｜]\s*/, '');
  const rawOptions = isStreaming
    ? ss.streamState.options
    : (latestAssistant?.parsed?.options ?? []);
  const options = useMemo(
    () => rawOptions.map(cleanOption).slice(0, 5),
    [rawOptions]
  );


  /* send */
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    const wasOption = !!text;
    setInput('');
    try {
      const result = await ss.sendGameMessage(msg);
      if (result?.aborted && !wasOption) {
        setInput(result.retractedText ?? msg);
      }
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

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col w-full glass-panel border-glow relative overflow-hidden">
        <ChatHeader
          variables={resolvedVariables}
          messagesCount={savePointCount}
          hasSavePoints={savePointCount > 0}
          onOpenReader={() => setReaderOpen(true)}
          onOpenVariables={() => setVarViewerOpen(true)}
          onOpenSave={() => setSaveOpen(true)}
          onOpenPrompt={() => setPromptOpen(true)}
        />

        {/* ── Streaming indicator ── */}
        {isStreaming && (
          <div className="flex items-center justify-end px-5 py-1.5 border-b border-aether-border/15 shrink-0">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-[10px] text-aether-cyan/60 font-mono"
            >
              AI 生成中...
            </motion.span>
          </div>
        )}

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
            <div className="h-full" />
          ) : (
            /* Main text display */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-[680px] mx-auto"
            >
              <div
                className="text-[15px] text-white/75 leading-[1.9] whitespace-pre-wrap font-sans tracking-[0.03em] select-none"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, visible: true });
                }}
              >
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

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <div className="shrink-0 bg-aether-deep/90">
          <div className="p-3 md:p-4">
            <div className="relative">
              {/* Options panel — absolute positioned above input */}
              <AnimatePresence>
                {optionsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 right-0 bottom-full border-x border-t bg-aether-deep/98 backdrop-blur-xl overflow-hidden border-aether-cyan/30 shadow-[0_0_24px_rgba(0,242,255,0.08)]"
                  >
                    {options.length > 0 ? (
                      options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => { handleSend(opt); setOptionsOpen(false); }}
                          disabled={isStreaming}
                          className="w-full flex items-center gap-2 px-5 py-3 text-left border-b border-white/[0.06] hover:bg-aether-cyan/[0.05] transition-all duration-150 clickable group last:border-b-0 disabled:opacity-40"
                        >
                          <span className="text-[11px] text-aether-cyan/40 font-mono shrink-0">[{i + 1}]</span>
                          <span className="text-[13px] text-white/70 font-display tracking-[0.08em] group-hover:text-aether-cyan transition-colors">
                            {opt}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-5 py-6 text-center text-[12px] text-white/15 font-display tracking-wide">
                        暂无可选行动 — 请自由输入
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toggle bar */}
              <button
                onClick={() => { setOptionsOpen(!optionsOpen); inputRef.current?.focus(); }}
                className={`w-full flex items-center justify-center h-5 transition-all duration-300 clickable border ${
                  optionsOpen
                    ? 'border-aether-cyan/50 shadow-[0_0_24px_rgba(0,242,255,0.1)] bg-aether-deep/98 backdrop-blur-xl text-aether-cyan/60 border-t-white/[0.04] rounded-b-none border-b-transparent'
                    : isFocused
                      ? 'border-aether-cyan/50 shadow-[0_0_24px_rgba(0,242,255,0.1)] bg-aether-cyan/[0.06] text-aether-cyan/60'
                      : options.length > 0
                        ? 'border-aether-cyan/40 bg-aether-cyan/[0.04] text-aether-cyan/50 shadow-[0_0_10px_rgba(0,242,255,0.1)] animate-glow-breathe'
                        : 'border-white/10 bg-aether-glass/40 text-white/25 hover:text-aether-cyan/45 hover:bg-aether-cyan/[0.03] hover:border-white/15 rounded-sm'
                }`}
              >
                <motion.div
                  animate={{ rotate: optionsOpen ? 180 : 0 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                  className="w-2.5 h-2.5 border-r border-b border-current rotate-45"
                />
              </button>

              {/* Input row */}
              <div className={`flex items-center border transition-all duration-300 ${
                (isFocused || optionsOpen)
                  ? 'border-aether-cyan/50 shadow-[0_0_24px_rgba(0,242,255,0.1)]'
                  : 'border-white/10 hover:border-white/15'
              } ${optionsOpen ? 'border-t-aether-cyan/10' : ''}`}>
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
                  className="flex-1 bg-transparent px-5 py-3.5 text-[14px] text-white/75 font-display tracking-[0.06em] placeholder:text-white/20 disabled:opacity-40 focus:outline-none"
                />
                <button
                  onClick={() => isStreaming ? ss.abortStream() : handleSend()}
                  disabled={!isStreaming && !input.trim()}
                  className={`shrink-0 self-stretch px-5 transition-all duration-300 clickable flex items-center ${
                    isStreaming
                      ? 'text-aether-cyan drop-shadow-[0_0_12px_rgba(0,242,255,0.6)]'
                      : (isFocused || optionsOpen)
                        ? 'text-aether-cyan drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]'
                        : 'text-aether-cyan/45'
                  } enabled:hover:text-aether-cyan enabled:hover:bg-aether-cyan/[0.04] enabled:active:scale-95 disabled:opacity-40`}
                  title={isStreaming ? '停止生成' : '发送'}
                >
                  {isStreaming ? (
                    <Square size={16} />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Plot Reader Modal ── */}
      <PlotReaderModal
        isOpen={readerOpen}
        onClose={() => setReaderOpen(false)}
        messages={ss.activeChat?.messages ?? []}
      />

      {/* ── Variable Viewer Modal ── */}
      <VariableViewerModal
        isOpen={varViewerOpen}
        onClose={() => setVarViewerOpen(false)}
        variables={ss.activeChat?.variables ?? {}}
        onSave={(vars) => ss.setChatVariables(vars)}
      />

      {/* ── Save Point Modal ── */}
      <SavePointModal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        messages={ss.activeChat?.messages ?? []}
        onJumpToFloor={(id) => ss.jumpToFloor(id)}
      />

      {/* ── Prompt Viewer Modal ── */}
      <PromptViewerModal
        isOpen={promptOpen}
        onClose={() => setPromptOpen(false)}
        prompt={ss.lastPrompt}
        replyText={latestAssistant?.content}
      />

      {/* ── Context menu ── */}
      <AnimatePresence>
        {ctxMenu.visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCtxMenu({ x: 0, y: 0, visible: false })}
            className="fixed inset-0 z-[130]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12 }}
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              className="absolute glass-panel border border-aether-cyan/30 shadow-[0_0_16px_rgba(0,242,255,0.12)] rounded overflow-hidden"
            >
              <button
                onClick={() => {
                  setCtxMenu({ x: 0, y: 0, visible: false });
                  const content = latestAssistant?.content ?? '';
                  setRawContent(content);
                  setEditedRaw(content);
                  setRawViewOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-[12px] text-white/60 hover:text-aether-cyan hover:bg-aether-cyan/[0.06] transition-all font-display tracking-wide whitespace-nowrap w-full"
              >
                <ChevronRight size={13} />
                查看原文
              </button>
              <button
                onClick={() => {
                  setCtxMenu({ x: 0, y: 0, visible: false });
                  ss.regenerateLast();
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-[12px] text-white/60 hover:text-aether-purple hover:bg-aether-purple/[0.06] transition-all font-display tracking-wide whitespace-nowrap w-full border-t border-aether-border/10"
              >
                <ChevronRight size={13} />
                重 ROLL
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Raw XML View Modal ── */}
      <AnimatePresence>
        {rawViewOpen && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRawViewOpen(false)}
              className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[960px] h-[85vh] glass-panel border-glow overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/40 to-transparent" />
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-aether-border/30 bg-aether-cyan/[0.03] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 bg-aether-cyan rounded-full" />
                  <h3 className="font-display font-bold text-xs tracking-[0.15em] text-aether-cyan uppercase">原始输出</h3>
                </div>
                <button onClick={() => setRawViewOpen(false)} className="text-white/30 hover:text-aether-cyan transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                <textarea
                  value={editedRaw}
                  onChange={(e) => setEditedRaw(e.target.value)}
                  className="flex-1 min-h-[200px] text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed font-mono bg-aether-dark/40 border border-aether-border/15 rounded-lg p-4 resize-none focus:outline-none focus:border-aether-cyan/50 focus:ring-1 focus:ring-aether-cyan/20 transition-all"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/20">点击文本框可直接编辑原始输出</span>
                  <button
                    onClick={async () => {
                      if (!ss.activeChat) return;
                      const msgs = ss.activeChat.messages;
                      const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
                      if (lastAssistant) {
                        await ss.editMessage(lastAssistant.id, editedRaw);
                        setRawViewOpen(false);
                        addNotification?.('已应用', '原文已修改并保存', 'success');
                      }
                    }}
                    disabled={editedRaw === rawContent}
                    className={`px-4 py-2 rounded text-xs font-display tracking-wide transition-all ${
                      editedRaw !== rawContent
                        ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_12px_rgba(0,242,255,0.25)] hover:shadow-[0_0_20px_rgba(0,242,255,0.4)]'
                        : 'bg-white/5 text-white/20 cursor-not-allowed'
                    }`}
                  >
                    应用修改
                  </button>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
