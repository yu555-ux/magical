import Dexie, { Table } from 'dexie';
import type { AppSettings, ChatSession } from './types';
import { DEFAULT_SETTINGS } from './types';

const DB_NAME = 'SillyTavernWebDB';
const DB_VERSION = 8;

class AppDatabase extends Dexie {
  settings!: Table<AppSettings>;
  chats!: Table<ChatSession>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      settings: 'key',
      chats: 'id, name, updatedAt',
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
