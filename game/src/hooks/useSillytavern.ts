import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStreamParser } from './useStreamParser';
import { createApiRouter } from '../sillytavern/api-router';
import { applyParsedToChat, autoTagDreamItems, enrichHistory, validateEquipment, formatVariablesForPrompt } from '../sillytavern/variables';
import { assemblePrompt, replaceMacros } from '../sillytavern/prompt-assembler';
import { scanLorebooks, formatMatchedEntries } from '../sillytavern/lorebookEngine';
import { DEFAULT_TAGS, DEFAULT_OPAQUE_TAGS, DEFAULT_SETTINGS, DEFAULT_PRESET_BLOCKS, DEFAULT_PRESET_PARAMS, type AppSettings, type ChatSession, type ChatMessage, type HistoryTimeline } from '../sillytavern/types';
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
    stageNames: Record<string, string>;
  } | null>(null);

  const [lastSecondaryPrompt, setLastSecondaryPrompt] = useState<{
    messages: Array<{ role: string; content: string }>;
    estimatedTokens: number;
    stageTokens: Record<string, number>;
    stageMessages: Record<string, Array<{ role: string; content: string }>>;
    stageOrder: string[];
    stageNames: Record<string, string>;
  } | null>(null);

  const [dualRunning, setDualRunning] = useState(false); // 第二API运行中
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((message: string) => { setToast(message); setTimeout(() => setToast(null), 2000); }, []);
  const abortRef = useRef<AbortController | null>(null);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) ?? null, [chats, activeChatId]);

  /** 将 {{LOREBY::pattern}} 替换为匹配的世界书条目内容 */
  const resolveLorebyMacro = useCallback((content: string, lorebooks: typeof settings extends { lorebooks: infer L } ? L : any): string => {
    if (!lorebooks || lorebooks.length === 0) return content.replace(/\{\{LOREBY::[^}]+\}\}/g, '');
    // 收集所有 pattern
    const patterns: string[] = [];
    const re = /\{\{LOREBY::([^}]+)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      patterns.push(m[1].trim());
    }
    if (patterns.length === 0) return content;
    // 按标题过滤
    const matched = lorebooks.filter((lb: any) =>
      patterns.some(p => lb.name.includes(p)),
    );
    if (matched.length === 0) return content.replace(/\{\{LOREBY::[^}]+\}\}/g, '');
    // 扫描并格式化
    const scanResult = scanLorebooks(matched, '', '');
    const allEntries: string[] = [];
    for (const anchor of Object.keys(scanResult.groups)) {
      const entries = scanResult.groups[anchor];
      if (entries.length > 0) {
        allEntries.push(formatMatchedEntries(entries));
      }
    }
    const replacement = allEntries.join('\n\n');
    return content.replace(/\{\{LOREBY::[^}]+\}\}/g, replacement);
  }, []);

  // 构建第二API提示词预览（响应 settings / activeChat 变化）
  const buildSecondaryPrompt = useCallback((s: AppSettings, chat: ChatSession | null) => {
    const varsPreset = s.presets?.find(
      p => p.id === s.activeVarsPresetId && p.type === 'vars',
    );
    if (!varsPreset) { setLastSecondaryPrompt(null); return; }

    const chatVars = chat?.variables ?? {};
    const lastAssistant = [...(chat?.messages ?? [])].reverse().find(m => m.role === 'assistant');
    const lastMaintext = lastAssistant?.parsed?.maintext ?? '';

    const secMacroCtx = {
      userName: s.userName ?? DEFAULT_SETTINGS.userName,
      characterName: s.characterName ?? DEFAULT_SETTINGS.characterName,
      userInput: '',
      playerDescription: s.playerDescription,
      characterDescription: s.characterDescription,
      varsListText: formatVariablesForPrompt(chatVars),
      lastMaintext: lastMaintext || '(暂无AI回复正文)',
    };

    const secStageMessages: Record<string, Array<{ role: string; content: string }>> = {};
    const secStageTokens: Record<string, number> = {};
    const secStageOrder: string[] = [];
    const secStageNames: Record<string, string> = {};
    let secTotalTokens = 0;

    const lorebooks = s.lorebooks ?? [];
    for (const block of varsPreset.blocks) {
      if (!block.enabled || !block.content?.trim()) continue;
      let resolved = resolveLorebyMacro(block.content, lorebooks);
      resolved = replaceMacros(resolved, secMacroCtx);
      if (!resolved.trim()) continue;
      const tokenEst = Math.round(resolved.length / 4);
      secTotalTokens += tokenEst;
      secStageMessages[block.identifier] = [{ role: block.role, content: resolved }];
      secStageTokens[block.identifier] = tokenEst;
      secStageOrder.push(block.identifier);
      secStageNames[block.identifier] = block.name || block.identifier;
    }

    if (secStageOrder.length > 0) {
      setLastSecondaryPrompt({
        messages: [],
        estimatedTokens: secTotalTokens,
        stageTokens: secStageTokens,
        stageMessages: secStageMessages,
        stageOrder: secStageOrder,
        stageNames: secStageNames,
      });
    } else {
      setLastSecondaryPrompt(null);
    }
  }, []);

  // 响应 settings 变化自动重建第二API提示词预览
  useEffect(() => {
    if (settings && initialized) {
      buildSecondaryPrompt(settings, activeChat);
    }
  }, [settings, activeChat, initialized, buildSecondaryPrompt]);

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
        presets: s.presets ?? DEFAULT_SETTINGS.presets,
        activeVarsPresetId: s.activeVarsPresetId ?? DEFAULT_SETTINGS.activeVarsPresetId,
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
      plotHistory: { reality: [], dream: [] },
      dreamAnchor: {},
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

  const sendGameMessage = useCallback(async (userText: string): Promise<{ aborted: boolean; retractedText?: string }> => {
    if (!activeChat || !settings) return { aborted: false };

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

    const { messages, totalTokens, stageTokens, stageMessages, stageOrder, stageNames } = assemblePrompt({
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
      plotHistory: updatedChat.plotHistory,
      dreamAnchor: updatedChat.dreamAnchor,
      squashSystemMessages: effectiveSettings.squashSystemMessages,
      recentMessageCount: effectiveSettings.recentMessageCount ?? DEFAULT_SETTINGS.recentMessageCount,
    });

    setLastPrompt({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      estimatedTokens: totalTokens,
      stageTokens,
      stageMessages,
      stageOrder,
      stageNames,
    });

    const freshRouter = createApiRouter(effectiveApi);
    parser.start();
    const controller = new AbortController();
    abortRef.current = controller;
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
      }, controller.signal);
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
    } catch (e) {
      parser.reset();
      // Retract: remove last user message, restore variables from previous assistant
      const retract = async () => {
        const msgs = updatedChat.messages;
        const lastUserIdx = [...msgs].reverse().findIndex(m => m.role === 'user');
        if (lastUserIdx < 0) return;
        const targetIdx = msgs.length - 1 - lastUserIdx;
        const truncated = msgs.slice(0, targetIdx);
        const lastAssistant = [...truncated].reverse().find(m => m.role === 'assistant');
        const restoredVars = lastAssistant?.variablesAfter ?? updatedChat.variables ?? {};
        const restoredAnchor = lastAssistant?.dreamAnchorAfter ?? updatedChat.dreamAnchor ?? {};
        const next: ChatSession = { ...updatedChat, messages: truncated, variables: restoredVars, dreamAnchor: restoredAnchor, updatedAt: Date.now() };
        await db.chats.put(next);
        setChats(prev => prev.map(c => c.id === next.id ? next : c));
      };
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      await retract();
      if (isAbort) return { aborted: true, retractedText: userText };
      throw e;
    }

    const { events, parsed } = parser.finish();
    const preVars = updatedChat.variables ?? {};
    const oldRealTime = (preVars['世界']?.['现实']?.['时间'] ?? null) as string | null;
    const oldDreamTime = (preVars['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;
    let { nextVariables, snapshot } = applyParsedToChat(preVars, parsed);
    autoTagDreamItems(preVars, nextVariables);

    let apiUsed: 'primary' | 'secondary' | 'dual' = 'primary';
    let secondaryRaw = '';
    if (effectiveApi.secondary?.enabled && effectiveSettings.apiMode === 'dual' && effectiveApi.secondary.baseUrl && effectiveApi.secondary.apiKey) {
      setDualRunning(true);
      const maintextForVars = parsed.maintext || events.filter(e => e.type === 'tag-chunk' || e.type === 'raw').map((e: any) => e.chunk).join('');
      if (maintextForVars.trim()) {
        try {
          // 查找激活的变量预设
          const varsPreset = effectiveSettings.presets.find(
            p => p.id === effectiveSettings.activeVarsPresetId && p.type === 'vars',
          );

          const secMessages: Array<{ role: string; content: string }> = [];

          if (varsPreset) {
            const lorebooks = effectiveSettings.lorebooks ?? [];
            const secMacroCtx = {
              userName: effectiveSettings.userName,
              characterName: effectiveSettings.characterName,
              userInput: userText,
              playerDescription: effectiveSettings.playerDescription,
              characterDescription: effectiveSettings.characterDescription,
              varsListText: formatVariablesForPrompt(nextVariables),
              lastMaintext: maintextForVars,
            };
            for (const block of varsPreset.blocks) {
              if (!block.enabled || !block.content?.trim()) continue;
              let resolved = resolveLorebyMacro(block.content, lorebooks);
              resolved = replaceMacros(resolved, secMacroCtx);
              if (resolved.trim()) {
                secMessages.push({ role: block.role, content: resolved });
              }
            }
          } else {
            secMessages.push({ role: 'system', content: '根据变量更新规则，从正文中提取变量变动。输出格式为 JSONPatch 数组或 JSON 合并对象。只输出 JSON，不要包含其他文本。' });
            secMessages.push({ role: 'user', content: `当前变量：\n${JSON.stringify(nextVariables, null, 2)}\n\n正文：\n${maintextForVars.slice(0, 3000)}` });
          }

          const secResult = await freshRouter.call('vars', {
            messages: secMessages as any,
            stream: false,
            temperature: effectiveApi.secondary.temperature ?? 0.3,
            max_tokens: effectiveApi.secondary.maxTokens ?? 2048,
          });
          if (secResult.response.ok) {
            const d = await secResult.response.json();
            const raw = d?.choices?.[0]?.message?.content ?? '';
            secondaryRaw = raw;  // 保存第二API原始输出，追加到助理消息下方

            // 尝试 JSON 对象（旧格式：深度合并）
            const mObj = raw.match(/\{[\s\S]*\}/);
            if (mObj) {
              try {
                const sp = JSON.parse(mObj[0]);
                if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
                  nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: sp }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
                  autoTagDreamItems(preVars, nextVariables);
                  snapshot = JSON.parse(JSON.stringify(nextVariables));
                  apiUsed = 'dual';
                }
              } catch { /* JSON parse failed, try array format below */ }
            }

            // 尝试 JSON 数组（新格式：JSONPatch）
            if (apiUsed !== 'dual') {
              const mArr = raw.match(/\[[\s\S]*\]/);
              if (mArr) {
                try {
                  const patches = JSON.parse(mArr[0]);
                  if (Array.isArray(patches) && patches.length > 0) {
                    nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: {}, patches }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
                    autoTagDreamItems(preVars, nextVariables);
                    snapshot = JSON.parse(JSON.stringify(nextVariables));
                    apiUsed = 'dual';
                  }
                } catch { /* fallback to primary vars */ }
              }
            }
          }
        } catch { /* fallback to primary vars */ }
      }
    }
    setDualRunning(false);

    // 第二API输出追加到正文
    if (secondaryRaw) {
      rawContent += '\n\n<details><summary>🔍 第二API变量提取</summary>\n\n' + secondaryRaw + '\n\n</details>';
    }

    // Auto-unequip items that don't match current plane
    const oldInDream = preVars?.世界?.梦境定位?.位于梦境 === true;
    const newInDream = nextVariables?.世界?.梦境定位?.位于梦境 === true;

    // 检测梦境状态转移，更新锚点（用于倒计时计算）
    let updatedDreamAnchor = { ...(updatedChat.dreamAnchor ?? {}) };
    if (oldInDream !== newInDream) {
      validateEquipment(nextVariables);
      snapshot = JSON.parse(JSON.stringify(nextVariables));

      if (oldInDream && !newInDream) {
        // 从梦境苏醒 → 记录现实时间作为锚点
        updatedDreamAnchor.lastWokeAt = nextVariables?.['世界']?.['现实']?.['时间'] ?? '';
      } else if (!oldInDream && newInDream) {
        // 进入梦境 → 记录梦境时间作为锚点
        updatedDreamAnchor.lastEnteredAt = nextVariables?.['世界']?.['梦境存档']?.['时间'] ?? '';
      }
    }

    // 只有世界时间实际变化时才跑生理 tick
    const newRealTime = (nextVariables?.['世界']?.['现实']?.['时间'] ?? null) as string | null;
    const newDreamTime = (nextVariables?.['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;

    if (newRealTime && newRealTime !== oldRealTime) {
      tickAllFemales(nextVariables, oldRealTime, newRealTime, { dreamOnly: false });
    }
    if (newDreamTime && newDreamTime !== oldDreamTime) {
      tickAllFemales(nextVariables, oldDreamTime, newDreamTime, { dreamOnly: true });
    }
    if (newRealTime !== oldRealTime || newDreamTime !== oldDreamTime) {
      snapshot = JSON.parse(JSON.stringify(nextVariables));
    }

    // enrichHistory 使用 postVars（变量更新后的最新状态）
    if (parsed.history) {
      parsed.history = enrichHistory(parsed.history, nextVariables);

      // 增量更新 plotHistory 缓存
      const prevPH = updatedChat.plotHistory ?? { reality: [], dream: [] };
      const sp = parsed.history;
      const plotHistory: HistoryTimeline = {
        reality: [...prevPH.reality],
        dream: [...prevPH.dream],
      };
      if (sp.world === '现实') {
        plotHistory.reality.push({ ...sp, sequence: plotHistory.reality.length + 1 });
      } else if (sp.world === '梦境') {
        plotHistory.dream.push({ ...sp, sequence: plotHistory.dream.length + 1 });
      }
      const plotHistorySnapshot = JSON.parse(JSON.stringify(plotHistory));

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: rawContent,
        timestamp: Date.now(), parsed, variablesAfter: snapshot, dreamAnchorAfter: { ...updatedDreamAnchor }, plotHistoryAfter: plotHistorySnapshot, apiUsed,
      };
      const finalChat: ChatSession = { ...updatedChat, messages: [...updatedChat.messages, assistantMsg], variables: nextVariables, dreamAnchor: updatedDreamAnchor, plotHistory, updatedAt: Date.now() };
      await db.chats.put(finalChat);
      setChats(prev => prev.map(c => c.id === finalChat.id ? finalChat : c));

      abortRef.current = null;
      return { aborted: false };
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant',
      content: rawContent,
      timestamp: Date.now(), parsed, variablesAfter: snapshot, dreamAnchorAfter: { ...updatedDreamAnchor }, apiUsed,
    };
    const finalChat: ChatSession = { ...updatedChat, messages: [...updatedChat.messages, assistantMsg], variables: nextVariables, dreamAnchor: updatedDreamAnchor, updatedAt: Date.now() };
    await db.chats.put(finalChat);
    setChats(prev => prev.map(c => c.id === finalChat.id ? finalChat : c));

    abortRef.current = null;
    return { aborted: false };
  }, [activeChat, settings, parser]);

  const jumpToFloor = useCallback(async (messageId: string) => {
    // Read latest from DB to avoid stale closure over activeChat
    const chats = await db.chats.toArray();
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    const idx = chat.messages.findIndex(m => m.id === messageId);
    if (idx < 0) return;
    const truncated = chat.messages.slice(0, idx + 1);
    const target = truncated[truncated.length - 1];
    const restoredVars = target?.role === 'assistant' && target.variablesAfter ? target.variablesAfter : chat.variables ?? {};
    const restoredAnchor = target?.role === 'assistant' && target.dreamAnchorAfter ? target.dreamAnchorAfter : chat.dreamAnchor ?? {};
    const restoredPlotHistory = target?.role === 'assistant' && target.plotHistoryAfter ? target.plotHistoryAfter : chat.plotHistory;
    const next: ChatSession = { ...chat, messages: truncated, variables: restoredVars, dreamAnchor: restoredAnchor, plotHistory: restoredPlotHistory, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
  }, [activeChatId]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const chats = await db.chats.toArray();
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    const nextMessages = chat.messages.map(m =>
      m.id === messageId ? { ...m, content: newContent } : m,
    );
    const next: ChatSession = { ...chat, messages: nextMessages, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
  }, [activeChatId]);

  const regenerateLast = useCallback(async () => {
    if (!activeChat) return;
    const lastUserIdx = [...activeChat.messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx < 0) return;
    const targetIdx = activeChat.messages.length - 1 - lastUserIdx;
    const truncated = activeChat.messages.slice(0, targetIdx);
    const lastAssistant = [...truncated].reverse().find(m => m.role === 'assistant');
    const restoredPlotHistory = lastAssistant?.plotHistoryAfter ?? activeChat.plotHistory;
    // Restore variables from last assistant too
    const restoredVars = lastAssistant?.variablesAfter ?? activeChat.variables ?? {};
    const restoredAnchor = lastAssistant?.dreamAnchorAfter ?? activeChat.dreamAnchor ?? {};
    const next: ChatSession = { ...activeChat, messages: truncated, variables: restoredVars, dreamAnchor: restoredAnchor, plotHistory: restoredPlotHistory, updatedAt: Date.now() };
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

  const refreshPrompt = useCallback(async (simulateInput?: string) => {
    if (!settings) return;
    const latestSettings = await getSettings();
    const effectiveSettings = {
      ...(latestSettings ?? DEFAULT_SETTINGS),
      ...(settings ?? {}),
      presetBlocks: latestSettings?.presetBlocks ?? settings?.presetBlocks ?? DEFAULT_PRESET_BLOCKS,
      lorebooks: latestSettings?.lorebooks ?? settings?.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
      presetParams: latestSettings?.presetParams ?? settings?.presetParams,
    };
    const chatVars = activeChat?.variables ?? DEFAULT_WORLD_VARS;
    const chatHistory = activeChat?.messages ?? [];
    const userInput = simulateInput
      ?? [...chatHistory].reverse().find(m => m.role === 'user')?.content
      ?? '';
    const { messages, totalTokens, stageTokens, stageMessages, stageOrder, stageNames } = assemblePrompt({
      userInput,
      history: chatHistory,
      presetBlocks: effectiveSettings.presetBlocks,
      lorebooks: effectiveSettings.lorebooks,
      userName: effectiveSettings.userName ?? DEFAULT_SETTINGS.userName,
      characterName: effectiveSettings.characterName ?? DEFAULT_SETTINGS.characterName,
      playerDescription: effectiveSettings.playerDescription,
      characterDescription: effectiveSettings.characterDescription,
      squashSystemMessages: effectiveSettings.squashSystemMessages,
      mapTree: chatVars['地图'],
      characters: chatVars['主要人物'],
      fullVariables: chatVars,
      currentLocation: chatVars['世界']?.['现实']?.['地点'] ?? '',
      isDream: chatVars['世界']?.['梦境定位']?.['位于梦境'] ?? false,
      plotHistory: activeChat?.plotHistory,
      dreamAnchor: activeChat?.dreamAnchor,
      recentMessageCount: effectiveSettings.recentMessageCount ?? DEFAULT_SETTINGS.recentMessageCount,
    });
    setLastPrompt({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      estimatedTokens: totalTokens,
      stageTokens,
      stageMessages,
      stageOrder,
      stageNames,
    });

    // 重建第二API提示词预览
    buildSecondaryPrompt(effectiveSettings, activeChat);
  }, [activeChat, settings, buildSecondaryPrompt]);

  return {
    settings, chats, activeChat, initialized, lastPrompt, lastSecondaryPrompt,
    createChat, selectChat, removeChat, sendGameMessage, jumpToFloor, editMessage, regenerateLast,
    updateSettings, setChatVariables, refreshPrompt,
    streamState: parser.state, abortStream: () => { abortRef.current?.abort(); parser.reset(); },
    dualRunning, toast, showToast,
  };
}

// ── Type export for Context ──

export type SillytavernContextType = ReturnType<typeof useSillytavern>;
