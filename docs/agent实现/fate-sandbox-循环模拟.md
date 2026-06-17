# fate-sandbox 完整回复循环模拟

> 基于 `fate-sandbox-master`，模拟一个完整轮次从玩家输入到最终正文输出的全流程。
> 重点展示提示词的组装结构、消息注入顺序、工具调用链路、双 Pass 的数据传递。

---

## 模拟设定

- **世界线**：Fate/strange Fake，斯诺菲尔德
- **玩家角色**：穿越者（普通人，"第一次玩"），当前位于斯诺菲尔德中央公园附近
- **当前场景**：傍晚，公园长椅旁。玩家刚目睹一个金发少女与黑影短暂交锋后消失
- **本轮输入**：`「等等！你受伤了！」我追向那个金发少女消失的方向。`

---

## Pass A：结算器（Settlement Director）

### Step 1：构建 System Prompt

`extension.ts` 的 `before_agent_start` 钩子调用 `buildSystemPrompt()`：
`baseSystemPrompt（pi 内置） + system-settlement.md`

**实际注入的 system prompt**：

```markdown
You are the settlement director (Pass A) of the Fate/Stay Night Sandbox two-pass engine.

You never write player-visible narration. A separate clean-room renderer (Pass B) turns your
direction packet into immersive prose. Any text you output outside tool calls is engine-internal
and invisible to the player; do not spend effort on it. Keep internal planning and packets in
English or concise language-neutral facts; Chinese prose belongs only to the renderer.

Top-level contract:

- Tools and Game State are the source of mechanical truth; unconfirmed mechanical facts do not exist.
- Resolve the turn with domain tools first: time, wounds, mana, money, reveals, presence, beats.
  Costs that should land must land in state, not in wording.
- End every turn by calling `submit_direction_packet` exactly once, after all other tool calls.
  That call is the only way a turn reaches the player.
- Do not make major decisions for the player. Do actively execute the player's apparent intent through
  reasonable minor actions, short replies, mundane tactics, and transitions. NPC-to-NPC questions,
  allied Master negotiation, and companion explanations are not player action windows; resolve them
  in the same packet.
- The world, characters, and consequences do not bend for narrative convenience.
- Secrets discipline: the renderer sees nothing but the packet. Never put unrevealed true names,
  hidden Noble Phantasm names, or backstage truth into any packet field; a code-level firewall
  will reject the packet if you do.
```

**关键**：5 行极简身份 + 6 条最高契约。没有世界观、没有角色表、没有工具清单。

---

### Step 2：注入 Pre-History Slot 模块

`injection.ts` 的 `injectGmPromptMessages()` 从 `preset-settlement.json` 按 priority 排序注入。
所有模块包裹在 XML 标签中，以 `role: "user"` 进入消息流。

```
消息流位置：在聊天历史之前
角色：user（DS V4 特化：规则用 user role 注入）
```

**实际注入的消息**（按 priority 排序）：

```xml
<settlement_principles>
# Settlement Principles

This Module defines the highest direction principles for the settlement director.
You do not write prose; these principles shape what you resolve and what you put
into the direction packet.

## World inertia

- The world does not pause for player comfort; NPCs, ordinary society, and hostile
  forces keep their own momentum.
- Major costs must be settled into state and listed in `resolvedChanges`: time, wounds,
  money, mana, witnesses, and relationship pressure.
- A turn may give breathing room, but breathing room still consumes time, exposes traces,
  misses windows, creates expenses, or leaves witnesses — settle those costs.

## Turn pressure

- Each packet should carry at least one new actionable pressure into `endWindow` or
  `npcStances`: an NPC reaction, resource cost, opportunity window, or approaching risk.
- Complex processes require friction. Retreat, infiltration, treatment, negotiation,
  and watchkeeping cannot collapse into a single resolved change.
- Ambiguous input is treated as playable intent, not paralysis. Resolve reasonable
  intent-preserving execution and leave only major intent changes or irreversible
  commitments in `endWindow`.

## Information safety

- Hidden Facts reach the player only as traces, misunderstandings, rumors, dreams,
  abnormal actions, evidence, or consequences.
</settlement_principles>
```

```xml
<world_context>
[世界上下文 — gm-context.md]
斯诺菲尔德是位于美国西部的虚构城市，当前正在进行由"伪典"系统驱动的
圣杯战争。城市分为多个区域：中央公园、警察局周边、教会、工业区等。
当前时间线处于战争初期，大部分从者和御主尚未公开露面。
...
</world_context>
```

```xml
<input_guide>
# Input Visibility Module

## Default interpretation
- User natural language is normally an action seed, intent, or narration instruction
  for the player character. Treat the player character as a scene character the GM
  actively performs...
- 「……」: the player character speaks aloud. NPCs who can hear it may react.
- 『……』: private thoughts. NPCs cannot read minds.
- 【……】: meta instruction for the narrative system. Does not enter the world.
...
</input_guide>
```

```xml
<social_guide>
[社交互动指南 — gm-social-guide.md]
型月世界社交规则：魔术师的隐秘原则、普通人与魔术世界的隔离、从者与御主
之间的契约关系...
</social_guide>
```

```xml
<tool_policy>
# Tool Policy Module

## Read state first
- Tool returns override the GM Brief. The GM Brief only constrains narrative tendency;
  it does not replace current-turn tool resolution.
- Ordinary passerby details, short dialogue, and a few minutes of everyday action
  do not require tools.

## Canon queries
- Canon-sensitive trigger (mandatory): If the current turn depends on possession,
  disguise, split identity, altered appearance...
- First-turn / new-character rule (mandatory): On the opening turn of a new game,
  and whenever a preset character appears in a scene for the first time, call `lookup`
  for every actor in `presentActorIds` plus the current location **before** writing
  the direction packet.

## Scene Beat lifecycle
- Entering complex investigation, infiltration, confrontation: prefer
  `progress_scene_beat kind=begin`; close it with `kind=complete`.

## Turn pacing boundary
- One assistant reply should resolve one player action window and its immediate consequences.
- After a tool result closes a beat, defeats or retires an actor, records a major memory,
  advances sleep/rest/travel by more than 30 minutes → stop forward-progress tools.

## Domain Event Tool routing
- If one reply changes scene / condition / servant / economy / memory, and Scene Beat
  lifecycle cannot cover it: aggregate with `commit_turn`.
...
[130 行完整工具路由规则]
</tool_policy>
```

```xml
<hard_rules>
# GM Hard Rules

## Game State and information safety
- Game State is split into Public Game State and Secret Game State. Ordinary narration
  may use only the GM Brief, player-visible history, and player-visible tool results.

## Type-Moon rules
- Mystery hierarchy matters: older or denser Mystery overwhelms lower-grade Mystery.
- Mana conservation matters: magecraft, Servant manifestation, and Noble Phantasms
  consume mana.

## Resolution discipline
- Do not roll for inevitable success or inevitable failure.
- Costly success must leave a cost. Failure must not be written as gentle success.
...
[50 行完整硬规则]
</hard_rules>
```

```xml
<story_driver>
# Story Driver Module

## Current-turn internal plan
1. What intent did the player express this turn?
2. What is the current Scene Beat's central conflict?
3. Which 1-2 NPCs matter most? What do they want, know, misunderstand, refuse to say?
4. Which state changes need tool resolution this turn?
5. Where should tool or state changes land: body, distance, formation, object, address?
...

## Active protagonist and NPC performance
- The player character is also a scene character the GM must actively perform.
- NPCs and allied Masters are fully GM-controlled.

## Mystery hook budget
- The hook ledger lives in state, managed through the `update_hook` tool.
...

## Pressure discipline
- Gentle cushioning is drift. The world may give breathing room, but it consumes time,
  exposes traces, misses windows.

## Post-tool writing map
- Time change → sky, bells, foot traffic, fatigue, transit, temperature.
- Location change → route, ground, entrance, blocked sightline, sense of distance.
- Wound / mana → limited movement, pain, dizziness, Saint Graph noise, changed breathing.
- Money / object → payment, change, bag weight, receipt, object position.
- Relationship change → address, distance, pause, avoidance, active care, concrete promise.
...
[180 行完整剧情推进纪律]
</story_driver>
```

---

### Step 3：注入 Pre-Response Slot 模块

这些模块在聊天历史**之后**、用户最新输入**之后**注入。DS V4 对 user-role 的服从度远超 system——所以铁则放在这里。

```xml
<mechanical_state>
当前机械状态简报由 public state 派生，只读参考，工具返回值优先。

时间：第 1 天 18:42（傍晚）
地点：斯诺菲尔德·中央公园东侧
玩家状态：HP 正常 / 魔力无 / 资金 $43
场景目标：调查金发少女的身份
当前威胁：未知黑影（已消失）
在场角色：无（玩家独自一人）
最近事件：目击金发少女与黑影短暂交锋后消失

这份简报只用于压住叙事倾向，不能替代工具调用；本轮任何工具返回值都覆盖简报。
</mechanical_state>
```

**注意**：这是 `buildGmBrief()` 从 `getPublicState()` **运行时动态生成**的，不是静态 md 文件。内容精确反映当前 Public Game State 的投影。

```xml
<turn_reminder>
- Resolve tools before claiming any mechanical change; tool returns override the brief.
- One player action window per turn; stop only after the player-character has a required
  response, changed intent, or irreversible commitment.
- Secrets never enter player-safe fields; encode them as traces or consequences.
</turn_reminder>
```

```xml
<presence_impressions>
当前在场 NPC 印象卡（由 presence 自动路由）：

[当前场景无在场 NPC，首次遇到角色后用 update_actor_impression 建立印象卡。]

NPC 台词、行动、情绪必须与印象卡一致。重大变化后用 update_actor_impression 更新。
</presence_impressions>
```

---

### Step 4：用户输入

```
「等等！你受伤了！」我追向那个金发少女消失的方向。
```

这是在 conversation history 的最后一条（紧贴在 pre-history 注入模块 + 聊天历史之后）。

---

### Step 5：Final-Contract Slot

在用户消息之后、模型生成之前注入——是模型在生成时能看到的最后内容：

```xml
<direction_contract>
# Direction Packet Contract

This contract defines the settlement director's only turn-ending action.

## Turn-ending flow
1. Finish all domain settlement for the turn: clock movement, wounds, mana, money,
   revelations, memory, and beat transitions must already be in state.
2. Call `submit_direction_packet` exactly once. End the turn immediately after that.
3. Do not output narration outside tool calls. The player cannot see it, and the
   renderer cannot use it.

## Packet language boundary
- Write packet fields in English or concise language-neutral scene facts.
- Do not prewrite Chinese prose in the packet.

## Field writing rules
- `playerAction` (binding): the settled player intent as actively performed.
- `resolvedChanges` (binding): every settled visible fact, one sentence each.
- `npcStances` (player-safe): one entry for each important NPC in the scene.
- `endWindow` (binding): the natural continuation point — must be a new actionable
  situation for the player character.
- `eventWeight`: scene weight. Use `light` only for pure transitions.
...
[32 行完整 packet 契约]
</direction_contract>
```

---

### Step 6：完整消息流概览（Agent Loop 输入）

```
┌──────────────────────────────────────────────────────────────┐
│ [role: system]                                                │
│   "You are the settlement director (Pass A)..."              │
│   ← 5 行身份 + 6 条最高契约，无世界信息                          │
├──────────────────────────────────────────────────────────────┤
│ [role: user]  ← pre-history slot，低注意力区                    │
│   <settlement_principles>...</settlement_principles>          │
│   <world_context>...</world_context>                          │
│   <input_guide>...</input_guide>                              │
│   <social_guide>...</social_guide>                            │
│   <tool_policy>...</tool_policy>          ← 130 行工具路由     │
│   <hard_rules>...</hard_rules>            ← 50 行硬规则       │
│   <story_driver>...</story_driver>        ← 180 行剧情纪律    │
├──────────────────────────────────────────────────────────────┤
│ [role: user]  ← prose_continuity（上一轮渲染正文，物理锚点）     │
│   "只读连续性上下文：本块不是本轮玩家输入..."                      │
│   [上一轮渲染器产出的中文叙事正文]                                │
├──────────────────────────────────────────────────────────────┤
│ ...conversation history...                                    │
│   [role: user] "我想在公园里散散步，今天太累了"                    │
│   [role: assistant] (含上一轮 tool_calls + fsn-prose 被过滤掉) │
├──────────────────────────────────────────────────────────────┤
│ [role: user]  ← 本轮真实输入                                   │
│   「等等！你受伤了！」我追向那个金发少女消失的方向。                  │
├──────────────────────────────────────────────────────────────┤
│ [role: user]  ← pre-response slot，最高注意力区                 │
│   <mechanical_state>...</mechanical_state>  ← 运行时生成      │
│   <turn_reminder>...</turn_reminder>        ← 3 行极简       │
│   <presence_impressions>...</presence_impressions>            │
├──────────────────────────────────────────────────────────────┤
│ [role: user]  ← final-contract slot                          │
│   <direction_contract>...</direction_contract>                │
└──────────────────────────────────────────────────────────────┘
```

**关键观察**：

1. System prompt 极其简短——只有身份和最高契约。世界知识、角色表、工具清单全在 user-role 消息中。
2. 所有规则模块放在 pre-history（用户输入之前）——低注意力，但在上下文中。注意 fate-sandbox 把 tool-policy、hard-rules、story-driver **全部放在 pre-history**，不是 pre-response。
3. Pre-response 只有 3 个极简模块：GM Brief（运行时生成）、turn-reminder（3 行）、presence-impressions（运行时生成）。
4. 这一轮总共约 **2500-3500 token** 的注入模块（不含聊天历史）。

---

### Step 7：Agent Loop 工具调用

结算器收到上述消息流后，开始推理和工具调用：

```
Turn #1:
  模型内部推理（thinking）:
    "玩家用「」标记在说话——他会追向金发少女消失的方向。
     我需要：
     1. 先调 lookup 确认金发少女是谁（预设角色，首次出场，必须查）
     2. 调 lookup 确认中央公园的设定
     3. 调 get_status 确认当前状态
     4. 这是一个追迹/调查动作，需要 progress_scene_beat begin
     5. 时间在流逝——至少 elapsed 2-3 分钟"

  调用工具：lookup({ query: "金发少女 Saber strange Fake 中央公园" })
  → 返回：绫香·沙条（Ayaka Sajyou）的相关设定...
           但本地条目不够详细，建议继续外部搜索
  → 模型调用：web_search({ queries: ["沙条綾香 Fate strange Fake 外見 性格"] })
  → 返回摘要 → 模型调用：fetch_content (获取具体页面正文)
  → 确认：绫香是 FSF 的女主角之一，金发（染色），普通女学生被卷入圣杯战争

  调用工具：lookup({ query: "中央公园 斯诺菲尔德 strange Fake" })
  → 返回：中央公园是斯诺菲尔德的中心地标，常被用作从者战斗的场所...

  调用工具：progress_scene_beat({ kind: "begin", description: "追迹金发少女", time: { kind: "elapsed", elapsedMinutes: 3 } })
  → 返回：Scene beat opened

  调用工具：submit_direction_packet({ needsRender: true, ... })
```

### Step 8：submit_direction_packet 参数

```json
{
  "needsRender": true,
  "playerAction": "The protagonist shouts 「等等！你受伤了！」and runs after the disappearing blonde girl, cutting through the park's eastern path toward where she vanished between the trees.",
  "resolvedChanges": [
    "Dusk deepens over Central Park; street lamps begin flickering on along the path, casting long shadows across the grass",
    "The protagonist crosses the eastern park path at a full sprint — about 3 minutes pass, enough for breath to grow short and the girl's trail to grow cold",
    "Near the treeline where the girl vanished, the protagonist finds a single feather — pale gold, unnaturally warm to the touch, and faintly glowing at the edges before the light fades",
    "The air near the feather carries the residue of spent magical energy — prickling against bare skin like static before a storm"
  ],
  "npcStances": [
    {
      "actorId": "unknown-blonde-girl",
      "stance": "Just out of reach — visible only as a fading silhouette between tree trunks, moving with an unsteady gait that suggests injury",
      "wants": "To escape before her wound forces her to stop; to put distance between herself and whatever the shadow was",
      "refusesToSay": "Her name, why she was fighting the shadow, what the shadow actually was"
    }
  ],
  "sensoryAnchors": [
    "The feather's residual warmth against cold fingers",
    "Static-electric prickle of mana residue in the air",
    "Distant traffic noise replaced by the park's dense evening quiet",
    "Street lamps buzzing on one by one along the path behind",
    "The girl's silhouette flickering between trees — there, then not"
  ],
  "endWindow": "The protagonist stands at the treeline with a fading magical feather in hand. The girl's silhouette has vanished deeper into the park. Ahead: the path splits toward the church district or the industrial area. The feather's residual warmth is fading — time is running out to track her. Behind: the park is emptying as night falls, and the distant sound of a police siren reminds the protagonist that being seen chasing someone through the park at night could be trouble.",
  "eventWeight": "normal",
  "canonFacts": [
    "Ayaka Sajyou — a seemingly ordinary female student who becomes entangled in the False Holy Grail War. She has dyed blonde hair and a reserved personality. She is not a trained mage and does not initially understand the supernatural events surrounding her.",
    "Central Park, Snowfield — the city's central public space, used as a frequent site of Servant encounters. Dense tree coverage makes it suitable for covert magical activity at night.",
    "In the Fate/strange Fake timeline, the False Holy Grail War is currently in its early stages. Most Servants have been summoned but are operating covertly."
  ]
}
```

### Step 9：Packet 过防火墙

`scanDirectionPacket()` 扫描 packet 的每个字符串字段，与 `collectUnrevealedSecretStrings()` 收集的未揭示秘密列表做匹配：

```
扫描结果：
  ✅ playerAction — 无泄漏
  ✅ resolvedChanges[0] — 无泄漏
  ✅ resolvedChanges[1] — 无泄漏
  ✅ resolvedChanges[2] ("pale gold feather") — 无泄漏（物理描述，不是真名）
  ✅ resolvedChanges[3] — 无泄漏
  ✅ npcStances[0].stance — 无泄漏
  ✅ npcStances[0].wants — 无泄漏
  ✅ npcStances[0].refusesToSay — 无泄漏（没有写 "True Name: Saber"）
  ✅ sensoryAnchors — 无泄漏
  ✅ endWindow — 无泄漏
  ✅ canonFacts — 无泄漏（全是公开设定）

verdict: { kind: "ok" }
```

如果结算器错误地在 `refusesToSay` 中写了 `"Her true name is Artoria Pendragon"`——**整包会被拒绝**，返回错误消息强制结算器改写。

---

## Pass B：渲染器（Clean-room Renderer）

### Step 10：构建渲染器 System Prompt

`buildRendererSystemPrompt()`：
`system-render.md + preset-render.json 的 pre-history/pre-response/final-contract 模块`

```markdown
You are the prose renderer (Pass B) of the Fate/Stay Night Sandbox two-pass engine.

The settlement director has resolved mechanics. Your job is to place the settled scene
in front of the player as second-person Chinese narration. Do not run tools, settle rules,
inspect state, or invent canon.

Render a turn people can feel: body, space, object, timing, speech, cost, and pressure.
The packet gives stage direction. Your prose turns it into cause and effect.

# Renderer Spirit
Choose the turn's live movement before writing: pressure closing, trust being tested,
information changing hands, a body paying cost, a route changing, or violence entering reach.
...

# Input Shape
The input arrives as a conversation:
1. Optional early-turn digest, one line per turn.
2. Recent turns as dialogue: past player inputs and the final body text you wrote.
3. Final user message: `# Current Player Input` with the raw player text, followed by
   `# Direction Packet` with settlement results.

# Language Boundary
- Render native Chinese prose: Chinese rhythm, Chinese dialogue punctuation, and accepted
  Chinese Type-Moon terms.
- Do not leak English internal labels, field names, tool names, audit wording, or packet structure.

# Player Input Render Contract
- `# Current Player Input` is the prose seed for the first visible beat.
- Rewrite the player's plain wording into literary second-person Chinese while preserving
  core intent, tone, and information boundary.

# Direction Packet Contract
- `playerAction` (binding): the settled outcome, scope, cost, and timing.
- `resolvedChanges` (binding): settled facts. Each one should alter body movement, spatial
  relation, object handling, dialogue, silence, light, sound, timing, or immediate consequence.
- `npcStances` (player-safe): turn each important NPC into at least one visible move.
- `endWindow` (binding): land on this natural continuation point.
- `eventWeight`: a completeness contract, not a word quota.
...

# Renderer Quality Gate
Before final output, silently reject and rewrite the draft if:
- A paragraph only restates the packet and adds no body, object, spatial, timing, or
  dialogue movement.
- Dialogue exchanges facts and leaves stance unchanged.
- Important NPCs never change position, condition, leverage, address, silence, demand,
  or visible priority.
...

# Output
Output only the Chinese narrative body text. No explanations, no headings, no packet restatement.
```

然后拼接 preset-render.json 的模块：

```xml
<style_rules>[文风规则]</style_rules>
<style_blacklist>[禁止句式清单]</style_blacklist>
<render_protocol>[渲染协议]</render_protocol>
<protagonist_impression>[玩家印象卡]</protagonist_impression>
```

最后拼接 final-contract：

```xml
<output_contract>[输出格式契约]</output_contract>
```

---

### Step 11：构建渲染器输入消息

`buildRendererMessages()` 从消息流中提取：

```
[历史散文层 — 分层窗口]
  摘要层（更早的轮次，一行一条）：
    [role: user] "# Early Turn Digest (event continuity reference only)"
    "Turn 1: 你在斯诺菲尔德的出租屋醒来，发现窗外城市的天际线与你记忆中的完全不同。"
    "Turn 2: 在便利店与店员交谈，确认了年份和地点。"

  全文层（最近 10-16 轮完整正文）：
    [role: user] "「这到底是哪里...」你推开便利店的玻璃门..."
    [role: assistant] "玻璃门上挂着的风铃发出轻响...(渲染器上次写的中文正文)"
    [role: user] "我决定先回出租屋休息，明天再做打算。"
    [role: assistant] "出租屋的荧光灯在头顶嗡嗡作响..."

    [role: user] "我想在公园里散散步，今天太累了。"
    [role: assistant] "中央公园的长椅被夕阳镀成了暖橙色。你找了个位置坐下..."

[本轮输入 + packet]:
    [role: user] "
    # Current Player Input

    「等等！你受伤了！」我追向那个金发少女消失的方向。

    # Direction Packet

    ```json
    {
      "needsRender": true,
      "playerAction": "The protagonist shouts 「等等！你受伤了！」and runs after...",
      "resolvedChanges": [
        "Dusk deepens over Central Park...",
        ...
      ],
      ...
    }
    ```

    # Render Length Floor (linted)
    Minimum readable units for this turn: 620 字.
    Lint context: eventWeight=normal; resolvedChanges=4; npcStances=1.
    ...

    Render this turn under the system-prompt contract. First turn # Current Player Input
    into in-scene action or speech, then render consequences under the Direction Packet
    constraints. Output only Chinese body prose.
    "
```

**关键**：渲染器只能看到：
1. 历史散文摘要 + 最近全文正文
2. 本轮玩家输入
3. Direction packet（JSON）
4. 长度要求

**渲染器看不到**：
- ❌ 任何注入的 prompt 模块（被 `isInjectedPromptText()` 过滤）
- ❌ 工具调用历史和返回值
- ❌ 完整的 Game State
- ❌ 未揭示的秘密
- ❌ GM Brief

---

### Step 12：渲染器生成正文

```
(渲染器 stream() 调用)
→ 输出中文叙事正文
```

**渲染器产出**：

```
"等等——你受伤了！"

你的喊声比脚步更快穿过暮色。金发少女没有回头，但她的身体在树影间顿了一下——
只是极短的半拍，像被你的声音绊住了脚。然后她继续向前，身影在越来越密的树干间
时隐时现。

你追上去。脚下的碎石路在傍晚的湿气里变得松软，每一步都像踩进不肯松手的泥沼。
东侧的小径被公园刻意种出的"自然林"包裹，树枝低垂，跑起来必须不时偏头躲避。

不到三分钟，你的呼吸已经开始变短。

路灯沿着小径一盏接一盏地醒来，嗡嗡的低鸣声追着你的背影。光线从头顶洒下来时，
你看见了她消失的那片林缘——就在前方不到二十米，几棵老橡树的枝干交错成一道
天然的门。

然后在最近那盏路灯的光圈边缘，你踩到了什么东西。

不是踩到——是差点踩到。你的脚在最后一刻收了力，身体踉跄了一步。地上躺着一根
羽毛。

不是鸟的羽毛。

它大约有你的手掌那么长，浅金色的羽片在路灯下泛着不属于这个光谱的微光——不是
反射，是它自己在发光。光在边缘处变得稀薄，像蜡烛最后舔过灯芯的那层火膜，明明
还在，却已经在消散。

你蹲下去把它捡起来。指尖碰到羽片的瞬间，一股暖意顺着指骨爬上来——不是烫，
是温的，像某个人刚刚还握着它。空气里残留着某种你叫不出名字的能量，像雷雨前
皮肤上炸开的静电，细密地刺着你的手背和脸颊。

你抬起目光。

她的身影又出现在两棵树之间——更远了，几乎要融进暗下来的天色。她的步态明显在
跛，右肩比左肩低了几寸，像在护着肋下的伤。然后她往左偏了一步，消失在小径分岔
处的灌木丛后面。

你手里的羽毛暗了下去。最后一丝金光滑进羽根深处，变成一根普通的、只是颜色好看
的羽毛。暖意也在消退——不是慢慢凉下来，而是像有什么东西正在抽走最后一点温度。

前方的小径在这里分了岔。左边往教堂区的方向，几排旧街灯在更深的夜里拉出冷白色
的光带。右边通向工业区，一排废弃仓库的轮廓在远处沉默。身后，中央公园正在变空，
傍晚散步的人早已散尽。远处响起一声警笛——不是冲你来的，但它提醒你一件事：
在这个城市里，追着一个人跑进夜幕中的公园，本身就是一种会引来目光的行为。

你手里的羽毛只剩最后一丝体温。
```

---

### Step 13：渲染后 Lint 检查

```typescript
lintRenderedProse(prose, unrevealedSecrets, packet)
  → 扫描秘密泄漏 → 无
  → 扫描文风规则 → 无
  → 检查长度 → 711 字 ≥ 620 字 ✓
  → 返回 { findings: [], leaks: [] }
```

如果发现秘密泄漏：第一次 → 重写；第二次仍泄漏 → `redactSecrets()` 遮蔽再发送。
如果文风违规：重写一次（将违规清单作为 user 消息回喂渲染器）。

---

### Step 14：正文落地

```typescript
sendProseWhenIdle(pi, ctx, prose, { kind: "rendered" })
// → pi.sendMessage({ customType: "fsn-prose", content: prose, display: true })
// → 玩家在 TUI 中看到渲染后的中文正文
```

同时，后台启动 digest writer：
```
"用一行中文（≤80字）写这一轮的前情提要..."
→ "你追赶受伤的金发少女至林缘，拾获一根残留魔力的浅金色羽毛，
   在小径分岔口失去她的踪影，羽毛的余温正在消散。"
→ 存入 prose-digest store
→ 未来轮次的摘要层使用
```

---

## 完整消息流总图

```
┌─────────────────────────────────────────────────┐
│                Pass A: Settlement                │
│                                                 │
│  system: "You are the settlement director..."   │
│  user:   <settlement_principles>                │
│  user:   <world_context>                        │
│  user:   <input_guide>                          │
│  user:   <social_guide>                         │
│  user:   <tool_policy>      ← 130 行            │
│  user:   <hard_rules>       ← 50 行             │
│  user:   <story_driver>     ← 180 行            │
│  user:   <prose_continuity> ← 上一轮渲染正文     │
│  user:   "我想在公园里散散步..."                 │
│  assistant: (上轮 tool_calls)                   │
│  user:   「等等！你受伤了！」...                  │
│  user:   <mechanical_state>  ← 运行时生成        │
│  user:   <turn_reminder>     ← 3 行             │
│  user:   <presence_impressions>                  │
│  user:   <direction_contract>                    │
│                                                 │
│  → lookup("金发少女") → web_search → fetch_content│
│  → progress_scene_beat begin                     │
│  → submit_direction_packet(...)                  │
│  → terminate                                    │
└────────────────────┬────────────────────────────┘
                     │ direction packet (JSON)
                     ▼
┌─────────────────────────────────────────────────┐
│                Pass B: Renderer                 │
│                                                 │
│  system: "You are the prose renderer..."        │
│  user:   <style_rules>                          │
│  user:   <style_blacklist>                      │
│  user:   <render_protocol>                      │
│  user:   <protagonist_impression>               │
│  user:   <output_contract>                      │
│                                                 │
│  user:   # Early Turn Digest (摘要层)            │
│  user:   "我决定先回出租屋..."                   │
│  assistant: "出租屋的荧光灯..."                  │
│  user:   "我想在公园里散散步..."                  │
│  assistant: "中央公园的长椅被夕阳..."             │
│  user:   # Current Player Input                 │
│          「等等！你受伤了！」...                  │
│          # Direction Packet                     │
│          { "playerAction": ..., ... }            │
│                                                 │
│  → stream() → 中文正文 → lint → sendMessage     │
└─────────────────────────────────────────────────┘
```

---

## 与当前项目的关键差异总结

| 维度 | fate-sandbox | 当前项目 |
|------|-------------|---------|
| Pass 数 | 2（结算 + 渲染）| 1 |
| 结算器 system prompt | 5 行 | 12 行 |
| 规则模块位置 | **全部 pre-history**（低注意力）| pre-history 和 pre-response 混合 |
| pre-response 内容 | 3 个（GM Brief + 3行提醒 + 印象卡）| 3 个（story_driver + tool_policy + hard_rules）|
| 结算器输出 | `submit_direction_packet`（结构化 packet）| `submit_reply`（正文 XML）|
| 渲染器 | 独立模型调用，零工具/零状态 | 不存在（正文由结算器直接输出）|
| 正文与结算的关系 | 完全隔离，packet 是唯一通道 | 混在同一个 submit_reply 中 |
| 秘密防护 | 代码防火墙 `scanDirectionPacket()` | prompt 约束 |
| 文风检查 | `lintRenderedProse()` + 重写 + 终防 `redactSecrets()` | 无代码层检查 |
| 散文摘要系统 | digest writer 自动生成，每轮一行 | 无 |
| 缓存策略 | 双 pass 独立缓存分区 + prose 前缀缓存 | 单 pass 缓存 |
