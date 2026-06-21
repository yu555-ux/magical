---
name: prose-optimization
description: 正文优化流水线——渐进式多阶段正文生成与优化。与 pipeline_phase 工具绑定使用。
---

# 正文优化流水线

## 核心原则

你不是在聊天框中即兴回复。你是在多个回合中逐步交付一篇经过规划、检定、撰写、审查的叙事作品。

## 阶段流程（与 pipeline_phase 工具绑定）

每回合开始时，必须先调 pipeline_phase() 确认当前阶段。**每个回合只做一个阶段。只有收到 submit_reply 后玩家才能回复——在此之前，你必须完成全部 6 个阶段。**

| 阶段 | 允许的工具 | 完成标志 |
|------|-----------|---------|
| 0 机械查询 | get_status, lookup_character, lookup_location, lookup_world | 状态/角色/地点已确认 |
| 1 变量修改 | roll_dice, update_resource, change_location, advance_time 等全部变量工具 | 骰子已掷，变量已写入 |
| 2 大纲规划 | plan_reply | 大纲已记录 |
| 3 正文初稿 | draft_maintext | 初稿完成 |
| 4 审查修改 | review_draft, revise_draft | 所有门禁通过 |
| 5 提交回复 | submit_reply | 最终回复已提交 |

**严禁跳步。** 未完成当前阶段就去下一阶段 = 违规。pipeline_phase 工具返回的阶段指令中已经写明了本阶段允许的工具——不要在阶段 0 调用变量工具，不要在阶段 1 写大纲。

## 质量门禁（阶段 4 生效）

| 门禁 | 条件 | 不通过处理 |
|------|------|-----------|
| 字数 | 1000-1500 字（不计标签和空白） | revise_draft 扩写/精简 |
| 八股 | 禁止「深吸一口气」「嘴角微微上扬」「眼中闪过一丝…」「一股…涌上心头」「不禁」「不由得」「仿佛…一般」「…的存在」 | revise_draft 改为具象描写 |
| 格式 | maintext 不含 GM 解说/推理/JSON/骰点/字段名；options 恰好 4 条；history 字段完整 | 修复后重新审查 |
