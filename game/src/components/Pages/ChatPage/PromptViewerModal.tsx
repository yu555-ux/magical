import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, ChevronDown, ChevronRight, User, Bot } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prompt: {
    estimatedTokens: number;
    stageTokens: Record<string, number>;
    stageMessages: Record<string, Array<{ role: string; content: string }>>;
    stageOrder: string[];
    stageNames: Record<string, string>;
  } | null;
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

function TokenBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 90 ? 'bg-aether-red/50' : pct > 70 ? 'bg-aether-yellow/40' : 'bg-aether-cyan/40';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-aether-dark/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-white/20 font-mono">{used}/{total} tk</span>
    </div>
  );
}

export default function PromptViewerModal({ isOpen, onClose, prompt, replyText }: Props) {
  const replyTokens = replyText ? Math.round(replyText.length / 4) : 0;
  const promptTokens = prompt?.estimatedTokens ?? 0;
  const budget = 2000000 - 64000;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setCollapsed(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  if (!isOpen) return null;

  const order = prompt?.stageOrder ?? [];
  const msgs = prompt?.stageMessages ?? {};
  const tokens = prompt?.stageTokens ?? {};
  const names = prompt?.stageNames ?? {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-aether-dark/92 backdrop-blur-xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[860px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
                     shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
        >
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 bg-aether-cyan rounded-full shadow-[0_0_6px_rgba(0,242,255,0.5)]" />
              <FileText size={16} className="text-aether-cyan/80" />
              <h2 className="font-display font-black text-xs tracking-[0.15em] text-aether-cyan/90 uppercase">发送给 AI 的提示词</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-aether-cyan/40">{promptTokens}+{replyTokens}={promptTokens+replyTokens} tk</span>
              <button onClick={onClose} className="text-white/15 hover:text-aether-cyan transition-colors p-1 clickable rounded">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!prompt ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText size={36} className="text-white/8 mb-3" />
                <p className="text-white/20 text-xs font-display">暂无请求数据</p>
              </div>
            ) : (
              <>
                {/* Token bar */}
                <div className="rounded border border-aether-border/10 bg-aether-dark/25 px-3 py-2.5">
                  <TokenBar used={promptTokens + replyTokens} total={budget} />
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {order.map(id => {
                      const tk = tokens[id] || 0;
                      if (!tk) return null;
                      const displayName = names[id] || id;
                      return <span key={id} className="text-[9px] text-white/15 font-mono">{displayName}: {tk}tk</span>;
                    })}
                  </div>
                </div>

                {/* Block cards — in send order */}
                <div className="space-y-1">
                  {order.map((id, i) => {
                    const blockMsgs = msgs[id];
                    if (!blockMsgs || blockMsgs.length === 0) return null;
                    const tk = tokens[id] || 0;
                    const isOpen = !collapsed.has(id);
                    const isHistory = id.toLowerCase().includes('chathistory');
                    const isUserInput = id === 'userInput';

                    return (
                      <div key={id}
                        className={`rounded border border-aether-border/8 bg-aether-dark/20 border-l-2 ${
                          isUserInput ? 'border-l-aether-cyan/35' :
                          isHistory ? 'border-l-aether-cyan/25' :
                          'border-l-aether-purple/25'
                        }`}>
                        <button
                          onClick={() => toggle(id)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-aether-cyan/[0.02] transition-colors text-left"
                        >
                          {isOpen ? <ChevronDown size={10} className="text-white/18" /> : <ChevronRight size={10} className="text-white/10" />}
                          <span className="text-[10px] font-display font-semibold tracking-wide text-white/40 flex-1 truncate">
                            {i + 1}. {names[id] || id}
                          </span>
                          <span className="text-[8px] text-white/12 font-mono">{blockMsgs.length} msg</span>
                          <span className={`text-[8px] font-mono w-10 text-right ${tk > 500 ? 'text-aether-yellow/40' : 'text-white/15'}`}>
                            ~{tk} tk
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
                                <span className="text-[7px] text-white/10 font-mono shrink-0 mt-0.5">
                                  {Math.round(msg.content.length / 4)}tk
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Send order summary */}
                <div className="flex items-center gap-1 overflow-x-auto text-[9px] font-mono text-white/10 py-1 no-scrollbar">
                  {order.filter(id => msgs[id]?.length > 0).map((id, i, arr) => (
                    <span key={id} className="flex items-center gap-1 shrink-0">
                      <span className="text-white/20">{names[id] || id}</span>
                      {i < arr.length - 1 && <span>→</span>}
                    </span>
                  ))}
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
