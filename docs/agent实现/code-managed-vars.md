---
name: code-managed-vars
description: 传统模式下由代码（而非 AI）强制管理的变量字段和更新 tick 管线
metadata: 
  node_type: memory
  type: project
  originSessionId: a5502ff8-68c9-4b92-8722-19576ee9d348
---

传统酒馆模式下，变量更新有两条路径：

**路径一：AI 写入**（`<vars>` / `<JSONPatch>` 标签，或第二 API 输出 JSON Patch）
→ 经 `vars-merger.ts` 解析 → `var-apply.ts` 应用

**路径二：代码强制接管**（AI 写入被丢弃或覆盖）

## 代码强制管理的字段

| 字段 | 管理方式 | 文件 |
|------|---------|------|
| `主角.年龄` | `stripCodeManaged()` 从 prompt 删除；`tickAges()` 随年份递增 | `var-format.ts:8` `physiology.ts:513` |
| `世界.现实.天气` | 日期翻篇按季节加权随机轮换（枚举约束）；AI 可通过领域工具覆盖 | `weather.ts` |
| `世界.梦境存档.天气` | 日期变化时从月相计算（新月/残月/满月）；AI 可覆盖为血雨/血雾 | `weather.ts` |
| `世界.倒计时.*` | `injectCountdown()` 从锚点时间实时计算；`applyParsedToChat()` 丢弃 AI 写入并恢复旧值 | `countdown.ts:86` `var-apply.ts:18-28` |
| `子宫.宫内精液.总量` | AI 写入来源列表后，代码自动 `reduce` 求和 | `useSillytavern.ts:938-941` |
| `子宫.生理周期.当前阶段` | `determinePhase()` 纯代码判定 | `physiology.ts:76` |
| `子宫.怀孕状态.*` | `tickFemalePhysiology()` 管理全部状态转换 | `physiology.ts:272` |
| 装备位面 | `validateEquipment()` 梦境/现实切换时自动卸下不适配物品 | `var-clamp.ts:9` |
| 数值范围 | `clampVariableRanges()` 钳制 HP/MP/SAN/好感度/技能/具现进度 | `var-clamp.ts:77` |
| 地点格式 | `normalizeLocations()` 强制 `父地点-子地点` | `var-map.ts:217` |
| `子宫` 子结构 | `repairUterusStructure()` 修复 AI JSON Patch 可能破坏的结构 | `physiology.ts:187` |

## 事件驱动的 Tick 管线

`sendGameMessage()` 完成后按以下顺序触发：

```
1. gameBus.emit('message_received')
   └─→ plot-history subscriber: 从 <history> 标签提取剧情节点

2. gameBus.emit('vars_applied')
   └─→ dream-anchor subscriber: 检测梦境↔现实切换 → 更新锚点 + validateEquipment

3. 检测世界时间变化 (newRealTime !== oldRealTime || newDreamTime !== oldDreamTime)
   └─→ gameBus.emit('time_changed')
       └─→ physiology subscriber:
            ├─ tickAges(vars, oldTime, newTime)
            └─ tickAllFemales(vars, oldTime, newTime)
                 ├─ 精液衰减 (排卵期 3%/h，非排卵期 15%/h)
                 ├─ 生理周期推进
                 ├─ 受精判定 (日期系数 × 年龄系数 × 精液系数，一次掷骰)
                 ├─ 怀孕阶段推进 (受精→早孕→中孕→晚孕→产褥期)
                 └─ 产褥期恢复 (产后42天→未孕)
```

## 跨天 Tick

`tickAllFemales()` 处理跨多天时逐日迭代 (`physiology.ts:448-457`)：
- 每天 24h 衰减 + dateChanged=true
- 确保中间天数不遗漏受精判定窗口

## 双 API 模式下的变量流

第一 API 输出叙事 → 第二 API（小模型，temperature=0.3）专做变量提取 → 输出 JSON Patch 数组 → `applyJsonPatch()` 应用 → 再跑 clamp/location/dream-anchor/physiology 全套 tick

**Why:** 代码接管了所有有确定规则的计算（生理周期、倒计时、数值边界、装备验证），AI 只负责"叙事驱动的数值变化"（如受伤扣 HP、好感度变化）。事件总线把核心循环和副作用解耦。

**How to apply:** 新增代码管理字段时：1) 在 `var-format.ts:stripCodeManaged` 中删除（防止 AI 看到并尝试写入）；2) 在 `var-apply.ts:applyParsedToChat` 中恢复/覆盖（丢弃 AI 写入）；3) 通过 tick 函数或 subscriber 计算正确值。
