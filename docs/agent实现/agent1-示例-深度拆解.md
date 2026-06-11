# fate-sandbox 深度拆解：提示词架构 × 工具体系

---

## 第一部分：真实提示词架构

### 一句话总结

**提示词不是写出来的，是装配出来的。** 一个 `preset.json`（声明式配置）+ 一个 `injection.ts`（运行时装配引擎）+ 13 个 markdown 模块文件 + 1 个运行时动态源 = 模型每轮实际看到的完整上下文。

---

### 装配流水线（从源码到模型）

```
                    ┌──────────────────┐
                    │   preset.json    │  声明式模块清单
                    │   version: 1     │  每个模块有: id / enabled / slot / priority / header / source
                    └───────┬──────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  engine/gm-prompt/injection.ts │  运行时装配引擎
            │                                │
            │  loadPromptAssets()            │
            │  ├─ gm-system.md → system      │
            │  └─ preset.json → preset       │
            │                                │
            │  injectGmPromptMessages()       │
            │  ├─ buildSlotMessages("pre-history")    │
            │  │   └─ 读 preset.json modules[slot=pre-history]  │
            │  │       按 priority 排序，每个生成一个 user message │
            │  ├─ ...原始消息...                       │
            │  ├─ buildSlotMessages("pre-response")    │
            │  │   └─ modules[slot=pre-response]       │
            │  │       含 runtime:state-brief → 调用 buildGmBrief(state) │
            │  └─ buildSlotMessages("final-contract")   │
            │      └─ modules[slot=final-contract]      │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────────────────────┐
            │  模型实际收到的 messages 数组（以一轮为例）      │
            │                                               │
            │  [0] user: <creative_constitution>            │
            │      玩家视角 / 世界惯性 / 场景动力           │
            │      </creative_constitution>                │
            │                                               │
            │  [1] user: <world_context>                   │
            │      世界观边界 / 本地素材范围 / 正典可信度    │
            │      </world_context>                        │
            │                                               │
            │  [2] user: <input_guide>                     │
            │      「」『』【】三种引号约定                 │
            │      </input_guide>                           │
            │                                               │
            │  [3] user: <social_guide>                    │
            │      本音建前 / 型月对话 / NPC 行为驱动       │
            │      </social_guide>                          │
            │                                               │
            │  [4] user: <style_blacklist>                 │
            │      12 条禁止句式                            │
            │      </style_blacklist>                       │
            │                                               │
            │  [5] user: <writing_guide>                   │
            │      镜头规则 / Fate 风味 / 句式节奏          │
            │      </writing_guide>                         │
            │                                               │
            │  [6] user: <render_protocol>                 │
            │      连续性规则 / 状态锚点 / 多人场景 / 坏→好示例│
            │      </render_protocol>                       │
            │                                               │
            │  ── 以上是 pre-history slot（低注意力背景参考）──│
            │                                               │
            │  [7] user: *玩家本轮输入*                     │
            │      "我走进冬木教会..."                       │
            │                                               │
            │  ── 以下是 pre-response slot（最高注意力！）──  │
            │                                               │
            │  [8] user: <mechanical_state>                │
            │      [当前 GM 简报]                           │
            │      时间：2004年1月30日（周五）18:00 JST     │
            │      地点：冬木市 · 深山镇 · 穗群原学园·校门外 │
            │      态势：daily                              │
            │      玩家角色：你 / human / 身份未定...        │
            │      同行者：无                               │
            │      资源：可访问资金 50,000 円...             │
            │      伤势/长期影响：无显著伤势或长期影响        │
            │      （这是从 state 运行时动态生成的！）       │
            │      </mechanical_state>                      │
            │                                               │
            │  [9] user: <protagonist_impression>           │
            │      主角印象模板（用户可覆盖）                │
            │      </protagonist_impression>                │
            │                                               │
            │ [10] user: <tool_policy>                     │
            │      工具调用策略（读状态优先 / 正典查询 /     │
            │      Scene Beat lifecycle / 领域事件路由 /     │
            │      子代理路由 / 战斗边界）                   │
            │      </tool_policy>                           │
            │                                               │
            │ [11] user: <hard_rules>                      │
            │      新手模式 / 型月规则 / 状态安全 /          │
            │      裁决纪律 / 后果纪律                       │
            │      </hard_rules>                            │
            │                                               │
            │ [12] user: <story_driver>                    │
            │      12 条回合内检查 / 谜团预算 / 压力纪律 /   │
            │      post-tool 写作地图                        │
            │      </story_driver>                          │
            │                                               │
            │  ── 以下是 final-contract slot（最后一道防线）──│
            │                                               │
            │ [13] user: <output_contract>                 │
            │      只输出中文叙事正文 / 长度随事件重量 /     │
            │      禁止汇报句式 / 禁止伪菜单结尾 /           │
            │      首行必须是场景内动作                       │
            │      </output_contract>                       │
            │                                               │
            │  → 模型生成 →                                 │
            └───────────────────────────────────────────────┘
```

---

### 三层 Slot 的注意力设计

```
高注意力 ▲
          │  [8-12] pre-response    机械状态、工具策略、硬规则、故事驱动
          │                          ★ 离生成最近，注意力最高
          │
          │  [7]    user input       玩家本轮行动
          │
          │  [0-6]  pre-history      创作宪章、世界观、写作指南
          │                          ★ 离生成最远，注意力最低
          │
          │  [13]   final-contract   输出格式契约
          │                          ★ 最后注入，影响输出形状
低注意力 ▼
```

**为什么把硬规则放在 user message 流而不是 system prompt？** 这是 DeepSeek V4 适配的关键发现：V4 对 system prompt 的遵循度远低于 user message 中的指令。把硬规则放在最靠近生成位置的 user message 中（`pre-response` slot），并包裹在 XML 标签中，效果远好于 system prompt。

---

### preset.json 的配置能力

```json
{
  "id": "tool-policy",
  "enabled": true,             // 一键禁用整个模块
  "slot": "pre-response",       // 三个 slot 之一
  "priority": 20,               // 同 slot 内排序（越小越靠前）
  "header": "tool_policy",      // 注入时的 XML 标签名
  "source": "agents/gm-tool-policy.md"  // 文件源
}
```

`runtime:state-brief` 是唯一的运行时源——它不是文件，而是调用 `buildGmBrief(getPublicState())` 每轮动态生成。

---

### 模块文件的职责边界

每个模块只做一件事，互不重叠：

| 模块 | 核心职责 | 禁止管的事 |
|------|---------|-----------|
| `gm-system.md` | 身份定义 + 最高契约（5条） | 工具策略、硬规则、输出格式 |
| `gm-creative-constitution.md` | 玩家视角、世界惯性、场景动力 | 工具路由、文风、输出形状 |
| `gm-context.md` | 世界观边界、正典可信度 | 工具策略、规则 |
| `gm-input-guide.md` | `「」『』【】` 三种引号约定 | 社交行为、文风 |
| `gm-social-guide.md` | 本音/建前、型月对话、NPC 行为驱动 | 输入格式、文风 |
| `gm-style-blacklist.md` | 12条禁止句式 | 正向写作指导 |
| `gm-style.md` | 镜头规则、Fate 风味、句式节奏 | 禁止句式列表 |
| `gm-render.md` | 连续性规则、状态锚点、多人场景 | 工具策略、规则 |
| `gm-tool-policy.md` | 工具调用决策树、领域事件路由 | 硬性世界观规则 |
| `gm-rules.md` | 新手模式、型月规则、裁决/后果纪律 | 工具调用时机 |
| `gm-story-driver.md` | 12条回合内检查、谜团预算、压力纪律 | 工具策略 |
| `gm-think.md` | 输出前 8 条验证 | 工具调用 |
| `gm-output-contract.md` | 输出格式硬约束 | 叙事内容 |

**关键设计原则：模块之间不互相引用，不出现"详见某某模块"——每个模块可以独立启用/禁用/调整优先级。**

---

### 用户覆盖机制

```typescript
function resolvePromptFilePath(path: string): string {
  const userPath = path.replace(/^agents\//u, "agents/user/");
  // 如果 agents/user/protagonist-impression.md 存在，优先用它
  if (userPath !== path && existsSync(absoluteUserPath)) {
    return absoluteUserPath;
  }
  return join(PROJECT_ROOT, path);
}
```

玩家可以在 `agents/user/` 下放同名文件覆盖默认模块——例如 `protagonist-impression.md` 默认是空白模板，玩家填上自己的主角设定后，自动优先使用。

---

## 第二部分：完整工具清单

### 工具总览（21 个注册工具）

```
                    ┌─────────────────────────────┐
                    │    叙事工具（每轮核心）       │
                    │  commit_turn                │ ← 回合提交（时间+领域事件）
                    │  progress_scene_beat        │ ← Scene Beat lifecycle
                    │  get_status                 │ ← GM Brief 查询
                    └─────────────────────────────┘

  ┌──────────────────────┐    ┌──────────────────────┐
  │   领域写入工具（6个）  │    │   查询/研究工具（1个） │
  │  update_actor_condition│   │  lookup               │
  │  set_scene_presence   │    └──────────────────────┘
  │  upsert_actor         │
  │  update_economy       │    ┌──────────────────────┐
  │  update_servant_form  │    │   秘密/揭示工具（2个） │
  │  record_memory        │    │  reveal_secret        │
  └──────────────────────┘    │  private_resolve      │
                              └──────────────────────┘
  ┌──────────────────────┐    ┌──────────────────────┐
  │   战斗/裁决工具（1个） │    │   初始化/配置工具（2个）│
  │  resolve_combat_exchange│  │  initialize_new_game  │
  └──────────────────────┘    │  configure_campaign   │
                              └──────────────────────┘
  ┌──────────────────────┐    ┌──────────────────────┐
  │   维护/清理工具（1个） │    │   调试工具（5个）      │
  │  retire_actor         │    │  patch_state（已禁用） │
  └──────────────────────┘    │  override_locked_fact  │
                              │  migrate_state         │
                              │  reset_state           │
                              │  get_state_schema      │
                              │  export_state          │
                              └──────────────────────┘
```

---

### 一、叙事工具（3个）

#### 1. `commit_turn` — 回合提交

**职责**：每轮叙事结束时一次性提交时间推进 + 领域事件。这是"回合"概念的强制执行点。

**参数**：
```typescript
{
  summary?: string           // 可选，自动从事件 reason 生成
  time: {
    kind: "elapsed" | "travel"
    elapsedMinutes: number   // kind=elapsed/travel 必填
    location?: LocationState // kind=travel 必填
    reason: string           // 为什么耗时
  }
  events: Array<{
    kind: "scene" | "scene-presence" | "actor-condition" 
        | "servant-form" | "economy" | "memory"
    event: { ... }           // 对应领域事件载荷
  }>
}
```

**约束**：
- 时间推进是**强制**的——不能跳过 `time` 参数
- 领域事件只能通过合法 kind 提交，不能裸写 path
- Scene Beat lifecycle 优先用 `progress_scene_beat`，不走 `commit_turn`
- 提交后应停止前台推进，先写足正文

#### 2. `progress_scene_beat` — Scene Beat Lifecycle

**职责**：推进 Scene Beat——开启有界行动窗口，或收口当前 beat。

**参数**：
```typescript
// kind=begin
{
  kind: "begin"
  title: string              // Beat 标题
  objectives: string[]       // 1-5 个 Scene Objective
  purpose: string            // 为什么进入这个 beat
  time: TurnTimePolicy       // 必须
  beatId?: string
  actionPolicy?: {           // 行动边界
    allowedActions?: string[]
    forbiddenEscalations?: string[]
    completionCriteria?: string[]
    nextBeatHints?: string[]
  }
  threats?: { summary: string, severity: string }[]
  presence?: { presentActorIds: string[], allyActorIds: string[] }
  situation?: string
}

// kind=complete
{
  kind: "complete"
  outcome: string            // 收口结果
  time: TurnTimePolicy       // 必须
  memory?: {                 // 可选：记录 Campaign Memory
    title: string
    summary: string
    consequences?: string[]
    claims: MemoryClaim[]
  }
  nextBeat?: { ... } | null  // 可选：直接进入下一 beat
  presence?: { ... }
  situation?: string
}
```

**约束**：
- 同一时间只能有一个 active beat
- complete 必须先解决所有 Scene Objective
- 失败/撤退也可以 complete，但 outcome 必须写明代价
- nextBeat 不能复读同一中心冲突

#### 3. `get_status` — GM Brief 查询

**职责**：查看当前玩家可见状态摘要。

**特殊机制**：**去重保护**——如果状态没变化，重复调用会直接抛错拒绝。
```typescript
// 内部用 WeakMap 记录上次 revision
function rejectRepeatedStatusRead(sessionManager, revision) {
  if (previousRevision === revision) {
    throw new Error("get_status 已读取当前状态；状态未变化...")
  }
}
```

---

### 二、领域写入工具（6个）

#### 4. `update_actor_condition` — Actor 状态更新

**支持的 kind（10种）**：

| kind | 用途 |
|------|------|
| `add-wound` | 新增伤势（minor/moderate/severe/critical） |
| `update-wound` | 更新已有伤势的描述/治疗/恢复性 |
| `add-affliction` | 新增异常状态（诅咒、中毒等） |
| `add-permanent-effect` | 新增永久影响 |
| `update-magecraft-circuits` | 更新魔术回路状态（count/quality/od/status/traits） |
| `resolve-condition` | 处理伤势/异常（recovered/stabilized） |
| `change-outfit` | 更换外观/服装/灵装 |
| `transfer-tracked-item` | 转移关键物品持有者 |
| `update-tracked-item` | 更新关键物品状态 |
| `add-tracked-item` | 新增关键物品到追踪列表 |

**严禁行为**：不能用通用 HP 替代离散伤势；换装不能用 update-wound；普通消耗品不能塞进 trackedItems。

#### 5. `set_scene_presence` — 场景在场管理

```typescript
{
  presentActorIds: string[]  // 当前在场 actor
  allyActorIds: string[]     // 同行者
  reason: string
}
```

**设计意图**：actor materialization（`upsert_actor`）和 physical presence（`set_scene_presence`）**分离**——注册一个 actor 不等于它就在当前场景。

#### 6. `upsert_actor` — Actor 注册

**支持的 kind（4种）**：

| kind | 用途 |
|------|------|
| `setup-protagonist` | 开局确认玩家角色身份 |
| `ensure-public-npc` | 幂等注册普通 NPC（不覆盖已有） |
| `upsert-public-npc` | 注册/更新 NPC 公开投影 |
| `upsert-servant` | 注册从者（完整职阶/参数/技能/宝具） |

#### 7. `update_economy` — 经济更新

**支持的 kind**：`spend-money` / `gain-money` / `add-purse` / `rename-purse` / `add-debt`

**约束**：每笔资金必须指定 purse/account 与 reason；gain-money 必须提供 source 和 counterparty。

#### 8. `update_servant_form` — 从者形态更新

**支持的 kind**：`spend-mana` / `restore-mana` / `damage-spiritual-core` / `add-param-modifier` / `change-contract` / `add-permanent-defect`

**约束**：锁定字段（职阶/真名/基础参数/宝具）不可改。

#### 9. `record_memory` — 记忆记录

**支持的 kind**：`pin-fact` / `record-major-event` / `record-daily-summary`

**约束**：每条 public memory 必须提供 claims（结构化证据声明），包含 kind / statement / certainty / evidence。

---

### 三、查询工具（1个）

#### 10. `lookup` — 型月设定查询

**职责**：查询角色、从者、地点、概念、时间线的权威设定。支持单关键词或多关键词（空格/逗号分隔）。

**工具 description 示例**：
```
"查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。
【必须调用的场景】
- 玩家遇到或提及任何预设角色/从者/NPC——必须先查再叙述
- 玩家进入预设地点——先查地点设定再描述环境
【严禁的行为】
- 凭记忆编造角色外貌/性格/背景
- 即兴发明型月设定"
```

---

### 四、秘密/揭示工具（2个）

#### 11. `reveal_secret` — 隐藏事实揭示

**支持的 kind（4种）**：

| kind | 用途 |
|------|------|
| `configure-servant-secrets` | 从者首次入场时配置隐藏真名/宝具揭示条件 |
| `configure-actor-secrets` | NPC 首次入场时配置隐藏动机/未揭示联盟 |
| `claim-reveal` | 玩家提出推理声明，工具内部匹配验证 |
| `observed-reveal` | 剧情内直接观察触发揭示 |

**核心机制**：GM 提交的是 claim + evidence，不是 secret ID。工具内部：
1. 匹配 secret slot 的 revealConditions
2. 证据匹配成功 → revealed，更新 public state
3. 部分匹配 → foreshadowed
4. 不匹配 → insufficient-evidence / incorrect

**安全设计**：GM 不能直接指定"揭示 secret #3"——他只能说"玩家声称 Saber 是亚瑟王，证据是她用了 Excalibur"。工具内部查找是否有匹配的 secret slot。

#### 12. `private_resolve` — 私密结算

**支持的 kind**：`hidden-reaction` / `secret-compatibility`

**职责**：查询 hidden fact 后用玩家安全的叙事约束回答，不泄露隐藏真相本身。

```
输入：actorId=Caster, stimulus="玩家提到了科尔基斯"
输出：outcome="subtle-reaction"
      narrativeConstraints=["可以描写可见的细微反应，但不得泄露隐藏真相。"]
```

---

### 五、战斗工具（1个）

#### 13. `resolve_combat_exchange` — 战斗交锋裁决

**核心算法**：
```
score = rankScore + scaleScore + factorScore + swingScore - vulnerabilityScore

rankScore    = mainRankDelta × 2 + clamp(modifierDelta)
scaleScore   = servant(3) / mage(1) / mundane(0)
factorScore  = min(resources,2) + min(advantages,3) - min(disadvantages,3) + riskScore
swingScore   = bad-break(-2) / pressure(-1) / neutral(0) / opening(+1) / turnabout(+2)
vulnerability = woundVulnerability + servantVulnerability(mana + spiritualCore)
```

**结果 band**：
| score | outcome |
|-------|---------|
| ≥5 | clean-advantage（高风险时降为 advantage-with-cost） |
| 2-4 | advantage-with-cost |
| -1~1 | exchange |
| -4~-2 | forced-defense（desperate 时降为 failed-with-cost） |
| <-4 | overwhelmed |

**关键设计**：`resolve_combat_exchange` **只裁决，不改状态**。返回结果包含：
- `stateLandings[]`：列出必须/可选的状态落地项（scene-objective, scene-threat, actor-condition, servant-form, memory, reveal-secret）
- `narrativeConstraints[]`：叙事约束
- `forbiddenNarration[]`：禁止写的句式
- `nextActionWindow`：下一行动窗口描述

**战场变数是自动投骰的**：
```typescript
function rollCombatSwing(): CombatSwing {
  const roll = randomInt(100)
  if (roll < 10) return "bad-break"     // 10%
  if (roll < 30) return "pressure"      // 20%
  if (roll < 70) return "neutral"       // 40%
  if (roll < 90) return "opening"       // 20%
  return "turnabout"                    // 10%
}
```

---

### 六、初始化/配置工具（2个）

#### 14. `initialize_new_game` — 新游戏初始化

单入口 recipe：重置 state → 配置 campaign → 写入 protagonist → 设置在场 actor → 配置从者秘密。

#### 15. `configure_campaign` — Campaign 配置

配置时间线、时区、起始时间、地点、经济规则等元数据。

---

### 七、维护工具（1个）

#### 16. `retire_actor` — Actor 退场

将已退场/死亡/离开的 actor 从 public registry 移除。有保护约束：不能 retire protagonist，不能删除被契约/item 引用的 actor。

---

### 八、调试工具（5个）

#### 17. `patch_state` — **已禁用**

```typescript
export function patchStateTool(params, _sessionManager): ToolResult {
  patchState(params.ops)  // 底层直接抛异常
  return textResult("patch_state 已禁用：常规玩法必须使用领域 update 工具。", details)
}
```

#### 18. `override_locked_fact` — 覆盖锁定事实（调试修档）

#### 19. `migrate_state` — 状态迁移（调试）

#### 20. `reset_state` — 重置状态（调试）

#### 21. `get_state_schema` — 查看 schema 版本（调试）

#### 22. `export_state` — 导出状态到文件（调试）

---

### 工具架构的通用模式

每个工具的调用链完全一致：

```
pi.registerTool({ name, description, parameters, execute })
  │
  ▼
tools/state/xxx-tool.ts
  │  1. 规范化 LLM 输入（normalizeXxxInput）
  │  2. 调用 runDomainEventTool
  ▼
tools/state/domain-tool-runner.ts
  │  1. execute() — 调用 engine 模块
  │  2. persistCurrentState(sessionManager) — 写 session custom entry
  │  3. writeStateToDetails(details) — 状态快照放入 toolResult.details
  │  4. 返回 { content: [{ type: "text", text: "..." }], details: {...} }
  ▼
engine/core/xxx.ts
  │  实际的领域逻辑，在 transactState() 包裹中修改 globalThis store
```

**关键防护层次**：
1. **工具 adapter**（`tools/state/`）：规范化 LLM 输出，扔掉多余字段，校验必需字段
2. **领域引擎**（`engine/core/`）：强类型 + assert 校验 + transactState 事务
3. **Schema 层**（`state.ts`）：200+ 类型定义 + 每个字段有 assert 函数
4. **Session 层**（`state-persistence.ts`）：每次写入自动持久化到 session custom entry

---

## 第三部分：关键设计思路总结

### 1. 工具不是「让 LLM 能做更多」，而是「让 LLM 不能做错的」

每个工具的 description 都包含三种信息：
- **必须调用的场景**：给 LLM 一个决策清单
- **严禁的行为**：堵死 LLM 的"偷懒路径"
- **叙事节奏提醒**：很多工具返回结果里会主动告诉 GM "现在应该停止推进，先写足正文"

### 2. 回合是强制概念

`commit_turn` 和 `progress_scene_beat` 都强制要求 `time` 参数。LLM 不能"自由判断"时间推进——每一轮的时间消耗是显式的、可审计的。pacing 警告（事件数≥3、时间>30分钟）进一步防止 LLM 在单轮内推进过多。

### 3. Public/Secret 双态是信息安全的基石

GM 的主 context 只能看到 Public Game State。Hidden facts 通过 `private_resolve` 查询但不暴露，通过 `reveal_secret` 在证据匹配时揭示。这确保了 GM 不会在叙事中"剧透"。

### 4. 战斗裁决与状态修改分离

`resolve_combat_exchange` 只返回结果 band 和约束，不修改任何状态。后续由 GM 调用领域写入工具落地。这防止了"一次工具调用改变多个不相关状态"。

### 5. 提示词模块化让迭代快

新增一条规则？加一个模块文件，在 preset.json 里注册。禁用一条规则？改 `enabled: false`。调整注意力？改 slot 或 priority。不需要重写 system prompt。
