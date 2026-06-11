# Agent 模式优化方案

> 基于 fate-sandbox（agent1-示例）和 tavern2agent 的深度分析。我们的项目是独立 Web 应用（React + IndexedDB），不依赖 pi agent 平台，所有方案都已针对此架构适配。

---

## 一、当前状态与核心差距

### 1.1 当前架构

```
用户输入 → buildAgentContext() → runAgentLoop() → LLM + tools → 输出
              │                      │
              ├─ 3层消息结构          ├─ while(turn < maxTurns)
              │  system: 身份+契约     │  ├─ router.callAgent()
              │  reference: 世界书+工具 │  ├─ 流式解析 SSE
              │  rules: 铁则(最后)      │  ├─ 检测 tool_calls
              └─ 静态拼接              │  ├─ 执行工具 → 结果回注
                                     │  └─ 无 tool → 退出
                                     └─ 5个工具: get_status, patch_state, save_point,
                                                  roll_dice, lookup_world
```

### 1.2 当前优点

- Agent loop 清晰，流式解析正确
- 已采用 "铁则离生成最近" 的 DeepSeek V4 适配策略
- 工具 description 包含"必须调用/严禁"模板
- 缓存友好的前缀消息布局

### 1.3 与 fate-sandbox 的核心差距

| 维度 | 我们 | fate-sandbox | 差距等级 |
|------|------|-------------|:--:|
| 提示词架构 | 单一文件字符串拼接 | preset.json + 13个独立模块 + 3个slot | **大** |
| 状态注入 | LLM手动 get_status | 运行时自动 GM Brief 每轮注入 | **大** |
| 状态写入 | 通用 JSON Patch | 领域事件工具，patch 已禁用 | **大** |
| 技能系统 | 无 | skills/ 目录，场景化加载 | **大** |
| 工具管理 | 5个工具始终暴露 | 按场景动态切换，3-6个/场景 | 中 |
| 思维链/自检 | 无 | 生成前13步 + 输出前8条双阶段检查 | 中 |
| 内容质量控制 | 仅格式规则 | 文风黑名单 + 好坏对比 + 渲染协议 + 创作宪法 | 中 |
| 状态持久化 | 对话结束整体保存 | 每轮快照 + 事务回滚 | 中 |
| Schema管理 | 无版本号 | schemaVersion + 渐进迁移 | 小 |
| 回合管理 | 自由loop | 强约束 commit_turn + pacing 警告 | 小 |

---

## 二、优化方案

以下 17 项按主题归为四组：**提示词架构 / 工具与状态 / 质量控制 / 支撑系统**。

---

### 组 A：提示词架构（P0 — 基础重构）

#### A1. 模块化装配系统

**目标**：从 `agent-defaults.ts` 单一文件 → `preset.json` + 多个独立 markdown 模块。

**参考**：fate-sandbox 的 `preset.json` + `injection.ts`，13 个模块各司其职。

**三个 slot 的注意力模型**：
```
高注意力 ▲  pre-response    GM Brief、工具策略、硬规则、自检清单
          │                   ★ 离生成最近，最高注意力
          │  user input      玩家本轮输入
          │  pre-history     创作宪法、世界观、文风指南、渲染协议
          ▼                   ★ 背景参考，注意力最低
低注意力    final-contract   输出格式契约
                              ★ 最后注入，影响输出形状
```

**需要拆分的模块**（按 slot 分组）：

| Slot | 模块 | 内容 |
|------|------|------|
| system | `gm-system.md` | 极简身份 + 最高契约（≤5条） |
| pre-history | `gm-creative-constitution.md` | 玩家视角、世界惯性、场景运动 |
| pre-history | `gm-style-guide.md` | 文风指南：字数、对话占比、镜头规则 |
| pre-history | `gm-style-blacklist.md` | 禁止句式清单 |
| pre-history | `gm-render-protocol.md` | 连续性规则、状态锚点、好坏对比示例 |
| pre-response | `mechanical_state` | **运行时动态生成**的 GM Brief |
| pre-response | `gm-tool-policy.md` | 工具调用策略 |
| pre-response | `gm-rules.md` | 硬性规则、机械纪律 |
| pre-response | `gm-story-driver.md` | 生成前内部分析（5步） |
| final-contract | `gm-output-contract.md` | 输出格式契约 |
| final-contract | `gm-think.md` | 输出前验证（8条） |

**实现要点**：
- `preset.json` 声明每个模块的 id/enabled/slot/priority/header/source
- `injection.ts` 装配引擎：读 preset → 按 slot 分组 → 按 priority 排序 → 注入消息流
- 每个模块独立启用/禁用/调优先级
- 用户可通过 `agents/user/` 目录覆盖默认模块

**preset.json 示例**：
```json
{
  "version": 1,
  "modules": [
    { "id": "creative-constitution", "enabled": true, "slot": "pre-history", "priority": 10, "header": "creative_constitution", "source": "agents/gm-creative-constitution.md" },
    { "id": "mechanical-state", "enabled": true, "slot": "pre-response", "priority": 5, "header": "mechanical_state", "source": "runtime:state-brief" },
    { "id": "output-contract", "enabled": true, "slot": "final-contract", "priority": 10, "header": "output_contract", "source": "agents/gm-output-contract.md" }
  ]
}
```

---

#### A2. 运行时 GM Brief（机械状态简报）

**问题**：Agent 必须手动 `get_status` 才知道状态 → 第一轮必浪费 1 个 tool call → LLM 可能"忘记"查状态。

**方案**：每轮从变量树自动生成 GM Brief，注入 pre-response slot。

```
<mechanical_state>
[当前 GM 简报]
时间：第3天 午后  地点：夏城一中·教学楼
玩家：HP 85/100  MP 60/100  金钱 320G
同行者：周汝
异常状态：轻微擦伤（左臂）
最近事件：教室遇袭 → 逃至天台 → 发现异常结界
</mechanical_state>
```

**实现**：
```typescript
function buildGmBrief(vars: Record<string, any>): string {
  const lines: string[] = [];
  lines.push(`时间：${vars['世界']?.['现实']?.['时间'] ?? '--'}`);
  lines.push(`地点：${vars['世界']?.['现实']?.['地点'] ?? '未知'}`);
  const r = vars['主角']?.['资源'];
  if (r) lines.push(`HP ${r['HP']}/${r['HP上限']}  MP ${r['MP']}/${r['MP上限']}  💰${r['金钱']}`);
  const companions = vars['主角']?.['同行者'] ?? [];
  if (companions.length) lines.push(`同行者：${companions.join('、')}`);
  return lines.join('  |  ');
}
```

**设计原则**：
- 简报只压住叙事倾向，工具返回值优先
- 控制在 300-500 字，不泄露隐藏信息
- `get_status` 工具仍保留作为精确查询手段（带去重保护）

---

#### A3. 思维链/自检清单

**参考**：fate-sandbox 的 `gm-story-driver.md`（生成前 13 步分析）+ `gm-think.md`（生成后 8 条验证）。

**核心指令**：`Do not write this Module's content into the final reply.`

**生成前内部分析**（5 步，注入 pre-response）：
1. 玩家本轮实际做了什么？不要扩展成更大的决定
2. 本轮需要工具确认的信息是什么？先调工具再叙事
3. 哪个 NPC 最重要？他/她想要什么、绝不会说出口什么？
4. 本轮叙事的主锚点是什么？身体动作 / 物品交互 / 环境变化？
5. 最后一段停在哪个具体行动窗口？

**输出前验证**（8 条，注入 final-contract）：
1. 是否替玩家做了决定？→ 删除，停在选择时刻
2. 是否在工具成功前声称了数值变化？→ 删除
3. 是否有裸数值？→ 改为自然语言
4. NPC 是否说了不该知道的信息？→ 删除或转推测
5. 是否有报告句式？→ 改为场景描写
6. 结尾是否停在可行动时刻？→ 加感官锚点
7. 是否有禁止句式？→ 替换
8. 标签是否正确闭合？→ 检查

---

### 组 B：工具与状态（P1 — 正确性基础）

#### B1. 从通用 patch → 领域事件工具

**问题**：LLM 会尝试各种 path → 失败 + 重试浪费 token → 无法防止写入错误路径。

**方案**：`patch_state` 降级为白名单约束模式，日常状态变更走领域事件工具。

```typescript
// 当前：通用 patch
patch_state({ ops: [{ op: "replace", path: "/主角/资源/HP", value: 80 }] })

// 优化后：领域事件
update_resource({ kind: "spend", resource: "HP", amount: 20, reason: "战斗受伤" })
advance_time({ kind: "elapsed", minutes: 30, reason: "在酒馆休息" })
change_location({ place: "夏城一中·天台", reason: "从教室逃至天台" })
```

**建议新增的领域工具**：
| 工具 | 职责 |
|------|------|
| `update_resource` | HP/MP/金钱等资源的增减，强制 reason |
| `advance_time` | 时间推进，强制显式声明 |
| `change_location` | 地点切换 |
| `add_item` / `remove_item` | 物品获取/消耗 |
| `update_relationship` | NPC 好感度变化 |
| `commit_turn` | 回合提交（时间 + 事件摘要） |

工具 execute 内部决定 path，LLM 只选择"做什么"。

---

#### B2. 动态场景切换（工具集 + 技能统一管理）

**问题**：所有工具始终暴露 → token 浪费 + 误调用风险。

**方案**：`switch_scene` 一次调用同时切换**工具集**和**场景技能**。

```typescript
// 场景配置
const SCENE_PROFILES = {
  always: {
    tools: ['get_status', 'lookup_world', 'roll_dice', 'save_point', 'use_skill', 'switch_scene'],
    skills: [],
  },
  setup: {
    tools: ['get_status', 'lookup_world', 'initialize_game', 'use_skill', 'switch_scene'],
    skills: ['start-game'],
  },
  combat: {
    tools: ['get_status', 'roll_dice', 'update_condition', 'use_skill', 'switch_scene'],
    skills: ['combat'],
  },
  social: {
    tools: ['get_status', 'lookup_world', 'update_relationship', 'save_point', 'use_skill', 'switch_scene'],
    skills: ['social-protocol'],
  },
  exploration: {
    tools: ['get_status', 'lookup_world', 'lookup_location', 'change_location', 'advance_time', 'use_skill', 'switch_scene'],
    skills: ['time-sense'],
  },
};
```

Agent loop 中的过滤：根据 `ctx.currentToolset` 过滤 `openaiTools`。

---

#### B3. 工具 description 全面增强

为每个工具补充：
- **失败时的明确行为**（"如果查不到 → 直接用现有信息叙事，不要反复换关键词重查"）
- **工具间协作关系**（"update_resource 后应接着写叙事，不要重复 get_status"）
- **去重保护**：get_status 状态未变化时拒绝重复调用

---

#### B4. State Schema 版本化与迁移

**问题**：字段重命名 → 旧存档报废。

**方案**：变量树加 `_meta.schemaVersion`，每次改字段 bump 版本 + 添加 migration 函数。

```typescript
const MIGRATIONS = [
  { from: 1, to: 2, description: "HP/MP移到 /主角/资源/", migrate(v) { ... } },
  { from: 2, to: 3, description: "新增体力字段", migrate(v) { ... } },
];

function migrateToLatest(vars) {
  let current = structuredClone(vars);
  const version = current['_meta']?.schemaVersion ?? 1;
  for (const m of MIGRATIONS.filter(m => m.from >= version)) {
    current = m.migrate(current);
  }
  return current;
}
```

**原则**：
- 运行时只读当前字段，不保留 fallback
- 迁移是纯代码逻辑，不调用 LLM
- IndexedDB 读取时自动检测版本并提示迁移

---

#### B5. 状态持久化与回退

**问题**：当前只在对话结束时整体保存，没有每轮快照。

**方案**：每个 agent turn 结束后自动保存快照到 IndexedDB。

```typescript
interface TurnSnapshot {
  id: number;
  messageIndex: number;
  timestamp: number;
  variables: Record<string, any>;     // 深拷贝
  toolCalls: Array<{ name: string }>;
  changes: Array<{ path: string; oldValue?: any; newValue?: any }>;
}
```

**事务保护**：
```typescript
async function executeToolWithSnapshot(tool, ctx, params) {
  const beforeVars = deepClone(ctx.variables);
  try {
    const result = await tool.execute(ctx, params);
    const changes = diffVariables(beforeVars, ctx.variables);
    if (changes.length > 0) {
      await snapshotStore.saveSnapshot({ ... });
    }
    return result;
  } catch (error) {
    ctx.variables = beforeVars;  // 回滚
    throw error;
  }
}
```

**回退**：从 IndexedDB 读取指定轮次快照 → 截断聊天历史 → 恢复变量树。

---

### 组 C：质量控制（P2 — 体验提升）

#### C1. 内容质量三层防线

| 层 | 机制 | 示例 |
|----|------|------|
| 事前约束 | 文风黑名单 | 12 条禁止句式（否定反转、空氛围、连续双喻等） |
| 事中引导 | 创作宪法 + 渲染协议 | "每个回合必须留下至少一个新的可行动压力" |
| 事后检查 | 输出前 8 条自检 | 见 A3 节 |

**好坏对比示例**（prompt 中直接放弱→强对比，比纯规则有效 10 倍）：
```
弱: 你们抵达柳洞寺外围。当前目标是观察结界并安全撤回。
强: 山门还隔着一段石阶，凛已经停了两次。她没有说累，
    只把手套重新往指根处拽紧。
```

#### C2. 输入协议（三种引号）

用户输入中的三种引号解析：

| 标记 | 含义 | NPC 可见性 |
|------|------|-----------|
| `「…」` | 角色说出口的话 | NPC 可听见和反应 |
| `『…』` | 内心想法 | NPC 不可知 |
| `【…】` | 元指令 | 不进入角色世界 |

实现：消息预处理时解析三种引号 → 注入时附带可见性提示。

#### C3. 回合强约束

- `commit_turn` 工具强制要求 `time` 参数
- Pacing 警告：事件数 ≥3 → "请停止推进，先写足正文"；时间 >30 分钟 → "请勿继续玩下一个窗口"

---

### 组 D：支撑系统（P1-P3 — 长期能力）

#### D1. Skills 技能系统

**与 pi 的关键差异**：我们没有 pi 的 `resources_discover`、slash command、`use_skill` 内置工具。需自建。

**设计**：Skill = 条件提示词模块 + 生命周期。与 B2 的场景切换统一管理——`switch_scene` 同时切换工具集和技能。

**技能加载的三种路径**：

| 路径 | 触发方式 | 延迟 |
|------|---------|------|
| 自动检测 | 用户输入匹配关键词 | 同轮注入 |
| LLM 调用 | 调用 `switch_scene()` 或 `use_skill()` | 下一轮生效 |
| UI 触发 | 前端按钮 | 同轮注入 |

**`use_skill` 工具**：LLM 手动加载额外技能（如 `use_skill("time-sense")`），内容作为工具结果回注。

**文件结构**：
```
game/src/sillytavern/agent-skills/
├── registry.ts
├── scene-profiles.ts
└── skills/
    ├── start-game/SKILL.md
    ├── combat/SKILL.md
    └── social/SKILL.md
```

#### D2. Player Panel

**Web 端实现**：React 组件，放在聊天界面侧边栏，独立数据源。

- 直接读 snapshotStore，不依赖 AI 回复
- 每次 agent turn 结束后自动刷新
- 显示：位置/时间、HP/MP/金钱、同行者、异常状态、本轮变化（动画高亮）

#### D3. 上下文压缩策略

**触发条件**：`estimatedTokens > contextWindow * 0.8`

**流程**：调用小模型生成摘要 → 用摘要替换旧消息 → 最近 4 轮完整保留 → 注入 state exclusion digest（已在 state 中的信息不需要保留在摘要里）

#### D4. 验证测试体系

| 层 | 方法 | 检查内容 |
|----|------|---------|
| 第一层 | grep/代码扫描 | 字段引用一致性、schema 匹配 |
| 第二层 | 人工检查清单 | 规则条数、模块完整性 |
| 第三层 | 自动化玩家 agent | 工具调用链路、状态写入一致性 |

---

### 提示词工程补充技巧

以下是跨模块的通用技巧：

**1. 创作宪法**（gm-creative-constitution.md）— 三条最高原则：
- 玩家视角：正文只展示玩家能感知的内容
- 世界惯性：世界不为玩家暂停，每次呼吸都有代价
- 场景运动：每个回合留下至少一个新压力

**2. "LLM 是叙事者，不是会计"** — 删除 prompt 里所有"因为你无法判断所以我要告诉你"的内容。计数、公式、触发条件进代码。Prompt 只放最小规则。

**3. 每个模块只做一件事** — 模块间不互相引用，不出现"详见某某模块"。这样每个模块可以独立启用/禁用/调优先级。

**4. 深度思考自检策略**（DeepSeek 使用总结）

**总结**：
1. 发挥 V4 的“深度思考”能力，让 AI 在生成前/后内部过一遍检查清单（prompt 自检，无额外延迟）。
2. 用户侧判断不准确时，优先在 prompt 中给对比示例引导。
3. 对话历史过长触发“摘要压缩”时，若问题与提示词内容相关，**务必以正确内容为准，及时修正压缩结果**。（记忆系统的正确内容始终以 `CLAUDE.md` 和 `MEMORY.md` 中的文件为准）

**5. 用户可覆盖的空白模板** — 如 `protagonist-impression.md` 是空白模板，玩家在设置中填写后自动覆盖默认版。

**6. 叙事技法参考** — 每个场景结束时必须有价值翻面。每轮至少推动一个微小变化。可作为可选 skill，LLM 在卡壳时自己加载。

---

## 三、提示词最终结构

### 最终固化的预设模块

基于上述所有分析，以下是推荐固化到项目中的完整提示词模块清单：

| # | 模块文件 | 注入 slot | 优先级 | 内容 |
|---|---------|----------|--------|------|
| 1 | `gm-system.md` | system | — | 身份 + 5 条最高契约 |
| 2 | `gm-creative-constitution.md` | pre-history | 10 | 玩家视角、世界惯性、场景运动 |
| 3 | `gm-style-guide.md` | pre-history | 20 | 字数、对话占比、镜头规则、句式节奏 |
| 4 | `gm-style-blacklist.md` | pre-history | 30 | 禁止句式清单 |
| 5 | `gm-render-protocol.md` | pre-history | 40 | 连续性规则、状态锚点、好坏对比 |
| 6 | `mechanical_state` | pre-response | 5 | **运行时生成**：当前时间/地点/HP/MP/金钱/同行者 |
| 7 | `gm-story-driver.md` | pre-response | 10 | 生成前 5 步内部规划 |
| 8 | `gm-tool-policy.md` | pre-response | 15 | 工具调用策略 |
| 9 | `gm-rules.md` | pre-response | 20 | 硬性规则、机械纪律 |
| 10 | `gm-output-contract.md` | final-contract | 10 | 输出格式契约 |
| 11 | `gm-think.md` | final-contract | 20 | 输出前 8 条验证 |

### Skills（条件加载，不常驻）

| Skill | 触发条件 | 内容 |
|-------|---------|------|
| `start-game` | 用户说"开始游戏" / `switch_scene("setup")` | 7 阶段开局流程 |
| `combat` | `switch_scene("combat")` | 战斗协议 |
| `social-protocol` | `switch_scene("social")` | 社交协议、本音建前 |
| `time-sense` | `switch_scene("exploration")` 或 `use_skill` | 时间感知 |
| `intimacy` | `use_skill("intimacy")` | 亲密场景 |
| `storytelling-beats` | `use_skill("storytelling-beats")` | 叙事节奏参考 |

---

## 四、实施路线图

### 第一阶段：架构基础（P0，1-2 周）

| # | 项目 | 说明 |
|---|------|------|
| 1 | **提示词模块化装配** | preset.json + 11 个 markdown 模块 + injection 引擎 |
| 2 | **运行时 GM Brief** | buildGmBrief() 动态生成，注入 pre-response slot |
| 3 | **Skills 加载器** | skills/ 目录解析，start-game skill 优先 |
| 4 | **思维链/自检清单** | 生成前 5 步 + 输出前 8 条 |

**验收**：preset.json 驱动装配，每轮自动注入 GM Brief + 自检清单，start-game 可走通开局流程。

### 第二阶段：工具与状态重构（P1，2-4 周）

| # | 项目 | 说明 |
|---|------|------|
| 5 | **领域事件工具** | update_resource、advance_time、change_location、add/remove_item |
| 6 | **switch_scene** | 场景统一切换（工具集 + 技能） |
| 7 | **工具 description 增强** | 失败指导 + 去重保护 |
| 8 | **Schema 版本化** | _meta.schemaVersion + 迁移函数 |
| 9 | **每轮状态快照** | TurnSnapshot → IndexedDB + 事务回滚 |

**验收**：新领域工具可用，patch_state 降级，普通轮只看到 5-6 个工具，回退后状态正确恢复。

### 第三阶段：质量与体验（P2，4-6 周）

| # | 项目 | 说明 |
|---|------|------|
| 10 | **内容质量控制** | 文风黑名单 + 好坏对比 + 创作宪法 |
| 11 | **回合强约束** | commit_turn + pacing 警告 |
| 12 | **输入协议** | 「」『』【】三种引号解析 + 可见性标注 |
| 13 | **Player Panel** | React 侧边栏，实时状态显示 |
| 14 | **验证测试体系** | checklist + 自动化玩家脚本 |

**验收**：输出前自检生效，时间推进显式记录，Player Panel 可用。

### 第四阶段：高级能力（P3，按需迭代）

| # | 项目 | 说明 |
|---|------|------|
| 15 | **多 Agent 认知隔离** | 有隐藏信息的 NPC 独立 context |
| 16 | **上下文压缩** | 自动摘要 + state exclusion digest |
| 17 | **叙事技法 skill** | 麦基三问、五步循环等可选参考 |

---

## 五、设计原则总结

| 原则 | 当前 | 目标 |
|------|------|------|
| 提示词装配 | 单一文件 | preset.json + 模块化 |
| 状态注入 | LLM 手动查询 | 自动 GM Brief 每轮注入 |
| 状态写入 | 通用 JSON Patch | 领域事件工具 |
| 注意力管理 | 铁则在最后 ✓ | 三个 slot + priority 精确控制 |
| 思维链 | 无 | 生成前规划 + 输出前验证双阶段 |
| 内容质量 | 仅格式规则 | 黑名单 + 好坏对比 + 创作宪法 |
| 工具暴露 | 5 个始终可见 | switch_scene 按场景过滤 |
| 回合管理 | 自由 loop | commit_turn + pacing 警告 |
| 配置能力 | 代码级修改 | preset.json 声明式 + 用户覆盖 |
| 技能系统 | 无 | skills/ + switch_scene 统一管理 |
| 状态持久化 | 结束时整体保存 | 每轮快照 + 事务回滚 |
| Schema 管理 | 无版本号 | schemaVersion + 渐进迁移 |
| 触发模式 | 被动响应 | LLM判断→自动调度（减少手动干预） |

**核心思路**：分三路推进——
- **核心循环**（模块化装配、GM Brief、领域工具、自检清单）→ 决定"能不能跑好"
- **支撑系统**（技能系统、场景切换、状态持久化、测试体系）→ 决定"能不能走远"
- **提示词内容**（好坏对比、创作宪法、文风黑名单）→ 决定输出"够不够好"
