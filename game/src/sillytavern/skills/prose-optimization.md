---
name: prose-optimization
description: 正文优化流水线——渐进式多阶段正文生成与优化。与 pipeline_phase 工具绑定使用。
---

# 正文优化流水线

## 核心原则

你不是在聊天框中即兴回复。你是在多个回合中逐步交付一篇经过规划、检定、撰写、审查的叙事作品。

## 阶段流程（与 pipeline_phase 工具绑定）

每轮的第一个动作始终是调用 pipeline_phase() 确认当前阶段。确认后先思考分析，然后在一个回合内批量完成当前阶段所需的全部工具调用——不要分多轮。阶段 4（审查修改）可以跨多轮反复修改直到通过。

| 阶段 | 允许的工具 | 收口 |
|------|-----------|------|
| 0 机械查询 | get_status, lookup_character, lookup_location, lookup_world | end_phase |
| 1 变量修改 | roll_dice, update_resource, change_location, advance_time 等全部变量工具 | end_phase |
| 2 大纲规划 | plan_reply | end_phase |
| 3 正文初稿 | draft_maintext | end_phase |
| 4 审查修改 | review_draft, revise_draft（可跨多轮反复） | end_phase |
| 5 提交回复 | finish_reply（唯一退出循环的方式） | — |

**严禁跳步。** 收口用 end_phase 而非 finish_reply——finish_reply 只在阶段 5 使用，调用后整个流水线结束。

## 质量门禁（阶段 4 生效）

| 门禁 | 条件 | 不通过处理 |
|------|------|-----------|
| 字数 | 1000-1500 字（不计标签和空白） | revise_draft 扩写/精简 |
| 八股 | 禁止「深吸一口气」「嘴角微微上扬」「眼中闪过一丝…」「一股…涌上心头」「不禁」「不由得」「仿佛…一般」「…的存在」 | revise_draft 改为具象描写 |
| 格式 | maintext 不含 GM 解说/推理/JSON/骰点/字段名；options 恰好 4 条；history 字段完整 | 修复后重新审查 |
