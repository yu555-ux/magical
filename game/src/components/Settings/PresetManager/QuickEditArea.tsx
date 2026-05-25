import React from 'react';
import type { QuickEditAreaProps } from './types';

export default function QuickEditArea({ blocks, onUpdate }: QuickEditAreaProps) {
  const mainBlock = blocks.find(b => b.identifier === 'main');
  if (!mainBlock) return null;

  return (
    <div className="mt-3 p-3 rounded-lg border border-aether-border/10 bg-aether-dark/20">
      <label className="text-[10px] text-white/25 font-display tracking-wide uppercase mb-1.5 block">
        快捷编辑 — {mainBlock.name}
      </label>
      <textarea
        value={mainBlock.content}
        onChange={e => onUpdate('main', { content: e.target.value })}
        rows={4}
        placeholder="主提示词内容..."
        className="w-full bg-aether-dark/50 border border-aether-border/25 rounded px-3 py-2 text-[11px] text-white/65 placeholder:text-white/10 focus:outline-none focus:border-aether-purple/50 transition-all resize-none font-mono leading-relaxed"
      />
    </div>
  );
}
