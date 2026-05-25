import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, EyeOff, CheckCircle2, Circle, Layers, BookOpen, ChevronDown, ChevronRight, MessageSquare, User, Bot } from 'lucide-react';
import type { PromptSection } from '../../../sillytavern/prompt-assembler';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prompt: {
    messages: Array<{ role: string; content: string }>;
    systemPrompt: string;
    sections: PromptSection[];
    estimatedTokens: number;
    stageTokens: Record<string, number>;
  } | null;
  replyText?: string;
}

// ── Stage display config ──

const STAGE_ORDER = [
  'worldInfoBefore', 'main', 'worldInfoAfter',
  'charDescription', 'charPersonality', 'scenario', 'personaDescription',
  'systemBlocks', 'userBlocks', 'assistantBlocks', 'enhanceDefinitions',
  'chatHistory', 'postHistory', 'userInput',
] as const;

const STAGE_LABELS: Record<string, string> = {
  worldInfoBefore: '世界书（角色前）',
  main: '主提示词',
  worldInfoAfter: '世界书（角色后）',
  charDescription: '角色描述',
  charPersonality: '角色性格',
  scenario: '场景设定',
  personaDescription: '玩家设定',
  systemBlocks: '系统提示块',
  userBlocks: '用户提示块',
  assistantBlocks: 'AI 提示块',
  enhanceDefinitions: '增强定义',
  chatHistory: '对话历史',
  postHistory: '后置内容',
  userInput: '用户输入',
};

const STAGE_COLORS: Record<string, string> = {
  worldInfoBefore: 'border-l-aether-purple/40',
  worldInfoAfter: 'border-l-aether-purple/40',
  main: 'border-l-aether-cyan/50',
  charDescription: 'border-l-aether-blue/30',
  charPersonality: 'border-l-aether-blue/30',
  scenario: 'border-l-aether-blue/30',
  personaDescription: 'border-l-aether-green/30',
  systemBlocks: 'border-l-white/15',
  userBlocks: 'border-l-aether-green/20',
  assistantBlocks: 'border-l-aether-blue/20',
  enhanceDefinitions: 'border-l-white/10',
  chatHistory: 'border-l-aether-cyan/30',
  postHistory: 'border-l-white/10',
  userInput: 'border-l-aether-cyan/40',
};

const SOURCE_ICONS: Record<string, any> = {
  preset: Layers,
  lorebook: BookOpen,
  chat: FileText,
};

const SOURCE_LABELS: Record<string, string> = {
  preset: '预设',
  lorebook: '世界书',
  chat: '对话',
};

const ROLE_ICONS: Record<string, any> = {
  system: Bot,
  user: User,
  assistant: MessageSquare,
};

const ROLE_COLORS: Record<string, string> = {
  system: 'text-aether-cyan/40',
  user: 'text-aether-green/45',
  assistant: 'text-aether-blue/40',
};

// ── Token bar ──

function TokenBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const barColor = pct > 80 ? 'bg-aether-red/60' : pct > 60 ? 'bg-aether-yellow/50' : 'bg-aether-cyan/50';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/20 font-mono w-10 text-right shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-aether-dark/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-white/25 font-mono w-16 text-right shrink-0">{used}/{total} tk</span>
      {pct > 80 && <span className="text-[8px] text-aether-red/60 font-mono">⚠️</span>}
    </div>
  );
}

// ── Pipeline flow ──

function PipelineFlow({ activeStages }: { activeStages: string[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-1 text-[9px] font-mono text-white/15 no-scrollbar">
      {STAGE_ORDER.filter(s => activeStages.includes(s)).map((stage, i, arr) => (
        <span key={stage} className="flex items-center gap-1 shrink-0">
          <span className={activeStages.includes(stage) ? 'text-white/35' : 'text-white/10'}>
            {STAGE_LABELS[stage] || stage}
          </span>
          {i < arr.length - 1 && <span className="text-white/8">→</span>}
        </span>
      ))}
    </div>
  );
}

// ── Main component ──

export default function PromptViewerModal({ isOpen, onClose, prompt, replyText }: Props) {
  const replyTokens = replyText ? Math.round(replyText.length / 4) : 0;
  const promptTokens = prompt?.estimatedTokens ?? 0;

  // Max context from preset or default
  const maxContext = 2000000;
  const maxOutput = 64000;
  const budget = maxContext - maxOutput;

  // Build stage→sections mapping
  const stageSections = new Map<string, PromptSection[]>();
  if (prompt?.sections) {
    for (const sec of prompt.sections) {
      const stage = sec.stage || 'systemBlocks';
      if (!stageSections.has(stage)) stageSections.set(stage, []);
      stageSections.get(stage)!.push(sec);
    }
  }

  // Build stage→messages mapping
  // Messages are in pipeline stage order; assign each message to the stage
  // whose sections appear at or before its position
  const stageMessages = new Map<string, Array<{ role: string; content: string }>>();
  if (prompt?.messages) {
    const msgList = prompt.messages;
    let msgIdx = 0;

    for (const stageName of STAGE_ORDER) {
      const msgs: Array<{ role: string; content: string }> = [];
      const secs = stageSections.get(stageName) || [];

      if (stageName === 'chatHistory') {
        // Consume all non-system messages that aren't the last user message
        while (msgIdx < msgList.length && msgList[msgIdx].role !== 'system') {
          const m = msgList[msgIdx];
          // If this is a user message and it's the last one in the array, it's userInput
          const remainingNonSystem = msgList.slice(msgIdx + 1).filter(x => x.role !== 'system').length;
          if (m.role === 'user' && remainingNonSystem === 0) break;
          msgs.push(m);
          msgIdx++;
        }
        if (msgs.length > 0) stageMessages.set(stageName, msgs);
        continue;
      }

      if (stageName === 'userInput') {
        if (msgIdx < msgList.length) {
          msgs.push(msgList[msgIdx]);
          stageMessages.set(stageName, msgs);
        }
        continue;
      }

      // System stages: consume consecutive system messages
      while (msgIdx < msgList.length && msgList[msgIdx].role === 'system') {
        msgs.push(msgList[msgIdx]);
        msgIdx++;
      }
      if (msgs.length > 0 || secs.length > 0) {
        stageMessages.set(stageName, msgs);
      }
    }
  }

  // Compute per-stage token totals
  const stageTokenTotals = new Map<string, number>();
  for (const [stage, msgs] of stageMessages) {
    const t = msgs.reduce((s, m) => s + Math.round(m.content.length / 4), 0);
    stageTokenTotals.set(stage, t);
  }

  // Active stages (have content)
  const activeStages = STAGE_ORDER.filter(s => {
    const msgs = stageMessages.get(s);
    const secs = stageSections.get(s);
    return (msgs && msgs.length > 0) || (secs && secs.length > 0);
  });

  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());

  const toggleCollapse = (stage: string) => {
    setCollapsedStages(prev => {
      const s = new Set(prev);
      s.has(stage) ? s.delete(stage) : s.add(stage);
      return s;
    });
  };

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
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" />
              </div>
              <FileText size={18} className="text-aether-cyan/80" />
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">发送给 AI 的提示词</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-aether-cyan/40">
                {activeStages.length} stages · {promptTokens} + {replyTokens} = {promptTokens + replyTokens} tk
              </span>
              <button onClick={onClose} className="text-white/20 hover:text-aether-cyan transition-colors p-1.5 clickable hover:bg-aether-cyan/[0.06] rounded">
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!prompt ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText size={36} className="text-white/8 mb-3" />
                <p className="text-white/20 text-xs font-display tracking-wide">暂无请求数据</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* ── Token budget bar ── */}
                <div className="rounded-lg border border-aether-border/10 bg-aether-dark/30 p-3 space-y-2">
                  <TokenBar used={promptTokens + replyTokens} total={budget} label="总用量" />
                  <div className="flex gap-3 text-[9px] font-mono text-white/15">
                    {prompt?.stageTokens && Object.entries(prompt.stageTokens).filter(([, t]) => t > 0).slice(0, 6).map(([name, tokens]) => (
                      <span key={name}>{STAGE_LABELS[name] || name}: {tokens}tk</span>
                    ))}
                    {(Object.entries(prompt?.stageTokens || {}).filter(([, t]) => t > 0).length > 6) && (
                      <span className="text-white/8">...</span>
                    )}
                  </div>
                </div>

                {/* ── Pipeline flow ── */}
                <div className="rounded-lg border border-aether-border/10 bg-aether-dark/20 px-3 overflow-hidden">
                  <PipelineFlow activeStages={activeStages} />
                </div>

                {/* ── Stages ── */}
                <div className="space-y-1.5">
                  {activeStages.map(stageName => {
                    const secs = stageSections.get(stageName) || [];
                    const msgs = stageMessages.get(stageName) || [];
                    const stageTokens = stageTokenTotals.get(stageName) || 0;
                    const isCollapsed = collapsedStages.has(stageName);
                    const colorClass = STAGE_COLORS[stageName] || 'border-l-white/10';
                    const allDisabled = secs.length > 0 && secs.every(s => !s.enabled);

                    return (
                      <div key={stageName}
                        className={`rounded-lg border border-aether-border/10 bg-aether-dark/25 overflow-hidden border-l-2 ${colorClass} ${
                          allDisabled ? 'opacity-30' : ''
                        }`}>
                        {/* Stage header */}
                        <button
                          onClick={() => toggleCollapse(stageName)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-aether-cyan/[0.02] transition-colors text-left"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={11} className="text-white/15 shrink-0" />
                          ) : (
                            <ChevronDown size={11} className="text-white/25 shrink-0" />
                          )}
                          <span className="text-[11px] font-display font-semibold tracking-wide text-white/50 flex-1">
                            {STAGE_LABELS[stageName] || stageName}
                          </span>
                          {stageTokens > 0 && (
                            <span className={`text-[9px] font-mono shrink-0 ${
                              stageTokens > 1000 ? 'text-aether-red/45' : stageTokens > 250 ? 'text-aether-yellow/45' : 'text-white/20'
                            }`}>
                              ~{stageTokens} tk
                            </span>
                          )}
                          <span className="text-[8px] text-white/12 font-mono shrink-0">{msgs.length} msg</span>
                        </button>

                        {/* Stage body */}
                        <AnimatePresence initial={false}>
                          {!isCollapsed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden border-t border-aether-border/6"
                            >
                              {/* Section list */}
                              {secs.map((section, i) => {
                                const SourceIcon = SOURCE_ICONS[section.source] || Layers;
                                const hasContent = section.content && section.content.trim().length > 0;
                                return (
                                  <div key={`${section.identifier}-${i}`}
                                    className={`border-b border-aether-border/4 last:border-b-0 ${
                                      !section.enabled ? 'opacity-30' : ''
                                    }`}>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-aether-dark/15">
                                      {section.enabled ? (
                                        <CheckCircle2 size={10} className="text-aether-green/40 shrink-0" />
                                      ) : (
                                        <Circle size={10} className="text-white/8 shrink-0" />
                                      )}
                                      <span className={`text-[10px] font-display truncate flex-1 ${
                                        section.enabled && hasContent ? 'text-white/40' : 'text-white/15'
                                      }`}>
                                        {section.name}
                                      </span>
                                      <span className="text-[7px] text-white/12 font-mono uppercase">{section.role}</span>
                                      <span className={`flex items-center gap-0.5 text-[7px] font-mono px-1 py-0.5 rounded ${
                                        section.source === 'lorebook' ? 'bg-aether-purple/10 text-aether-purple/50' :
                                        section.source === 'chat' ? 'bg-aether-blue/10 text-aether-blue/50' :
                                        'bg-aether-cyan/10 text-aether-cyan/50'
                                      }`}>
                                        <SourceIcon size={8} />
                                        {SOURCE_LABELS[section.source]}
                                      </span>
                                      {hasContent ? (
                                        <span className="text-[7px] text-white/12 font-mono">~{section.tokens || Math.round(section.content!.length / 4)} tk</span>
                                      ) : section.enabled ? (
                                        <span className="flex items-center gap-0.5 text-[7px] text-white/10 font-mono"><EyeOff size={8} /> 未匹配</span>
                                      ) : null}
                                    </div>
                                    {hasContent && (
                                      <pre className="px-3 py-1.5 text-[10px] text-white/40 whitespace-pre-wrap leading-relaxed font-mono max-h-[100px] overflow-y-auto">
                                        {section.content}
                                      </pre>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Message preview */}
                              {msgs.length > 0 && (
                                <div className="px-3 py-2 space-y-1 bg-aether-dark/10">
                                  {msgs.slice(0, stageName === 'chatHistory' ? 20 : 5).map((msg, i) => {
                                    const RoleIcon = ROLE_ICONS[msg.role] || MessageSquare;
                                    return (
                                      <div key={i} className="flex items-start gap-1.5">
                                        <RoleIcon size={12} className={`shrink-0 mt-0.5 ${ROLE_COLORS[msg.role] || 'text-white/20'}`} />
                                        <pre className="text-[10px] text-white/35 leading-relaxed font-mono line-clamp-3 flex-1">
                                          {msg.content.slice(0, 300)}{msg.content.length > 300 ? '...' : ''}
                                        </pre>
                                        <span className="text-[7px] text-white/10 font-mono shrink-0 mt-0.5">
                                          {Math.round(msg.content.length / 4)}tk
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {msgs.length > 20 && stageName === 'chatHistory' && (
                                    <p className="text-[9px] text-white/12 text-center py-1">
                                      ... 还有 {msgs.length - 20} 条消息
                                    </p>
                                  )}
                                  {msgs.length > 5 && stageName !== 'chatHistory' && (
                                    <p className="text-[9px] text-white/12 text-center py-1">
                                      ... 还有 {msgs.length - 5} 条消息
                                    </p>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
