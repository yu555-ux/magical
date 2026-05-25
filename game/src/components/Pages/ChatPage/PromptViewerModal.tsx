import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, ChevronDown, ChevronRight, MessageSquare, User, Bot } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prompt: {
    messages: Array<{ role: string; content: string }>;
    estimatedTokens: number;
    stageTokens: Record<string, number>;
    stageMessages: Record<string, Array<{ role: string; content: string }>>;
  } | null;
  replyText?: string;
}

// ── Stage config ──

const STAGE_ORDER = [
  'worldInfoBefore', 'main', 'worldInfoAfter',
  'charDescription', 'charPersonality', 'scenario', 'personaDescription',
  'systemBlocks', 'userBlocks', 'assistantBlocks', 'enhanceDefinitions',
  'chatHistory', 'postHistory', 'userInput',
] as const;

const STAGE_LABELS: Record<string, string> = {
  worldInfoBefore: '角色定义之前 (worldInfoBefore)',
  main: '主提示词 (main)',
  worldInfoAfter: '角色定义之后 (worldInfoAfter)',
  charDescription: '角色描述 (charDescription)',
  charPersonality: '角色性格 (charPersonality)',
  scenario: '场景设定 (scenario)',
  personaDescription: '玩家设定 (personaDescription)',
  systemBlocks: '系统提示块',
  userBlocks: '用户提示块',
  assistantBlocks: 'AI 提示块',
  enhanceDefinitions: '增强定义 (enhanceDefinitions)',
  chatHistory: '对话历史 (chatHistory)',
  postHistory: '后置内容',
  userInput: '用户输入',
};

const STAGE_BORDER: Record<string, string> = {
  worldInfoBefore: 'border-l-aether-purple/30',
  worldInfoAfter: 'border-l-aether-purple/30',
  main: 'border-l-aether-cyan/40',
  charDescription: 'border-l-aether-blue/25',
  charPersonality: 'border-l-aether-blue/25',
  scenario: 'border-l-aether-blue/25',
  personaDescription: 'border-l-aether-green/25',
  chatHistory: 'border-l-aether-cyan/25',
  userInput: 'border-l-aether-cyan/35',
};

// ── Role icon ──

function RoleIcon({ role }: { role: string }) {
  const cls = 'shrink-0 mt-0.5';
  switch (role) {
    case 'system': return <Bot size={12} className={`${cls} text-aether-cyan/30`} />;
    case 'user': return <User size={12} className={`${cls} text-aether-green/35`} />;
    case 'assistant': return <MessageSquare size={12} className={`${cls} text-aether-blue/35`} />;
    default: return <MessageSquare size={12} className={`${cls} text-white/15`} />;
  }
}

// ── Token bar ──

function TokenBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 90 ? 'bg-aether-red/50' : pct > 70 ? 'bg-aether-yellow/40' : 'bg-aether-cyan/40';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-aether-dark/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-white/20 font-mono">{used} / {total} tk</span>
    </div>
  );
}

// ── Stage card ──

function StageCard({
  name, label, msgs, defaultOpen,
}: {
  name: (typeof STAGE_ORDER)[number]; label: string; msgs: Array<{ role: string; content: string }>; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tokens = msgs.reduce((s, m) => s + Math.round(m.content.length / 4), 0);
  const border = STAGE_BORDER[name] || 'border-l-white/8';

  return (
    <div className={`rounded border border-aether-border/8 bg-aether-dark/20 border-l-2 ${border}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-aether-cyan/[0.02] transition-colors text-left"
      >
        {open ? <ChevronDown size={11} className="text-white/20 shrink-0" /> : <ChevronRight size={11} className="text-white/12 shrink-0" />}
        <span className="text-[11px] font-display font-semibold tracking-wide text-white/45 flex-1">{label}</span>
        <span className="text-[9px] text-white/15 font-mono">{msgs.length} msg</span>
        <span className={`text-[9px] font-mono w-12 text-right ${tokens > 500 ? 'text-aether-yellow/45' : 'text-white/20'}`}>
          ~{tokens} tk
        </span>
      </button>
      {open && (
        <div className="border-t border-aether-border/5">
          {msgs.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 border-b border-aether-border/3 last:border-b-0">
              <RoleIcon role={msg.role} />
              <pre className="text-[10px] text-white/45 leading-relaxed font-mono whitespace-pre-wrap flex-1 max-h-[200px] overflow-y-auto">
                {msg.content}
              </pre>
              <span className="text-[7px] text-white/10 font-mono shrink-0 mt-0.5">
                {Math.round(msg.content.length / 4)} tk
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──

export default function PromptViewerModal({ isOpen, onClose, prompt, replyText }: Props) {
  const replyTokens = replyText ? Math.round(replyText.length / 4) : 0;
  const promptTokens = prompt?.estimatedTokens ?? 0;
  const maxContext = 2000000;
  const budget = maxContext - 64000;

  // Active stages from stageMessages
  const stageMsgMap = prompt?.stageMessages || {};
  const activeStages = STAGE_ORDER.filter(s => stageMsgMap[s] && stageMsgMap[s].length > 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-aether-dark/92 backdrop-blur-xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[860px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
                     shadow-[0_0_80px_rgba(0,242,255,0.04),0_0_160px_rgba(0,0,0,0.6)]"
        >
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/50 to-transparent z-10" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 py-3.5 border-b border-aether-cyan/15 bg-aether-cyan/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
              <FileText size={18} className="text-aether-cyan/80" />
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">发送给 AI 的提示词</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-aether-cyan/40">
                {promptTokens} + {replyTokens} = {promptTokens + replyTokens} tk
              </span>
              <button onClick={onClose} className="text-white/20 hover:text-aether-cyan transition-colors p-1.5 clickable hover:bg-aether-cyan/[0.06] rounded">
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!prompt ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText size={36} className="text-white/8 mb-3" />
                <p className="text-white/20 text-xs font-display tracking-wide">暂无请求数据</p>
              </div>
            ) : (
              <>
                {/* Token budget */}
                <div className="rounded border border-aether-border/10 bg-aether-dark/25 px-3 py-2.5">
                  <TokenBar used={promptTokens + replyTokens} total={budget} />
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {activeStages.map(s => (
                      <span key={s} className="text-[9px] text-white/15 font-mono">
                        {STAGE_LABELS[s]?.split(' (')[0] || s}: {prompt?.stageTokens?.[s] || 0}tk
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pipeline flow */}
                <div className="flex items-center gap-1 overflow-x-auto py-1.5 px-1 text-[9px] font-mono text-white/12 no-scrollbar">
                  {activeStages.map((s, i) => (
                    <span key={s} className="flex items-center gap-1 shrink-0">
                      <span>{STAGE_LABELS[s]?.split(' (')[0] || s}</span>
                      {i < activeStages.length - 1 && <span>→</span>}
                    </span>
                  ))}
                </div>

                {/* Stage cards */}
                <div className="space-y-1.5">
                  {activeStages.map(s => (
                    <div key={s}>
                      <StageCard
                        name={s}
                        label={STAGE_LABELS[s] || s}
                        msgs={stageMsgMap[s]}
                        defaultOpen={s === 'main' || s === 'chatHistory' || s === 'userInput'}
                      />
                    </div>
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
