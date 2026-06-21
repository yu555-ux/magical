# Skill 系统 + 正文优化流水线 + Subagent 远期设计

> 2026-06-21 · 修订 2
> 基于 Fate sandbox + piagent 参考架构，对 web 端 GM Agent 进行流程编排能力升级。

---

## 〇、设计前提

经用户确认的三项定位：

| 维度 | 定位 | 含义 |
|------|------|------|
| **Skill** | GM 内部工作流模板 | 不是玩家可见的 `/命令`，而是 GM(AI) 的流程指引。与 piagent 的 Skill 机制对齐：Skill 是知识文档，通过 prompt 注入而非 tool calling。 |
| **优化流水线** | 多轮 tool loop 模式 | 将当前 `submit_reply` 的一次性提交拆分为：机械结算→大纲→正文→审查修改→提交。**机械结算必须在叙事规划之前完成。** |
| **Subagent** | 后台世界进程 | 远期目标。让 NPC/阵营在玩家视野外独立行动，产出 offscreen event。 |

---

## 一、Skill 系统设计

### 1.1 piagent 的 Skill 机制（参考基准）

在 piagent 中，Skill 和 Tool 是**两种完全不同的机制**：

| | Tool | Skill |
|---|---|---|
| **本质** | 可执行函数（代码） | 知识/指令文档（Markdown） |
| **调用通道** | OpenAI function calling（`tool_calls`） | Harness 层 API（`harness.skill(name)`） |
| **AI 看到什么** | JSON Schema（name + parameters） | 完整 Markdown 指令正文 |
| **有返回值吗** | 有（`execute()` 结果） | 无——它是指引，AI 读完后照做 |
| **谁触发** | AI 通过 `tool_calls` | 用户 slash command（`/skill:name`）或应用层路由 |
| **piagent 是否有 `use_skill` 工具** | — | **没有。Skill 不走 function calling。** |

**piagent 的 skill 完整生命周期**：

```
1. 加载（启动时）
   loadSkills(env, dirs)
   → 递归扫描目录，找到所有 SKILL.md
   → 解析 YAML frontmatter (name / description / disable-model-invocation)
   → 提取 Markdown body 作为 content
   → 产出 Skill[]，存入 AgentHarnessResources.skills

2. 列出（构建 system prompt 时）
   formatSkillsForSystemPrompt(skills)
   → 生成 XML 片段，插入 system prompt：
   
   "The following skills provide specialized instructions for specific tasks.
   Read the full skill file when the task matches its description.
   
   <available_skills>
     <skill>
       <name>start-game</name>
       <description>开始/重新开始 fate-sandbox。以流程机收集玩家立场...</description>
       <location>/skills/start-game/SKILL.md</location>
     </skill>
   </available_skills>"

3. 调用（运行时）
   用户输入 /skill:start-game
   → pi 平台拦截 slash command
   → 调用 harness.skill("start-game")
   → harness.skill() 内部：
     a. 从 resources.skills 查找匹配的 skill
     b. formatSkillInvocation(skill) → 把 skill.content 包装在 <skill> 标签里
     c. 包装后的字符串作为 user prompt 启动新 turn
     d. LLM 收到这条 user 消息，读取完整 skill 指令，按指引执行

4. skill 内容插入的精确位置
   messages[0] system  ← 身份 + 运行契约 + <available_skills> 列表
   messages[1] user    ← 背景参考
   ...
   messages[N] user    ← 【skill 内容作为新 user 消息插入这里】
                         <skill name="start-game" location="...">
                         References are relative to ...
                         
                         (完整的 Markdown 指令正文)
                         </skill>
```

### 1.2 Web 端适配

我们的项目没有 pi 的 TUI 和 slash command 层，但核心机制完全对齐：

```
piagent                              我们的 web 项目
────────────────────────────────────────────────────────────────
loadSkills(env, dirs)                Vite ?raw import + SKILL_REGISTRY
  文件系统扫描 SKILL.md                静态导入 .md 文件（与 MODULE_CONTENT 同模式）

formatSkillsForSystemPrompt()        注入到参考层（user role）
  插入 system prompt                   插入 reference slot（<available_skills> XML 列表）

harness.skill(name)                  常驻注入（prose-optimization 每轮激活）
  用户 slash command 触发              条件启用（combat-resolution 等用 preset.json）

formatSkillInvocation()              使用相同 <skill> XML 包装
  <skill name="..." location="...">    <skill name="..." location="...">
  ...content...                        ...content...
  </skill>                             </skill>
```

**skill 内容在我们的 messages 序列中的精确位置**：

```
messages[0]  system    ← gm-system.md（身份 + 契约 + <available_skills>）
messages[1]  user      ← pre-history 模块（世界逻辑、文风等）         ╮
messages[2]  user      ← reference 层（世界书 + 工具速查）             │ 前缀缓存区
messages[3]  user      ← final-contract 模块                          ╯
messages[4]  user      ← 聊天历史                                     ╮
messages[5]  user      ← 玩家输入                                      │ 动态区
messages[6]  user      ← pre-response 模块（GM Brief + 铁则 + 规则）   │
messages[7]  user      ← 【skill 内容插入这里】                        ╯
                         <skill name="prose-optimization" location="skills/prose-optimization.md">
                         References are relative to skills/.
                         
                         # 正文优化流水线
                         ## 操作顺序（严格遵守）
                         ...
                         </skill>
```

**缓存分析**：messages[6-7]（pre-response 区域）已包含每轮动态变化的 GM Brief（HP、位置、时间等状态简报）。插入一个**内容固定不变**的 skill 模块不会额外地破坏缓存——缓存断裂点本来就在聊天历史/用户输入之后（messages[4] 起）。

### 1.3 实现方式

Skill 就是 prompt 模块——和 `gm-rules.md`、`gm-tool-policy.md` 同级同类，走完全相同的 injection 管道。

**第一步：Skill 文件存储**

```
sillytavern/
  agent-prompt/              ← 现有静态模块（不变）
    preset.json
    module-content.ts
    gm-system.md
    gm-rules.md
    ...
  skills/                    ← 【新增目录】
    prose-optimization.md    ← 正文优化流水线
    combat-resolution.md     ← 战斗结算（后续）
    social-exchange.md       ← 社交交互（后续）
```

**第二步：Vite 静态导入（与 MODULE_CONTENT 完全相同的模式）**

```typescript
// sillytavern/skills/skill-registry.ts
import proseOptimizationRaw from './prose-optimization.md?raw';
// ...后续 skill 同理

export const SKILL_CONTENT: Record<string, string> = {
  'skills/prose-optimization.md': proseOptimizationRaw,
  // ...
};
```

**第三步：在 preset.json 中声明为模块**

```json
{
  "id": "skill-prose-optimization",
  "enabled": true,
  "slot": "pre-response",
  "priority": 5,
  "source": "skills/prose-optimization.md"
}
```

**第四步：在 module-content.ts 中注册 source**

```typescript
import { SKILL_CONTENT } from '../skills/skill-registry';

export const MODULE_CONTENT: Record<string, string> = {
  // ...现有模块...
  ...SKILL_CONTENT,  // ← 一行接入所有 skill
};
```

**第五步：`<available_skills>` 列表注入**

在 `agent-context.ts` 或 `agent-prompt/injection.ts` 中生成 `<available_skills>` XML 片段，注入到参考层（让 AI 知道有哪些 skill 可用）。格式与 piagent 的 `formatSkillsForSystemPrompt()` 完全一致。

**完成。** Skill 内容通过现有的 injection 管道自动进入 pre-response slot。不需要新的加载机制、不需要 `use_skill` 工具、不需要触发匹配逻辑。`prose-optimization` 设置 `enabled: true` 后每轮自动激活。

### 1.4 Skill 文件格式

```markdown
---
name: prose-optimization
description: 正文优化流水线——大纲→正文→审查修改→提交。每轮叙事生成时自动激活。
---

# 正文优化流水线

## 核心原则

你不是在聊天框中即兴回复。你是在交付一篇经过规划、检定、撰写、审查的叙事作品。

## 操作顺序（严格遵守）

**必须先完成机械结算，再规划叙事。** 未落地的状态变化不得出现在大纲中。

### 阶段 0：机械结算（在进入本 skill 的阶段 1 之前完成）

1. 调用 get_status 确认当前状态
2. 调用 roll_dice 执行必要的骰子检定
3. 调用 patch_state 等工具将变量变化写入状态树
4. 确保所有机械变化已落地，状态树已更新

### 阶段 1：改变量写大纲 (plan_reply)

基于**已落地的状态**，调用 plan_reply：
1. 列出本轮涉及的变量变化（path / from / to / reason）
2. 规划叙事节拍序列（3-7 个 beat）
3. 定义结尾停在什么可行动的瞬间

### 阶段 2：写正文 (draft_maintext)

按大纲的节拍顺序撰写正文初稿：
- 中文第二人称沉浸式叙事
- 不复制设定表或 GM 简报
- 停在明确可行动的瞬间

### 阶段 3：优化修改 (review_draft → revise_draft)

1. 调用 review_draft 审查初稿：字数（1000-1500）、八股检测、格式验证
2. 根据审查结果调用 revise_draft 逐项修改
3. 改后再次 review_draft，直到所有门禁通过

### 阶段 4：提交回复 (submit_reply)

所有门禁通过后调用 submit_reply。

## 质量门禁

| 门禁 | 条件 | 不通过处理 |
|------|------|-----------|
| 字数 | 1000-1500 字（不计标签和空白） | revise_draft 扩写/精简 |
| 八股 | 禁止「深吸一口气」「嘴角微微上扬」「眼中闪过一丝…」「一股…涌上心头」「不禁」「不由得」「仿佛…一般」「…的存在」 | revise_draft 改为具象描写 |
| 格式 | maintext 不含 GM 解说/推理/JSON/骰点/字段名；options 恰好 4 条；history 字段完整 | 修复后重新审查 |
```

### 1.5 为什么不需要 `use_skill` 工具

1. **piagent 没有 `use_skill` 工具。** Skill 和 Tool 是两套正交的机制。把 Skill 包装成 Tool 是对 piagent 设计的偏离。
2. **Skill 是指令，不是能力。** Tool 给 AI 可执行的函数；Skill 给 AI 可遵循的指引。
3. **常驻 skill 不需要调用/卸载。** 正文优化是每轮都需要的标准流程，没有"加载"和"卸载"的概念。
4. **缓存更友好。** Skill 内容固定不变，放在 prompt 模板里，DeepSeek 可以跨轮次缓存这个段落。放在 tool result 中反而每轮被当作"新内容"。

---

## 二、正文优化流水线设计

### 2.1 操作顺序（参考 Fate sandbox 修正）

Fate sandbox 的 `gm-direction.md` 明确规定：

> 1. Finish all domain settlement for the turn: clock movement, wounds, mana, money, revelations, memory, and beat transitions **must already be in state**.
> 2. Call `submit_direction_packet` exactly once.

**机械结算必须在叙事规划之前。** 不能并行——因为大纲需要基于已落地的状态来写。

```
玩家输入 "我挥剑砍向哥布林"
  │
  ▼
Turn 1: get_status()                     ← 查当前状态
  │
  ▼
Turn 2: roll_dice() + patch_state()      ← 掷骰子 + 修改变量（机械结算全部落地）
  │                                         🎲 检定: 攻击命中? 伤害多少?
  │                                         📊 变量: HP-5, 哥布林HP-8
  ▼
Turn 3: use_skill 自动激活               ← skill prose-optimization 已在 pre-response 中
         plan_reply()                     ← 基于已落地的状态写大纲
  │                                         "砍中哥布林左肩→它后退→反手一爪→你闪避→对峙"
  ▼
Turn 4: draft_maintext()                 ← 写正文初稿
  │
  ▼
Turn 5: review_draft()                   ← 审查（字数/八股/格式）
  │
  ▼
Turn 6: revise_draft()                   ← 逐项修改（若 Turn 5 未通过）
  │
  ▼
Turn 7: submit_reply()                   ← 提交最终回复 → 退出 tool loop
```

预估 5-7 次 LLM 往返（当前未优化流水线约 2-3 次）。如果审查一次通过，可减至 5 次。

### 2.2 骰子系统改进：A+B 方案

**问题**：当前 AI 倾向于不投骰子。prompt 中只有两句软约束（"不能自行脑补结果""不掷必然成功的骰子"），没有硬触发场景。而且 `roll_dice` 一次只能掷一种骰子——战斗场景需要先掷命中→再掷伤害→再掷闪避，AI 不知道可以连续调多次。

**方案 A：`gm-tool-policy.md` 增加硬触发场景表**

在工具策略模块中加入明确的"必须掷骰"场景，参考 Fate sandbox `gm-tool-policy.md` 的"Combat and risk boundary"段：

```markdown
## 骰子触发规则（硬约束）

以下场景必须调用 roll_dice，禁止直接用叙事替代判定结果：

### 战斗
- 攻击命中：roll_dice(label="命中", sides=20, dc=目标闪避值)
- 伤害骰：roll_dice(label="伤害", sides=8, count=武器骰数, modifier=力量加值)
- 闪避/格挡：roll_dice(label="闪避", sides=20, dc=攻击方命中值)
- 宝具/必杀技：roll_dice(label="宝具解放", sides=100, dc=60)

### 技能/属性检定
- 需要判定角色属性是否足以完成某动作：roll_dice(label="力量对抗", sides=20, modifier=力量值, dc=难度)
- 知识/调查/感知：roll_dice(label="调查", sides=100, dc=50)
- 社交对抗：roll_dice(label="说服", sides=20, modifier=魅力值, dc=NPC意志)

### 危险/随机
- 陷阱躲避、毒素抵抗、精神污染对抗
- 天气突变、随机遭遇、掉落判定
- 任何结果不由你叙事决定的场合

### 多次检定规则
- 战斗一轮通常需要 2-4 次检定（命中/伤害/闪避/效果），分多次 roll_dice 调用
- 连续调用时在 label 中标注序号和目的，如 "命中(攻击哥布林)" "伤害(长剑)"
- 技能复合判定：先投主要属性，再投辅助属性。如翻墙 = 力量检定→敏捷检定
- 所有检定完成后再进入 plan_reply 阶段——骰子结果未出之前不写大纲
```

**方案 B：`prose-optimization.md` skill 的阶段 0 加入多骰子流程指引**

在 skill 的阶段 0（机械结算）中明确多次投骰的流程：

```markdown
### 阶段 0：机械结算

1. **分析玩家输入**：列出所有需要判定的环节
   - 是否有战斗动作？（命中/伤害/闪避/特殊效果）
   - 是否有技能使用？（属性检定/知识判定）
   - 是否有危险/风险？（陷阱/毒素/环境）
   - 是否有随机事件？（天气/遭遇/掉落）

2. **执行多次检定**：
   - 每次 roll_dice 调用一次检定
   - label 参数必须标注具体场景（如 "长剑攻击地精" 而非 "攻击"）
   - 检定之间可以有依赖关系——先用第一个 roll_dice 的结果决定是否需要第二个
   - 不需要检定的场景（日常对话、观察、简单移动）跳过

3. **示例**：
   玩家说 "我用长剑砍向地精，然后闪避它的反击"
   
   → roll_dice(label="长剑攻击地精", sides=20, dc=12)
   → 工具返回: 命中 ✅
   → roll_dice(label="长剑伤害", sides=8, count=1, modifier=3)
   → 工具返回: 伤害 7 点
   → 更新状态（地精 HP-7）
   → roll_dice(label="闪避地精反击", sides=20, dc=10)
   → 工具返回: 闪避失败 ❌
   → 更新状态（玩家 HP-3）
   
   全部检定完成后，进入阶段 1（plan_reply）

4. **检定完成标志**：分析的所有环节都已掷骰 + 所有状态已落地 → 可进入阶段 1
```

### 2.3 新增工具定义

#### `plan_reply` — 叙事大纲（在机械结算之后调用）

```typescript
plan_reply: {
  name: 'plan_reply',
  label: '规划回复大纲',
  category: 'mechanics',
  description:
    '在机械结算完成（get_status/roll_dice/patch_state）之后，规划本轮叙事大纲。\n\n' +
    '【必须调用的场景】\n' +
    '- 所有状态变化已落地之后\n' +
    '- draft_maintext 之前\n\n' +
    '【严禁的行为】\n' +
    '- 在状态未落地前写大纲（大纲中的变化必须已通过工具写入状态树）\n' +
    '- 在大纲中写完整叙事（大纲只需骨架）\n\n' +
    '【你的职责】\n' +
    '大纲是你的叙事蓝图。它反映已发生的机械变化，不需要文采但必须结构清晰。',
  parameters: {
    type: 'object',
    properties: {
      variableChanges: {
        type: 'array', items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '变量路径' },
            from: { description: '变化前的值' },
            to: { description: '变化后的值' },
            reason: { type: 'string' },
          },
          required: ['path', 'to', 'reason'],
        },
        description: '本轮已落地的变量变化清单',
      },
      narrativeBeats: {
        type: 'array', items: {
          type: 'object',
          properties: {
            beat: { type: 'string', description: '叙事节拍（一句话）' },
            estimatedChars: { type: 'number' },
          },
          required: ['beat'],
        },
        description: '叙事节拍序列（3-7 个 beat）',
      },
      endingPosition: { type: 'string', description: '结尾停在什么可行动的瞬间' },
    },
    required: ['variableChanges', 'narrativeBeats', 'endingPosition'],
  },
  async execute(_ctx, params) { /* 记录大纲，返回摘要 */ },
},
```

#### `draft_maintext` / `review_draft` / `revise_draft`

（定义同原始版本，此处省略重复内容。详见 spec v1 的 §2.2。）

### 2.4 修改 `submit_reply` — 增加字数硬验证

```typescript
// submit_reply.execute() 开头增加：
const maintext = (params?.maintext as string)?.trim() ?? '';
const charCount = maintext.replace(/\s/g, '').length;
if (charCount < 1000) {
  return { content: [{ type: 'text', text: `❌ 字数不足 (${charCount}/1000)。请先调用 revise_draft 扩写正文。` }] };
}
if (charCount > 1500) {
  return { content: [{ type: 'text', text: `❌ 字数超标 (${charCount}/1500)。请先调用 revise_draft 精简正文。` }] };
}
```

### 2.5 工具变更总结

| 工具 | 状态 | 说明 |
|------|------|------|
| `get_status` | 已有 | 不变 |
| `roll_dice` | 已有 | 不变 |
| `patch_state` 等 | 已有 | 不变 |
| `plan_reply` | **新增** | 机械结算后的大纲规划 |
| `draft_maintext` | **新增** | 正文初稿 |
| `review_draft` | **新增** | 审查（字数/八股/格式） |
| `revise_draft` | **新增** | 修改 |
| `submit_reply` | **修改** | 增加 1000-1500 字硬验证 |

---

## 三、Subagent 远期设计

### 3.1 设计原则

继承 Fate sandbox（`AGENTS.md` §子代理纪律 + `parallel-line-subagents-plan.md`）：

1. **主 GM 管玩家可见世界** — 玩家侧响应、public state 更新、玩家可见叙事
2. **Subagent 管世界背面** — NPC 独立行动、秘密推进、未来钩子生成
3. **Engine/Tools 管事实落地** — subagent 不直接写 state

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

### 3.3 Subagent 输入/输出契约

```typescript
interface SubagentInput {
  agentId: string;
  timeWindow: { start: string; end: string };
  knownFacts: string[];           // 该 agent 实际知道的事实
  privateFacts: string[];         // 该 agent 的秘密
  playerSideSummary: string;      // 与该 agent 相关的玩家侧摘要
  allowedScope: string[];         // 允许推进的范围
  forbiddenEscalations: string[]; // 禁止触发的剧情
  actorGoals: string[];           // 当前目标
}

interface SubagentOutput {
  agentId: string;
  timeRange: { start: string; end: string };
  outcome: 'no-change' | 'progress' | 'escalation' | 'blocked';
  privateSummary: string;
  publicLeakCandidates: string[];
  futureHooks: string[];
  riskFlags: string[];
}
```

### 3.4 为什么放在远期

1. web 端没有 subagent 基础设施（独立 LLM 调用、session 级状态存储、上下文传递协议）
2. 优化流水线是当前最直接的用户体验提升
3. 后台世界进程需要丰富的 NPC 数据支持

---

## 四、文件改动清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `sillytavern/skills/skill-registry.ts` | Vite `?raw` 导入所有 skill .md 文件，导出 `SKILL_CONTENT` map |
| `sillytavern/skills/prose-optimization.md` | 正文优化流水线 skill |
| `sillytavern/tools/outline.ts` | `plan_reply` 工具 |
| `sillytavern/tools/draft.ts` | `draft_maintext` 工具 |
| `sillytavern/tools/review.ts` | `review_draft` + `revise_draft` 工具 |

### 改造文件

| 文件 | 改动 | 说明 |
|------|------|------|
| `agent-prompt/module-content.ts` | +2 行 | `import { SKILL_CONTENT }` + spread 到 MODULE_CONTENT |
| `agent-prompt/preset.json` | +8 行 | 新增 skill-prose-optimization 模块声明 |
| `agent-prompt/injection.ts` | +20 行 | 新增 `<available_skills>` 列表生成 + `<skill>` 标签包装 |
| `tools/registry.ts` | +10 行 | 注册 outline/draft/review 工具 |
| `tools/mechanics.ts` | +30 行 | `submit_reply` 增加字数验证 |

配合在 `game/.gitignore` 末尾添加 `skills/`。

### 后续扩展（不在本次范围）

| 文件 | 说明 |
|------|------|
| `sillytavern/subagents/` | Subagent 管理（远期） |
| `sillytavern/skills/combat-resolution.md` | 战斗结算 skill |
| `sillytavern/skills/social-exchange.md` | 社交交互 skill |

---

## 五、实施阶段

### 阶段 1：Skill 基础设施 + 优化流水线工具（5-7 天）

1. 新增 `sillytavern/skills/skill-registry.ts` — Vite raw import
2. 新增 `sillytavern/skills/prose-optimization.md` — 第一个 skill
3. 改造 `module-content.ts` + `preset.json` — 接入 skill
4. 改造 `injection.ts` — 生成 `<available_skills>` + `<skill>` 包装
5. 新增 `plan_reply` / `draft_maintext` / `review_draft` / `revise_draft` 工具
6. 改造 `submit_reply` — 字数硬验证
7. **检验**：完整流水线跑通（机械结算→大纲→正文→审查修改→提交），字数 1000-1500，无八股

### 阶段 2：体验打磨（2-3 天）

1. UI：ToolCallBubble 展示流水线阶段进度
2. 日志：记录每阶段耗时和通过率
3. Prompt 微调
4. **检验**：连续 20 轮，字数达标率 > 90%

### 阶段 3（远期）：Subagent 探索

---

## 六、风险与缓解

| 风险 | 缓解 |
|------|------|
| LLM 往返增加（5-7 次 vs 当前 2-3 次） | 工具执行是本地同步（毫秒级）。额外延迟来自 LLM 调用，预估实际增加 2-3 轮 |
| AI 跳过优化步骤 | skill 在 pre-response 高注意力区；`submit_reply` 的字数硬验证强制阻断 |
| 八股检测依赖 AI 自觉 | 在 skill 和 review_draft description 中列出具体八股句式清单 |
| prompt 模板膨胀 | skill 内容约 2000 token，在现有 pre-response 基础上增加。监控总 token 使用 |

---

## 七、附录：与 piagent 的对应关系

| 本设计 | piagent | 是否对齐 |
|--------|---------|---------|
| `skills/*.md` 文件 | `SKILL.md` 文件 | ✅ 同格式 |
| `SKILL_CONTENT` map | `loadSkills()` 产出 | ✅ 同结构（web 适配为静态导入） |
| `<available_skills>` XML | `formatSkillsForSystemPrompt()` | ✅ 同格式 |
| `<skill>` 标签包装 | `formatSkillInvocation()` | ✅ 同格式 |
| pre-response slot 注入 | `harness.skill()` → user message | ✅ 同为上下文注入 |
| 常驻启用（`enabled: true`） | slash command 触发 | ⚠️ 适配差异（web 无 TUI） |

核心差异只有一个：piagent 通过 slash command 触发 skill，我们通过 `preset.json` 的 `enabled` 字段控制。但 skill 的存储格式、列表格式、内容包装格式、注入方式完全一致。
