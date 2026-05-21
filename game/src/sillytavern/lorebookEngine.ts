/**
 * Lorebook matching engine — keyword-based activation + recursive scanning
 */
import type { Lorebook, LorebookEntry } from './types';
import { LOREBOOK_POSITION_MAP, INJECTION_ANCHORS } from './types';

export interface MatchedEntry {
  entry: LorebookEntry;
  matchedKeywords: string[];
  anchorId: string;  // which injection anchor (worldInfoBefore / worldInfoAfter)
}

export interface ScanResult {
  before: MatchedEntry[];  // → worldInfoBefore
  after: MatchedEntry[];   // → worldInfoAfter
}

/**
 * Scan user input + recent chat history against all lorebooks.
 * Returns entries grouped by injection anchor.
 */
export function scanLorebooks(
  lorebooks: Lorebook[],
  userInput: string,
  historyText: string,
): ScanResult {
  const before: MatchedEntry[] = [];
  const after: MatchedEntry[] = [];
  const scanText = userInput + ' ' + historyText;

  for (const book of lorebooks) {
    const matched = scanBook(book, scanText);
    for (const m of matched) {
      const anchorId = LOREBOOK_POSITION_MAP[m.entry.position] || 'worldInfoAfter';
      if (anchorId === 'worldInfoBefore') {
        before.push(m);
      } else {
        after.push(m);
      }
    }
  }

  // Sort by order within each group
  before.sort((a, b) => (a.entry.order ?? 100) - (b.entry.order ?? 100));
  after.sort((a, b) => (a.entry.order ?? 100) - (b.entry.order ?? 100));

  return { before, after };
}

function scanBook(book: Lorebook, text: string): MatchedEntry[] {
  const matched: MatchedEntry[] = [];
  const ids = new Set<string>();
  let scanText = text;
  let depth = 0;
  const maxDepth = book.recursive ? 3 : 1;

  while (depth < maxDepth) {
    let hasNew = false;
    for (const entry of book.entries) {
      if (!entry.enabled || ids.has(entry.id)) continue;

      let isMatch = false;
      let matchedKeys: string[] = [];

      if (entry.constant) {
        isMatch = true;
      } else if (entry.keys.length > 0) {
        matchedKeys = entry.keys.filter(k => scanText.includes(k));
        isMatch = matchedKeys.length > 0;
      }

      if (isMatch) {
        ids.add(entry.id);
        const m: MatchedEntry = {
          entry,
          matchedKeywords: matchedKeys,
          anchorId: LOREBOOK_POSITION_MAP[entry.position] || 'worldInfoAfter',
        };
        matched.push(m);
        scanText += ' ' + entry.content;
        hasNew = true;
      }
    }
    if (!hasNew) break;
    depth++;
  }

  return matched;
}

/**
 * Format matched entries into a prompt block string.
 */
export function formatMatchedEntries(entries: MatchedEntry[]): string {
  if (entries.length === 0) return '';
  return entries.map(e => e.entry.content).join('\n\n');
}
