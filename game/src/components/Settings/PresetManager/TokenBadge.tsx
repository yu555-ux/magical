import React from 'react';

interface Props {
  content: string;
}

function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

function colorClass(tokens: number): string {
  if (tokens > 1000) return 'text-aether-red/45';
  if (tokens > 250) return 'text-aether-yellow/45';
  return 'text-white/25';
}

export default function TokenBadge({ content }: Props) {
  const tokens = estimateTokens(content || '');
  return (
    <span className={`text-[9px] font-mono shrink-0 w-10 text-right ${colorClass(tokens)}`}>
      {content ? tokens : '-'}
    </span>
  );
}
