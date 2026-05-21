import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, EyeOff, CheckCircle2, Circle, Database, Layers } from 'lucide-react';
import type { PromptSection } from '../../../sillytavern/prompt-assembler';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prompt: {
    messages: Array<{ role: string; content: string }>;
    systemPrompt: string;
    sections: PromptSection[];
    estimatedTokens: number;
  } | null;
  replyText?: string;
}

const sourceIcons: Record<string, any> = {
  preset: Layers,
  variables: Database,
  chat: FileText,
};

const sourceLabels: Record<string, string> = {
  preset: '预设',
  variables: '变量',
  chat: '对话',
};

export default function PromptViewerModal({ isOpen, onClose, prompt, replyText }: Props) {
  const replyTokens = replyText ? Math.round(replyText.length / 4) : 0;
  const promptTokens = prompt?.estimatedTokens ?? 0;

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
          className="relative w-full max-w-[820px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
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
              <span className="text-[10px] font-mono text-aether-cyan/40">Prompt {promptTokens} + Reply {replyTokens} = {promptTokens + replyTokens} tk</span>
              <button onClick={onClose} className="text-white/20 hover:text-aether-cyan transition-colors p-1.5 clickable hover:bg-aether-cyan/[0.06] rounded">
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {!prompt ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText size={36} className="text-white/8 mb-3" />
                <p className="text-white/20 text-xs font-display tracking-wide">暂无请求数据</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Sections: organized by preset prompt_order */}
                {prompt.sections.map((section, i) => {
                  const SourceIcon = sourceIcons[section.source] || Layers;
                  const hasContent = section.content && section.content.trim().length > 0;
                  return (
                    <div key={`${section.identifier}-${i}`}
                      className={`rounded-lg border overflow-hidden transition-all ${
                        section.enabled && hasContent
                          ? 'border-aether-border/15 bg-aether-dark/30'
                          : section.enabled
                            ? 'border-aether-border/8 bg-aether-dark/20 opacity-50'
                            : 'border-aether-border/5 bg-aether-dark/15 opacity-30'
                      }`}>
                      {/* Section header */}
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-aether-border/8 bg-aether-dark/20">
                        {section.enabled ? (
                          <CheckCircle2 size={12} className="text-aether-green/50 shrink-0" />
                        ) : (
                          <Circle size={12} className="text-white/10 shrink-0" />
                        )}
                        <span className={`text-[11px] font-display font-semibold tracking-wide flex-1 ${
                          section.enabled && hasContent ? 'text-white/55' : 'text-white/20'
                        }`}>
                          {section.name}
                        </span>
                        <span className="text-[8px] text-white/15 font-mono uppercase">{section.role}</span>
                        <span className={`flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded ${
                          section.source === 'variables' ? 'bg-aether-gold/10 text-aether-gold/50' :
                          section.source === 'chat' ? 'bg-aether-blue/10 text-aether-blue/50' :
                          'bg-aether-cyan/10 text-aether-cyan/50'
                        }`}>
                          <SourceIcon size={9} />
                          {sourceLabels[section.source]}
                        </span>
                        {hasContent && (
                          <span className="text-[8px] text-white/15 font-mono">~{Math.round(section.content!.length / 4)} tk</span>
                        )}
                        {!hasContent && section.enabled && (
                          <span className="flex items-center gap-0.5 text-[8px] text-white/12 font-mono"><EyeOff size={9} /> 未匹配</span>
                        )}
                      </div>
                      {/* Section content */}
                      {hasContent && (
                        <pre className="p-3 text-[11px] text-white/50 whitespace-pre-wrap leading-relaxed font-mono max-h-[160px] overflow-y-auto">
                          {section.content}
                        </pre>
                      )}
                    </div>
                  );
                })}

                {/* User input */}
                {prompt.messages.filter(m => m.role === 'user').map((msg, i) => (
                  <div key={`user-${i}`}
                    className="rounded-lg border border-aether-cyan/20 bg-aether-cyan/[0.03] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-aether-cyan/10 bg-aether-cyan/[0.03]">
                      <span className="text-[11px] font-display font-semibold tracking-wide text-aether-cyan/60">你的回复</span>
                      <span className="text-[8px] text-white/15 font-mono ml-auto">~{Math.round(msg.content.length / 4)} tk</span>
                    </div>
                    <pre className="p-3 text-[12px] text-white/65 whitespace-pre-wrap leading-relaxed font-sans max-h-[120px] overflow-y-auto">
                      {msg.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
