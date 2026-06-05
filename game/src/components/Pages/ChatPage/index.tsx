import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, Send, Square } from 'lucide-react';
import ChatHeader from './ChatHeader';
import PlotReaderModal from './PlotReaderModal';
import VariableViewerModal from './VariableViewerModal';
import SavePointModal from './SavePointModal';
import PromptViewerModal from './PromptViewerModal';
import { useSS } from '../../../hooks/SillytavernContext';
import { deepResolveMacros } from '../../../sillytavern/prompt-assembler';
import { DEFAULT_SETTINGS } from '../../../sillytavern/types';
import { cleanOption } from '../../../utils/string';
import RichTextRenderer from '../../Settings/RichTextRenderer';
import RawXmlViewerModal from './RawXmlViewerModal';
import VariableDiffModal from './VariableDiffModal';
import { showTopCenter } from '../../shared/TopCenterToast';
import ContextMenu from './ContextMenu';
import ShopBanner from './ShopBanner';
import ShopModal from './ShopModal';
import { checkShopAvailability, getLiuSanniangFavorability } from '../../../sillytavern/shop-engine';
import { useKeyboardAware, scrollToBottomSmooth } from '../../../hooks/useKeyboardAware';

export default function ChatPage({
  addNotification,
  diffOpen,
  setDiffOpen,
  openVariableDiff,
}: {
  addNotification?: (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success',
    onClick?: () => void,
  ) => void;
  diffOpen: boolean;
  setDiffOpen: (v: boolean) => void;
  openVariableDiff: () => void;
}) {
  const ss = useSS();

  // Resolve {{user}}/<user>/{{char}} macros for UI display
  const resolvedVariables = useMemo(() => {
    const vars = ss.activeChat?.variables;
    if (!vars) return undefined;
    return deepResolveMacros(vars, ss.settings?.userName ?? DEFAULT_SETTINGS.userName, ss.settings?.characterName ?? DEFAULT_SETTINGS.characterName);
  }, [ss.activeChat?.variables, ss.settings?.userName, ss.settings?.characterName]);

  const shopAvailable = useMemo(() => {
    const vars = ss.activeChat?.variables;
    if (!vars) return false;
    return checkShopAvailability(vars);
  }, [ss.activeChat?.variables]);

  const shopFavorability = useMemo(() => {
    const vars = ss.activeChat?.variables;
    if (!vars) return 0;
    return getLiuSanniangFavorability(vars);
  }, [ss.activeChat?.variables]);

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
  const [shopOpen, setShopOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isKeyboardOpen } = useKeyboardAware();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isDualApi = ss.settings?.apiMode === 'dual' && ss.settings?.api?.secondary?.enabled;

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

  /* Keyboard-aware scroll — when keyboard opens, keep messages visible */
  useEffect(() => {
    if (isKeyboardOpen && messagesAreaRef.current) {
      // Delay slightly for keyboard animation to settle
      const t = setTimeout(() => {
        scrollToBottomSmooth(messagesAreaRef.current!);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [isKeyboardOpen]);

  // Latest assistant message & parsed data
  const latestAssistant = useMemo(() => {
    const msgs = ss.activeChat?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') return msgs[i];
    }
    return null;
  }, [ss.activeChat?.messages, ss.jumpVersion]);

  const latestVarChanges = latestAssistant?.varChanges;

  const thinking = isStreaming
    ? ss.streamState.thinking
    : (latestAssistant?.parsed?.thinking ?? '');
  // 优先流式内容（结束后仍保留），其次已保存的助理消息
  const rawMaintext = ss.streamState.maintext
    || latestAssistant?.parsed?.maintext
    || latestAssistant?.content
    || '';
  // 实时解析 {{user}} / <user> 宏（不在消息中烘焙，改名即时生效）
  const displayName = ss.settings?.userName || '你';
  const maintext = useMemo(
    () => rawMaintext.replace(/\{\{user\}\}/g, displayName).replace(/<user>/g, displayName),
    [rawMaintext, displayName],
  );

  // 优先流式选项（结束后仍保留），其次已保存消息
  const rawOptions = ss.streamState.options.length > 0
    ? ss.streamState.options
    : (latestAssistant?.parsed?.options ?? []);
  const options = useMemo(
    () => rawOptions.map(cleanOption).filter(o => o.trim()).slice(0, 5),
    [rawOptions]
  );


  /* send */
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming || ss.dualRunning) return;
    const wasOption = !!text;
    setInput('');
    try {
      const result = await ss.sendGameMessage(msg);
      if (result?.aborted && !wasOption) {
        setInput(result.retractedText ?? msg);
      }
      if (result?.formatError) {
        // 格式错误时始终恢复输入（含选项），并通知玩家
        setInput(result.retractedText ?? msg);
        showTopCenter('AI 回复缺少必要标签，请重试', 'warning');
      }
      if (result?.varsUpdated) {
        addNotification?.('变量已更新', `第二API已更新 ${result.patchCount ?? 0} 项变量`, 'success', openVariableDiff);

        // 从变量变更中检测好感度变化
        const affectionChanges = result.varChanges?.filter(
          c => c.path.endsWith('好感值') && c.category === 'numeric'
        ) ?? [];
        for (const c of affectionChanges) {
          const segs = c.path.split('.');
          const idx = segs.indexOf('好感值');
          const name = idx > 0 ? segs[idx - 1] : '角色';
          const dir = (c.delta ?? 0) > 0 ? '+' : '';
          addNotification?.('好感度变化', `${name}好感度${dir}${c.delta}（${c.oldValue}→${c.newValue}）`, 'success');
        }

        // 受精事件通知
        if (result.fertilizationEvents?.length) {
          for (const ev of result.fertilizationEvents) {
            addNotification?.('受孕', `${ev.name}已受孕，父方${ev.father}`, 'success');
          }
        }
      }
    } catch (err) {
      // API 网络错误等 → 恢复输入框
      setInput(msg);
      showTopCenter(String(err), 'error');
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
          dreamAnchor={ss.activeChat?.dreamAnchor}
          onOpenReader={() => setReaderOpen(true)}
          onOpenVariables={() => setVarViewerOpen(true)}
          onOpenSave={() => setSaveOpen(true)}
          onOpenPrompt={() => setPromptOpen(true)}
        />

        {/* ── Streaming indicator ── */}
        {isStreaming && (
          <div className="flex items-center justify-end px-3 md:px-5 py-1.5 border-b border-aether-border/15 shrink-0">
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
          <div className="px-3 md:px-5 pt-2 md:pt-3">
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
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Main text pane ── */}
        <div ref={messagesAreaRef} className="flex-1 overflow-y-auto chat-scroll-area px-3 md:px-10 py-4 md:py-6">
          {!maintext && !isStreaming ? (
            <div className="h-full" />
          ) : (
            /* Main text display */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ maxWidth: `${ss.settings?.messageWidthPercent ?? DEFAULT_SETTINGS.messageWidthPercent}%` }}
              className="mx-auto w-full md:w-auto"
            >
              <div
                className="text-[15px] text-white/75 leading-[1.9] whitespace-pre-wrap font-sans tracking-[0.03em] select-none"
                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, visible: true });
                }}
                onTouchStart={(e) => {
                  if (!isMobile) return;
                  e.preventDefault(); // 阻止文字选择
                  longPressTimer.current = setTimeout(() => {
                    const touch = e.touches[0];
                    setCtxMenu({ x: touch.clientX, y: touch.clientY, visible: true });
                  }, 600);
                }}
                onTouchMove={() => {
                  if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault(); // 阻止文字选择
                  if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                }}
              >
                <RichTextRenderer text={maintext} config={ss.settings?.richTextConfig} />
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <div className="shrink-0 bg-aether-deep/90 sticky bottom-0 z-20">
          <div className="p-2 md:p-4">
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
                          className="w-full flex items-center gap-2 px-3 md:px-5 py-3 text-left border-b border-white/[0.06] hover:bg-aether-cyan/[0.05] transition-all duration-150 clickable group last:border-b-0 disabled:opacity-40"
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
                onClick={() => setOptionsOpen(!optionsOpen)}
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
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  className="flex-1 bg-transparent px-3 md:px-5 py-3 md:py-3.5 text-[14px] md:text-[14px] text-white/75 font-display tracking-[0.06em] placeholder:text-white/20 disabled:opacity-40 focus:outline-none chat-input-nozoom"
                />
                <button
                  onClick={() => {
                    if (isStreaming) ss.abortStream();
                    else if (ss.dualRunning) ss.abortDual();
                    else handleSend();
                  }}
                  disabled={!isStreaming && !ss.dualRunning && !input.trim()}
                  className={`shrink-0 self-stretch px-3 md:px-5 transition-all duration-300 clickable flex items-center ${
                    isStreaming || ss.dualRunning
                      ? 'text-aether-cyan drop-shadow-[0_0_12px_rgba(0,242,255,0.6)]'
                      : (isFocused || optionsOpen)
                        ? 'text-aether-cyan drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]'
                        : 'text-aether-cyan/45'
                  } enabled:hover:text-aether-cyan enabled:hover:bg-aether-cyan/[0.04] enabled:active:scale-95 disabled:opacity-40`}
                  title={isStreaming ? '停止生成' : ss.dualRunning ? '停止变量提取' : '发送'}
                >
                  {isStreaming || ss.dualRunning ? (
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

      {/* ── Shop bubble (fixed position, draggable) ── */}
      <ShopBanner
        visible={shopAvailable}
        favorability={shopFavorability}
        onOpenShop={() => setShopOpen(true)}
      />

      {/* ── Plot Reader Modal ── */}
      <PlotReaderModal
        isOpen={readerOpen}
        onClose={() => setReaderOpen(false)}
        messages={ss.activeChat?.messages ?? []}
        userName={ss.settings?.userName || '你'}
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
        isBusy={isStreaming || ss.dualRunning}
        userName={ss.settings?.userName || '你'}
      />

      {/* ── Variable Diff Modal ── */}
      <VariableDiffModal
        isOpen={diffOpen}
        onClose={() => setDiffOpen(false)}
        changes={latestVarChanges ?? []}
      />

      {/* ── Prompt Viewer Modal ── */}
      <PromptViewerModal
        isOpen={promptOpen}
        onClose={() => setPromptOpen(false)}
        onRefresh={() => ss.refreshPrompt(input || undefined)}
        prompt={ss.lastPrompt}
        secondaryPrompt={ss.lastSecondaryPrompt}
        replyText={latestAssistant?.content}
      />

      {/* ── Context menu ── */}
      <ContextMenu
        ctxMenu={ctxMenu}
        onClose={() => setCtxMenu({ x: 0, y: 0, visible: false })}
        onViewRaw={() => {
          const content = ss.lastRawContent || latestAssistant?.content || '';
          setRawContent(content);
          setEditedRaw(content);
          setRawViewOpen(true);
        }}
        onRegenerate={() => ss.regenerateLast()}
        onRegenerateVars={() => ss.regenerateVarsOnly()}
        isDualApi={isDualApi}
      />

      {/* ── Shop Modal ── */}
      <ShopModal
        isOpen={shopOpen}
        onClose={() => setShopOpen(false)}
        onNotify={(msg, type) => showTopCenter(msg, type === 'success' ? 'success' : 'error')}
      />

      {/* ── Raw XML View Modal ── */}
      <RawXmlViewerModal
        isOpen={rawViewOpen}
        onClose={() => setRawViewOpen(false)}
        content={rawContent}
        edited={editedRaw}
        onEditedChange={setEditedRaw}
        dirty={editedRaw !== rawContent}
        onApply={async () => {
          if (!ss.activeChat) return;
          const msgs = ss.activeChat.messages;
          const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
          if (lastAssistant) {
            await ss.editMessage(lastAssistant.id, editedRaw);
            setRawViewOpen(false);
            showTopCenter('原文已修改并保存', 'success');
          }
        }}
      />

    </div>
  );
}
