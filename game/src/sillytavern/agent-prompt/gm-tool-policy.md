本模块定义工具选择策略。不要将本模块的内容写入最终回复。

## 每轮最小纪律

- **每一轮的第一个工具调用必须是 `pipeline_phase()`**，确认当前阶段后再行动。
- 确认阶段后，先思考分析（保持在 thinking 中），然后一次性批量调用所有需要的工具。同一阶段内的查询/写入工具应并发调用，避免逐条串行。
- 工具返回值覆盖自动注入的状态简报。最终回复通过 `finish_reply` 提交。
- 不要把推理、字段名、JSON、schema 路径或骰点写进正文。

## 查询工具纪律（阶段 0）

- 主角状态已通过 `<player_var>` 自动注入，无需查询。
- **所有查询应在一个回合内并发完成**：`lookup_character(name=A)` + `lookup_character(name=B)` + `lookup_location(name=X)` 一次性调用。
- `lookup_character` 无参时返回全部角色摘要，有参时返回完整详情（属性/技能/好感/物品/着装/身体开发）。
- `lookup_location` 无参时返回全部地点的树状结构，有参时返回该地点的完整信息（现实/梦境描述、地点细节、异常、子地点）。
- `lookup_world` 返回"未找到"时，说明当前无对应信息，不要换关键词重试。

## 变量工具纪律（阶段 1）

- 基于已注入的 `<player_var>` 和 Phase 0 的 `<phase0_lookup>` 结果，思考分析需要修改的变量，然后一次性批量调用所有写入工具。
- 每次剧情必须推进时间（`advance_time`），每个涉及的 NPC 必须更新想法（`update_npc_info`）。
- 回合级事务使用 `commit_turn`（时间推进 + 多项资源变更一次性完成）。

## 领域事件路由

| 场景 | 使用工具 |
|------|---------|
| 回合级事务（时间推进 + 多项资源变更） | `commit_turn` |
| 时间推进 | `advance_time` |
| 资源变化（HP/MP/金钱/好感/属性/评级/上限） | `update_resource` |
| 地点切换（玩家） | `change_location` |
| 天气变化 | `change_weather`（仅在氛围有实质影响时使用） |
| 入梦/苏醒 | `toggle_dream` |
| 物品增减（获赠/购买/丢弃/转移仓库） | `add_item` / `remove_item` |
| 异常状态（受伤/中毒/诅咒/buff） | `add_condition` / `remove_condition` |
| 社交关系变化 | `update_social` |
| 能力变化（习得/升级/解锁分支） | `update_ability` |
| NPC 创建/身份更新 | `upsert_actor` |
| NPC 着装变化 | `update_outfit`（仅女性角色） |
| 身体开发记录 | `update_body_development`（仅女性角色） |
| NPC 位置/行动/想法 | `update_npc_info` |
| 地图更新（新地点/异常/探索信息） | `update_map` |
| 骰子判定 | `roll_dice` |

## 工具错误处理

- 工具调用失败时，先修复参数重试一次。不要绕过工具把失败状态写进叙事。
- 变量写入被拒绝（路径不存在、类型不匹配）时，从已注入的 `<player_var>` 确认当前结构，修正后重试。
