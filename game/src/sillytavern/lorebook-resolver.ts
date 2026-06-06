/**
 * Resolve {{LOREBY::pattern}} macros in content by matching against lorebook entries.
 * Pure function — no React dependencies.
 */
export function resolveLorebyMacro(
  content: string,
  lorebooks: Array<{ name: string; entries?: Array<{ enabled?: boolean; keys?: string[]; secondaryKeys?: string[]; comment?: string; content: string }> }> | undefined | null,
): string {
  if (!lorebooks?.length) return content.replace(/\{\{LOREBY::[^}]+\}\}/g, '');

  const patterns: string[] = [];
  const re = /\{\{LOREBY::([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    patterns.push(m[1].trim());
  }
  if (patterns.length === 0) return content;

  // Match by lorebook entry title (comment)
  const parts: string[] = [];
  for (const lb of lorebooks) {
    for (const entry of (lb.entries ?? [])) {
      if (!entry.enabled) continue;
      const keys = (entry.keys || []).concat(entry.secondaryKeys || []);
      const matchText = [entry.comment || '', ...keys].join(' ');
      if (patterns.some(p => matchText.includes(p))) {
        parts.push(entry.content);
      }
    }
  }

  const replacement = parts.join('\n\n');
  return replacement
    ? content.replace(/\{\{LOREBY::[^}]+\}\}/g, replacement)
    : content.replace(/\{\{LOREBY::[^}]+\}\}/g, '');
}
