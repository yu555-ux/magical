import { motion } from 'motion/react';
import { Copy, Check } from 'lucide-react';
import { formatTime } from './types';
import type { ChatMessage } from './types';

interface MessageBubbleProps {
  msg: ChatMessage;
  idx: number;
  copiedIdx: number | null;
  onCopy: (content: string, idx: number) => void;
}

export default function MessageBubble({ msg, idx, copiedIdx, onCopy }: MessageBubbleProps) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      key={`msg-${idx}-${msg.timestamp.getTime()}`}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        damping: 22,
        stiffness: 220,
        delay: Math.min(idx * 0.04, 0.4),
      }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} group mb-3`}
    >
      <div
        className={`relative max-w-[78%] md:max-w-[68%] transition-shadow duration-300 ${
          isUser
            ? 'border border-aether-blue/25 bg-gradient-to-br from-aether-blue/[0.1] via-aether-blue/[0.04] to-transparent hover:shadow-[0_0_12px_rgba(0,168,204,0.08)]'
            : 'border border-aether-cyan/20 bg-gradient-to-br from-aether-cyan/[0.06] via-aether-cyan/[0.02] to-transparent shadow-[0_0_20px_rgba(0,242,255,0.04)] hover:shadow-[0_0_20px_rgba(0,242,255,0.08)]'
        }`}
        style={{
          borderRadius: isUser
            ? '12px 2px 12px 12px'
            : '2px 12px 12px 12px',
        }}
      >
        {/* corner accent dot */}
        <div className={`absolute top-0 w-1.5 h-1.5 ${isUser ? 'right-0 -mr-px -mt-px' : 'left-0 -ml-px -mt-px'}`}>
          <div className={`w-full h-full ${isUser ? 'bg-aether-blue/40 rounded-bl-sm' : 'bg-aether-cyan/40 rounded-br-sm'}`} />
        </div>

        {/* message content */}
        <div className="px-5 py-3.5 pr-12">
          <p className={`text-[14px] tracking-[0.02em] leading-[1.7] font-sans ${
            isUser ? 'text-white/80' : 'text-white/75'
          }`}>
            {msg.content}
          </p>
        </div>

        {/* footer row */}
        <div className="flex items-center px-5 pb-2.5">
          <span className="text-[9px] font-mono tracking-[0.08em] text-white/15">
            {formatTime(msg.timestamp)}
          </span>
        </div>

        {/* copy button */}
        <button
          onClick={() => onCopy(msg.content, idx)}
          className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-sm hover:bg-white/[0.04] clickable"
          title="复制"
        >
          {copiedIdx === idx ? (
            <Check size={13} className="text-green-400" />
          ) : (
            <Copy
              size={13}
              className="text-white/25 hover:text-aether-cyan transition-colors"
            />
          )}
        </button>
      </div>
    </motion.div>
  );
}
