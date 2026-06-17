# Agent 模式优化方案

> **最后更新**: 2026-06-17
> **主要参考**: fate-sandbox-master（Fate/strange Fake 沙盒，基于 pi agent 平台的双 pass 架构）
> **架构说明**: 我们的项目是独立 Web 应用（React + Vite + IndexedDB），不依赖 pi agent 平台。所有方案已针对 Web 端架构适配——核心概念可直接借鉴，但实现路径需自行造轮子（无 pi 的 extension hook / TypeBox / session manager）。

---

## 〇、fate-sandbox 双 Pass 架构速览

在深入优化方案之前，先理解 fate-sandbox 最核心的架构决策。详细模拟见 `fate-sandbox-循环模拟.md`。

### 双 Pass 是什么

```
玩家输入
  ↓
┌─ Pass A: Settlement Director (agent loop) ──────────────┐
│  身份: "You never write player-visible narration."       │
│  输入: system-settlement.md                              │
│       + preset-settlement.json 的 10 个模块               │
│       + 聊天历史 + 用户输入                               │
│  输出: submit_direction_packet (结构化 JSON)              │
│        → playerAction / resolvedChanges / npcStances     │
│        → sensoryAnchors / endWindow / eventWeight        │
│        → canonFacts                                      │
│        → 经 packet-firewall 扫描秘密泄漏后 terminate     │
└──────────────────┬──────────────────────────────────────┘
                   │ direction packet (唯一通道)
                   ▼
┌─ Pass B: Clean-room Renderer (纯 stream()) ─────────────┐
│  身份: "Do not run tools, settle rules, inspect state."  │
│  输入: system-render.md                                  │
│       + preset-render.json 的 5 个模块                    │
│       + 散文史 (摘要层 + 全文层)                          │
│       + 本轮玩家输入 + Direction Packet                  │
│  输出: 纯中文叙事正文 → lint → 回写 session              │
│  可见: 玩家输入 + packet + 历史正文                      │
│  不可见: ❌ 工具历史 ❌ State ❌ 未揭示秘密 ❌ GM Brief  │
└──────────────────────────────────────────────────────────┘
```

### 为什么需要双 Pass

来自 ADR-0002（`docs/adr/0002-two-pass-direction-render-split.md`）：

> 两个工作在单次生成中互相腐蚀：文笔质量和工具纪律在同一个模型 pass 中互相折衷，工作记忆中的秘密泄漏到热情的叙述中（审计发现真实的真名泄漏），引擎端的拒绝变成玩家可见的失败。

### 对 Web 端的适用性

| 双 Pass 解决的问题 | 我们是否需要 | 建议 |
|-------------------|-------------|------|
| 结算与渲染在工作记忆中互相腐蚀 | ⚠️ 部分存在 — submit_reply 同时处理结算信息和叙事 | P2 考虑方向 |
| 隐藏秘密泄漏到叙事中 | 当前项目无隐藏信息层 | 暂不需要 |
| 工具失败暴露给玩家 | 当前已有 ToolCallBubble | 可接受 |
| 不同模型做结算 vs 渲染 | 目前单模型可用 | 未来可选 |
| 多一次模型调用成本 + packet 完整性依赖 | — | 先优化单 pass |

**结论**：双 Pass 是核心创新但不是当前最紧迫的——我们的项目没有秘密泄漏问题，且单 pass 的 submit_reply 效果已可用。先把单 pass 做到极致，再考虑切两轮。

---

## 一、当前状态与核心差距

### 1.1 当前架构

```
用户输入 → buildAgentContext() → runAgentLoop() → LLM + tools → submit_reply → 输出
              │                      │
              ├─ 3层消息结构          ├─ while(turn < maxTurns)
              │  system: 身份+契约     │  ├─ router.callAgent()
              │  pre-history: 8个文风模块 │  ├─ 流式解析 SSE
              │  pre-response: 3个规则模块 │  ├─ 检测 tool_calls
              │  final-contract: 3个检查模块│  ├─ 执行工具(含事务保护) → 结果回注
              └─ preset.json + injection.ts │  └─ submit_reply → 退出
                                         └─ 工具: get_status, lookup_world,
                                            roll_dice, save_point, switch_scene,
                                            submit_reply, 及 9 个领域工具
```

### 1.2 当前优点

- Agent loop 清晰，事务保护完善（structuredClone 快照回滚）
- 已采用 preset.json + slot/priority 的模块化架构（与 fate-sandbox 同级）
- 工具 description 三段式模板已部分应用
- GM Brief 运行时动态生成（buildGmBrief）
- 自检清单（think_check 9 条）比 fate-sandbox 的 Quality Gate 更结构化
- 缓存监控（DeepSeek cache hit/miss 追踪）

### 1.3 与 fate-sandbox-master 的核心差距（修订版）

| 维度 | 我们 | fate-sandbox-master | 差距等级 | 说明 |
|------|------|---------------------|:--:|------|
| **双 Pass 分离** | 单 pass | 结算器 + 洁净室渲染器 | **大** | 但我们暂不需要——无秘密泄漏问题 |
| **Slot 策略** | 预置 pre-response | 所有规则放 **pre-history** | **中** | fate 把 tool-policy/hard-rules/story-driver 全放低注意力区 |
| **turn-reminder** | 无 | 3 行极简每轮提醒 | **小** | 高价值低成本 |
| **presence-impressions** | 无 | 运行时从 state 提取 NPC 印象卡 | **中** | compaction 后保持 NPC 声音一致性 |
| **story-driver 深度** | ~30 行 | **180 行**，13 步规划 + post-tool 写作映射 | **大** | 最值得借鉴的单文件 |
| **tool-policy 深度** | 53 行，基础路由 | **130 行**，canon query 规则 + beat lifecycle + subagent 路由 | **大** | 工具纪律的核心防线 |
| **TypeBox schema** | JSON Schema 对象 | 完整 TypeBox 类型定义 | 中 | pi 平台专有，我们不依赖 |
| **Domain Event Runner** | 无统一事务层 | clone → execute → commit → persist | 中 | 当前 structuredClone 回滚已可用 |
| **packet-firewall** | 无 | 代码层秘密泄漏扫描 + 整包拒绝 | 小 | 无秘密层则不需要 |
| **prose lint + retry** | 无 | 渲染后 3 层检查 + 重写 + redact | 中 | 可参考做正文质量检查 |
| **digest writer** | 无 | 独立小模型写每行摘要 | 小 | 未来 compaction 时可用 |

---

## 二、提示词架构优化（P0）

### 2.1 当前已做到的

当前项目的 preset.json + injection.ts + module-content.ts 架构已经和 fate-sandbox 同级：
- preset.json 声明模块 id/enabled/slot/priority/header/source
- injection.ts 按 slot/priority 排序组装
- module-content.ts 提供 Vite `?raw` import 的内容映射
- 支持 `runtime:state-brief` 动态生成

### 2.2 需要调整的部分

#### A. Slot 策略调整

**fate-sandbox 的做法**：**所有规则模块放在 pre-history**（低注意力区），pre-response 只放 3 个极简模块。

```
fate-sandbox settlement preset:
  pre-history (低注意力):
    settlement-principles (pri=10)
    world-context (pri=20)
    input-guide (pri=30)
    social-guide (pri=40)
    tool-policy (pri=80)          ← 130 行工具路由在这里
    hard-rules (pri=90)           ← 50 行硬规则在这里
    story-driver (pri=100)        ← 180 行剧情纪律在这里
  pre-response (最高注意力):
    mechanical-state (pri=10)      ← GM Brief，运行时生成
    turn-reminder (pri=20)        ← 3 行极简
    presence-impressions (pri=15)  ← NPC 印象卡，运行时生成
  final-contract:
    direction-contract (pri=10)   ← packet 格式契约
```

哲学：**工具 description 是模型调用的第一入口，prompt 模块只是上下文参考。** 规则需要存在但不需要每轮高声朗读。pre-response 只放"绝对不可跳过的最小纪律"——3 行 turn-reminder。

**当前项目的做法**：story-driver、tool-policy、hard-rules 放在 **pre-response**（最高注意力区）。

**建议**：两种策略各有利弊。当前项目的做法（规则放 pre-response）在 DS V4 上可能更有效——DS V4 对 user-role 的服从度远超 system，且 high-attention 区域的指令更容易被遵循。保持当前布局，但做以下微调：

1. **新增 turn-reminder 模块**：3 行极简，放在 pre-response 第一位（pri=5）。

```markdown
# Turn Reminder

- 先调工具确认机械事实，再叙事。工具返回值覆盖 GM Brief。
- 一轮只处理一个玩家的行动窗口。停在玩家必须回应的时刻。
- 不要把推理、字段名、JSON、schema 路径写进正文。
```

2. **考虑将 story-driver 拆分为两个模块**：
   - `gm-story-driver.md`（pre-history，pri=15）：写作前的剧情规划（轻量 5 步）
   - `gm-story-driver-full.md`（可选 skill）：完整的 13 步规划 + post-tool 写作映射表

#### B. 新增模块：presence-impressions（NPC 在场印象卡）

**来源**：fate-sandbox 的 `buildPresenceImpressionsText()`，从 state 的 actor impression 中提取当前场景 NPC 的 presence/actionStyle/relationshipPosture/voiceMaterial。

**Web 端适配**：从变量树 `主要人物/` + 当前场景中提取。

```typescript
function buildPresenceImpressions(variables: Record<string, any>, currentLocation: string): string {
  // 从变量树中提取当前场景相关的 NPC
  // 格式：NPC 名 / 在场状态 / 当前情绪 / 对玩家的态度 / 声音特征
  // 控制在 200-400 字
}
```

**价值**：compaction 后 NPC 声音一致性是纯 prompt 最易丢失的维度。印象卡作为每轮注入的"当前 NPC 状态锚"可以显著缓解。

#### C. story-driver 深化

**参考**：fate-sandbox 的 `gm-story-driver.md` 180 行。最值得借鉴的部分：

1. **13 步当前轮内部分析**（我们可压缩为 5-8 步）
2. **Post-tool 写作映射表**（最具实操价值）：

```
- Time change → sky, bells, foot traffic, fatigue, transit, temperature
- Location change → route, ground, entrance, blocked sightline, sense of distance
- Wound / mana → limited movement, pain, dizziness, changed breathing
- Money / object → payment, change, bag weight, receipt, object position
- Relationship change → address, distance, pause, avoidance, active care, concrete promise
```

这个映射表把"工具结果如何转化为叙事细节"做成了速查清单。建议加入我们的 `gm-story-driver.md`。

3. **压力纪律**：
```
- Gentle cushioning is drift.
- Pressure must land on state or an action window.
- If each careful player action gets clean success, the next success must carry cost.
```

---

## 三、工具调用优化（P1）

### 3.1 当前工具现状

当前 15 个工具（get_status, lookup_world, roll_dice, save_point, switch_scene, submit_reply, advance_time, change_location, change_weather, toggle_dream, update_resource, commit_turn, update_skill, add_item, remove_item, add_condition, remove_condition, update_social, update_outfit, update_body_development, update_npc_info, update_map）。

分 5 个 category：lookup / world / variable / mechanics / deprecated。

### 3.2 需要调整的部分

#### A. 工具 description 全面三段式

每个工具必须包含：

```
【必须调用的场景】— 具体列表，不用模糊表述
【严禁的行为】— 显式否定模型的内部记忆权威性
【你的职责】— 重新定义角色（"你不是创造者，你是翻译者"）
```

**参考 fate-sandbox `lookup` 的优秀范例**：

```
"查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。

【必须调用的场景】
- 玩家遇到或提及任何预设角色/从者/NPC——必须先查再叙述
- 玩家进入预设地点——先查地点设定再描述环境
- 当前场景涉及憑依、伪装、身份分裂、外观错位...——先查本地；
  若本地条目没写清身份层、外观层、知识边界、时点，再继续外部 canon research

【严禁的行为】
- 凭记忆编造角色外貌/性格/背景
- 即兴发明设定
- 用一句粗略摘要填补复杂 canon 细节；不知道外观、时点、身份主体或
  知识边界时必须继续查证"
```

**注意**：fate-sandbox 的 lookup description 比我们当前的 lookup_world 长 3 倍，列举了更具体的 canon-sensitive 触发条件。

#### B. submit_reply 的 description 是最高优先级

submit_reply 是 agent loop 的唯一出口。它的 description 必须最强：

```
"提交本轮最终回复。这是你向玩家输出叙事的**唯一方式**。

【必须调用的场景】
- 所有工具调用完成后，准备输出叙事时
- 你确定本轮不需要再查询或修改状态时
- 不确定还需要什么时——直接调用此工具提交当前回复

【严禁的行为】
- 在调用 submit_reply 之前直接输出任何文本——会被系统忽略
- 在 maintext 中输出推理、字段名、JSON、schema 路径、骰点
- 替玩家做决定——叙事必须停在玩家可回应处

【你的职责】
你不是在聊天框中回复，你是在通过工具提交一篇完整的叙事作品。
maintext 是你唯一的叙事输出渠道。"
```

#### C. 引入 turn-reminder 到 tool-policy

参考 fate-sandbox 在 pre-response 中的 3 行极简提醒。可合并到 tool-policy.md 的顶部：

```markdown
## 每轮最小纪律（turn-reminder）

- 先调工具确认机械事实，再叙事。工具返回值覆盖 GM Brief。
- 一轮只处理一个玩家行动窗口。停在玩家必须回应的时刻。
- 秘密/幕后真相只通过痕迹、传闻、梦境或后果呈现。
```

#### D. Domain Event 思维

fate-sandbox 的核心哲学："工具是领域事件，不是 MVU 状态栏"。当前项目已部分采用——`commit_turn` 作为 canonical turn 提交入口。可以进一步强化：

- 每个写工具必须有 `reason` 参数（当前 `update_resource` 已有 reason，但 `add_item`/`remove_item` 没有）
- 时间推进必须是 turn envelope，不是可选项

---

## 四、质量控制优化（P1-P2）

### 4.1 gm-system.md 双层框架

当前 gm-system.md 已有"Tools and Game State are the source of mechanical truth"。但缺少 fate-sandbox 的显式双层框架：

```markdown
## Your output has two layers

① **Mechanical layer** — determined by tool calls. All concrete data, settings,
   and judgment results MUST come from tool return values.
② **Narrative layer** — generated by you. Translate mechanical results into vivid
   second-person Chinese narration.

**Nothing in the mechanical layer exists until confirmed by a tool call.**
If you narrate mechanical content without calling the corresponding tool,
you are **polluting the game state**.
```

关键：把"不调就编"重新框定为**污染游戏状态**，不是"偷懒"或"拖慢节奏"。

### 4.2 文风 Lint（未来）

fate-sandbox 的 `engine/audit/lint-rules.ts` + `extensions/two-pass-render/index.ts` 中的 `lintRenderedProse()` 提供了渲染后自动检查 + 重写的机制。Web 端可以在 `submit_reply` 的 execute 中或 agent loop 完成后加入类似的正文后检查。

### 4.3 玩家印象卡（protagonist-impression）

fate-sandbox 的 `agents/protagonist-impression.md` 是空白模板，让玩家/系统填写对玩家角色的行为模式观察。可以参考内循环系统中的"梦呓分析"模块——分析玩家的游玩类型、行为模式、交互偏好，注入 pre-history 供 GM 参考。

---

## 五、实施路线图（修订版）

### 第一阶段：提示词微调（本周可完成）

| # | 改动 | 文件 | 工作量 |
|---|------|------|--------|
| 1 | **gm-system.md 双层框架** | `agent-prompt/gm-system.md` | 5 行 |
| 2 | **submit_reply description 三段式强化** | `tools/mechanics.ts` | 20 行 |
| 3 | **新增 turn-reminder 模块** | 新建 `agent-prompt/gm-turn-reminder.md` + 更新 `preset.json` + 更新 `module-content.ts` | 10 行 |
| 4 | **tool-policy 顶部加 turn-reminder** | `agent-prompt/gm-tool-policy.md` | 5 行 |
| 5 | **story-driver 加入 post-tool 写作映射表** | `agent-prompt/gm-story-driver.md` | 15 行 |

### 第二阶段：工具增强（1-2 周）

| # | 改动 | 说明 |
|---|------|------|
| 6 | **补全所有工具 description 三段式** | 逐一检查 tools/ 下每个工具 |
| 7 | **给写工具加 reason 参数** | add_item, remove_item, add_condition 等 |
| 8 | **lookup_world description 强化** | 参考 fate-sandbox lookup 的详细触发条件 |

### 第三阶段：质量系统（2-4 周）

| # | 改动 | 说明 |
|---|------|------|
| 9 | **正文 lint 检查** | submit_reply 后扫描禁止句式、秘密泄漏 |
| 10 | **presence-impressions** | 运行时从变量树提取 NPC 印象卡注入 |
| 11 | **玩家印象卡** | 追踪玩家行为模式，注入 pre-history |

### 第四阶段：架构升级（评估后决定）

| # | 改动 | 说明 |
|---|------|------|
| 12 | **双 Pass 分离** | 结算器 + 渲染器分离，需要重构 agent loop |
| 13 | **Domain Event Tool Runner** | 统一事务层 |
| 14 | **Subagent 系统** | offscreen 事件生成 / 节奏审计 |

---

## 六、与 fate-sandbox 的关键设计理念对照

| 理念 | fate-sandbox 实现 | 我们应该怎么做 |
|------|------------------|---------------|
| "Agent 是程序本身" | 所有逻辑进 engine/*.ts，prompt 极简 | 继续保持代码层优先 |
| "Prompt 不是防线" | 约束下沉到 schema、tool boundary、engine invariant | 工具加 strict path 保护 |
| "工具是领域事件" | commit_turn 必须带 time，所有写工具有 reason | 给所有写工具强制加 reason |
| "工具 description 是第一防线" | 每个工具三段式 + 跨工具路由规则 | 补全三段式 + tool-policy 深化 |
| "硬规则离生成最近" | 3 行 turn-reminder 在 pre-response | 新增 turn-reminder |
| "叙事交给 LLM，计数交给代码" | 骰子/伤害/好感度计算全部进 engine | 保持当前做法 |
| "数据没有查询工具 = 死数据" | 索引文件 + lookup 工具 | 当前 get_status + lookup_world 已覆盖 |

---

## 七、设计原则（不变）

| 原则 | 当前 | 目标 |
|------|------|------|
| 提示词装配 | preset.json + 模块化 ✓ | 微调 slot 策略 + 新增模块 |
| 状态注入 | GM Brief 运行时生成 ✓ | 新增 presence-impressions |
| 状态写入 | 领域事件工具 ✓ | 统一 reason 参数 |
| 注意力管理 | pre-response 放铁则 ✓ | 新增 turn-reminder 极简层 |
| 思维链 | 生成前规划 + 输出前自检 ✓ | story-driver 加入写作映射表 |
| 内容质量 | think_check 9 条 | + 正文 lint 检查 |
| 工具暴露 | switch_scene 过滤 ✓ | 补全三段式 description |
| 回合管理 | commit_turn ✓ | turn-reminder 强调时间必填 |

**核心思路不变**：分三路推进——
- **核心循环**（模块化装配、GM Brief、领域工具、自检清单）→ 决定"能不能跑好"
- **支撑系统**（技能系统、场景切换、状态持久化、测试体系）→ 决定"能不能走远"
- **提示词内容**（好坏对比、创作宪法、文风黑名单）→ 决定输出"够不够好"
