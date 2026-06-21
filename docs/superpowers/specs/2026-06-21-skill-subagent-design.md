# Skill 系统 + 正文优化流水线 + Subagent 远期设计

> 2026-06-21
> 基于 Fate sandbox + piagent 参考架构，对 web 端 GM Agent 进行流程编排能力升级。

---

## 〇、设计前提

经用户确认的三项定位：

| 维度 | 定位 | 含义 |
|------|------|------|
| **Skill** | GM 内部工作流模板 | 不是玩家可见的 `/命令`，而是 GM(AI) 在不同阶段自动加载的流程指引。玩家不感知 skill 的加载和切换。 |
| **优化流水线** | 多轮 tool loop 模式 | 将当前 `submit_reply` 的一次性提交拆分为：大纲→骰子→正文→审查→修改→提交，每个阶段有专门工具，AI 在 tool loop 中自然流转。 |
| **Subagent** | 后台世界进程 | 远期目标。让 NPC/阵营在玩家视野外独立行动，产出 offscreen event。不是当前优先事项。 |

---

## 一、Skill 系统设计

### 1.1 概念模型

Skill = **流程知识模块**。它告诉 GM（AI）"当前阶段该做什么 + 怎么判断做完了 + 质量门禁是什么"。

与现有 `agent-prompt/` 模块的关键区别：

| | 现有模块（gm-rules.md 等） | Skill |
|---|---|---|
| 加载方式 | 静态（启动时全部加载） | 动态（按阶段触发加载） |
| 生命周期 | 常驻（整个会话） | 临时（当前阶段结束后卸载） |
| 职责 | 提供持久规则和约束 | 提供当前阶段的步骤清单和质量标准 |
| 内容粒度 | 宽泛（"写中文第二人称"） | 具体（"检查字数是否在 1000-1500 之间，检测以下八股句式…"） |

### 1.2 数据结构

```typescript
// sillytavern/skills/types.ts

/** Skill 触发条件 */
interface SkillTrigger {
  /** 触发类型 */
  type: 'phase' | 'tool_called' | 'condition';
  /** 匹配值 */
  value: string;
}

/** Skill 中的质量门禁 */
interface QualityGate {
  /** 门禁名称 */
  name: string;
  /** 检查内容描述（给 AI 看） */
  description: string;
  /** 通过条件（给 AI 看） */
  passCondition: string;
  /** 不通过时的处理（给 AI 看） */
  onFail: string;
  /** 是否强制执行（true = 不通过则禁止进入下一阶段） */
  mandatory: boolean;
}

/** Skill 定义 */
interface GameSkill {
  /** 唯一标识，如 "prose-optimization" */
  name: string;
  /** 简短描述（用于 AI 判断是否加载） */
  description: string;
  /** 触发条件列表（满足任一即触发） */
  triggers: SkillTrigger[];
  /** 有序的阶段步骤 */
  phases: SkillPhase[];
  /**
   * 注入的 slot（默认 'pre-response'——高注意力区）
   * 可设为 'pre-history' 用于背景参考型 skill
   */
  slot: 'pre-history' | 'pre-response';
  /** 在同一 slot 中的优先级（数字越小越靠前） */
  priority: number;
  /** 完整的 Markdown 指令正文 */
  content: string;
}
```

### 1.3 文件存储格式

每个 Skill 是一个 Markdown 文件，放在 `sillytavern/skills/` 目录下。Frontmatter 存元数据，正文存指令。

```markdown
---
name: prose-optimization
description: 正文优化流水线——大纲→骰子→正文→审查→修改→提交。当AI准备输出叙事时自动加载。
triggers:
  - type: phase
    value: narrative_generation
slot: pre-response
priority: 5
phases:
  - id: outline
    name: 改变量写大纲
    description: 检查本轮变量变化，规划叙事大纲
    tools: [plan_reply]
  - id: dice
    name: 掷必要骰子
    description: 执行大纲中涉及的随机检定
    tools: [roll_check]
  - id: prose
    name: 写正文
    description: 按大纲和骰子结果撰写正文
    tools: [draft_maintext]
  - id: review
    name: 优化修改
    description: 杀八股、检查字数、验证格式
    tools: [review_draft, revise_draft]
    qualityGates:
      - name: word_count
        description: 正文 1000-1500 字
        passCondition: maintext 字符数（不计标签和空白）在 1000-1500 之间
        onFail: 调用 revise_draft 扩写或精简，直到字数达标
        mandatory: true
      - name: cliche_check
        description: 检测八股句式
        passCondition: 不得出现「深吸一口气」「嘴角微微上扬」「眼中闪过一丝…」「一股…涌上心头」「不禁」「不由得」「仿佛…一般」「…的存在」等模板化表达
        onFail: 调用 revise_draft 替换八股句式，改为具象描写
        mandatory: true
      - name: format_check
        description: 检查输出格式
        passCondition: maintext 不含 GM 解说/推理/JSON/骰点/字段名；options 恰好 4 条；history 字段完整
        onFail: 修复格式问题后重新提交
        mandatory: true
  - id: submit
    name: 提交回复
    description: 所有门禁通过后提交最终回复
    tools: [submit_reply]
---

# 正文优化流水线

## 核心原则

你不是在聊天框中即兴回复。你是在交付一篇经过规划、检定、撰写、审查的叙事作品。

## 阶段 1：改变量写大纲 (plan_reply)

在调用 plan_reply 之前：
1. 用 get_status 确认当前状态（HP、位置、时间、在场角色）
2. 对比玩家输入前后的变量变化
3. 在 plan_reply 的参数中描述：哪些变量变了、叙事需要覆盖什么、建议的字数分配

## 阶段 2：掷必要骰子 (roll_check)

对大纲中涉及随机判定的每个环节：
1. 调用 roll_check 执行检定
2. 骰子结果将影响正文的叙事走向——成功和失败的描写应有实质差异

不需要检定的场景（日常对话、观察、移动）跳过此阶段。

## 阶段 3：写正文 (draft_maintext)

按大纲和骰子结果撰写正文：
- 中文第二人称沉浸式叙事
- 不要复述设定表或 GM 简报
- 停在明确可行动的瞬间

## 阶段 4：优化修改 (review_draft → revise_draft)

1. 调用 review_draft，它会返回：
   - 字数统计
   - 八股检测结果
   - 格式问题
2. 根据 review 结果调用 revise_draft 逐项修改
3. 改完后可再次 review_draft 确认
4. 直到所有 mandatory gate 通过

## 阶段 5：提交回复 (submit_reply)

所有门禁通过后调用 submit_reply，将最终正文 + options + history 提交。
```

### 1.4 加载机制

在现有 `agent-context.ts` 的 `buildAgentContext()` 中增加 skill 加载步骤：

```
现有流程:
  1. 运行 injection engine → 加载 preset.json 模块
  2. 构建 layered context (system → ref → history → user → pre-response → final-contract)
  3. 返回 messages + tools

新流程:
  1. 运行 injection engine → 加载 preset.json 模块
  2. 【新增】技能匹配：检查所有 GameSkill 的 triggers，匹配当前阶段
  3. 【新增】将匹配的 skill content 作为附加的 pre-response 模块注入
  4. 构建 layered context (同上)
  5. 返回 messages + tools
```

触发匹配逻辑：

```typescript
// sillytavern/skills/skill-loader.ts

export function matchSkills(
  skills: GameSkill[],
  ctx: {
    currentPhase: string;         // 当前阶段（idle / narrative_generation / combat 等）
    lastToolCalled?: string;     // 上一个被调用的工具名
    userInput: string;          // 玩家输入
  },
): GameSkill[] {
  return skills.filter(skill =>
    skill.triggers.some(trigger => {
      switch (trigger.type) {
        case 'phase':
          return ctx.currentPhase === trigger.value;
        case 'tool_called':
          return ctx.lastToolCalled === trigger.value;
        case 'condition':
          // 简单字符串匹配（未来可扩展为 DSL）
          return ctx.userInput.includes(trigger.value);
        default:
          return false;
      }
    }),
  );
}
```

### 1.5 与现有系统的关系

```
agent-prompt/
  ├── preset.json          ← 静态模块声明（不变）
  ├── module-content.ts    ← 静态模块注册（不变）
  ├── gm-system.md         ← 身份+契约（不变）
  ├── gm-rules.md          ← 持久规则（不变）
  ├── ...                   ← 其他静态模块（不变）
  └── ...

skills/                     ← 【新增目录】
  ├── types.ts             ← GameSkill 类型定义
  ├── skill-loader.ts      ← 触发匹配 + 动态注入
  ├── prose-optimization.md ← 正文优化流水线
  ├── combat-resolution.md  ← 战斗结算流水线（后续）
  └── social-exchange.md    ← 社交交互流水线（后续）

tools/                      ← 【扩展】
  ├── registry.ts          ← 增加新工具注册
  ├── mechanics.ts         ← 增加 plan_reply, review_draft, revise_draft
  └── ...
```

---

## 二、正文优化流水线设计

### 2.1 工具全景图

每个 "Turn" 是一次 LLM 调用。同一次 LLM 响应中可以包含多个并行工具调用（如 Turn 1 同时调 get_status 和 plan_reply），但工具之间有数据依赖的必须分轮（如 review_draft 的结果是 revise_draft 的输入）。

预估 4-5 次 LLM 往返（当前未优化流水线约 2-3 次）：

```
玩家输入 "我挥剑砍向哥布林"
  │
  ▼
Turn 1: get_status() + plan_reply()   ← 并行调用：查状态+写大纲
  │                                       skill prose-optimization 此时被触发注入
  ▼
Turn 2: roll_check() × N + draft_maintext()  ← 并行调用：骰子+初稿
  │
  ▼
Turn 3: review_draft()                ← 审查初稿 → 发现问题
  │
  ▼
Turn 4: revise_draft()                ← 修改 → 若仍有问题则 repeat Turn 3-4
  │
  ▼
Turn 5: submit_reply()                ← 提交最终回复 → 退出 tool loop
```

### 2.2 新增工具定义

#### `plan_reply` — 叙事大纲

```typescript
plan_reply: {
  name: 'plan_reply',
  label: '规划回复大纲',
  category: 'mechanics',
  description:
    '在写正文之前，先规划本轮叙事的大纲。这不是可选的——你的正文必须基于大纲撰写。\n\n' +
    '【必须调用的场景】\n' +
    '- 在 get_status 之后、draft_maintext 之前\n' +
    '- 每次准备写正文时\n\n' +
    '【严禁的行为】\n' +
    '- 跳过此工具直接写正文\n' +
    '- 在大纲中写完整叙事（大纲只需骨架）\n\n' +
    '【你的职责】\n' +
    '大纲是你的叙事蓝图。它不需要文采，但必须结构清晰。',
  parameters: {
    type: 'object',
    properties: {
      variableChanges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '变量路径，如 /主角/资源/HP/当前' },
            from: { description: '变化前的值' },
            to: { description: '变化后的值' },
            reason: { type: 'string', description: '变化原因' },
          },
          required: ['path', 'to', 'reason'],
        },
        description: '本轮涉及的变量变化清单',
      },
      narrativeBeats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            beat: { type: 'string', description: '叙事节拍描述（一句话）' },
            needsDice: { type: 'boolean', description: '此节拍是否需要掷骰检定' },
            estimatedChars: { type: 'number', description: '预估字数' },
          },
          required: ['beat', 'needsDice'],
        },
        description: '叙事节拍序列（3-7 个 beat）',
      },
      endingPosition: {
        type: 'string',
        description: '结尾停在什么可行动的瞬间',
      },
    },
    required: ['variableChanges', 'narrativeBeats', 'endingPosition'],
  },
  async execute(_ctx, params) {
    const beats = params.narrativeBeats as Array<{ beat: string; needsDice: boolean }>;
    const lines: string[] = [
      '📋 大纲已记录。',
      '',
      `变量变化: ${(params.variableChanges as any[]).length} 项`,
      `叙事节拍: ${beats.length} 个`,
    ];
    beats.forEach((b, i) => {
      lines.push(`  ${i + 1}. [${b.needsDice ? '🎲' : '📝'}] ${b.beat}`);
    });
    lines.push(`结尾位置: ${params.endingPosition}`);
    return {
      content: [{ type: 'text', text: lines.join('\n') }],
      details: params,
    };
  },
},
```

#### `draft_maintext` — 正文初稿

```typescript
draft_maintext: {
  name: 'draft_maintext',
  label: '撰写正文初稿',
  category: 'mechanics',
  description:
    '基于大纲和骰子结果，撰写正文初稿。这是初稿——后续还有审查和修改环节，所以不需要完美。\n\n' +
    '【必须调用的场景】\n' +
    '- 在 plan_reply 和必要的 roll_check 之后\n' +
    '- 准备写正文时\n\n' +
    '【严禁的行为】\n' +
    '- 跳过此工具直接 submit_reply\n' +
    '- 在此阶段就追求完美——这只会拖慢节奏\n\n' +
    '【你的职责】\n' +
    '按大纲的节拍顺序写完初稿。聚焦于叙事流畅性和情节推进，字数和去八股留给 review 阶段。',
  parameters: {
    type: 'object',
    properties: {
      maintext: { type: 'string', description: '正文初稿' },
      wordCountEstimate: { type: 'number', description: '预估字数' },
    },
    required: ['maintext'],
  },
  async execute(_ctx, params) {
    const text = params.maintext as string;
    const estimate = params.wordCountEstimate as number ?? text.length;
    return {
      content: [{ type: 'text', text: `📝 初稿已记录 (约${estimate}字)。请继续 review_draft。` }],
      details: { maintext: text, estimate },
    };
  },
},
```

#### `review_draft` — 审查初稿

```typescript
review_draft: {
  name: 'review_draft',
  label: '审查初稿',
  category: 'mechanics',
  description:
    '审查初稿，检测字数、八股句式、格式问题。返回问题清单供 revise_draft 修改。\n\n' +
    '【必须调用的场景】\n' +
    '- 在 draft_maintext 之后\n' +
    '- revise_draft 修改后需要再次验证时\n\n' +
    '【严禁的行为】\n' +
    '- 跳过审查直接 submit_reply\n' +
    '- 看到问题后直接忽略——必须修复或给出合理理由\n\n' +
    '【你的职责】\n' +
    '你不是在自我批评——你是在质量控制。发现问题不是失败，遗漏问题才是。',
  parameters: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['word_count', 'cliche', 'format', 'other'] },
            severity: { type: 'string', enum: ['must_fix', 'should_fix', 'suggestion'] },
            description: { type: 'string' },
            location: { type: 'string', description: '问题在正文中的位置描述' },
          },
          required: ['type', 'severity', 'description'],
        },
        description: '发现的问题列表',
      },
      wordCount: { type: 'number', description: '实际字数' },
      passed: { type: 'boolean', description: '是否所有 mandatory gate 都通过' },
    },
    required: ['issues', 'wordCount', 'passed'],
  },
  async execute(_ctx, params) {
    const issues = params.issues as any[];
    const wordCount = params.wordCount as number;
    const passed = params.passed as boolean;
    const lines: string[] = [
      passed ? '✅ 审查通过' : '❌ 审查未通过',
      `字数: ${wordCount}`,
      `问题: ${issues.length} 个`,
    ];
    for (const issue of issues) {
      const emoji = issue.severity === 'must_fix' ? '🔴' : issue.severity === 'should_fix' ? '🟡' : '🟢';
      lines.push(`  ${emoji} [${issue.type}] ${issue.description}`);
    }
    return {
      content: [{ type: 'text', text: lines.join('\n') }],
      details: { issues, wordCount, passed },
    };
  },
},
```

#### `revise_draft` — 修改初稿

```typescript
revise_draft: {
  name: 'revise_draft',
  label: '修改初稿',
  category: 'mechanics',
  description:
    '根据 review_draft 发现的问题，逐项修改正文。修改后应再次调用 review_draft 验证。\n\n' +
    '【必须调用的场景】\n' +
    '- review_draft 返回 passed=false 时\n\n' +
    '【严禁的行为】\n' +
    '- 修改后不重新 review\n' +
    '- 修复一个问题的同时引入新问题\n\n' +
    '【你的职责】\n' +
    '修改是外科手术，不是重写。只改需要改的地方，保持叙事流畅性。',
  parameters: {
    type: 'object',
    properties: {
      revisedMaintext: { type: 'string', description: '修改后的正文' },
      fixes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            issueType: { type: 'string' },
            fix: { type: 'string', description: '修改说明' },
          },
          required: ['issueType', 'fix'],
        },
        description: '每项修改的说明',
      },
    },
    required: ['revisedMaintext', 'fixes'],
  },
  async execute(_ctx, params) {
    const fixes = params.fixes as any[];
    return {
      content: [{ type: 'text', text: `🔧 已修改 ${fixes.length} 项问题。请再次 review_draft 验证。` }],
      details: params,
    };
  },
},
```

### 2.3 修改 `submit_reply` — 增加最终验证

在现有 `submit_reply.execute()` 开头增加：

```typescript
// 执行前置：验证字数
const maintext = (params?.maintext as string)?.trim() ?? '';
const charCount = maintext.replace(/\s/g, '').length;
if (charCount < 1000) {
  return {
    content: [{ type: 'text', text: `❌ 字数不足 (${charCount}/1000)。请先调用 revise_draft 扩写正文。` }],
    details: { error: 'word_count_too_low', charCount },
  };
}
if (charCount > 1500) {
  return {
    content: [{ type: 'text', text: `❌ 字数超标 (${charCount}/1500)。请先调用 revise_draft 精简正文。` }],
    details: { error: 'word_count_too_high', charCount },
  };
}
// 继续原有逻辑...
```

### 2.4 优化流水线变更总结

| 工具 | 状态 | 说明 |
|------|------|------|
| `get_status` | 已有 | 不变 |
| `roll_dice` | 已有 | 不变 |
| `plan_reply` | **新增** | 叙事大纲规划 |
| `draft_maintext` | **新增** | 正文初稿 |
| `review_draft` | **新增** | 审查初稿（字数/八股/格式） |
| `revise_draft` | **新增** | 修改初稿 |
| `submit_reply` | **修改** | 增加字数下限/上限验证 |

---

## 三、Subagent 远期设计

### 3.1 设计原则

继承 Fate sandbox 的 subagent 架构原则（参考 `AGENTS.md` §子代理纪律 + `parallel-line-subagents-plan.md`）：

1. **主 GM 管玩家可见世界** — 玩家侧响应、public state 更新、玩家可见叙事
2. **Subagent 管世界背面** — NPC 独立行动、秘密推进、未来钩子生成
3. **Engine/Tools 管事实落地** — subagent 不直接写 state，只提交候选结果

### 3.2 架构（远期）

```
玩家输入
  ↓
主 GM 结算玩家侧（含 skill 编排的优化流水线）
  ↓
[可选] 调用后台 subagent
  │  - NPC 阵营 agent：推进独立目标
  │  - 世界事件 agent：生成背景事件
  ↓
Subagent 返回结构化 offscreen event
  ↓
主 GM 选择落入 secret state / public clue / 暂存
  ↓
玩家可见叙事（含后台事件的痕迹/传闻/梦境）
```

### 3.3 Subagent 类型（按优先级）

| Subagent | 用途 | 触发条件 | 优先级 |
|----------|------|---------|--------|
| `offscreen-actor` | 单个 NPC/阵营的玩家视野外独立行动 | major beat 结束、长时间跳过 | P1 |
| `world-event` | 生成世界背景事件（天气异变、路人传闻、政治变动） | 场景切换、arc 过渡 | P2 |
| `timeline-auditor` | 检查叙事一致性、题材漂移 | 每 10-20 轮 | P3 |

### 3.4 Subagent 输入契约

```typescript
interface SubagentInput {
  agentId: string;
  timeWindow: { start: string; end: string };
  knownFacts: string[];        // 该 agent 实际知道的事实
  privateFacts: string[];      // 该 agent 自己的秘密
  playerSideSummary: string;   // 只给与该 agent 可能相关的玩家侧摘要
  allowedScope: string[];      // 允许推进的内容范围
  forbiddenEscalations: string[];  // 禁止提前触发的剧情
  actorGoals: string[];        // 该 agent 的当前目标
}
```

### 3.5 Subagent 输出契约

```typescript
interface SubagentOutput {
  agentId: string;
  timeRange: { start: string; end: string };
  outcome: 'no-change' | 'progress' | 'escalation' | 'blocked';
  privateSummary: string;          // 落入 secret state 的后台事实
  publicLeakCandidates: string[];  // 可通过痕迹/传闻/梦境投影到玩家侧的信息
  futureHooks: string[];           // 后续遭遇或冲突钩子
  riskFlags: string[];             // 需要主 GM 注意的风险
}
```

### 3.6 为什么放在远期

1. **当前 web 端没有 subagent 基础设施**。需要：
   - 独立的 LLM 调用管理（可能需要后台 worker）
   - Session 级别的 subagent 状态存储
   - 主 GM 和 subagent 之间的上下文传递协议
2. **优化流水线优先**。正文质量是当前最直接的用户体验提升点。
3. **后台世界进程需要丰富的 NPC 数据**。当前项目的 NPC 系统还在建设中。

---

## 四、文件改动清单

### 新增文件

| 文件 | 行数估 | 说明 |
|------|--------|------|
| `sillytavern/skills/types.ts` | ~40 | GameSkill / SkillTrigger / QualityGate 类型定义 |
| `sillytavern/skills/skill-loader.ts` | ~80 | 触发匹配 + 动态注入逻辑 |
| `sillytavern/skills/prose-optimization.md` | ~120 | 正文优化流水线 skill 模板 |
| `sillytavern/tools/outline.ts` | ~60 | plan_reply 工具 |
| `sillytavern/tools/draft.ts` | ~60 | draft_maintext 工具 |
| `sillytavern/tools/review.ts` | ~100 | review_draft + revise_draft 工具 |

### 改造文件

| 文件 | 改动范围 | 说明 |
|------|---------|------|
| `sillytavern/agent-context.ts` | +30 行 | 在 buildAgentContext 中集成 skill loading |
| `sillytavern/tools/registry.ts` | +10 行 | 注册新工具（outline/draft/review） |
| `sillytavern/tools/mechanics.ts` | +30 行 | submit_reply 增加字数验证 |
| `sillytavern/types.ts` | +20 行 | 增加 GameSkill 相关类型引用 |

### 后续扩展（不在本次范围）

| 文件 | 说明 |
|------|------|
| `sillytavern/subagents/` | Subagent 管理（远期） |
| `sillytavern/skills/combat-resolution.md` | 战斗结算 skill |
| `sillytavern/skills/social-exchange.md` | 社交交互 skill |

---

## 五、实施阶段

### 阶段 1：Skill 基础设施（3-4 天）

1. **新增** `sillytavern/skills/types.ts` — 类型定义
2. **新增** `sillytavern/skills/skill-loader.ts` — 触发匹配 + 注入
3. **改造** `sillytavern/agent-context.ts` — 集成 skill loading
4. **新增** `sillytavern/skills/prose-optimization.md` — 第一个 skill
5. **检验**：AI 在 narrative_generation 阶段自动加载 prose-optimization skill，上下文中可见 skill 指令

### 阶段 2：优化流水线工具（4-5 天）

1. **新增** `sillytavern/tools/outline.ts` — plan_reply
2. **新增** `sillytavern/tools/draft.ts` — draft_maintext
3. **新增** `sillytavern/tools/review.ts` — review_draft + revise_draft
4. **改造** `sillytavern/tools/mechanics.ts` — submit_reply 增加字数验证
5. **改造** `sillytavern/tools/registry.ts` — 注册新工具
6. **检验**：一轮完整的优化流水线跑通（大纲→骰子→正文→审查→修改→提交），字数在 1000-1500 范围内，无八股句式

### 阶段 3：体验打磨（2-3 天）

1. UI 侧：ToolCallBubble 展示优化流水线的阶段进度
2. 日志：记录每阶段耗时和通过率
3. Prompt 微调：根据实际运行效果调整 skill 和工具 description
4. **检验**：连续 20 轮游戏，正文质量稳定，字数达标率 > 90%

### 阶段 4（远期）：Subagent 探索

1. 评估实际需求（是否需要后台世界进程）
2. 设计 subagent 基础设施
3. 实现 `offscreen-actor` subagent 原型
4. 验证认知隔离效果

---

## 六、风险与缓解

| 风险 | 缓解 |
|------|------|
| 多轮 tool loop 增加延迟（预期 5-8 轮） | 工具执行是本地同步操作（毫秒级），额外延迟主要来自每次新的 LLM 调用。但实际测试中 LLM 通常在同一轮内并行调用多个工具，不会 5-8 次 LLM 往返。预估实际增加 2-3 次 LLM 调用 |
| AI 拒绝遵循优化流水线 | skill 注入到 pre-response slot（高注意力区），且 submit_reply 的字数验证强制 AI 无法跳过优化步骤 |
| 八股检测依赖 AI 自觉 | review_draft 的 description 中列出具体八股句式清单，且 skill 的 qualityGates 定义了明确的 pass/fail 条件 |
| Skill 内容与现有模块内容重复/冲突 | skill 聚焦流程步骤和质量标准，现有模块聚焦持久规则；两者不重复。如有冲突以 skill 为准（skill 离生成最近，优先级更高） |

---

## 七、附录：与参考实现的对应关系

| 本设计 | Fate sandbox 参考 | piagent 参考 |
|--------|------------------|-------------|
| GameSkill | `skills/*/SKILL.md` | `Skill` interface (`types.ts`) |
| skill-loader.ts | — | `harness/skills.ts` (`loadSkills`) |
| 优化流水线 | `gm-direction.md` + `gm-render.md` 的 two-pass 架构 | — |
| plan_reply → draft → review → revise | `submit_direction_packet` + `gm-render.md` 的 direction/render 分离 | — |
| Subagent | `.pi/agents/parallel-line.md` | pi-subagents extension |
| 触发匹配 | — | `formatSkillInvocation` + model invocation |

关键差异：本设计是 **web 端 GM 内部工作流**（不暴露给玩家），而 Fate sandbox 的 skill 是**玩家可调用的命令**。这是因为 web 端的交互模型不同——玩家不需要知道 GM 内部用什么 skill，他们只需要看到高质量的叙事输出。
