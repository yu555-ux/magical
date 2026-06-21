/**
 * 静态导入所有提示词模块文件。
 * Vite 的 ?raw 导入将 .md 文件内容作为字符串返回。
 */

import gmSystemRaw from './gm-system.md?raw';
import gmWorldLogicRaw from './gm-world-logic.md?raw';
import gmCharacterEngineRaw from './gm-character-engine.md?raw';
import gmNarrativeVoiceRaw from './gm-narrative-voice.md?raw';
import gmNeutralRaw from './gm-neutral.md?raw';
import gmAntiLiteraryRaw from './gm-anti-literary.md?raw';
import gmWritingStyleRaw from './gm-writing-style.md?raw';
import gmStyleBlacklistRaw from './gm-style-blacklist.md?raw';
import gmRenderProtocolRaw from './gm-render-protocol.md?raw';
import gmStoryDriverRaw from './gm-story-driver.md?raw';
import gmToolPolicyRaw from './gm-tool-policy.md?raw';
import gmRulesRaw from './gm-rules.md?raw';
import gmOutputContractRaw from './gm-output-contract.md?raw';
import gmThinkRaw from './gm-think.md?raw';
import gmTurnReminderRaw from './gm-turn-reminder.md?raw';

import { SKILL_CONTENT } from '../skills/skill-registry';

/** source 路径 → 文件内容 */
export const MODULE_CONTENT: Record<string, string> = {
  ...SKILL_CONTENT,
  'agent-prompt/gm-system.md': gmSystemRaw,
  'agent-prompt/gm-world-logic.md': gmWorldLogicRaw,
  'agent-prompt/gm-character-engine.md': gmCharacterEngineRaw,
  'agent-prompt/gm-narrative-voice.md': gmNarrativeVoiceRaw,
  'agent-prompt/gm-neutral.md': gmNeutralRaw,
  'agent-prompt/gm-anti-literary.md': gmAntiLiteraryRaw,
  'agent-prompt/gm-writing-style.md': gmWritingStyleRaw,
  'agent-prompt/gm-style-blacklist.md': gmStyleBlacklistRaw,
  'agent-prompt/gm-render-protocol.md': gmRenderProtocolRaw,
  'agent-prompt/gm-story-driver.md': gmStoryDriverRaw,
  'agent-prompt/gm-tool-policy.md': gmToolPolicyRaw,
  'agent-prompt/gm-rules.md': gmRulesRaw,
  'agent-prompt/gm-output-contract.md': gmOutputContractRaw,
  'agent-prompt/gm-think.md': gmThinkRaw,
  'agent-prompt/gm-turn-reminder.md': gmTurnReminderRaw,
};
