import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, ChevronDown, ChevronRight, User, Bot, RefreshCw } from 'lucide-react';

type PromptData = {
  estimatedTokens: number;
  stageTokens: Record<string, number>;
  stageMessages: Record<string, Array<{ role: string; content: string }>>;
  stageOrder: string[];
  stageNames: Record<string, string>;
} | null;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  prompt: PromptData;
  secondaryPrompt?: PromptData;
  replyText?: string;
}

function RoleIcon({ role }: { role: string }) {
  const cls = 'shrink-0 mt-0.5';
  switch (role) {
    case 'user': return <User size={11} className={`${cls} text-aether-green/35`} />;
    case 'assistant': return <Bot size={11} className={`${cls} text-aether-blue/35`} />;
    default: return <Bot size={11} className={`${cls} text-aether-cyan/25`} />;
  }
}

export default function PromptViewerModal({ isOpen, onClose, onRefresh, prompt, secondaryPrompt, replyText }: Props) {
  const replyTokens = replyText ? Math.round(replyText.length / 4) : 0;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'primary' | 'secondary'>('primary');

  const toggle = (id: string) => setCollapsed(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  if (!isOpen) return null;

  const active = view === 'secondary' && secondaryPrompt ? secondaryPrompt : prompt;
  const promptTokens = active?.estimatedTokens ?? 0;
  const order = active?.stageOrder ?? [];
  const msgs = active?.stageMessages ?? {};
  const tokens = active?.stageTokens ?? {};
  const names = active?.stageNames ?? {};
  const hasSecondary = !!secondaryPrompt;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-aether-dark/92 backdrop-blur-xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[780px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
                     shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
        >
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />
          <div className="absolute top-0 left-0 right-0 h-[40px] bg-gradient-to-b from-aether-cyan/[0.03] to-transparent pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4.5 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)] ${
                  view === 'secondary' ? 'bg-amber-400' : 'bg-aether-cyan'
                }`} />
                <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-20 ${
                  view === 'secondary' ? 'bg-amber-400' : 'bg-aether-cyan'
                }`} />
              </div>
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">
                {view === 'secondary' ? '第二API 变量预设' : '发送给 AI 的提示词'}
              </h2>
              {hasSecondary && (
                <div className="flex items-center gap-0.5 ml-2">
                  <button
                    onClick={() => setView('primary')}
                    className={`px-2 py-0.5 text-[10px] font-display tracking-wide border transition-all ${
                      view === 'primary'
                        ? 'border-aether-cyan/40 bg-aether-cyan/10 text-aether-cyan'
                        : 'border-white/10 text-white/25 hover:text-white/45'
                    }`}
                  >第一API</button>
                  <button
                    onClick={() => setView('secondary')}
                    className={`px-2 py-0.5 text-[10px] font-display tracking-wide border transition-all ${
                      view === 'secondary'
                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                        : 'border-white/10 text-white/25 hover:text-white/45'
                    }`}
                  >第二API</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-aether-cyan/40">
                ~{promptTokens}<span className="text-white/20"> tk</span>
                {view === 'primary' && replyTokens > 0 && (
                  <span> +{replyTokens}<span className="text-white/20">(回复)</span></span>
                )}
              </span>
              {onRefresh && (
                <button onClick={onRefresh} className="text-white/15 hover:text-aether-cyan transition-colors p-1 clickable rounded" title="刷新提示词">
                  <RefreshCw size={14} />
                </button>
              )}
              <button onClick={onClose} className="text-white/15 hover:text-aether-cyan transition-colors p-1 clickable rounded">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!active ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText size={36} className="text-white/8 mb-3" />
                <p className="text-white/20 text-xs font-display">
                  {view === 'secondary' ? '未激活变量预设或暂无数据' : '暂无请求数据'}
                </p>
              </div>
            ) : (
              <>
                {/* Block cards — in send order */}
                <div className="space-y-1">
                  {order.map((id) => {
                    const blockMsgs = msgs[id];
                    if (!blockMsgs || blockMsgs.length === 0) return null;
                    const isOpen = !collapsed.has(id);
                    const isHistory = /^chathistory$/i.test(id);

                    return (
                      <div key={id}
                        className={`rounded border border-aether-border/8 bg-aether-dark/20 border-l-2 ${
                          isHistory ? 'border-l-aether-cyan/25' :
                          view === 'secondary' ? 'border-l-amber-400/25' :
                          'border-l-aether-purple/25'
                        }`}>
                        <button
                          onClick={() => toggle(id)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-aether-cyan/[0.02] transition-colors text-left"
                        >
                          {isOpen ? <ChevronDown size={10} className="text-white/18" /> : <ChevronRight size={10} className="text-white/10" />}
                          <span className="text-[10px] font-display font-semibold tracking-wide text-white/40 flex-1 truncate">
                            {names[id] || id}
                          </span>
                          <span className="text-[8px] text-white/12 font-mono">{blockMsgs.length} msg</span>
                          <span className={`text-[8px] font-mono w-10 text-right ${(tokens[id] || 0) > 500 ? 'text-aether-yellow/40' : 'text-white/15'}`}>
                            ~{tokens[id] || 0} tk
                          </span>
                        </button>
                        {isOpen && (
                          <div className="border-t border-aether-border/5">
                            {blockMsgs.map((msg, j) => (
                              <div key={j} className="flex items-start gap-2 px-3 py-2 border-b border-aether-border/3 last:border-b-0">
                                <RoleIcon role={msg.role} />
                                <pre className="text-[10px] text-white/40 leading-relaxed font-mono whitespace-pre-wrap flex-1 max-h-[160px] overflow-y-auto">
                                  {msg.content}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
