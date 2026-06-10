/**
 * 提示词注入引擎
 *
 * 读 preset.json → 加载 .md 模块内容 → 按 slot + priority 排序
 * → 包裹 XML 标签 → 返回分 slot 的消息数组
 *
 * 参考 fate-sandbox 的 engine/gm-prompt/injection.ts
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
}

export interface InjectionContext {
  userName: string;
  characterName: string;
  /** 玩家本轮原始输入（用于宏替换 {{original}} / {{lastUserMessage}}） */
  userInput: string;
  /** 完整变量树（用于 buildGmBrief） */
  variables: Record<string, any>;
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

function loadPromptModules(): PromptModule[] {
  const modules: PromptModule[] = [];

  for (const m of presetData.modules) {
    if (!m.enabled) continue;

    let body: string;
    if (m.source === 'runtime:state-brief') {
      // 运行时动态生成，这里放占位，buildSlotMessages 时替换
      body = '__RUNTIME_STATE_BRIEF__';
    } else {
      body = MODULE_CONTENT[m.source] ?? '';
      if (!body) {
        console.warn(`[injection] 模块 "${m.id}" 的源文件 "${m.source}" 未找到`);
        continue;
      }
    }

    modules.push({
      id: m.id,
      slot: m.slot as PromptSlot,
      priority: m.priority,
      header: m.header,
      body,
    });
  }

  return modules;
}

// ── GM Brief builder ──

function buildGmBrief(variables: Record<string, any>): string {
  const lines: string[] = ['当前机械状态简报由变量树派生，只读参考，工具返回值优先。', ''];

  // 时间
  const time = variables['世界']?.['现实']?.['时间'];
  if (time) lines.push(`时间：${time}`);

  // 地点
  const place = variables['世界']?.['现实']?.['地点'];
  if (place) lines.push(`地点：${place}`);

  // 梦境/现实
  const isDream = variables['世界']?.['现实']?.['是否梦境'];
  if (isDream === true) lines.push(`⚠️ 当前处于梦境中`);

  lines.push('');

  // 玩家资源
  const res = variables['主角']?.['资源'];
  const body = variables['主角']?.['身体属性'];
  if (res || body) {
    const parts: string[] = [];
    if (res?.['HP'] !== undefined) {
      const max = res['HP上限'] ?? '?';
      parts.push(`HP ${res['HP']}/${max}`);
    }
    if (res?.['MP'] !== undefined) {
      const max = res['MP上限'] ?? '?';
      parts.push(`MP ${res['MP']}/${max}`);
    }
    if (body?.['生命']?.['当前'] !== undefined) {
      const max = body['生命']?.['上限'] ?? '?';
      parts.push(`生命 ${body['生命']['当前']}/${max}`);
    }
    if (body?.['能量']?.['当前'] !== undefined) {
      const max = body['能量']?.['上限'] ?? '?';
      parts.push(`能量 ${body['能量']['当前']}/${max}`);
    }
    if (body?.['SAN']?.['当前'] !== undefined) {
      const max = body['SAN']?.['上限'] ?? '?';
      parts.push(`SAN ${body['SAN']['当前']}/${max}`);
    }
    if (res?.['金钱'] !== undefined) {
      parts.push(`金钱 ${res['金钱']}`);
    }
    if (parts.length > 0) lines.push(`资源：${parts.join('  |  ')}`);
  }

  // 评级
  const rating = variables['主角']?.['评级'];
  if (rating) lines.push(`评级：${rating}`);

  // 同行者
  const companions = variables['主角']?.['同行者'];
  if (Array.isArray(companions) && companions.length > 0) {
    lines.push(`同行者：${companions.join('、')}`);
  }

  // 状态异常
  const conditions = variables['主角']?.['状态'];
  if (conditions && typeof conditions === 'object' && Object.keys(conditions).length > 0) {
    const condText = Object.entries(conditions as Record<string, any>)
      .map(([name, detail]) => {
        const desc = detail?.描述 ?? '';
        return desc ? `${name}（${desc}）` : name;
      })
      .join('；');
    if (condText) lines.push(`状态异常：${condText}`);
  }

  // 最近剧情节点
  const plotReality = variables['_plotHistory']?.['reality'];
  if (Array.isArray(plotReality) && plotReality.length > 0) {
    const recent = plotReality.slice(-3);
    const titles = recent.map((n: any) => n.title).filter(Boolean);
    if (titles.length > 0) lines.push(`最近事件：${titles.join(' → ')}`);
  }

  lines.push('');
  lines.push('这份简报只用于压住叙事倾向，不能替代工具调用；本轮任何工具返回值都覆盖简报。');

  return lines.join('\n');
}

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

      // 运行时动态生成 GM Brief
      if (m.id === 'mechanical-state') {
        body = buildGmBrief(ctx.variables);
      }

      // 解析 {{user}} <user> {{char}} 等宏
      body = replaceMacros(body, macroCtx);

      return {
        role: 'user' as const,
        content: `<${m.header}>\n${body}\n</${m.header}>`,
      };
    });
}

// ── Main entry ──

export function buildInjectionContext(ctx: InjectionContext): InjectionResult {
  const modules = loadPromptModules();

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
