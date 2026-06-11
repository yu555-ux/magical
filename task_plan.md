# Agent 模式审查与优化 — 任务计划

> 最后更新：2026-06-11

---

## 已完成 ✅

| # | 项目 |
|---|------|
| ✅ | 缓存修复 — recentMessageCount 6→0，跨请求缓存 90%+ |
| ✅ | **22 工具** — 变量全线补完 (P0+P1+P2+upsert_actor+map) |
| ✅ | 工具文件拆分 — registry 2183行 → 10文件/2520行 |
| ✅ | 场景切换 — switch_scene + 5场景过滤 (默认关闭) |
| ✅ | 循环控制 — gm-tool-policy补完 + pacing警告 |
| ✅ | 提示词结构 — mechanical_state→final-contract + 22工具文档更新 |
| ✅ | 变量结构简化 — 梦境定位包装层删除 |
| ✅ | 查询优化 — get_status 无参显示完整树 + 智能提示 |
| ✅ | 事务保护 — variables/dreamAnchor/plotHistory 三重回滚 |
| ✅ | 代码质量 — 死代码删除 / 废弃导入 / 类型安全 / 版本锁 |
| ✅ | 状态先行 — advance_time 内联 subscriber (天气/生理/年龄/倒计时) |
| ✅ | 领域工具加固 — reason校验 / 入梦检查 |
| ✅ | 文档整理 — 5份核心文档 + fate对比 |
| ✅ | GM预设模块 — 14个 .md 模块 + preset.json + injection 引擎 |
| ✅ | 流式解析器 — StreamTagParser 状态机 |

---

## 待完成

| 优先级 | 项目 | 说明 |
|:---:|------|------|
| 🟡 | `switch_scene` 完善 | 场景过滤已实现，需用户配置启用 |
| 🟡 | Skills 技能系统 | skills/ 目录 + use_skill + 条件加载 |
| 🟡 | 每轮状态快照 | TurnSnapshot → IndexedDB |
| 🟡 | 上下文压缩 | 摘要替换旧消息 → 缓存 99%+ |
| 🔵 | Schema 版本化 | 字段迁移 |
| 🔵 | Public/Secret 分离 | 认知隔离 |
| 🔵 | 子代理 | parallel-line + timeline-showrunner |
| 🔵 | Player Panel | React 侧边栏 |
| 🔵 | 输入协议 | 「」『』【】三种引号 |
