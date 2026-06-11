# Agent 模式审查与优化 — 任务计划

> 最后更新：2026-06-11。目标：全面审查 agent 模式实现，发现优化点，输出改进方案，按优先级执行。

---

## 总览：三线并行

```
一线：核心循环（决定"能不能跑好"）
二线：支撑系统（决定"能不能走远"）
三线：提示词内容（决定输出"够不够好"）
```

---

## 已完成 ✅

### 本次会话新增（2 项）
| # | 项目 | 文件 |
|---|------|------|
| ✅ | 缓存命中率修复 | types.ts — recentMessageCount 默认值 6→0，消除历史截断 |
| ✅ | 缓存机制分析 | DeepSeek 前缀缓存跨请求有效，命中率取决于前缀重叠度 |

### C 路线 — 代码质量修复（6 项）
| # | 项目 | 文件 |
|---|------|------|
| ✅ | 删除死代码 | agent-loop.ts — 去除未使用的 requestPayload 重复构造 |
| ✅ | 清理废弃导入 | agent-context.ts — 删除 SYSTEM_PROMPT/NARRATIVE_RULES 导入 |
| ✅ | 事务保护 | agent-loop.ts — variables/dreamAnchor/plotHistory 三重快照+回滚 |
| ✅ | patch_state 白名单 | tools/registry.ts — 对齐实际变量树，移除幻影路径 /主角/同行者 |
| ✅ | 类型安全 | types.ts + agent-loop.ts + api-router.ts — 消除全部 as any |
| ✅ | 版本锁 | preset.json + injection.ts — 版本语义文档化 |

### 领域工具审查与修复（4 项）
| # | 项目 | 文件 |
|---|------|------|
| ✅ | reason 运行时校验 | tools/registry.ts — advance_time / change_location / change_weather |
| ✅ | 入梦条件检查 | tools/registry.ts — toggle_dream 强制检查倒计时 00:00 |
| ✅ | 事务回滚覆盖 | agent-loop.ts — dreamAnchor + plotHistory 纳入回滚范围 |
| ✅ | **状态先行架构** | tools/registry.ts — advance_time 内联 subscriber 链（天气/生理/年龄/倒计时） |

### 此前已完成（历史 commit）
| # | 项目 |
|---|------|
| ✅ | 模块化提示词装配系统（preset.json + 14 个 .md 模块 + injection 引擎） |
| ✅ | 运行时 GM Brief（buildGmBrief 动态生成，pre-response slot 注入） |
| ✅ | 思维链/自检清单（gm-story-driver.md 13 步 + gm-think.md 9 条验证） |
| ✅ | 流式解析器（StreamTagParser 状态机） |
| ✅ | 工具 description 工程（三段式模板） |

---

## 待完成 🔴🟡🔵

### 一线：核心循环

| # | 优先级 | 项目 | 说明 |
|---|:---:|------|------|
| ✅ | 🔴 | **`commit_turn` 工具** | 回合级原子提交：time + events[] 批量执行 |
| ✅ | 🔴 | **`update_resource` 工具** | HP/MP/金钱/好感/超凡资源增减 |
| ✅ | — | **工具分类 + patch_state 隐藏** | 4 分类(lookup/variable/mechanics/deprecated)，前端分组展示 |
| ☐ | 🟡 | **`add_condition` / `remove_condition`** | 异常状态写入工具，替代 patch_state 的最后用途，完成后可彻底删除 patch_state |
| 3 | 🟡 | **回合级事务保护** | 将事务边界从"单工具"提升到"整个 tool_call 批次"，跨工具原子性 |
| 4 | 🟡 | **循环退出引导** | 从纯 maxTurns 硬限制 → 增加场景节拍完成信号 / pacing 警告 |
| 5 | 🔵 | **工具结果 → GM Brief 摘要** | 每轮工具执行完毕后自动归纳摘要，注入 pre-response slot |

### 二线：支撑系统

| # | 优先级 | 项目 | 说明 |
|---|:---:|------|------|
| 6 | 🟡 | **`switch_scene` 场景切换** | SCENE_PROFILES 按场景过滤工具集+技能，当前 8 个工具始终暴露 |
| 7 | 🟡 | **Skills 技能系统** | skills/ 目录 + `use_skill` 工具 + 三种加载路径（自动/LLM/UI） |
| 8 | 🟡 | **每轮状态快照** | TurnSnapshot → IndexedDB，支持回退到任意历史轮次 |
| 9 | 🔵 | **Schema 版本化** | `_meta.schemaVersion` + 迁移函数，防止字段改名导致旧存档报废 |
| 10 | 🔵 | **上下文压缩** | 对话历史过长时自动摘要 + state exclusion digest |

### 三线：提示词与体验

| # | 优先级 | 项目 | 说明 |
|---|:---:|------|------|
| 11 | 🟡 | **Public/Secret 状态分离** | NPC 秘密动机/隐藏宝具不应注入 prompt，需要认知隔离 |
| 12 | 🔵 | **输入协议（三种引号）** | 「」『』【】解析 + 可见性标注 |
| 13 | 🔵 | **Player Panel** | React 侧边栏实时状态显示 |
| 14 | 🔵 | **多 Agent 认知隔离** | 有隐藏信息的 NPC 独立 context |
| 15 | 🔵 | **子代理** | parallel-line（offscreen 势力推进）、timeline-showrunner（叙事节奏审计） |

---

## Fate-sandbox 对比差距摘要

| 维度 | 我们 | Fate | 差距 |
|------|------|------|:--:|
| 工具调用 | 逐个执行 | commit_turn 批量原子提交 | 🔴 |
| 循环停止 | maxTurns + 无 tool_call | 场景节拍生命周期 | 🟡 |
| 最终输出 | 流式累积文本 | GM Brief 锚定 + 9 条自检 | 🟢 (自检已实现) |
| 状态管理 | 单工具级事务 | 回合级 transactState | 🟡 |
| 状态分层 | 单一公开树 | Public/Secret 双态 | 🟡 |
| 子代理 | 无 | parallel-line + timeline-showrunner | 🔵 |
| 回合提交 | ❌ 无 commit_turn | ✅ 核心工具 | 🔴 |

---

## 建议执行顺序

```
第 1 步：commit_turn + update_resource     🔴 一线 #1 #2  核心工具
         ↓
第 2 步：回合级事务 + 循环退出引导        🟡 一线 #3 #4  循环加固
         ↓
第 3 步：switch_scene + Skills 技能系统    🟡 二线 #6 #7  场景管理
         ↓
第 4 步：上下文压缩                        🟡 二线 #10    缓存追平 pi（调前）
         ↓
第 5 步：每轮状态快照 + Schema 版本化      🟡 二线 #8 #9  状态持久化
         ↓
第 6 步：Public/Secret 分离 + 子代理       🔵 三线 #11 #14 #15
         ↓
第 7 步：Player Panel + 输入协议            🔵 三线 #12 #13
```

### 缓存专项路线（穿插进行，低成本高收益）

```
✅ 1. recentMessageCount 0 → 历史全保留 → 缓存 90%+
☐ 2. 静态模块前置 → pre-history 移到聊天历史之前 → 缓存更稳定
☐ 3. 上下文压缩 → 摘要替换旧消息 → 缓存追平 pi 的 99%+
```

---

## 已解决的问题

| 错误 | 原因 | 修复 |
|------|------|------|
| patch_state 白名单含幻影路径 `/主角/同行者` | 未对照实际变量树 | 删除，补漏 `/主角/持有物品/` `/仓库/` `/特殊玩法/` |
| toggle_dream 不检查入梦条件 | 缺少倒计时校验 | 入梦前 injectCountdown + 检查 00:00 |
| advance_time 后 subscriber 延迟执行 | 事件总线在 agent loop 结束后才 emit | 内联 subscriber 链到工具 execute 中 |
| 事务回滚不覆盖 dreamAnchor | 只快照了 variables | 扩展为 variables + dreamAnchor + plotHistory 三重快照 |
