/**
 * 提示词注入引擎
 *
 * 读 preset.json → 加载 .md 模块内容 → 按 slot + priority 排序
 * → 包裹 XML 标签 → 返回分 slot 的消息数组
 *
 * 参考 fate-sandbox 的 engine/gm-prompt/injection.ts
 *
 * ## preset.json 版本规则
 *
 * `version` 字段用于追踪模块声明的结构变化。语义：
 *   - 增删模块、改 slot/priority/header 或改 source 路径 → bump version
 *   - 仅修改 .md 文件内容（不改 preset.json）→ version 不变
 *
 * 安全修改流程：
 *   1. 修改 preset.json → bump version
 *   2. 如果需要新增 .md 文件：
 *      a. 在 module-content.ts 中 import 并注册到 MODULE_CONTENT
 *      b. 在 preset.json 中添加模块声明
 *   3. 如果删除模块，确保 preset.json 和 module-content.ts 同步更新
 *   4. 检查 injection.ts 的 InjectionResult 接口是否需要扩展
 */

import presetData from './preset.json';
import { MODULE_CONTENT } from './module-content';
import { replaceMacros } from '../prompt-assembler';

// ── Types ──

export type PromptSlot = 'pre-history' | 'pre-response' | 'final-contract';

interface PromptModule {
  id: string;
  slot: PromptSlot;
  priority: number;
  header: string;
  body: string;
  source: string;
}

export interface InjectionContext {
  userName: string;
  characterName: string;
  /** 玩家本轮原始输入（用于宏替换 {{original}} / {{lastUserMessage}}） */
  userInput: string;
  /** 完整变量树（用于 buildGmBrief） */
  variables: Record<string, any>;
  /** 启用的 Skill ID 列表（来自 AppSettings.enabledSkills） */
  enabledSkills: string[];
}

export interface InjectionResult {
  /** 注入到聊天历史之前的消息（背景参考） */
  preHistoryMessages: Array<{ role: 'user'; content: string }>;
  /** 注入到用户输入之后的消息（最高注意力） */
  preResponseMessages: Array<{ role: 'user'; content: string }>;
  /** 注入到最后的格式约束 */
  finalContractMessages: Array<{ role: 'user'; content: string }>;
  /** System prompt 内容（gm-system.md，由调用方自行处理） */
  systemPromptContent: string;
  /** 当前模块清单名称列表（调试用） */
  loadedModules: string[];
}

// ── Module loading ──

function loadPromptModules(enabledSkills: string[]): PromptModule[] {
  const modules: PromptModule[] = [];

  for (const m of presetData.modules) {
    if (!m.enabled) continue;

    // Skill 模块：由用户设置控制启用/关闭
    if (m.id.startsWith('skill-') && !enabledSkills.includes(m.id)) {
      continue;
    }

    let body: string;
    if (m.source === 'runtime:state-brief') {
      body = '__RUNTIME_STATE_BRIEF__';
    } else {
      body = MODULE_CONTENT[m.source] ?? '';
      if (!body) {
        console.warn(`[injection] 模块 "${m.id}" 的源文件 "${m.source}" 未在 MODULE_CONTENT 中注册。请在 module-content.ts 中添加对应的 import。`);
        continue;
      }
    }

    modules.push({
      id: m.id,
      slot: m.slot as PromptSlot,
      priority: m.priority,
      header: m.header,
      body,
      source: m.source,
    });
  }

  return modules;
}

// ── GM Brief builder ──
// 直接复用 get_status 的完整输出（buildStatusBrief），
// 确保自动注入的 <player_var> 与工具返回值格式完全一致。
// 见 sillytavern/tools/lookup.ts

import { buildStatusBrief } from '../tools/lookup';

// ── Slot message builder ──

function buildSlotMessages(
  modules: PromptModule[],
  slot: PromptSlot,
  ctx: InjectionContext,
): Array<{ role: 'user'; content: string }> {
  const macroCtx = {
    userName: ctx.userName,
    characterName: ctx.characterName,
    userInput: ctx.userInput,
    playerDescription: '',
    characterDescription: '',
    varsListText: '',
    lastMaintext: '',
    fullVars: ctx.variables,
  };

  return modules
    .filter(m => m.slot === slot)
    .sort((a, b) => a.priority - b.priority)
    .map(m => {
      let body = m.body;

      // 运行时动态生成 <player_var>（与 get_status 工具同源，格式完全一致）
      if (m.id === 'mechanical-state') {
        body = buildStatusBrief(ctx.variables, ctx.userName);
      }

      // skill 模块：开头加 References 行（对齐 piagent formatSkillInvocation）
      if (m.id.startsWith('skill-')) {
        const skillDir = m.source.replace(/\/[^/]+\.md$/, '');
        body = `References are relative to ${skillDir}/.\n\n${body}`;
      }

      // 解析 {{user}} <user> {{char}} 等宏
      body = replaceMacros(body, macroCtx);

      // 支持带属性的标签头（如 skill name="xxx" location="xxx"）
      const tagName = m.header.split(/\s+/)[0];
      return {
        role: 'user' as const,
        content: `<${m.header}>\n${body}\n</${tagName}>`,
      };
    });
}

// ── Main entry ──

export function buildInjectionContext(ctx: InjectionContext): InjectionResult {
  const modules = loadPromptModules(ctx.enabledSkills ?? []);

  const systemPromptContent = MODULE_CONTENT['agent-prompt/gm-system.md'] ?? '';

  const result: InjectionResult = {
    preHistoryMessages: buildSlotMessages(modules, 'pre-history', ctx),
    preResponseMessages: buildSlotMessages(modules, 'pre-response', ctx),
    finalContractMessages: buildSlotMessages(modules, 'final-contract', ctx),
    systemPromptContent,
    loadedModules: modules.map(m => m.id),
  };

  return result;
}
