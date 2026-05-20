import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Hash } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prompt: { messages: Array<{ role: string; content: string }>; estimatedTokens: number } | null;
  replyText?: string;
}

const roleColors: Record<string, string> = {
  system: 'text-aether-purple/60',
  user: 'text-aether-cyan/60',
  assistant: 'text-aether-green/60',
};

const roleLabels: Record<string, string> = {
  system: '系统',
  user: '用户',
  assistant: '助手',
};

export default function PromptViewerModal({ isOpen, onClose, prompt, replyText }: Props) {
  const replyTokens = useMemo(() => replyText ? Math.round(replyText.length / 4) : 0, [replyText]);
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
          className="relative w-full max-w-[780px] max-h-[88vh] glass-panel border-glow overflow-hidden flex flex-col
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
              <h2 className="font-display font-black text-sm tracking-[0.15em] text-aether-cyan/90 uppercase">请求详情</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Token stats */}
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-aether-purple/50">Prompt <span className="text-white/40">{promptTokens}</span></span>
                <span className="text-white/10">|</span>
                <span className="text-aether-green/50">Reply <span className="text-white/40">{replyTokens}</span></span>
                <span className="text-white/10">|</span>
                <span className="text-aether-cyan/50">合计 <span className="text-white/50">{promptTokens + replyTokens}</span></span>
              </div>
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
                <p className="text-white/8 text-[10px] mt-1">发送消息后将显示提示词详情</p>
              </div>
            ) : (
              <div className="space-y-4">
                {prompt.messages.map((msg, i) => (
                  <div key={i}
                    className="bg-aether-dark/40 rounded-lg border border-aether-border/15 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-aether-border/10 bg-aether-dark/30">
                      <Hash size={11} className="text-white/15" />
                      <span className={`text-[10px] font-display font-semibold tracking-wider uppercase ${roleColors[msg.role] || 'text-white/30'}`}>
                        {roleLabels[msg.role] || msg.role}
                      </span>
                      <span className="text-[9px] text-white/15 font-mono ml-auto">~{Math.round(msg.content.length / 4)} tk</span>
                    </div>
                    <pre className="p-3 text-[11px] text-white/55 whitespace-pre-wrap leading-relaxed font-mono max-h-[200px] overflow-y-auto">
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
