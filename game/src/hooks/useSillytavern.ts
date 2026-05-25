import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStreamParser } from './useStreamParser';
import { createApiRouter } from '../sillytavern/api-router';
import { applyParsedToChat } from '../sillytavern/variables';
import { assemblePrompt } from '../sillytavern/prompt-assembler';
import { DEFAULT_TAGS, DEFAULT_OPAQUE_TAGS, DEFAULT_SETTINGS, DEFAULT_PRESET_BLOCKS, type AppSettings, type ChatSession, type ChatMessage } from '../sillytavern/types';
import { getDatabase, initializeDatabase, getSettings, getChats, saveChat, deleteChat, saveSettings } from '../sillytavern/database';
import { DEFAULT_WORLD_VARS } from '../sillytavern/default-world-vars';
import { tickAllFemales } from '../sillytavern/physiology';

const db = getDatabase();

export function useSillytavern() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<{
    messages: Array<{ role: string; content: string }>;
    estimatedTokens: number;
    stageTokens: Record<string, number>;
    stageMessages: Record<string, Array<{ role: string; content: string }>>;
    stageOrder: string[];
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((message: string) => { setToast(message); setTimeout(() => setToast(null), 2000); }, []);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) ?? null, [chats, activeChatId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initializeDatabase();
      const [s, c] = await Promise.all([getSettings(), getChats()]);
      if (cancelled) return;
      setSettings(s ? {
        ...DEFAULT_SETTINGS,
        ...s,
        // Restore defaults for fields that may be undefined in stored settings
        lorebooks: s.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
        presetBlocks: s.presetBlocks ?? DEFAULT_SETTINGS.presetBlocks,
      } : { ...DEFAULT_SETTINGS });
      setChats(c);
      if (c.length > 0) setActiveChatId(c[0].id);
      setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const createChat = useCallback(async (name: string) => {
    const chat: ChatSession = {
      id: crypto.randomUUID(), name, messages: [],
      characterName: settings?.characterName ?? DEFAULT_SETTINGS.characterName,
      userName: settings?.userName ?? DEFAULT_SETTINGS.userName,
      variables: JSON.parse(JSON.stringify(DEFAULT_WORLD_VARS)),
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await saveChat(chat);
    setChats(prev => [...prev, chat]);
    setActiveChatId(chat.id);
    return chat.id;
  }, [settings]);

  const selectChat = useCallback((id: string) => setActiveChatId(id), []);
  const removeChat = useCallback(async (id: string) => {
    await deleteChat(id);
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId((chats.filter(c => c.id !== id)[0]?.id) ?? null);
  }, [activeChatId, chats]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── streaming parser ──
  const parser = useStreamParser(
    [...new Set([...(settings?.customTags ?? []), ...DEFAULT_TAGS])],
    [...DEFAULT_OPAQUE_TAGS],
  );

  const sendGameMessage = useCallback(async (userText: string) => {
    if (!activeChat || !settings) return;

    const latestSettings = await getSettings();
    const effectiveApi = latestSettings?.api ?? settings.api ?? DEFAULT_SETTINGS.api;
    const effectiveSettings = {
      ...(latestSettings ?? DEFAULT_SETTINGS),
      ...(settings ?? {}),
      api: effectiveApi,
      // DB takes priority for these fields (may be updated by PresetManager/LorebookTab auto-save)
      presetBlocks: latestSettings?.presetBlocks ?? settings?.presetBlocks ?? DEFAULT_PRESET_BLOCKS,
      lorebooks: latestSettings?.lorebooks ?? settings?.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
      presetParams: latestSettings?.presetParams ?? settings?.presetParams,
    };

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText, timestamp: Date.now() };
    const updatedChat: ChatSession = { ...activeChat, messages: [...activeChat.messages, userMsg], updatedAt: Date.now() };
    await db.chats.put(updatedChat);
    setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));

    const chatVars = updatedChat.variables ?? {};

    const { messages, totalTokens, stageTokens, stageMessages, stageOrder } = assemblePrompt({
      userInput: userText,
      history: updatedChat.messages,
      presetBlocks: effectiveSettings.presetBlocks,
      lorebooks: effectiveSettings.lorebooks,
      userName: effectiveSettings.userName,
      characterName: effectiveSettings.characterName,
      playerDescription: effectiveSettings.playerDescription,
      characterDescription: effectiveSettings.characterDescription,
      mapTree: chatVars['地图'],
      currentLocation: chatVars['世界']?.['现实']?.['地点'] ?? '',
      isDream: chatVars['世界']?.['梦境定位']?.['位于梦境'] ?? false,
      characters: chatVars['主要人物'],
      fullVariables: chatVars,
      squashSystemMessages: effectiveSettings.squashSystemMessages,
      maxContextTokens: effectiveSettings.presetParams?.openai_max_context ?? 2000000,
      maxOutputTokens: effectiveSettings.presetParams?.openai_max_tokens ?? 64000,
    });

    setLastPrompt({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      estimatedTokens: totalTokens,
      stageTokens,
      stageMessages,
      stageOrder,
    });

    const freshRouter = createApiRouter(effectiveApi);
    parser.start();
    let rawContent = '';
    try {
      const { response } = await freshRouter.call('story', {
        messages,
        stream: true,
        ...(effectiveSettings.presetParams ? {
          temperature: effectiveSettings.presetParams.temperature,
          top_p: effectiveSettings.presetParams.top_p,
          top_k: effectiveSettings.presetParams.top_k,
          frequency_penalty: effectiveSettings.presetParams.frequency_penalty,
          presence_penalty: effectiveSettings.presetParams.presence_penalty,
          max_tokens: effectiveSettings.presetParams.openai_max_tokens,
        } : {}),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body');
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          for (const line of part.split('\n').filter(l => l.startsWith('data: '))) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try { const json = JSON.parse(data); const delta = json?.choices?.[0]?.delta?.content ?? ''; if (delta) { rawContent += delta; parser.feed(delta); } } catch { /* ignore */ }
          }
        }
      }
    } catch (e) { parser.reset(); throw e; }

    const { events, parsed } = parser.finish();
    let { nextVariables, snapshot } = applyParsedToChat(updatedChat.variables ?? {}, parsed);

    let apiUsed: 'primary' | 'secondary' | 'dual' = 'primary';
    if (effectiveApi.secondary?.enabled && effectiveSettings.apiMode === 'dual' && effectiveApi.secondary.baseUrl && effectiveApi.secondary.apiKey) {
      const maintextForVars = parsed.maintext || events.filter(e => e.type === 'tag-chunk' || e.type === 'raw').map((e: any) => e.chunk).join('');
      if (maintextForVars.trim()) {
        try {
          const secMessages = [
            { role: 'system', content: 'Extract variable changes from story text. Output ONLY a JSON object. Do NOT include any other text.' },
            { role: 'user', content: `Current state:\n${JSON.stringify(updatedChat.variables ?? {}, null, 2)}\n\nStory:\n${maintextForVars.slice(0, 3000)}\n\nJSON:` },
          ];
          const secResult = await freshRouter.call('vars', { messages: secMessages as any, stream: false, temperature: effectiveApi.secondary.temperature ?? 0.3, max_tokens: effectiveApi.secondary.maxTokens ?? 2048 });
          if (secResult.response.ok) {
            const d = await secResult.response.json();
            const raw = d?.choices?.[0]?.message?.content ?? '';
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) {
              const sp = JSON.parse(m[0]);
              if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
                nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: sp }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
                snapshot = JSON.parse(JSON.stringify(nextVariables));
                apiUsed = 'dual';
              }
            }
          }
        } catch { /* fallback to primary vars */ }
      }
    }

    // 生理系统 tick（双轨：现实 + 梦境）
    const world = nextVariables?.['世界'];
    if (world) {
      const sysKey = '_生理系统';
      if (!nextVariables[sysKey]) nextVariables[sysKey] = {};

      // 现实轨 — 非梦境 NPC 走现实时钟
      const realTime = world?.['现实']?.['时间'];
      if (realTime) {
        const lastReal = nextVariables[sysKey]?.['上次现实tick日期'] ?? null;
        nextVariables[sysKey]['上次现实tick日期'] = tickAllFemales(
          nextVariables, realTime, typeof lastReal === 'string' ? lastReal : null,
          { dreamOnly: false },
        );
      }

      // 梦境轨 — 梦境 NPC 走梦境时钟
      const dreamTime = world?.['梦境存档']?.['时间'];
      if (dreamTime) {
        const lastDream = nextVariables[sysKey]?.['上次梦境tick日期'] ?? null;
        nextVariables[sysKey]['上次梦境tick日期'] = tickAllFemales(
          nextVariables, dreamTime, typeof lastDream === 'string' ? lastDream : null,
          { dreamOnly: true },
        );
      }

      snapshot = JSON.parse(JSON.stringify(nextVariables));
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant',
      content: rawContent,
      timestamp: Date.now(), parsed, variablesAfter: snapshot, apiUsed,
    };
    const finalChat: ChatSession = { ...updatedChat, messages: [...updatedChat.messages, assistantMsg], variables: nextVariables, updatedAt: Date.now() };
    await db.chats.put(finalChat);
    setChats(prev => prev.map(c => c.id === finalChat.id ? finalChat : c));
  }, [activeChat, settings, parser]);

  const jumpToFloor = useCallback(async (messageId: string) => {
    if (!activeChat) return;
    const idx = activeChat.messages.findIndex(m => m.id === messageId);
    if (idx < 0) return;
    const truncated = activeChat.messages.slice(0, idx + 1);
    const target = truncated[truncated.length - 1];
    const restoredVars = target?.role === 'assistant' && target.variablesAfter ? target.variablesAfter : activeChat.variables ?? {};
    const next: ChatSession = { ...activeChat, messages: truncated, variables: restoredVars, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
  }, [activeChat]);

  const regenerateLast = useCallback(async () => {
    if (!activeChat) return;
    const lastUserIdx = [...activeChat.messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx < 0) return;
    const targetIdx = activeChat.messages.length - 1 - lastUserIdx;
    const truncated = activeChat.messages.slice(0, targetIdx);
    const next: ChatSession = { ...activeChat, messages: truncated, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
    await sendGameMessage(activeChat.messages[targetIdx].content);
  }, [activeChat, sendGameMessage]);

  const setChatVariables = useCallback(async (vars: Record<string, any>) => {
    if (!activeChat) return;
    const next: ChatSession = { ...activeChat, variables: vars, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
  }, [activeChat]);

  return {
    settings, chats, activeChat, initialized, lastPrompt,
    createChat, selectChat, removeChat, sendGameMessage, jumpToFloor, regenerateLast,
    updateSettings, setChatVariables,
    streamState: parser.state, abortStream: () => {},
    toast, showToast,
  };
}
