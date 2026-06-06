import { useCallback } from 'react';
import type { AppSettings, ChatSession, VarChange } from '../sillytavern/types';
import { DEFAULT_SETTINGS, DEFAULT_PRESET_BLOCKS } from '../sillytavern/types';
import { getSettings } from '../sillytavern/database';
import { createApiRouter } from '../sillytavern/api-router';
import { showTopCenter } from '../components/shared/TopCenterToast';
import { resolveLorebyMacro } from '../sillytavern/lorebook-resolver';
import { replaceMacros } from '../sillytavern/prompt-assembler';
import { formatVariablesForPrompt, applyParsedToChat, autoTagDreamItems, buildVarChanges } from '../sillytavern/variables';
import { tickAllFemales, tickAges, type FertilizationResult } from '../sillytavern/physiology';
import { buildSecondaryPrompt } from '../sillytavern/secondary-prompt-builder';
import type { Table } from 'dexie';

// Match the database shape used in useSillytavern
interface AppDB {
  chats: Table<ChatSession>;
}

export interface RegenerateVarsDeps {
  activeChat: ChatSession | null;
  settings: AppSettings | null;
  db: AppDB;
  setDualRunning: (v: boolean) => void;
  dualAbortRef: React.MutableRefObject<AbortController | null>;
  setLastRawContent: (v: string) => void;
  setChats: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setLastSecondaryPrompt: (v: any) => void;
}

export function useRegenerateVars({
  activeChat, settings, db, setDualRunning, dualAbortRef,
  setLastRawContent, setChats, setLastSecondaryPrompt,
}: RegenerateVarsDeps) {
  return useCallback(async (): Promise<{
    patchCount: number;
    varChanges: VarChange[];
    fertilizationEvents: FertilizationResult[];
  } | null> => {
    if (!activeChat || !settings) return null;
    setDualRunning(true);
    // Read latest chat from DB to avoid stale closure
    const dbChats = await db.chats.toArray();
    const chat = dbChats.find(c => c.id === activeChat.id) ?? activeChat;
    const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant?.parsed?.maintext) { setDualRunning(false); return null; }

    const latestSettings = await getSettings();
    const effectiveApi = latestSettings?.api ?? settings.api ?? DEFAULT_SETTINGS.api;
    const effectiveSettings = {
      ...(latestSettings ?? DEFAULT_SETTINGS),
      ...(settings ?? {}),
      api: effectiveApi,
      presetBlocks: latestSettings?.presetBlocks ?? settings?.presetBlocks ?? DEFAULT_PRESET_BLOCKS,
      lorebooks: latestSettings?.lorebooks ?? settings?.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
    };

    if (!effectiveApi.secondary?.enabled || !effectiveApi.secondary.baseUrl) { setDualRunning(false); return null; }

    const router = createApiRouter(effectiveApi);
    // Roll back to state before last assistant to avoid repeated patch accumulation
    const lastIdx = chat.messages.indexOf(lastAssistant);
    let preVars = JSON.parse(JSON.stringify(chat.variables ?? {}));
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (chat.messages[i].variablesAfter) { preVars = JSON.parse(JSON.stringify(chat.messages[i].variablesAfter)); break; }
    }
    const maintextForVars = lastAssistant.parsed.maintext;

    const varsPreset = effectiveSettings.presets?.find(
      (p) => p.id === effectiveSettings.activeVarsPresetId && p.type === 'vars',
    );

    if (!varsPreset) { setDualRunning(false); return null; }

    try {
      const secMessages: Array<{ role: string; content: string }> = [];
      const lorebooks = effectiveSettings.lorebooks ?? [];
      const secMacroCtx = {
        userName: effectiveSettings.userName,
        characterName: effectiveSettings.characterName,
        userInput: '',
        playerDescription: effectiveSettings.playerDescription,
        characterDescription: effectiveSettings.characterDescription,
        varsListText: formatVariablesForPrompt(preVars),
        lastMaintext: maintextForVars,
        fullVars: preVars,
      };

      for (const block of varsPreset.blocks) {
        if (!block.enabled || !block.content?.trim()) continue;
        let resolved = resolveLorebyMacro(block.content, lorebooks);
        resolved = replaceMacros(resolved, secMacroCtx);
        if (resolved.trim()) secMessages.push({ role: block.role, content: resolved });
      }

      // Sync prompt viewer (secondary API variable prompt)
      const secondaryPrompt = buildSecondaryPrompt(effectiveSettings, chat);
      setLastSecondaryPrompt(secondaryPrompt);

      const dualController = new AbortController();
      dualAbortRef.current = dualController;
      const { response } = await router.call('vars', {
        messages: secMessages as any,
        stream: false,
        temperature: effectiveApi.secondary.temperature ?? 0.3,
        max_tokens: effectiveApi.secondary.maxTokens ?? 2048,
      }, dualController.signal);

      if (!response.ok) { showTopCenter('变量重写失败', 'error'); return null; }
      const d = await response.json();
      const raw = d?.choices?.[0]?.message?.content ?? '';
      let nextVariables = JSON.parse(JSON.stringify(preVars));
      let patchCount = 0;
      const semenPatches: any[] = [];

      const mArr = raw.match(/\[[\s\S]*\]/);
      let varsRegenerated = false;
      if (mArr) {
        try {
          const patches = JSON.parse(mArr[0]);
          if (Array.isArray(patches) && patches.length > 0) {
            nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: {}, patches }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
            autoTagDreamItems(preVars, nextVariables);
            patchCount = patches.length;
            for (const p of patches) if (p.path && (p.path as string).includes('宫内精液.总量')) semenPatches.push(p);
            varsRegenerated = true;
          }
        } catch { /* ignore */ }
      }
      if (nextVariables === preVars) {
        const mObj = raw.match(/\{[\s\S]*\}/);
        if (mObj) {
          try {
            const sp = JSON.parse(mObj[0]);
            if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
              nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: sp }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
              autoTagDreamItems(preVars, nextVariables);
              patchCount = Object.keys(sp).length;
              varsRegenerated = true;
            }
          } catch { /* ignore */ }
        }
      }

      // Build variable changes
      const varChanges = varsRegenerated ? buildVarChanges(preVars, nextVariables) : [];

      // AI modified intrauterine semen → sync total
      const processedSemenNodes = new Set<any>();
      for (const p of semenPatches) {
        const parts = (p.path as string).split('/');
        const semenIdx = parts.indexOf('宫内精液');
        if (semenIdx > 0) {
          const base = parts.slice(0, semenIdx + 1);
          let node: any = nextVariables;
          for (const seg of base) { if (node && typeof node === 'object') node = node[seg]; else break; }
          if (!node || typeof node !== 'object' || processedSemenNodes.has(node)) continue;
          processedSemenNodes.add(node);
          if (Array.isArray(node['来源列表'])) {
            node['总量'] = node['来源列表'].reduce((sum: number, e: any) => sum + (e['容量'] || 0), 0);
          }
        }
      }

      // Physiology tick → fertilization detection
      const oldRealTime = (preVars?.['世界']?.['现实']?.['时间'] ?? null) as string | null;
      const oldDreamTime = (preVars?.['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;
      const newRealTime = (nextVariables?.['世界']?.['现实']?.['时间'] ?? null) as string | null;
      const newDreamTime = (nextVariables?.['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;
      const fertilizationEvents: FertilizationResult[] = [];
      if (newRealTime && newRealTime !== oldRealTime) {
        tickAges(nextVariables, oldRealTime, newRealTime);
        fertilizationEvents.push(...tickAllFemales(nextVariables, oldRealTime, newRealTime, { dreamOnly: false, prevVariables: preVars }));
      }
      if (newDreamTime && newDreamTime !== oldDreamTime) {
        fertilizationEvents.push(...tickAllFemales(nextVariables, oldDreamTime, newDreamTime, { dreamOnly: true, prevVariables: preVars }));
      }

      // Update raw content viewer
      if (raw) {
        let tagged = raw;
        if (!/<JSONPatch/i.test(tagged)) {
          tagged = `<JSONPatch>\n${tagged}\n</JSONPatch>`;
        }
        if (!/<Analysis/i.test(tagged)) {
          tagged = `<Analysis>\n变量分析\n</Analysis>\n${tagged}`;
        }
        setLastRawContent(`<maintext>\n${lastAssistant.parsed.maintext}\n</maintext>\n\n${tagged}`);
      }

      // Update last assistant message's varChanges
      const updatedMessages = chat.messages.map(m =>
        m.id === lastAssistant.id ? { ...m, varChanges } : m
      );

      const next: ChatSession = { ...chat, messages: updatedMessages, variables: nextVariables, updatedAt: Date.now() };
      await db.chats.put(next);
      setChats(prev => prev.map(c => c.id === next.id ? next : c));
      return varsRegenerated ? { patchCount, varChanges, fertilizationEvents } : null;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      console.error('[SillyTavern] 变量重写失败:', e);
      showTopCenter('变量重写失败', 'error');
      return null;
    } finally {
      dualAbortRef.current = null;
      setDualRunning(false);
    }
  }, [activeChat, settings, db, setDualRunning, dualAbortRef, setLastRawContent, setChats, setLastSecondaryPrompt]);
}
