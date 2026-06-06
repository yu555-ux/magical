import { replaceMacros } from './prompt-assembler';
import { formatVariablesForPrompt } from './variables';
import { resolveLorebyMacro } from './lorebook-resolver';
import { DEFAULT_SETTINGS, type AppSettings, type ChatSession } from './types';

export interface SecondaryPromptData {
  messages: Array<{ role: string; content: string }>;
  estimatedTokens: number;
  stageTokens: Record<string, number>;
  stageMessages: Record<string, Array<{ role: string; content: string }>>;
  stageOrder: string[];
  stageNames: Record<string, string>;
}

/**
 * Build secondary-API prompt preview from vars preset blocks.
 * Pure logic — the caller decides how to store the result (e.g. via setState).
 */
export function buildSecondaryPrompt(
  s: AppSettings,
  chat: ChatSession | null,
): SecondaryPromptData | null {
  const varsPreset = s.presets?.find(
    p => p.id === s.activeVarsPresetId && p.type === 'vars',
  );
  if (!varsPreset) return null;

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
    fullVars: chatVars,
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

  if (secStageOrder.length === 0) return null;

  return {
    messages: [],
    estimatedTokens: secTotalTokens,
    stageTokens: secStageTokens,
    stageMessages: secStageMessages,
    stageOrder: secStageOrder,
    stageNames: secStageNames,
  };
}
