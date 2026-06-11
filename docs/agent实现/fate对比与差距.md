# Fate-sandbox 对比与差距

> 2026-06-11，基于完整代码审查和实测数据。

---

## Fate-sandbox 游玩流程

```
① 玩家输入 → pi 框架收到消息
② session_start/context 钩子 → 从 session 树恢复状态（含 schema 迁移）
③ before_agent_start → 组装 system prompt
④ context 钩子 → 三层 slot 注入（pre-history / pre-response / final-contract）
⑤ context 钩子 → 构建 GM Brief（时间/地点/资源/目标/威胁/记忆/资金）
⑥ LLM 收到完整上下文 → 思考 → 决定工具调用
⑦ 工具执行 → transactState() 回合级事务保护 → 持久化状态 → 返回结果
⑧ LLM 收到结果 → 可能再调用工具 → 或开始叙事
⑨ LLM 输出最终叙事 → 停在玩家可回应处
⑩ 通过 session custom entry + state.json 持久化状态
⑪ 返回①
```

---

## 逐环节对比

| # | 环节 | Fate-sandbox | 我们 | 状态 |
|---|------|-------------|------|:--:|
| ① | 状态恢复 | session 树递归扫描 + schema 版本迁移 | IndexedDB 读聊天记录 | ✅ |
| ② | 提示词装配 | preset.json → 3 slot 注入 (pre-history/pre-response/final-contract) | 同架构，14 个模块 | ✅ |
| ③ | GM Brief | 完整简报：时间/位置/态势/故事窗口/角色/同伴/资金/目标/威胁/记忆 | 基础简报：时间/地点/HP/MP/评级 | 🟡 |
| ④ | 工具事务 | `transactState()` 回合级回滚 | `structuredClone` 单工具级回滚 | 🟡 |
| ⑤ | pacing 控制 | commit_turn 警告 + scene beat 生命周期 | commit_turn/advance_time 警告 | ✅ |
| ⑥ | **场景节拍** | begin/complete 结构化故事窗口 + 自动关闭 | 无 | 🔴 |
| ⑦ | 状态分层 | Public/Secret 双态，专用 reveal_secret 工具 | 单一公开变量树 | 🔵 |
| ⑧ | 状态持久化 | 每次工具调用后自动持久化 | 对话结束时整体保存 | 🟡 |
| ⑨ | **上下文压缩** | compaction → 摘要替换旧消息（摘要固定→缓存稳定） | 无（刚修复 recentMessageCount=0） | 🟡 |
| ⑩ | **子代理** | parallel-line（offscreen）+ timeline-showrunner（节奏审计） | 无（纯前端并行方案已设计） | 🔵 |
| ⑪ | 工具数量 | 20+ 领域工具 | 22 变量+查询+机制工具 | ✅ |
| ⑫ | 场景过滤 | 无（全部工具始终暴露） | switch_scene 按 5 场景过滤 | ✅ |
| ⑬ | 文件组织 | 每个工具一个文件 | 10 文件分类组织 | ✅ |

---

## 差距详细说明

### 🔴 场景节拍（缺失）

Fate 的结构化故事窗口机制：
- `progress_scene_beat begin`：设定目标（1-5个）+ 允许/禁止的行动 + 完成条件
- 节拍中：通过 commit_turn 渐进解决目标
- `progress_scene_beat complete`：所有目标解决 → 自动关闭窗口
- 自动关闭：当 commit_turn 发现所有目标已解决 → 自动清除窗口

**影响**：LLM 缺少"这一段故事结束了"的明确信号。循环退出完全依赖 prompt 引导 + pacing 警告。

**计划**：P1 优先级。实现较复杂（需要扩展状态管理 + agent-loop 集成）。

### 🟡 GM Brief 不足

Fate 简报包含：态势（daily/combat/investigation）、故事窗口信息、同伴、目标+威胁列表、最近记忆、资金。

我们只有：时间、地点、HP/MP/SAN、金钱、评级。

**影响**：LLM 不清楚当前剧情进展的宏观图景。需要手动 get_status 查一切。

**计划**：低成本增强——在 buildGmBrief() 中追加目标/威胁/最近事件字段。

### 🟡 回合级事务

我们的 agent-loop 现已实现对每个工具的快照+回滚（单工具级）。但若 LLM 在同一轮调了 3 个工具，第 3 个失败只能回滚第 3 个——前 2 个的副作用已永久写入。

Fate 的 `transactState()` 包裹整个提交，一次失败全部回滚。

**计划**：agent-loop 中加一层 commit_turn 的事务边界。

### 🟡 状态持久化

每次工具调用后立即持久化（Fate）vs 对话整体保存（我们）。

**影响**：崩溃后丢失进度。但手机浏览器 IndexedDB 场景下整体保存可接受。

**计划**：低优先级——每轮结束后自动保存一次快照即可。

### 🔵 上下文压缩

Fate 的 compaction 用固定摘要替换旧消息 → 摘要不变 → 缓存前缀永久稳定。

我们刚修复了 recentMessageCount=0，缓存率已提升到 80-90%。压缩可进一步追平到 95%+。

**计划**：P2 优先级。用 DeepSeek 小模型生成摘要。

### 🔵 Public/Secret 分离

Fate 的工具只能读取 public 状态，secret 字段必须通过 `reveal_secret` 工具显式揭示。

我们的变量树中 NPC 秘密动机、隐藏宝具和玩家可见数据混在一起。当前通过 prompt 指令限制 LLM 不泄露即可。

**计划**：低优先级——需重构整个变量树结构。

### 🔵 子代理

Fate 的 parallel-line 异步推进 offscreen 势力，timeline-showrunner 审计叙事节奏。

我们可用前端 `Promise.all()` 并行调 API 实现，不需要服务器。

**计划**：P2 优先级。已设计纯前端方案。

---

## 我们独有的优势

| 特性 | 说明 |
|------|------|
| switch_scene 场景过滤 | Fate 无此机制，所有工具始终暴露 |
| 文件分类组织 | Fate 仍是单文件注册，我们按领域拆分为 10 文件 |
| helpers 共享函数 | Fate 有 domain-tool-runner，我们有 12 个通用 helper |
| 缓存分析体系 | 通过实测数据精确定位缓存问题并修复 |
| Web 原生部署 | 手机浏览器即用，无需安装终端/框架 |
