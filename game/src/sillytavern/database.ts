import Dexie, { Table } from 'dexie';
import type { AppSettings, ChatSession } from './types';
import { DEFAULT_SETTINGS, DEFAULT_PRESET_BLOCKS } from './types';

const DB_NAME = 'SillyTavernWebDB';
const DB_VERSION = 4;

class AppDatabase extends Dexie {
  settings!: Table<AppSettings>;
  chats!: Table<ChatSession>;

  constructor() {
    super(DB_NAME);
    this.version(3).stores({
      settings: 'key',
      chats: 'id, name, updatedAt',
    }).upgrade(async tx => {
      const s = await tx.table('settings').toCollection().toArray();
      for (const row of s) {
        if (row.uiMode === undefined) row.uiMode = 'game';
        if (row.customTags === undefined) row.customTags = ['maintext', 'option', 'history', 'vars', 'thinking', 'think'];
        if (row.thinkingDisplay === undefined) row.thinkingDisplay = 'fold';
        if (row.api?.secondary === undefined) {
          row.api = { ...row.api, secondary: { enabled: false, baseUrl: '', apiKey: '', model: '' } };
        }
        await tx.table('settings').put(row);
      }
    });
    this.version(4).stores({
      settings: 'key',
      chats: 'id, name, updatedAt',
    }).upgrade(async tx => {
      const s = await tx.table('settings').toCollection().toArray();
      for (const row of s) {
        if (!row.presetBlocks || row.presetBlocks.length === 0) {
          row.presetBlocks = DEFAULT_PRESET_BLOCKS;
        }
        await tx.table('settings').put(row);
      }
    });
  }
}

let dbInstance: AppDatabase | null = null;

export function getDatabase(): AppDatabase {
  if (!dbInstance) dbInstance = new AppDatabase();
  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  const c = await db.settings.count();
  if (c === 0) await db.settings.put({ ...DEFAULT_SETTINGS, key: 'settings' });
}

export async function getSettings(): Promise<AppSettings | undefined> {
  const all = await getDatabase().settings.toArray();
  return all[0];
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await getDatabase().settings.put({ ...settings, key: 'settings' });
}

export async function getChats(): Promise<ChatSession[]> {
  return getDatabase().chats.toArray();
}

export async function saveChat(chat: ChatSession): Promise<string> {
  await getDatabase().chats.put(chat);
  return chat.id;
}

export async function deleteChat(id: string): Promise<void> {
  await getDatabase().chats.delete(id);
}
