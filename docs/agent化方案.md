# Agent 化改造方案

> 2026-06-09
> 基于 piagent + tavern2agent 架构分析，对当前项目进行全面的 Agent 化改造设计。

---

## 一、当前架构总览

### 1.1 数据流（当前）

```
用户输入 → [ChatPage.handleSend]
  │
  ▼
useSillytavern.sendGameMessage(userText)
  │
  ├─ 1. assemblePrompt()       ← 提示词构建
  │     ├─ PresetBlock 数组遍历
  │     ├─ 宏引擎替换（{{user}} {{MAP}} {{GET_VAR}} 等）
  │     ├─ 世界书关键词扫描+注入
  │     ├─ 聊天历史拼接
  │     └─ → { messages, totalTokens }
  │
  ├─ 2. apiRouter.call('story', { messages, stream:true })
  │     └─ → 流式 SSE 响应
  │
  ├─ 3. StreamTagParser.feed(chunk)   ← XML 状态机解析
  │     └─ → { maintext, options, history, vars }
  │
  ├─ 4. 格式检查（无有效标签 → 回退）
  │
  ├─ 5. gameBus.emit('message_received')
  │     ├─ plot-history subscriber    ← <history> → plotHistory
  │     └─ (后续)
  │
  ├─ 6. [双API模式] 第二次 API 调用
  │     └─ → JSON Patch / JSON Merge → applyParsedToChat
  │
  ├─ 7. gameBus.emit('vars_applied')
  │     ├─ dream-anchor subscriber    ← 梦境切换 → 装备验证
  │     └─ physiology subscriber      ← (下一轮 time_changed)
  │
  ├─ 8. gameBus.emit('time_changed')
  │     └─ physiology subscriber      ← 生理 tick
  │
  └─ 9. 保存到 IndexedDB → UI 刷新
```

### 1.2 核心问题清单

| # | 问题 | 影响 |
|---|------|------|
| 1 | **"预设为空"拦截** | `DEFAULT_PRESET_BLOCKS = []`，首次启动必须导入预设才能用。Agent 模式不需要 PresetBlock，但该检查在 `sendGameMessage` 里硬编码 |
| 2 | **XML 标签解析不可靠** | AI 输出格式错误（缺标签/标签未闭合）→ 直接回退，丢失整轮对话 |
| 3 | **变量修改依赖文本解析** | JSON Patch 嵌在 `<vars>` / `<JSONPatch>` 标签里，解析失败静默丢弃 |
| 4 | **单次调用无工具循环** | AI 不能"查设定→掷骰→计算→写状态→叙事"，只能一次性全部输出 |
| 5 | **双 API 设计是补丁** | 第二 API 负责变量处理是 workaround，本质是因为单次调用塞不下所有逻辑 |
| 6 | **无上下文管理** | `recentMessageCount: 6` 是唯一修剪手段，长会话无 compaction |
| 7 | **无 prompt 缓存标记** | 缓存监控已采集 usage 但没有主动标记 cache_control 提高命中率 |
| 8 | **状态无 session 快照** | 变量树存在 IndexedDB ChatSession 上，回档靠"从 assistant 消息反向查找 variablesAfter"，历史节点没有独立快照 |

---

## 二、Agent 化目标架构

### 2.1 目标数据流

```
用户输入 → [ChatPage.handleSend]
  │
  ▼
agentLoop.start(userText, context)
  │
  ├─ 1. buildContext()           ← 分层提示词构建（不变层优先）
  │    ├─ System Layer:    身份 + 运行契约
  │    ├─ Reference Layer: 世界观 / 角色 / 工具索引（user role, 上方）
  │    ├─ Rule Layer:      铁则 / 叙事纪律 / attention reminders（user role, 下方）
  │    ├─ Chat History:    最近 N 条 + summary（如做过 compaction）
  │    ├─ Tool Definitions: 注册的工具列表
  │    └─ → { messages, tools }
  │
  ├─ 2. agentLoop.run()    ← 核心：内层 tool loop
  │    ┌─────────────────────────────────────────────┐
  │    │ while (hasMoreToolCalls || pendingMessages) │
  │    │   ├─ LLM call (stream)                       │
  │    │   ├─ assistant 回复                          │
  │    │   │   ├─ 有 tool_call → 执行工具               │
  │    │   │   │   → tool_result 追加到 context          │
  │    │   │   │   → hasMoreToolCalls = true          │
  │    │   │   └─ 无 tool_call → hasMoreToolCalls = false│
  │    │   ├─ prepareNextTurn（可选修改 model/config） │
  │    │   └─ shouldStopAfterTurn? → break           │
  │    └─────────────────────────────────────────────┘
  │
  ├─ 3. commit()   ← 写入 session + IndexedDB
  │    ├─ assistant 消息 → ChatSession.messages
  │    ├─ State snapshot → session custom entry
  │    ├─ 工具执行结果 → ChatSession.messages（tool_results）
  │    └─ gameBus.emit('turn_complete')
  │
  └─ 4. side effects（订阅者处理）
       ├─ physiology tick
       ├─ dream anchor
       └─ plot history
```

### 2.2 前后端职责重新划分

```
┌─ 前端 (React) ─────────────────────────┐
│  ChatPage / Sidebar / Modals           │
│  只做 UI：输入 → sendMessage → 渲染     │
│  不处理 prompt 构建 / 变量解析           │
└───────────┬────────────────────────────┘
            │ useSillytavern (hook)
            ▼
┌─ Agent 层 (新) ─────────────────────────┐
│  agent-loop.ts        tool loop 核心    │
│  agent-context.ts     分层上下文构建     │
│  session-store.ts     状态持久化        │
└───────────┬────────────────────────────┘
            │
            ▼
┌─ Engine 层 (现有, 改造) ────────────────┐
│  prompt-assembler.ts  → prompt layering│
│  stream-parser.ts     → 改为 tool 解析  │
│  api-router.ts        → 保留（扩展）    │
│  cache-monitor.ts     → 保留（增强）    │
└───────────┬────────────────────────────┘
            │
            ▼
┌─ Tools 层 (新) ─────────────────────────┐
│  state.ts      patch_state / get_status│
│  dice.ts       roll / combat_check     │
│  world.ts      lookup_location / npc   │
│  narrative.ts  save_point / append_plot│
│  shop.ts       browse / purchase       │
│  realize.ts    preview / execute       │
│  physiology.ts tick / check_fertility  │
└───────────┬────────────────────────────┘
            │
            ▼
┌─ Data 层 (现有, 保留) ──────────────────┐
│  IndexedDB (Dexie)  +  Session Snapshots│
│  lorebookEngine / map-filter / etc.    │
└────────────────────────────────────────┘
```

---

## 三、前端改动

### 3.1 ChatPage（最小改动）

当前 `handleSend` 直接调 `ss.sendGameMessage(msg)`，Agent 化后接口不变：

```typescript
// 改前
const result = await ss.sendGameMessage(msg);

// 改后 — 接口不变，内部走 agent loop
const result = await ss.sendGameMessage(msg);
// result 新增字段:
//   toolCalls: ToolCallRecord[]  ← 本轮执行的工具调用列表
//   turnCount: number            ← 本轮经历了多少 turn (AI 返回次数)
```

**ChatPage 需要改的：**
- 流式渲染逻辑支持「工具调用中」状态（类似 TauriTavern `StreamingProcessor.toolCalls`）
- 新增 `ToolCallBubble` 组件：显示工具调用（可折叠），参照 `CacheMonitorBubble`
- `isStreaming` 状态在 tool loop 期间保持 true
- "预设为空"拦截**移除**（Agent 模式不需要 PresetBlock）

### 3.2 SystemSettingsModal / ApiTab

- **新增字段**：`ApiSettings.agentMode: boolean`（默认 false，可切换）
- **新增字段**：`ApiSettings.tools: string[]`（启用的工具列表，checkboxes）
- **移除/降级**：presetBlocks / activePresetId / presets（Agent 模式下隐藏或禁用）
- **ApiTab 改动**：新增 "Agent 模式" 开关，开启后隐藏预设相关字段

### 3.3 PromptViewerModal

- Agent 模式下显示分层视图：System / Reference / Rules / History / Tools
- 每层可独立折叠
- 显示预估 token 数和缓存命中预测

### 3.4 Sidebar

- 不需要改（页面路由不变）

---

## 四、后端/Agent 层改动（核心）

### 4.1 新增：`sillytavern/agent-loop.ts`

```typescript
interface AgentLoopConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  signal?: AbortSignal;
  tools: AgentTool[];
  maxTurns: number;        // 安全上限，防止无限循环
  onEvent: (event: AgentEvent) => void;  // UI 更新回调
}

interface AgentLoopResult {
  messages: AgentMessage[];   // 本轮新增的所有消息
  finalText: string;          // 最终叙事文本
  toolCalls: ToolCallRecord[];
  turnCount: number;
  usage: CacheUsageRecord;
}

async function runAgentLoop(
  initialMessages: Message[],
  config: AgentLoopConfig,
): Promise<AgentLoopResult>;
```

**内层循环逻辑**（参考 piagent `agent-loop.ts:155-268`）：

```
while (turnCount < maxTurns) {
  1. 发送 LLM 请求（stream: true, tools: config.tools）
  2. 流式解析 assistant 回复
     - 如果是普通文本 → 累积到 finalText
     - 如果是 tool_call → 收集 toolCalls
  3. 如果没有 tool_call → break（AI 完成叙事）
  4. 如果有 tool_call → 逐个执行
     - 结果作为 tool_result 消息追加到 messages
     - turnCount++
     - 回到步骤 1（AI 看到工具结果后继续）
}
// 返回最终结果
```

### 4.2 新增：`sillytavern/agent-context.ts`

**分层提示词构建器**，取代 `prompt-assembler.ts` 的扁平化方式：

```typescript
interface AgentContextConfig {
  // System 层（不变，缓存友好）
  systemPrompt: string;          // 身份 + 运行契约

  // Reference 层（user role, 上方）
  worldContext: string;          // 世界观 / 地图 / 角色列表
  toolIndex: string;             // 工具速查

  // Rule 层（user role, 下方）
  rules: string;                 // 铁则 / 叙事纪律 / attention reminders

  // History 层
  history: ChatMessage[];
  recentMessageCount: number;

  // Tools 层
  tools: AgentTool[];
}

function buildAgentContext(config: AgentContextConfig): {
  messages: Message[];
  systemPrompt: string;
  tools: ToolDefinition[];
};
```

**分层注入模式**（参考 tavern2agent deepseek-v4.md）：

```
System Prompt     → "你是叙事者（GM）。机械层由工具确定，叙事层由你表达。"
                    （极简，只放身份+最高契约）

[以下为世界观与参考信息]  ← user role, 上方
  ## 世界设定
  当前位置：{{location}} | 时间：{{time}}
  ## 角色速查
  {{characterIndex}}
  ## 可用工具
  {{toolList}}

[玩家输入]           ← 用户的实际消息

[以下是你必须遵守的铁则]  ← user role, 下方（离生成最近）
  - 所有具体数据必须来自工具调用
  - 未经工具确认的数据 = 污染游戏状态
  - {{narrativeRules}}
```

**关键点**：
- 世界观/角色信息放在用户消息**上方**（低注意力区，但 DS 缓存可命中）
- 铁则放在用户消息**下方**（高注意力区，DS V4 的 user message 服从度最高）
- System prompt 只放身份+契约，不放长规则表
- 所有动态注入通过 `context` 修改 deep copy，不污染对话历史

### 4.3 新增：`sillytavern/tools/` 目录

```
sillytavern/tools/
  ├── registry.ts        ← 工具注册中心 + 类型定义
  ├── state.ts           ← patch_state / get_status / get_variable
  ├── world.ts           ← lookup_location / lookup_npc / lookup_item
  ├── dice.ts            ← roll_dice / combat_check / skill_check
  ├── narrative.ts       ← save_point / append_history / set_scene
  ├── shop.ts            ← browse_shop / purchase_item
  ├── realize.ts         ← preview_realize / execute_realize
  └── physiology.ts      ← tick_physiology / check_fertility
```

**工具定义模板**（参考 piagent 的 `types.ts:361-384` 和 tavern2agent 的 pi-integration.md）：

```typescript
// tools/registry.ts
import { Type } from "typebox";

export interface AgentTool {
  name: string;
  label: string;           // UI 显示名
  description: string;     // 包含"必须调用场景"+"严禁行为"
  parameters: TypeBox schema;
  execute: (params: any) => Promise<ToolResult>;
  executionMode?: 'parallel' | 'sequential';  // 工具执行模式
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details?: any;           // 给 hooks/日志用，不进入 LLM 上下文
  terminate?: boolean;     // 是否终止当前 tool batch
}

// 示例：patch_state
export const patchStateTool: AgentTool = {
  name: "patch_state",
  label: "修改游戏状态",
  description:
    "通过 JSON Patch (RFC 6902) 修改游戏变量树。这是修改变量的唯一方式。\n\n" +
    "【必须调用的场景】\n" +
    "- 玩家 HP/MP/金钱 等数值变化\n" +
    "- NPC 好感度变化\n" +
    "- 地点切换\n" +
    "- 物品增减\n" +
    "- 任何需要记录到状态的变化\n\n" +
    "【严禁的行为】\n" +
    "- 在叙事中说「好感度+10」但未调此工具\n" +
    "- 凭记忆推测当前数值——必须先 get_status 确认",
  parameters: Type.Object({
    ops: Type.Array(Type.Object({
      op: Type.Union([Type.Literal("replace"), Type.Literal("add"), Type.Literal("remove")]),
      path: Type.String({ description: "JSON Pointer，如 /主角/资源/HP" }),
      value: Type.Optional(Type.Unknown()),
    })),
  }),
  execute: async (params) => {
    const state = loadState();
    applyPatches(state, params.ops);
    saveState(state);
    return {
      content: [{ type: "text", text: `已更新 ${params.ops.length} 项变量` }],
      details: { ops: params.ops },
    };
  },
};
```

### 4.4 改造：`api-router.ts`

当前 `api-router.ts` 非常简单（67 行），只支持单/双路由。Agent 化后：

- 保留 `createApiRouter` 的基础 fetch 封装
- 新增：`streamWithTools(model, messages, tools, signal)` — 带 tool_choice 的流式调用
- 新增：`cacheControl` 选项（控制是否添加缓存标记头）
- 移除：task-based routing（`story`/`vars`/`summary`）— Agent 模式不需要

### 4.5 改造：`useSillytavern.ts` 的 `sendGameMessage`

这是改动最大的函数。当前 ~430 行（265-694），Agent 化后：

```typescript
const sendGameMessage = useCallback(async (userText: string, opts?: { skipUserMessage?: boolean }) => {
  // ... 前置检查 ...

  // ── 新：Agent 模式 ──
  if (settings.agentMode) {
    // 1. 构建分层上下文
    const agentContext = buildAgentContext({
      systemPrompt: buildSystemLayer(...),
      worldContext: buildReferenceLayer(...),
      rules: buildRuleLayer(...),
      history: updatedChat.messages,
      tools: getEnabledTools(settings),
    });

    // 2. 启动 agent loop
    const abortController = new AbortController();
    abortRef.current = abortController;

    const loopResult = await runAgentLoop(
      agentContext.messages,
      {
        model: effectiveApi.model,
        apiKey: effectiveApi.apiKey,
        baseUrl: effectiveApi.baseUrl,
        signal: abortController.signal,
        tools: agentContext.tools,
        maxTurns: 10,  // 安全上限
        onEvent: (event) => {
          // 通知 UI 更新（流式文本、工具调用状态、等等）
          // 参考当前 parser 的事件机制
        },
      },
    );

    // 3. 处理结果
    const finalText = loopResult.finalText;
    const assistantMsg = { id: uuid, role: 'assistant', content: finalText, ... };
    // ... 保存到 DB, emit events, 等 ...
    return { aborted: false, toolCalls: loopResult.toolCalls, ... };
  }

  // ── 旧：非 Agent 模式（保留兼容） ──
  // ... 现有代码 ...
}, [activeChat, settings, parser]);
```

### 4.6 改造：`stream-parser.ts`

- **保留** `StreamTagParser`（用于解析 thinking 标签）
- **新增** 流式 tool_call 解析：参考 TauriTavern `ToolManager.parseToolCalls` (`tool-calling.js`)
- OpenAI tool call 流式响应格式：
  ```json
  {
    "choices": [{
      "delta": {
        "tool_calls": [{
          "index": 0,
          "id": "call_xxx",
          "function": { "name": "patch_state", "arguments": "{\"ops\":[" }
        }]
      }
    }]
  }
  ```

### 4.7 移除/降级

| 模块 | 操作 | 原因 |
|------|------|------|
| `stream-parser.ts` 的 `<vars>` `<JSONPatch>` 解析 | 移除 | 工具调用替代 |
| `secondary-prompt-builder.ts` | 保留（降级为非 Agent 模式专用） | Agent 不需要双 API |
| `presetImporter.ts` | 保留（降级为非 Agent 模式专用） | Agent 不需要 ST 预设 |
| `DEFAULT_PRESET_BLOCKS = []` 拦截 | **移除** | Agent 模式下不需要预设 |
| `apiMode: 'dual'` | 保留（降级为非 Agent 模式） | 单 Agent API 即可 |
| `activePresetId` / `activeVarsPresetId` | Agent 模式下隐藏 UI | 不再使用 |

---

## 五、API 配置改动

### 5.1 当前 vs 改造后

```typescript
// 当前 ApiSettings
{
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  secondary?: { enabled, baseUrl, apiKey, model, ... };
}

// 改造后 ApiSettings
{
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;

  // 新增：Agent 模式配置
  agentMode: boolean;              // 默认 false（兼容）
  enabledTools: string[];          // ['patch_state', 'get_status', 'roll_dice', ...]
  maxTurnsPerMessage: number;      // 每轮最大 tool loop 次数，默认 10
  toolExecution: 'parallel' | 'sequential';  // 默认 'parallel'

  // 新增：缓存优化
  cacheControl: 'auto' | 'enabled' | 'disabled';  // 默认 'auto'

  // 保留：双 API（仅非 Agent 模式）
  apiMode: 'single' | 'dual';
  secondary?: { ... };
}
```

### 5.2 Settings UI 改动

```
ApiTab:
  ┌─────────────────────────────────────────┐
  │ API Mode:  [单 API]  [双 API]           │  ← 保留
  │            [Agent 模式 ✨]               │  ← 新增
  ├─────────────────────────────────────────┤
  │ 主 API 配置                              │
  │  Base URL / API Key / Model             │
  │  测试连通性                               │
  ├─────────────────────────────────────────┤
  │ Agent 配置（仅 Agent 模式）              │
  │  最大轮数: [10]                          │
  │  工具执行: [并行 ▾] [顺序]              │
  │  缓存控制: [自动 ▾]                     │
  │                                         │
  │  启用的工具（勾选）:                     │
  │  [✓] patch_state   [✓] get_status       │
  │  [✓] roll_dice     [✓] combat_check     │
  │  [✓] lookup_location [✓] lookup_npc     │
  │  [✓] save_point    [ ] browse_shop      │
  │  [✓] realize_item  [ ] tick_physiology  │
  └─────────────────────────────────────────┘
```

### 5.3 预设相关 UI（Agent 模式下隐藏）

```
FrontendConfigTab:
  - 预设管理器 (PromptManagerRoot)  → 非 Agent 模式显示
  - 在 Agent 模式下显示灰色提示："Agent 模式不需要预设"
```

---

## 六、缓存策略（Agent 模式特有优势）

### 6.1 为什么 Agent 模式缓存命中率更高

```
非 Agent 模式:
  每次请求: [System Prompt(变)] [Context(变)] [Rules(变)] [History(变)] [User Input(新)]
  缓存命中率: 低（每次 prompt 都是新组装的）

Agent 模式:
  第一次请求:  [System(不变)] [Tools(不变)] [Ref(不变)] [Rules(不变)] [History(不变)] [User(新)]
               └──────────────────── 缓存写入 ────────────────────┘└── 新 ──┘
  第二次请求:  [System(不变)] [Tools(不变)] [Ref(不变)] [Rules(不变)] [History(不变)] [User(新)]
               └──────────────── 全部命中！───────────────────────┘└── 新 ──┘

  Tool loop 内:
  第 1 次:    [System+Tools+Ref+Rules+History] [User Input]
              └─────────── 缓存写入 ──────────┘└─ 新 ──┘
  第 2 次:    [System+Tools+...+History] [Assistant(tool_call)] [ToolResult(新)]
              └────── 缓存命中 ───────┘└──── 新 ────┘└─ 新 ──┘
  第 3 次:    [System+Tools+...+ToolResult1] [Assistant(tool_call)] [ToolResult2(新)]
              └─────── 缓存命中 ─────────┘└──── 新 ────┘└─ 新 ──┘
```

### 6.2 主动缓存标记（参考 piagent openai-completions.ts:638-739）

```typescript
// 在发送给 DS API 的消息中：
// 1. System prompt 的最后一条 text content 标记 cache_control
systemMessage.content = [
  { type: "text", text: systemText, cache_control: { type: "ephemeral" } }
];

// 2. 历史消息中最后一条 user/assistant 标记 cache_control
lastHistoryMessage.content = [
  { type: "text", text: lastText, cache_control: { type: "ephemeral" } }
];

// 3. Tools 数组的最后一个元素标记 cache_control
tools[tools.length - 1].cache_control = { type: "ephemeral" };
```

### 6.3 缓存监控增强

当前 `cache-monitor.ts` 已采集 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`。Agent 化后增强：
- 记录每轮 tool loop 的缓存命中
- 在 `CacheMonitorBubble` 显示命中率趋势
- 命中率下降时告警（提示用户可能修改了历史消息）

---

## 七、状态持久化改造

### 7.1 当前问题

- 变量树存在 `ChatSession.variables`，与 chat messages 绑定
- 回档靠"从 assistant 消息反向查找 variablesAfter"
- 没有独立的状态快照
- 没有状态版本管理

### 7.2 改造方案（参考 tavern2agent SKILL.md §六）

```
ChatSession:
  messages[]        ← 对话历史
  variables         ← (保留, 最新状态缓存)
  stateSnapshots: { ← 新增: 状态快照映射
    [messageId]: StateSnapshot
  }
  stateSchemaVersion: number  ← 新增: 状态 schema 版本

StateSnapshot = {
  vars: Record<string, any>;   ← 快照时的变量树
  turn: number;                ← 第几轮
  timestamp: number;
}

// 每次 tool loop 后：
// 1. 计算 dirty state diff
// 2. 写入 assistant 消息的 stateSnapshot
// 3. 保存到 IndexedDB
```

### 7.3 回档支持

参考 `useSillytavern.jumpToFloor`：已经能从截断位置还原变量。改造后：
- 回档到 messageId → 从 `stateSnapshots[messageId]` 恢复
- 向后兼容：无 snapshot 时回退到 `variablesAfter`

---

## 八、迁移策略：三阶段

### 阶段 1：Agent 基础设施（不动现有逻辑）

1. **新增** `sillytavern/agent-loop.ts` — tool loop 核心
2. **新增** `sillytavern/agent-context.ts` — 分层提示词
3. **新增** `sillytavern/tools/registry.ts` — 工具注册（先注册 3-5 个核心工具）
4. **改造** `api-router.ts` — 新增 `streamWithTools`
5. **新增** `AppSettings.agentMode` — 默认 false
6. **新增** `ApiTab` 的 Agent 模式开关

**检验标准**：Agent 模式开关打开后，用 mock 工具跑通 tool loop → AI 文本正常输出

### 阶段 2：工具迁移（将现有引擎模块注册为工具）

逐个将现有引擎注册为工具：
1. `patch_state` / `get_status` → 替代当前 `applyParsedToChat` 的文本解析
2. `roll_dice` → 替代 AI 脑补掷骰
3. `lookup_location` / `lookup_npc` → 替代 {{MAP}} {{FEMALE_STRANGER}} 宏的部分功能
4. `save_point` → 替代 `<history>` XML 标签
5. `realize_item` → `realize-engine.ts`
6. `shop_browse` / `shop_purchase` → `shop-engine.ts`

**检验标准**：Agent 模式关闭双 API，单 API 用工具调用完成叙事+状态更新，格式错误率降为 0

### 阶段 3：体验优化（缓存 + compaction + 多 agent）

1. **缓存标记** — 在分层提示词中主动标记 cache_control
2. **上下文 compaction** — 长会话自动压缩旧消息为 summary
3. **多 agent 探索** — 可选：NPC 子代理（认知隔离），但非必需
4. **移除旧代码** — 清理 XML 标签解析、双 API 变量处理等过时逻辑

**检验标准**：缓存命中率 > 70%，支持 200+ 轮对话不爆上下文

---

## 九、"预设为空"问题的处理

当前 `DEFAULT_PRESET_BLOCKS = []`，`sendGameMessage` 开头检查：

```typescript
// useSillytavern.ts:285-287
if (!effectiveSettings.presetBlocks || effectiveSettings.presetBlocks.length === 0) {
  throw new Error('请先在设置中导入提示词预设');
}
```

**Agent 化后**：
- Agent 模式下跳过这个检查
- Agent 模式的分层提示词用 `agent-context.ts` 构建，不依赖 PresetBlock 数组
- PresetBlock 导入功能保留给非 Agent 模式

具体改动（`useSillytavern.ts`:285-287）：
```typescript
// 改后：
if (!effectiveSettings.agentMode) {
  if (!effectiveSettings.presetBlocks || effectiveSettings.presetBlocks.length === 0) {
    throw new Error('请先在设置中导入提示词预设，或开启 Agent 模式');
  }
}
```

---

## 十、文件改动清单

### 新增文件

| 文件 | 行数估 | 说明 |
|------|--------|------|
| `sillytavern/agent-loop.ts` | ~200 | Tool loop 核心 |
| `sillytavern/agent-context.ts` | ~150 | 分层提示词构建 |
| `sillytavern/tools/registry.ts` | ~100 | 工具注册中心 |
| `sillytavern/tools/state.ts` | ~120 | patch_state / get_status |
| `sillytavern/tools/dice.ts` | ~80 | roll_dice / combat_check |
| `sillytavern/tools/world.ts` | ~100 | lookup_location / lookup_npc |
| `sillytavern/tools/narrative.ts` | ~80 | save_point / append_history |
| `components/ChatPage/ToolCallBubble.tsx` | ~60 | 工具调用状态 UI |

### 改造文件

| 文件 | 改动范围 | 说明 |
|------|---------|------|
| `hooks/useSillytavern.ts` | ~100 行改动 | sendGameMessage 分支 + agentMode 检查 |
| `sillytavern/api-router.ts` | ~40 行新增 | streamWithTools 函数 |
| `sillytavern/types.ts` | ~30 行新增 | Agent 相关类型 |
| `components/Settings/ApiTab.tsx` | ~60 行新增 | Agent 模式 UI |
| `components/Settings/FrontendConfigTab.tsx` | ~10 行 | 预设区条件隐藏 |
| `components/Pages/ChatPage/index.tsx` | ~30 行 | ToolCallBubble + streaming 状态 |
| `sillytavern/stream-parser.ts` | ~40 行新增 | tool_call 流式解析 |
| `sillytavern/cache-monitor.ts` | ~30 行新增 | cache_control 标记 |

### 不移除/保留兼容的文件

| 文件 | 原因 |
|------|------|
| `prompt-assembler.ts` | 非 Agent 模式仍需要 |
| `secondary-prompt-builder.ts` | 非 Agent 双 API 模式需要 |
| `presetImporter.ts` | 非 Agent 模式需要 |
| `lorebookEngine.ts` | Agent 模式仍用（lookup_location 工具内部调用） |
| `event-bus.ts` | 保留（Agent 模式继续使用） |
| `database.ts` | 保留（增加 stateSnapshots 表） |
| 所有 subscribers | 保留（继续监听 turn_complete 等事件） |
| `variables.ts` | 保留（工具内部调用） |
| `map-filter.ts` / `character-filter.ts` | 保留（工具内部调用） |
| `realize-engine.ts` / `shop-engine.ts` | 保留（注册为工具） |
| `physiology.ts` | 保留（继续作为 subscriber） |

---

## 十一、风险与回退策略

| 风险 | 缓解 |
|------|------|
| Agent 模式的 tool loop 可能无限循环 | `maxTurns` 硬上限 + 用户可见暂停按钮 |
| AI 在 Agent 模式下风格变化 | 分层提示词中的铁则层保留叙事规则 |
| 工具定义不当导致 AI 不调用 | 参考 tavern2agent 的「工具 description 工程」模板 |
| DS V4 的 reasoning 语言漂移 | 全链路中文化（已做）+ 保留现有 thinking 标签解析 |
| 缓存策略改动导致成本升高 | Agent 模式默认关闭，可选开启；缓存监控持续跟踪 |
| 对非 Agent 模式的兼容性 | Agent 模式通过开关控制，默认 false；两种模式共用 DB schema |

**回退**：任何时候关闭 Agent 模式开关 → 完全回到当前工作方式。
