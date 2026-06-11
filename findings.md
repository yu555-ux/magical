# Agent 模式审查发现

> 动态更新。按优先级排列：🔴 高 → 🟡 中 → 🔵 低

---

## 🔴 高优先级

### 1. 缺失 `commit_turn` 工具
- **发现**：fate-sandbox 的核心工具是 `commit_turn`——LLM 声明时间+事件列表，引擎一次性原子执行
- **我们的现状**：LLM 逐个调领域工具（advance_time → change_location → …），每次都是一个独立事务
- **影响**：跨工具无原子性；LLM 需要手动编排工具调用顺序；回合概念不明确
- **建议**：实现 `commit_turn` 作为所有领域事件的聚合入口

### 2. 缺失 `update_resource` 工具
- **发现**：HP/MP/金钱/超凡资源（蝶烬/尸气）的增减无专用工具
- **现状**：LLM 被迫使用已降级的 `patch_state` 做资源变更
- **影响**：patch_state 白名单被触发后，LLM 无法正常写入资源变化
- **建议**：优先实现，覆盖 spend/restore/add 三种操作 + 强制 reason

---

## 🟡 中优先级

### 3. 循环退出纯靠 maxTurns 硬限制
- **发现**：`while (turnCount < maxTurns)` + 无 tool_call 则 break
- **对比 fate**：场景节拍生命周期（begin/complete），结构化的故事窗口
- **风险**：LLM 可能无限 tool_call 直到 maxTurns 耗尽
- **建议**：增加 pacing 警告 + commit_turn 内聚回合概念

### 4. 事务边界为单工具级
- **发现**：刚实现的事务保护是每个工具一次快照/回滚
- **对比 fate**：`transactState()` 包裹整个回合的所有事件
- **差距**：如果 LLM 在同一轮内调用了 3 个工具，第 3 个失败只回滚第 3 个——前 2 个的副作用已永久写入
- **建议**：提升到回合级事务

### 5. Public/Secret 状态未分离
- **发现**：单一变量树，NPC 秘密动机/隐藏宝具与玩家可见数据混在一起
- **对比 fate**：双态架构，不同工具类管理不同可见层
- **建议**：分拆变量树，至少区分"玩家可知"和"GM 专有"

### 6. 无场景切换机制
- **发现**：8 个工具始终暴露给 LLM
- **设计已存在**：优化方案 B2 的 SCENE_PROFILES 设计完整但未实现
- **建议**：实现 switch_scene 工具 + 场景工具过滤

### 7. Skills 技能系统缺失
- **发现**：无 `use_skill` 工具，无条件加载的提示词模块
- **设计已存在**：优化方案 D1 的三种加载路径设计完整但未实现
- **建议**：skills/ 目录 + registry + use_skill 工具

---

## 🔵 低优先级

### 8. 无每轮状态快照
- 当前只在对话结束时整体保存，无法回退到中间轮次
- 设计完整（TurnSnapshot → IndexedDB），待实现

### 9. Schema 版本化缺失
- 字段改名会导致旧存档报废
- 设计完整（_meta.schemaVersion + 迁移函数），待实现

### 10. 无子代理
- 缺少 parallel-line（offscreen 势力推进）和 timeline-showrunner（叙事节奏审计）
- 属于 Phase 4 高级能力

### 11. 上下文压缩缺失
- 对话历史过长时无自动摘要机制
- 属于 Phase 4 高级能力

---

## 已解决的发现

| # | 发现 | 解决方案 |
|---|------|---------|
| 1 | agent-loop.ts 存在死代码 | 删除，一次构建复用 |
| 2 | agent-context.ts 导入已废弃常量 | 删除导入和 fallback 分支 |
| 3 | 事务保护只覆盖 variables | 扩展为三重快照 |
| 4 | patch_state 白名单含幻影路径 | 对齐实际变量树 |
| 5 | as any 类型断言 | 新增 OpenAI 消息类型 |
| 6 | 领域工具 reason 缺校验 | 补全校验 |
| 7 | toggle_dream 不检查倒计时 | 强制检查 00:00 |
| 8 | advance_time 后 subscriber 延迟 | 内联 subscriber 链 |
| 9 | recentMessageCount=6 截断历史 → 缓存率 50% | 改为 0（不限制）→ 预期 90%+ |
| 10 | gm-tool-policy.md 为空壳 | 补完工具选择纪律+回合边界+领域事件路由 |
| 11 | commit_turn / advance_time 无 pacing 警告 | ≥3 events 或 >30min 触发"停止推进，进入叙事"警告 |
