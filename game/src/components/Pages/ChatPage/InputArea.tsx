import React from 'react';
import { motion } from 'motion/react';
import { Send } from 'lucide-react';

interface InputAreaProps {
  input: string;
  setInput: (v: string) => void;
  isTyping: boolean;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isFocused: boolean;
  setIsFocused: (v: boolean) => void;
  optionsOpen: boolean;
  setOptionsOpen: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  aiOptions?: string[];
}

const FALLBACK_OPTIONS = [
  { label: '探索周围', hint: '扫描当前区域环境' },
  { label: '查看状态', hint: '检查自身属性与装备' },
  { label: '使用技能', hint: '释放以太共鸣技能' },
  { label: '检查物品', hint: '查看背包与物资' },
  { label: '展开对话', hint: '与附近人物互动' },
];

export default function InputArea({
  input,
  setInput,
  isTyping,
  onSend,
  onKeyDown,
  isFocused,
  setIsFocused,
  optionsOpen,
  setOptionsOpen,
  inputRef,
  aiOptions,
}: InputAreaProps) {
  const hasAiOptions = aiOptions && aiOptions.length > 0;
  const displayOptions = hasAiOptions
    ? aiOptions.map((o) => ({ label: o, hint: '' }))
    : FALLBACK_OPTIONS;

  return (
    <div className="bg-aether-deep/90 shrink-0">
      <div className="p-3 md:p-4">
        <div className="relative">
          {/* Options panel */}
          <div className={`absolute left-0 right-0 bottom-full border-x border-t bg-aether-deep/98 backdrop-blur-xl overflow-hidden transition-all duration-200 ${
            optionsOpen
              ? 'opacity-100 visible border-aether-cyan/30 shadow-[0_0_24px_rgba(0,242,255,0.08)]'
              : 'opacity-0 invisible border-white/[0.08]'
          }`}>
            {displayOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => { setInput(opt.label); setOptionsOpen(false); inputRef.current?.focus(); }}
                className="w-full flex items-center justify-between px-5 py-3 text-left border-b border-white/[0.06] hover:bg-aether-cyan/[0.05] transition-all duration-150 clickable group last:border-b-0"
              >
                <span className="text-[13px] text-white/70 font-display tracking-[0.08em] group-hover:text-aether-cyan transition-colors duration-150">
                  {hasAiOptions ? `${opt.label}` : opt.label}
                </span>
                {opt.hint ? (
                  <span className="text-[10px] text-white/25 font-sans group-hover:text-white/45 transition-colors duration-150">
                    {opt.hint}
                  </span>
                ) : (
                  <span className="text-[10px] text-aether-cyan/25 font-mono">AI</span>
                )}
              </button>
            ))}
          </div>

          {/* Toggle bar */}
          <button
            onClick={() => { setOptionsOpen(!optionsOpen); inputRef.current?.focus(); }}
            className={`w-full flex items-center justify-center h-5 transition-all duration-300 clickable border ${
              optionsOpen
                ? 'border-aether-cyan/50 shadow-[0_0_24px_rgba(0,242,255,0.1)] bg-aether-deep/98 backdrop-blur-xl text-aether-cyan/60 border-t-white/[0.04] rounded-b-none border-b-transparent'
                : isFocused
                  ? 'border-aether-cyan/50 shadow-[0_0_24px_rgba(0,242,255,0.1)] bg-aether-cyan/[0.06] text-aether-cyan/60'
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
              onKeyDown={onKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="写入信息并推进剧情..."
              disabled={isTyping}
              className="flex-1 bg-transparent px-5 py-3.5 text-[14px] text-white/75 font-display tracking-[0.06em] placeholder:text-white/20 disabled:opacity-40 focus:outline-none"
            />
            <button
              onClick={onSend}
              disabled={!input.trim() || isTyping}
              className={`shrink-0 self-stretch px-5 transition-all duration-300 clickable flex items-center ${
                (isFocused || optionsOpen)
                  ? 'text-aether-cyan drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]'
                  : 'text-aether-cyan/45'
              } enabled:hover:text-aether-cyan enabled:hover:bg-aether-cyan/[0.04] enabled:active:scale-95 disabled:opacity-15`}
              title="发送"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
