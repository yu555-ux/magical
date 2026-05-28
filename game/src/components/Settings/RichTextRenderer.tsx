import React, { useMemo } from 'react';
import type { RichTextConfig } from '../../sillytavern/types';
import { DEFAULT_RICH_TEXT_CONFIG } from '../../sillytavern/types';

// ========== Tokenizer Types ==========

type SegmentType = 'plain' | 'quotes' | 'cornerBrackets' | 'angleBrackets' | 'italic' | 'bold';

interface ParsedSegment {
  type: SegmentType;
  content: string;
}

interface PatternDef {
  type: SegmentType;
  regex: RegExp;
}

// ========== Tokenizer ==========

function parseRichText(text: string, config?: RichTextConfig): ParsedSegment[] {
  const cfg = config ?? DEFAULT_RICH_TEXT_CONFIG;

  // Fast path: no features enabled
  if (!cfg.quotes.enabled && !cfg.cornerBrackets.enabled && !cfg.angleBrackets.enabled && !cfg.italic.enabled && !cfg.bold.enabled) {
    return [{ type: 'plain', content: text }];
  }

  // Build patterns in priority order (bold before italic to avoid ** overlap)
  const patterns: PatternDef[] = [];
  if (cfg.bold.enabled)            patterns.push({ type: 'bold',            regex: /\*\*(.+?)\*\*/g });
  if (cfg.italic.enabled)          patterns.push({ type: 'italic',          regex: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g });
  if (cfg.cornerBrackets.enabled)  patterns.push({ type: 'cornerBrackets',  regex: /【([^】]+)】/g });
  if (cfg.angleBrackets.enabled)   patterns.push({ type: 'angleBrackets',   regex: /「([^」]+)」/g });
  if (cfg.quotes.enabled)          patterns.push({ type: 'quotes',          regex: /["“](.+?)["”]/g });

  if (patterns.length === 0) return [{ type: 'plain', content: text }];

  const segments: ParsedSegment[] = [];
  let pos = 0;

  while (pos < text.length) {
    let bestMatch: { type: SegmentType; content: string; start: number; end: number } | null = null;

    for (const p of patterns) {
      p.regex.lastIndex = pos;
      const m = p.regex.exec(text);
      if (m && (bestMatch === null || m.index < bestMatch.start)) {
        bestMatch = { type: p.type, content: m[1], start: m.index, end: m.index + m[0].length };
      }
    }

    if (bestMatch) {
      // Plain text before match
      if (bestMatch.start > pos) {
        segments.push({ type: 'plain', content: text.slice(pos, bestMatch.start) });
      }
      // Styled segment (inner content only, delimiters stripped)
      if (bestMatch.content) {
        segments.push({ type: bestMatch.type, content: bestMatch.content });
      }
      pos = bestMatch.end;
    } else {
      // No more matches — rest is plain
      segments.push({ type: 'plain', content: text.slice(pos) });
      break;
    }
  }

  return segments;
}

// ========== React Component ==========

export default function RichTextRenderer({ text, config }: { text: string; config?: RichTextConfig }) {
  const cfg = config ?? DEFAULT_RICH_TEXT_CONFIG;

  const segments = useMemo(() => parseRichText(text, cfg), [text, cfg]);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'plain') return <React.Fragment key={i}>{seg.content}</React.Fragment>;
        const sc = cfg[seg.type];
        return (
          <span key={i} style={{
            color: sc?.color ?? '#ffffff',
            fontWeight: sc?.bold ? 700 : undefined,
            fontStyle: sc?.italic ? 'italic' : undefined,
          }}>{seg.content}</span>
        );
      })}
    </>
  );
}

// Also export the parser for standalone use
export { parseRichText };
