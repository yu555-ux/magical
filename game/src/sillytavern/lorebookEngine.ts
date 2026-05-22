/**
 * Lorebook matching engine — keyword-based activation + recursive scanning
 */
import type { Lorebook, LorebookEntry, InjectionAnchor } from './types';
import { LOREBOOK_POSITION_MAP, INJECTION_ANCHORS } from './types';

export interface MatchedEntry {
  entry: LorebookEntry;
  matchedKeywords: string[];
  anchorId: string;
}

export interface ScanResult {
  groups: Record<string, MatchedEntry[]>;
}

function emptyScanResult(): ScanResult {
  const groups: Record<string, MatchedEntry[]> = {};
  for (const anchor of INJECTION_ANCHORS) {
    groups[anchor] = [];
  }
  return { groups };
}

export function scanLorebooks(
  lorebooks: Lorebook[],
  userInput: string,
  historyText: string,
): ScanResult {
  const result = emptyScanResult();
  const scanText = userInput + ' ' + historyText;

  for (const book of lorebooks) {
    const matched = scanBook(book, scanText);
    for (const m of matched) {
      const anchorId = LOREBOOK_POSITION_MAP[m.entry.position] || 'worldInfoAfter';
      if (result.groups[anchorId]) {
        result.groups[anchorId].push(m);
      } else {
        result.groups['worldInfoAfter'].push(m);
      }
    }
  }

  for (const anchor of INJECTION_ANCHORS) {
    result.groups[anchor].sort((a, b) => {
      const d = (a.entry.order ?? 100) - (b.entry.order ?? 100);
      if (d !== 0) return d;
      return (a.entry.depth ?? 0) - (b.entry.depth ?? 0);
    });
  }

  return result;
}

/** Check if a single keyword matches text, respecting case/whole-word settings */
function keyMatches(keyword: string, text: string, caseSensitive: boolean, wholeWords: boolean): boolean {
  if (!caseSensitive) {
    keyword = keyword.toLowerCase();
    text = text.toLowerCase();
  }
  if (wholeWords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, caseSensitive ? '' : 'i');
    return re.test(text);
  }
  return text.includes(keyword);
}

function scanBook(book: Lorebook, text: string): MatchedEntry[] {
  const matched: MatchedEntry[] = [];
  const ids = new Set<string>();
  let scanText = text;
  let depth = 0;
  const maxDepth = book.recursive ? 3 : 1;
  const caseSensitive = book.caseSensitive ?? false;
  const wholeWords = book.matchWholeWords ?? false;

  while (depth < maxDepth) {
    let hasNew = false;
    for (const entry of book.entries) {
      if (!entry.enabled || ids.has(entry.id)) continue;

      // preventRecursion: skip if we're past the first pass (depth > 0)
      if (depth > 0 && entry.preventRecursion) continue;

      let isMatch = false;
      let matchedKeys: string[] = [];

      if (entry.constant) {
        isMatch = true;
      } else if (entry.keys.length > 0 || entry.secondaryKeys.length > 0) {
        const allKeys = [...entry.keys, ...entry.secondaryKeys];
        const hits = allKeys.filter(k => keyMatches(k, scanText, caseSensitive, wholeWords));

        if (entry.selective) {
          const primaryHits = entry.keys.filter(k => keyMatches(k, scanText, caseSensitive, wholeWords));
          const secHits = entry.secondaryKeys.filter(k => keyMatches(k, scanText, caseSensitive, wholeWords));
          const hasKeys = entry.keys.length > 0;
          const hasSecKeys = entry.secondaryKeys.length > 0;

          switch (entry.selectiveLogic) {
            case 0: // and_any: primary AND, secondary OR
              isMatch = hasKeys && primaryHits.length === entry.keys.length;
              if (!isMatch && hasSecKeys) isMatch = secHits.length > 0;
              if (isMatch) matchedKeys = [...primaryHits, ...secHits];
              break;
            case 1: // not_all: primary NOT all, secondary AND
              isMatch = !hasKeys || primaryHits.length !== entry.keys.length;
              if (isMatch && hasSecKeys) isMatch = secHits.length === entry.secondaryKeys.length;
              if (isMatch) matchedKeys = [...primaryHits, ...secHits];
              break;
            case 2: // not_any: primary NOT any, secondary OR
              isMatch = !hasKeys || primaryHits.length === 0;
              if (isMatch && hasSecKeys) isMatch = secHits.length > 0;
              if (isMatch) matchedKeys = [...primaryHits, ...secHits];
              break;
            case 3: // and_all: primary OR, secondary AND
              isMatch = hasKeys && primaryHits.length > 0;
              if (isMatch && hasSecKeys) isMatch = secHits.length === entry.secondaryKeys.length;
              if (isMatch) matchedKeys = [...primaryHits, ...secHits];
              break;
            default: // fallback: primary OR
              isMatch = primaryHits.length > 0;
              if (!isMatch && hasSecKeys) isMatch = secHits.length > 0;
              if (isMatch) matchedKeys = [...primaryHits, ...secHits];
          }
        } else {
          // Non-selective: ANY key matches
          if (entry.keys.length > 0) {
            const primaryHits = entry.keys.filter(k => keyMatches(k, scanText, caseSensitive, wholeWords));
            isMatch = primaryHits.length > 0;
            matchedKeys = primaryHits;
          }
          if (!isMatch && entry.secondaryKeys.length > 0) {
            const secHits = entry.secondaryKeys.filter(k => keyMatches(k, scanText, caseSensitive, wholeWords));
            isMatch = secHits.length > 0;
            matchedKeys = secHits;
          }
        }
      }

      // Probability check
      if (isMatch && entry.useProbability) {
        const roll = Math.random() * 100;
        if (roll > (entry.probability ?? 100)) {
          isMatch = false;
        }
      }

      if (isMatch) {
        ids.add(entry.id);
        matched.push({
          entry,
          matchedKeywords: matchedKeys,
          anchorId: LOREBOOK_POSITION_MAP[entry.position] || 'worldInfoAfter',
        });

        // excludeRecursion: don't add content to scan buffer for recursive matching
        if (!entry.excludeRecursion) {
          scanText += ' ' + entry.content;
        }
        hasNew = true;
      }
    }
    if (!hasNew) break;
    depth++;
  }

  return matched;
}

export function formatMatchedEntries(entries: MatchedEntry[]): string {
  if (entries.length === 0) return '';
  return entries.map(e => e.entry.content).join('\n\n');
}
