# Toast 系统规范

## 两种标准 Toast

### 1. 右上角 Toast
- **组件**：`Feedback.tsx` → `Toast`
- **位置**：`fixed right-6 top-24`
- **特征**：矩形卡片，右侧滑入，5秒进度条，有关闭按钮
- **内容**：**仅变量相关**（变量更新、好感度变化）

### 2. 顶端中央 Toast
- **组件**：待抽取为共享组件
- **位置**：`fixed top-4 left-1/2 -translate-x-1/2`
- **特征**：横条，淡入淡出，2-3秒自动消失
- **内容**：**其他所有**（格式错误、发送失败、存档/读档、购买、导入、设置保存等）

---

## 铃铛

- **两个 Tab**：「变量」和「剧情」
- **「变量」tab**：收变量变化对比（原「终端」内容）
- **「剧情」tab**：占位，暂不处理
- **规则**：成功和失败都进 toast + 铃铛（无特殊 case）

---

---

# 修改计划

## Phase 1: 好感度上升 → 变量变化驱动

**当前**：`useGameEventMonitor` 每 3 秒轮询 IndexedDB，diff 好感值，独立生成 toast+铃铛

**目标**：利用已有的 `buildVarChanges()` 结果，在变量更新时直接检测好感度变化

**改动**：
1. 在 `ChatPage/index.tsx` 发送成功后，检查 `result.varChanges`（已有）中是否包含 `好感值` 路径
2. 若有 → 生成好感度变化 toast（右上角）+ 铃铛通知
3. 删除 `useGameEventMonitor` 中的 toast 生成（`addToast?.()` 调用）
4. 铃铛的「剧情」tab 暂不处理，`useGameEventMonitor` 中的 `pushStatus` 暂时保留但 channel 改为 'story'

**涉及文件**：
- `ChatPage/index.tsx` — 新增好感度检测逻辑
- `useGameEventMonitor.ts` — 移除 toast 生成，channel 改名

---

## Phase 2: 铃铛重构 — 终端/日志 → 变量/剧情

**当前**：`Channel = 'terminal' | 'log'`，tab 标签「终端」「日志」

**目标**：`Channel = 'variable' | 'story'`，tab 标签「变量」「剧情」

**改动**：
1. `StatusBell.tsx`：改 Channel 类型、CHANNELS 标签、默认 tab、filter 逻辑
2. `Feedback.tsx` Toast：channel 样式适配新名称
3. 全局搜索替换 `'terminal'` → `'variable'`（channel 值）
4. 铃铛「剧情」tab 保留空状态，后续再填充

**涉及文件**：
- `StatusBell.tsx` — 类型、标签、默认 tab
- `Feedback.tsx` — Toast 的 isLog → isVariable
- `App.tsx` — addToast 参数类型
- `useGameEventMonitor.ts` — channel 值改名
- `types.ts` — 如有 ToastOptions 类型

---

## Phase 3: 铃铛规则 — 成功/失败都双通道

**当前**：`addNotification` 中 error/warning → 仅 toast，success/info → toast+铃铛

**目标**：所有类型 → toast + 铃铛

**改动**：
1. `App.tsx` `addNotification`：删除 if/else 分支，统一走 `addToast + pushStatus`
2. `pushStatus` 的 type 映射：error → 'error', warning → 'warning', success → 'ok', info → 'info'

**涉及文件**：
- `App.tsx` — addNotification 函数

---

## Phase 4: Toast 内容分离（后续阶段）

将非变量相关的 toast 从右上角迁移到顶端中央（需先实现顶端中央标准组件）。

---

## 实施顺序

| 顺序 | Phase | 内容 |
|------|-------|------|
| 1 | Phase 2 | 铃铛 tab 改名（独立改动，影响面小） |
| 2 | Phase 3 | 铃铛规则统一（紧接 Phase 2） |
| 3 | Phase 1 | 好感度 → 变量驱动（依赖铃铛结构清晰） |
| 4 | Phase 4 | Toast 内容分离（最后，等顶端中央组件就绪） |

前 3 个 Phase 可以连续实施。
