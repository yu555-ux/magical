/**
 * SillyTavern lorebook import adapter
 * Converts ST world book JSON to Lorebook
 */
import type { Lorebook, LorebookEntry } from './types';

interface STExport {
  name?: string;
  description?: string;
  entries?: Record<string, STEntry>;
  settings?: {
    recursive_scanning?: boolean;
  };
}

interface STEntry {
  uid?: number;
  key?: string[];
  keysecondary?: string[];
  comment?: string;
  content?: string;
  constant?: boolean;
  disable?: boolean;
  position?: number;
  order?: number;
  excluded?: boolean;
  depth?: number;
  selective?: boolean;
  selectiveLogic?: number;
}

export function importLorebookFromJson(raw: Record<string, any>, fileName?: string): Lorebook {
  const data = raw as STExport;

  const rawEntries = Object.values(data.entries || {})
    .filter((e: STEntry) => !e.excluded);

  const entries: LorebookEntry[] = rawEntries.map((e: STEntry) => ({
    id: crypto.randomUUID(),
    keys: e.key || [],
    secondaryKeys: e.keysecondary || [],
    content: e.content || '',
    comment: e.comment || e.content?.slice(0, 50) || '',
    enabled: !e.disable,
    position: e.position ?? 0,
    order: e.order ?? 100,
    constant: e.constant ?? false,
    depth: e.depth ?? 4,
    selective: e.selective ?? false,
    selectiveLogic: e.selectiveLogic ?? 0,
  }));

  // Derive name: prefer JSON's name field, then filename without extension, then fallback
  const fallbackName = fileName ? fileName.replace(/\.json$/i, '') : undefined;
  const name = data.name || fallbackName || '导入的世界书';

  return {
    id: crypto.randomUUID(),
    name,
    entries,
    recursive: data.settings?.recursive_scanning ?? false,
    caseSensitive: false,
    matchWholeWords: false,
    createdAt: Date.now(),
  };
}

export function exportLorebookToJson(book: Lorebook): Record<string, any> {
  const entries: Record<string, any> = {};
  book.entries.forEach((entry, i) => {
    entries[String(i)] = {
      uid: i,
      key: entry.keys,
      keysecondary: entry.secondaryKeys,
      comment: entry.comment,
      content: entry.content,
      constant: entry.constant,
      disable: !entry.enabled,
      position: entry.position,
      order: entry.order,
      depth: entry.depth ?? 4,
      selective: entry.selective ?? false,
      selectiveLogic: entry.selectiveLogic ?? 0,
    };
  });

  return {
    name: book.name,
    description: '',
    entries,
    settings: {
      recursive_scanning: book.recursive,
      case_sensitive: book.caseSensitive,
      match_whole_words: book.matchWholeWords,
    },
  };
}

export interface ImportResult {
  lorebook: Lorebook;
  name: string;
  entryCount: number;
}
