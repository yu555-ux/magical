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
}

export function importLorebookFromJson(raw: Record<string, any>): Lorebook {
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
  }));

  return {
    id: crypto.randomUUID(),
    name: data.name || '导入的世界书',
    entries,
    recursive: data.settings?.recursive_scanning ?? false,
    createdAt: Date.now(),
  };
}

export interface ImportResult {
  lorebook: Lorebook;
  name: string;
  entryCount: number;
}
