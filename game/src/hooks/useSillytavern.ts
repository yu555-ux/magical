import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useStreamParser } from './useStreamParser';
import { createApiRouter } from '../sillytavern/api-router';
import { applyParsedToChat, autoTagDreamItems, enrichHistory, formatVariablesForPrompt, buildVarChanges } from '../sillytavern/variables';
import { assemblePrompt, replaceMacros } from '../sillytavern/prompt-assembler';
import { DEFAULT_TAGS, DEFAULT_OPAQUE_TAGS, DEFAULT_SETTINGS, DEFAULT_PRESET_BLOCKS, DEFAULT_PRESET_PARAMS, type AppSettings, type ChatSession, type ChatMessage, type HistoryTimeline, type ToolExecutionRecord } from '../sillytavern/types';
import { getDatabase, initializeDatabase, getSettings, getChats, saveChat, deleteChat, saveSettings } from '../sillytavern/database';
import { DEFAULT_WORLD_VARS } from '../sillytavern/default-world-vars';
import { showTopCenter } from '../components/shared/TopCenterToast';
import { type FertilizationResult } from '../sillytavern/physiology';
import { buildAgentContext } from '../sillytavern/agent-context';
import { runAgentLoop } from '../sillytavern/agent-loop';
import { getEnabledTools, type ToolExecutionContext } from '../sillytavern/tools/registry';
import { SCENE_VARIABLE_TOOLS, type SceneType } from '../sillytavern/tools/scene-profiles';
import { resolveLorebyMacro } from '../sillytavern/lorebook-resolver';
import { buildSecondaryPrompt } from '../sillytavern/secondary-prompt-builder';
import { useRegenerateVars } from './useRegenerateVars';
import { gameBus } from '../sillytavern/event-bus';
import { initPhysiologySubscriber, getLastFertilizationEvents } from '../sillytavern/subscribers/physiology';
import { initDreamAnchorSubscriber, getUpdatedDreamAnchor } from '../sillytavern/subscribers/dream-anchor';
import { initPlotHistorySubscriber, applyPlotHistory } from '../sillytavern/subscribers/plot-history';
import { extractUsageFromSSE, buildUsageRecord, storeFullPrompt, initCacheMonitor } from '../sillytavern/cache-monitor';
import { parseHistoryBlock } from '../sillytavern/variables';
import type { ParsedTags, SavePoint } from '../sillytavern/types';

/** 解析 Agent 模式输出的 XML 标签 */
function parseAgentTags(raw: string): Omit<ParsedTags, 'thinking' | 'varsRaw' | 'varsCommands' | 'unknown'> {
  const extract = (tag: string): string => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
    return (raw.match(re)?.[1] ?? '').trim();
  };

  const maintext = extract('maintext');

  // 解析 option 标签
  const optionRaw = extract('option');
  const options = optionRaw
    ? optionRaw.split('\n')
        .map(l => l.replace(/^选项\d+:\s*/, '').trim())
        .filter(l => l && !l.startsWith('选项'))
    : [];

  // 解析 history 标签
  const historyRaw = extract('history');
  let history: SavePoint | null = null;
  if (historyRaw) {
    history = parseHistoryBlock(historyRaw);
  }

  return { maintext, options, history };
}

const DEFAULT_OPENING = `餐桌上方的吊灯洒下暖白色的光。张云夹了一块排骨，没放进自己碗里，而是越过半个桌子，稳稳地落在了<user>的米饭上。排骨上的糖醋汁洇进白白的米粒里。

她收回筷子，目光在儿子脸上停了两秒。

"怎么了？"张云微微偏过头，看着他，声音放得很轻，"今天一天都蔫巴巴的。菜不合胃口？还是在学校遇到什么事了？"

她没有停下手里的动作，顺手把汤碗往他面前推了推。

坐在他对面的周汝正咬着筷子尖，听到这话，立刻抬起眼睛。她今天在家穿着一件稍微有些宽松的针织衫，领口滑到了一边肩膀上。

"是不是昨天熬夜看小说了？"周汝挑了挑眉，语气里带着点故意的调侃，"还是说……在学校看上哪个小姑娘，人家没理你？"

"别瞎说。"张云嗔怪地看了女儿一眼，但也没生气，只是又把目光转回他身上，眉头微皱。

"没事。"<user>用筷子戳了一下那块排骨，勉强恢复了平日的精神，"就是昨晚没睡好，可能有点落枕，头一直疼。"

何止是没睡好。

<user>在心里默默吐槽一句，低头扒了一口饭。从早上醒来到现在，他脑袋就一直疼的不行。

昨晚的梦太真实了。

真实到他现在还能清晰地回想起那轮挂在夜空中的血月。整个世界都被蒙上了一层暗红色，没有声音，没有活气。在梦里，他刚走出家门，只是下意识地向楼上看了一眼。

就那一眼。

一颗巨大的、布满红血丝的眼球悬浮在半空，没有眼睑，深红色的瞳孔直勾勾地盯着他。那种诡异的感觉和心里大作的预警，让他几乎是连滚带爬地跑下楼，冲出楼道。可是没跑出几步，迎面就撞上两队行人。

一队高抬大轿，红剪纸散天，乐极升天。

一队披麻戴孝，唢呐哀乐齐奏，黯然销魂。

他刚反应过来这就是以前看的僵尸片里的红白冲煞，就被一恍惚，被关进了棺材，然后暴毙了。

然后...他就在床上惊醒，浑身冷汗，头疼欲裂。

想到这里，<user>深吸一口气，把嘴里的饭咽下去。饭菜的香味稍微驱散了一点脑海里挥之不去的惊悚。

"头疼？"张云的眉头立刻皱了起来，她放下碗筷，直接站起身，走到他身边，手贴上了他的额头。

"没发烧啊。"张云嘀咕了一句，手指又顺势在他的太阳穴上轻轻按揉了两下，"是不是最近压力太大了？快高考了，你也别把自己逼得太紧。考成什么样都没关系，妈养你。"

她的动作很轻，带着一点让人安心的温柔。

"哎哟，妈，你这就偏心了啊。"周汝在对面拖长了声音，"我高考那会儿，你天天让我早睡早起，怎么到他这儿就成'考成什么样都没关系'了？"

她虽然嘴上抱怨着，但眼睛却一直盯着他的脸色看，眉心也微不可察地蹙了起来。

"你能一样吗？你从小就不用我操心。"张云白了女儿一眼，手上的动作没停，又转头看着他，"吃完饭早点去休息。要是一会儿还疼，我给你拿点布洛芬。实在不行，明天妈带你去医院做个脑CT。"

"不用不用，真不用。"<user>赶紧往后躲了一下，避开张云的手。要是真去医院检查，医生也查不出什么来，总不能说是在梦里被鬼弄死的后遗症吧。

"我就是有点困，睡一觉就好了。"他加快了扒饭的速度，试图用行动证明自己真的没事。

周汝看着他狼吞虎咽的样子，忍不住轻轻哼了一声。

"慢点吃，没人跟你抢。"她放下筷子，伸手把一盘清炒虾仁推到了他手边。

"你要是真的头疼得厉害，晚上就别看书了。"周汝用手指卷着垂在肩上的一缕头发，半开玩笑到，"要是……要是睡不着，你来找姐姐我，我来哄睡哦~"

她说完，又迅速补充了一句："当然，你要是不想就算了，我也挺忙的。"

但她放在桌子底下的手，却微微攥紧了衣角。

张云看着女儿别扭的样子，忍不住笑了一下，又坐回了自己的位置上。

"行了，汝汝你别没大没小了...<user>多吃点蔬菜。"张云又给他夹了一筷子青菜，"今晚什么都别想，好好睡一觉。天大的事，有妈在呢。"`;

const db = getDatabase();

export function useSillytavern() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<{
    messages: Array<{ role: string; content: string }>;
    estimatedTokens: number;
    stageTokens: Record<string, number>;
    stageMessages: Record<string, Array<{ role: string; content: string }>>;
    stageOrder: string[];
    stageNames: Record<string, string>;
  } | null>(null);

  const [lastSecondaryPrompt, setLastSecondaryPrompt] = useState<{
    messages: Array<{ role: string; content: string }>;
    estimatedTokens: number;
    stageTokens: Record<string, number>;
    stageMessages: Record<string, Array<{ role: string; content: string }>>;
    stageOrder: string[];
    stageNames: Record<string, string>;
  } | null>(null);

  const [dualRunning, setDualRunning] = useState(false);
  const [lastRawContent, setLastRawContent] = useState(''); // 最近一轮原始输出（查看原文用）
  const [jumpVersion, setJumpVersion] = useState(0); // 每次回档+1，强制ChatPage刷新
  const abortRef = useRef<AbortController | null>(null);
  const dualAbortRef = useRef<AbortController | null>(null);
  const currentSceneRef = useRef<SceneType | null>(null);

  // Agent mode state
  const [pendingToolCalls, setPendingToolCalls] = useState<Map<string, { name: string; label: string; startTime: number }>>(new Map());
  const [completedToolCalls, setCompletedToolCalls] = useState<ToolExecutionRecord[]>([]);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) ?? null, [chats, activeChatId]);

  /** 将 {{LOREBY::pattern}} 替换为匹配的世界书条目内容（按条目标题/检索词匹配） */
  // 响应 settings 变化自动重建第二API提示词预览
  useEffect(() => {
    if (settings && initialized) {
      const prompt = buildSecondaryPrompt(settings, activeChat);
      setLastSecondaryPrompt(prompt);
    }
  }, [settings, activeChat, initialized]);

  // 注册事件总线订阅者（一次性，全应用生命周期）
  useEffect(() => {
    initPhysiologySubscriber();
    initDreamAnchorSubscriber();
    initPlotHistorySubscriber();
    initCacheMonitor();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initializeDatabase();
      const [s, c] = await Promise.all([getSettings(), getChats()]);
      if (cancelled) return;
      setSettings(s ? {
        ...DEFAULT_SETTINGS,
        ...s,
        // Restore defaults for fields that may be undefined in stored settings
        lorebooks: s.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
        presetBlocks: s.presetBlocks ?? DEFAULT_SETTINGS.presetBlocks,
        presets: s.presets ?? DEFAULT_SETTINGS.presets,
        activeVarsPresetId: s.activeVarsPresetId ?? DEFAULT_SETTINGS.activeVarsPresetId,
      } : { ...DEFAULT_SETTINGS });
      setChats(c);
      if (c.length > 0) setActiveChatId(c[0].id);
      setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const createChat = useCallback(async (name: string) => {
    const userName = settings?.userName || DEFAULT_SETTINGS.userName;
    // 玩家填了名字 → 烘焙进开场白；没填 → 保留宏，显示层实时解析
    const openingText = userName?.trim()
      ? DEFAULT_OPENING.replace(/\{\{user\}\}/g, userName).replace(/<user>/g, userName)
      : DEFAULT_OPENING;

    const openingOptions: string[] = [
      '把事情敷衍过去，说自己只是没睡好有点头疼',
      '把昨晚那个真实得可怕的噩梦告诉妈妈和姐姐',
      '沉默地低头吃饭，心里还在反复回想梦里的血月和红白队伍',
      '打起精神，问问姐姐最近在学校怎么样，转移话题',
    ];

    const openingHistory = {
      sequence: 1,
      title: '噩梦初醒',
      world: '现实',
      date: '2026年04月06日',
      location: '{{user}}家',
      characters: '{{user}}、张云、周汝',
      description: '{{user}}在晚餐时精神萎靡，被母亲张云和姐姐周汝察觉。昨晚他在梦中进入了一个挂着血月的诡异世界，遭遇血瞳和红白冲煞后暴毙惊醒，至今头痛未消。张云关心儿子的状态，周汝则在调侃中藏着担忧。',
      keyInfo: [
        '{{user}}拥有进入梦境世界的能力——梦境行走',
        '梦境中悬挂着永恒的血月，与现实世界的建筑格局一致但充满异常',
        '{{user}}的梦境行走技能等级为"聚砂"，刚刚觉醒不久',
        '张云是退役魔法少女，体内奇迹之源已枯竭，无法再使用魔力',
        '隔壁602室住着青梅竹马顾昀和顾惜姐妹',
      ],
      foreshadowing: [
        '梦境中的血瞳和红白冲煞暗示着梦境的危险正在逼近现实',
        '张云作为退役魔法少女的身份尚未对儿子明说',
        '梦境与现实之间的边界似乎正在变得模糊',
      ],
    };

    const fullContent = [
      `<maintext>${openingText}</maintext>`,
      openingOptions.map(o => `- ${o}`).join('\n'),
      `<history>
序号: ${openingHistory.sequence}
标题: ${openingHistory.title}
世界: ${openingHistory.world}
日期: ${openingHistory.date}
地点: ${openingHistory.location}
相关人物: ${openingHistory.characters}
描述: ${openingHistory.description}
关键信息:
${openingHistory.keyInfo.map(k => `  - ${k}`).join('\n')}
伏笔:
${openingHistory.foreshadowing.map(f => `  - ${f}`).join('\n')}
</history>`,
    ].join('\n');

    const chat: ChatSession = {
      id: crypto.randomUUID(), name,
      messages: [{
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: fullContent,
        timestamp: Date.now(),
        parsed: {
          maintext: openingText,
          thinking: '',
          options: openingOptions,
          history: openingHistory,
          varsRaw: '',
          varsCommands: { merge: {} },
          unknown: {},
        },
        plotHistoryAfter: { reality: [], dream: [] },
      }],
      characterName: settings?.characterName ?? DEFAULT_SETTINGS.characterName,
      userName,
      variables: JSON.parse(JSON.stringify(DEFAULT_WORLD_VARS)),
      plotHistory: { reality: [], dream: [] },
      dreamAnchor: {},
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await saveChat(chat);
    setChats(prev => [...prev, chat]);
    setActiveChatId(chat.id);
    return chat.id;
  }, [settings]);

  const selectChat = useCallback((id: string) => setActiveChatId(id), []);
  const removeChat = useCallback(async (id: string) => {
    await deleteChat(id);
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId((chats.filter(c => c.id !== id)[0]?.id) ?? null);
  }, [activeChatId, chats]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── streaming parser ──
  const parser = useStreamParser(
    [...new Set([...(settings?.customTags ?? []), ...DEFAULT_TAGS])],
    [...DEFAULT_OPAQUE_TAGS],
  );

  const sendGameMessage = useCallback(async (userText: string, opts?: { skipUserMessage?: boolean }): Promise<{ aborted: boolean; retractedText?: string; varsUpdated?: boolean; patchCount?: number; formatError?: boolean; varChanges?: import('../sillytavern/types').VarChange[]; fertilizationEvents?: FertilizationResult[] }> => {
    if (!activeChat || !settings) return { aborted: false };

    // 从 DB 读取最新 chat，避免 regenerate 等操作导致的闭包过期
    const dbChats = await db.chats.toArray();
    const effectiveChat = dbChats.find(c => c.id === activeChat.id) ?? activeChat;

    const latestSettings = await getSettings();
    const effectiveApi = latestSettings?.api ?? settings.api ?? DEFAULT_SETTINGS.api;
    const effectiveSettings = {
      ...(latestSettings ?? DEFAULT_SETTINGS),
      ...(settings ?? {}),
      api: effectiveApi,
      // DB takes priority for these fields (may be updated by PresetManager/LorebookTab auto-save)
      presetBlocks: latestSettings?.presetBlocks ?? settings?.presetBlocks ?? DEFAULT_PRESET_BLOCKS,
      lorebooks: latestSettings?.lorebooks ?? settings?.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
      presetParams: latestSettings?.presetParams ?? settings?.presetParams,
    };

    // Agent 模式：不需要预设
    const isAgentMode = effectiveSettings.api?.agentMode === true && (effectiveSettings.api?.enabledTools?.length ?? 0) > 0;

    // 非 Agent 模式且无预设 → 阻止
    if (!isAgentMode && (!effectiveSettings.presetBlocks || effectiveSettings.presetBlocks.length === 0)) {
      throw new Error('请先在设置中导入提示词预设，或开启 Agent 模式');
    }

    const skipUser = opts?.skipUserMessage === true;
    // 保存发送前的变量快照到 user 消息，供重写时回退使用
    const preSendVars = JSON.parse(JSON.stringify(effectiveChat.variables ?? {}));
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText, timestamp: Date.now(), variablesAfter: preSendVars };
    // 构建消息列表：若末位已是用户消息，则替换（去重，只保留最新玩家输入）
    let newMessages = [...effectiveChat.messages, userMsg];
    while (newMessages.length >= 2 && newMessages[newMessages.length - 1].role === 'user' && newMessages[newMessages.length - 2].role === 'user') {
      newMessages = [...newMessages.slice(0, -2), newMessages[newMessages.length - 1]];
    }
    const updatedChat: ChatSession = skipUser
      ? { ...effectiveChat, updatedAt: Date.now() }
      : { ...effectiveChat, messages: newMessages, updatedAt: Date.now() };
    if (!skipUser) {
      await db.chats.put(updatedChat);
      setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
    }

    // 共用回退：删除刚添加的用户消息，恢复变量/锚点/剧情历史
    const doRetract = async () => {
      const msgs = updatedChat.messages;
      const lastUserIdx = [...msgs].reverse().findIndex(m => m.role === 'user');
      if (lastUserIdx < 0) return;
      const targetIdx = msgs.length - 1 - lastUserIdx;
      const truncated = msgs.slice(0, targetIdx);
      const lastAssistant = [...truncated].reverse().find(m => m.role === 'assistant');
      const restoredVars = lastAssistant?.variablesAfter ?? updatedChat.variables ?? {};
      const restoredAnchor = lastAssistant?.dreamAnchorAfter ?? updatedChat.dreamAnchor ?? {};
      const restoredPlotHistory = lastAssistant?.plotHistoryAfter ?? updatedChat.plotHistory;
      const next: ChatSession = { ...updatedChat, messages: truncated, variables: restoredVars, dreamAnchor: restoredAnchor, plotHistory: restoredPlotHistory, updatedAt: Date.now() };
      await db.chats.put(next);
      setChats(prev => prev.map(c => c.id === next.id ? next : c));
    };

    const chatVars = updatedChat.variables ?? {};
    const preVars = updatedChat.variables ?? {};

    // ─── Agent 模式 ───
    if (isAgentMode) {
      console.group('🚀 Agent Mode');
      console.log(`📩 用户输入: "${userText}"`);
      console.log(`🤖 模型: ${effectiveApi.model}`);
      console.log(`🔧 启用工具: ${(effectiveApi.enabledTools ?? []).join(', ') || '无'}`);

      const allTools = getEnabledTools(effectiveApi.enabledTools ?? []);
      // 场景过滤：仅在 LLM 显式调用 switch_scene 后才启用，否则全部工具可见
      const scene = currentSceneRef.current;
      const agentTools = scene
        ? allTools.filter(t => {
            if (t.category !== 'variable') return true;
            const whitelist = SCENE_VARIABLE_TOOLS[scene] ?? [];
            return whitelist.includes(t.name);
          })
        : allTools;
      if (scene) {
        console.log(`🎬 当前场景: ${scene}, 变量工具: ${agentTools.filter(t => t.category === 'variable').map(t => t.name).join(', ')}`);
      }

      const agentCtx = buildAgentContext({
        userName: effectiveSettings.userName ?? DEFAULT_SETTINGS.userName,
        characterName: effectiveSettings.characterName ?? DEFAULT_SETTINGS.characterName,
        playerDescription: effectiveSettings.playerDescription,
        characterDescription: effectiveSettings.characterDescription,
        history: updatedChat.messages,
        recentMessageCount: effectiveSettings.recentMessageCount ?? DEFAULT_SETTINGS.recentMessageCount,
        variables: JSON.parse(JSON.stringify(chatVars)), // deep copy for mutable context
        lorebooks: effectiveSettings.lorebooks ?? [],
        plotHistory: updatedChat.plotHistory,
        dreamAnchor: updatedChat.dreamAnchor,
        tools: agentTools,
      });

      setLastPrompt({
        messages: agentCtx.messages.map(m => ({ role: m.role, content: m.content })),
        estimatedTokens: Math.round(agentCtx.messages.reduce((s, m) => s + m.content.length / 4, 0)),
        stageTokens: {},
        stageMessages: agentCtx.stageMessages,
        stageOrder: agentCtx.stageOrder,
        stageNames: {},
      });

      // 工具执行上下文
      const agentVars = JSON.parse(JSON.stringify(chatVars)); // mutable during agent loop
      const historyText = updatedChat.messages.slice(-6).map((m: any) => m.content).join(' ');

      const toolCtx: ToolExecutionContext = {
        variables: agentVars,
        lorebooks: effectiveSettings.lorebooks ?? [],
        plotHistory: updatedChat.plotHistory ?? { reality: [], dream: [] },
        dreamAnchor: updatedChat.dreamAnchor ?? {},
        userInput: userText,
        historyText,
        patchVariables: (ops) => {
          // 直接修改 agentVars（deep copy）
          const changes: Array<{ path: string; oldValue?: any; newValue?: any }> = [];
          for (const op of ops) {
            const parts = (op.path || '').split('/').filter(Boolean);
            if (parts.length === 0) return { ok: false, error: '空路径' };
            // 找到父对象
            let current: any = agentVars;
            for (let i = 0; i < parts.length - 1; i++) {
              if (current && typeof current === 'object') {
                current = current[parts[i]];
              } else {
                // 创建中间路径
                const next: any = current && typeof current === 'object' ? current : {};
                if (typeof next === 'object') next[parts[i]] = next[parts[i]] || {};
                current = next[parts[i]];
              }
            }
            if (!current || typeof current !== 'object') return { ok: false, error: `路径 ${op.path} 无效` };
            const key = parts[parts.length - 1];
            const oldValue = current[key];
            if (op.op === 'remove') {
              delete current[key];
              changes.push({ path: op.path, oldValue, newValue: undefined });
            } else if (op.op === 'replace' || op.op === 'insert') {
              current[key] = op.value;
              changes.push({ path: op.path, oldValue, newValue: op.value });
            }
          }
          return { ok: true, changes };
        },
        appendHistory: (sp) => {
          const timeline = toolCtx.plotHistory;
          if (sp.world === '梦境') {
            timeline.dream = [...timeline.dream, { ...sp, sequence: timeline.dream.length + 1 }];
          } else {
            timeline.reality = [...timeline.reality, { ...sp, sequence: timeline.reality.length + 1 }];
          }
        },
        setCurrentScene: (s) => { currentSceneRef.current = s; },
      };

      const freshRouter = createApiRouter(effectiveApi);
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset agent tool call state
      setPendingToolCalls(new Map());
      setCompletedToolCalls([]);

      let rawContent = '';
      let thinkingContent = '';
      const agentRecords: ToolExecutionRecord[] = [];
      const replyGroupId = crypto.randomUUID();  // 同一次用户回复的所有 turn 共享

      try {
        const params = effectiveSettings.presetParams ?? DEFAULT_PRESET_PARAMS;
        const loop = runAgentLoop({
          router: freshRouter,
          systemPrompt: agentCtx.systemPrompt,
          messages: agentCtx.messages,
          tools: agentTools,
          toolContext: toolCtx,
          signal: controller.signal,
          maxTurns: effectiveApi.maxTurnsPerMessage ?? 10,
          temperature: params.temperature,
          top_p: params.top_p,
          top_k: params.top_k,
          frequency_penalty: params.frequency_penalty,
          presence_penalty: params.presence_penalty,
          max_tokens: params.openai_max_tokens,
        });

        for await (const event of loop) {
          switch (event.type) {
            case 'text_delta':
              rawContent += event.chunk;
              break;
            case 'thinking_delta':
              thinkingContent += event.chunk;
              break;
            case 'turn_usage': {
              const dsUsage = { prompt_cache_hit_tokens: event.hit, prompt_cache_miss_tokens: event.miss, completion_tokens: event.generated };
              const record = buildUsageRecord(dsUsage, effectiveApi.model, effectiveChat.id,
                agentCtx.messages.map((m: any) => ({ role: m.role, content: m.content })), userText);
              record.replyGroupId = replyGroupId;
              storeFullPrompt(record.requestId, agentCtx.messages.map((m: any) => ({ role: m.role, content: m.content })));
              gameBus.emit('api_usage', { record });
              break;
            }
            case 'toolcall_start': {
              const tool = agentTools.find(t => t.name === event.name);
              flushSync(() => {
                setPendingToolCalls(prev => {
                  const next = new Map(prev);
                  next.set(event.id, { name: event.name, label: tool?.label ?? event.name, startTime: Date.now() });
                  return next;
                });
              });
              break;
            }
            case 'toolcall_end':
              break;
            case 'tool_result': {
              agentRecords.push(event.record);
              flushSync(() => {
                setPendingToolCalls(prev => {
                  const next = new Map(prev);
                  next.delete(event.record.id);
                  return next;
                });
                setCompletedToolCalls(prev => [...prev, event.record]);
              });
              break;
            }
            case 'done':
              rawContent = event.text || rawContent;
              thinkingContent = event.thinking || thinkingContent;
              break;
            case 'error':
              console.error('[Agent] Agent loop error:', event.message);
              break;
          }
        }

        // 获取最终结果
        const result = await loop.next();
        const loopResult = result.value;
        if (loopResult && typeof loopResult === 'object' && 'text' in loopResult) {
          rawContent = (loopResult as any).text || rawContent;
          thinkingContent = (loopResult as any).thinking || thinkingContent;
        }
      } catch (e) {
        console.error('[Agent] Agent loop error:', e);
        const isAbort = e instanceof DOMException && e.name === 'AbortError';
        if (!skipUser) await doRetract();
        if (isAbort) return { aborted: true, retractedText: userText };
        throw e;
      }

      if (!rawContent.trim()) {
        console.warn('[Agent] AI 返回空内容');
        if (!skipUser) await doRetract();
        return { aborted: true, retractedText: userText, formatError: true };
      }

      // 解析 Agent 输出标签
      const parsedTags = parseAgentTags(rawContent);

      // 应用 Agent 修改后的变量
      const nextVariables = agentVars;
      const varChanges = buildVarChanges(preVars, nextVariables);
      const snapshot = JSON.parse(JSON.stringify(nextVariables));

      // 处理 <history> 标签 — 通过 subscriber 追加到 plotHistory
      let finalPlotHistory = toolCtx.plotHistory;
      if (parsedTags.history) {
        const fullParsed: ParsedTags = { ...parsedTags, thinking: thinkingContent, varsRaw: '', varsCommands: { merge: {} }, unknown: {} };
        gameBus.emit('message_received', {
          rawContent,
          parsed: fullParsed,
          preVars: JSON.parse(JSON.stringify(preVars)),
          chat: updatedChat,
          userName: effectiveSettings.userName ?? DEFAULT_SETTINGS.userName,
        });
        const { timeline } = applyPlotHistory(toolCtx.plotHistory);
        finalPlotHistory = timeline;
      }

      // 通知订阅者：变量已更新
      gameBus.emit('vars_applied', {
        preVars: JSON.parse(JSON.stringify(preVars)),
        postVars: JSON.parse(JSON.stringify(nextVariables)),
        varChanges,
      });

      // 保存到 DB
      const msgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: msgId, role: 'assistant',
        content: rawContent,
        timestamp: Date.now(),
        parsed: { thinking: thinkingContent, varsRaw: '', varsCommands: { merge: {} }, unknown: {}, ...parsedTags },
        variablesAfter: snapshot,
        dreamAnchorAfter: { ...updatedChat.dreamAnchor },
        plotHistoryAfter: JSON.parse(JSON.stringify(finalPlotHistory)),
        apiUsed: 'primary',
        varChanges,
      };
      const updatedMessages = [...updatedChat.messages, assistantMsg];
      const finalChat: ChatSession = { ...updatedChat, messages: updatedMessages, variables: nextVariables, dreamAnchor: updatedChat.dreamAnchor, plotHistory: finalPlotHistory, updatedAt: Date.now() };
      await db.chats.put(finalChat);
      setChats(prev => prev.map(c => c.id === finalChat.id ? finalChat : c));

      console.log(`📊 Agent 最终: ${rawContent.length} 字文本, ${thinkingContent.length} 字思考, ${agentRecords.length} 个工具调用`);
      console.groupEnd();

      abortRef.current = null;
      setPendingToolCalls(new Map());
      return {
        aborted: false,
        varsUpdated: varChanges.length > 0,
        patchCount: agentRecords.length,
        varChanges,
      };
    }

    // ─── 非 Agent 模式（原有逻辑）───
    const { messages, totalTokens, stageTokens, stageMessages, stageOrder, stageNames } = assemblePrompt({
      userInput: userText,
      history: updatedChat.messages,
      presetBlocks: effectiveSettings.presetBlocks,
      lorebooks: effectiveSettings.lorebooks,
      userName: effectiveSettings.userName,
      characterName: effectiveSettings.characterName,
      playerDescription: effectiveSettings.playerDescription,
      characterDescription: effectiveSettings.characterDescription,
      mapTree: chatVars['地图'],
      currentLocation: chatVars['世界']?.['现实']?.['地点'] ?? '',
      isDream: chatVars['世界']?.['位于梦境'] ?? false,
      characters: chatVars['主要人物'],
      fullVariables: chatVars,
      plotHistory: updatedChat.plotHistory,
      dreamAnchor: updatedChat.dreamAnchor,
      squashSystemMessages: effectiveSettings.squashSystemMessages,
      recentMessageCount: effectiveSettings.recentMessageCount ?? DEFAULT_SETTINGS.recentMessageCount,
      useProcessedMap: effectiveSettings.useProcessedMap,
      useProcessedCharacters: effectiveSettings.useProcessedCharacters,
    });

    setLastPrompt({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      estimatedTokens: totalTokens,
      stageTokens,
      stageMessages,
      stageOrder,
      stageNames,
    });

    const freshRouter = createApiRouter(effectiveApi);
    parser.start();
    const controller = new AbortController();
    abortRef.current = controller;
    let rawContent = '';
    try {
      const { response } = await freshRouter.call('story', {
        messages,
        stream: true,
        ...(effectiveSettings.presetParams ? {
          temperature: effectiveSettings.presetParams.temperature,
          top_p: effectiveSettings.presetParams.top_p,
          top_k: effectiveSettings.presetParams.top_k,
          frequency_penalty: effectiveSettings.presetParams.frequency_penalty,
          presence_penalty: effectiveSettings.presetParams.presence_penalty,
          max_tokens: effectiveSettings.presetParams.openai_max_tokens,
        } : {}),
      }, controller.signal);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body');
      const decoder = new TextDecoder();
      let buf = '';
      let lastUsage: any = null;  // 缓存监控：捕获最后一条 chunk 的 usage
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          for (const line of part.split('\n').filter(l => l.startsWith('data: '))) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content ?? '';
              if (delta) { rawContent += delta; parser.feed(delta); }
              // DeepSeek 在流末尾返回 usage
              if (json?.choices?.[0]?.usage ?? json?.usage) {
                lastUsage = json?.choices?.[0]?.usage ?? json?.usage;
              }
            } catch { /* ignore */ }
          }
        }
      }
      // 缓存监控：流式结束后采集 usage
      if (lastUsage) {
        const record = buildUsageRecord(
          lastUsage,
          effectiveApi.model,
          effectiveChat.id,
          messages.map((m: any) => ({ role: m.role, content: m.content })),
          userText,
        );
        storeFullPrompt(record.requestId, messages.map((m: any) => ({ role: m.role, content: m.content })));
        gameBus.emit('api_usage', { record });
      }
    } catch (e) {
      console.error('[SillyTavern] 第一API调用失败:', e);
      parser.reset();
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      if (!skipUser) await doRetract();
      if (isAbort) return { aborted: true, retractedText: userText };
      throw e;
    }

    const { events, parsed } = parser.finish();

    // 格式错误检测：第一API必须输出 maintext / option / history 中至少一个有效标签
    // 同时检测是否使用了 <content> 等未定义标签
    const knownTags = new Set([
      ...(effectiveSettings.customTags ?? []),
      ...DEFAULT_TAGS,
    ]);
    const tagPattern = /<(\w+)[>\s\/]/g;
    const foundTags = new Set<string>();
    let tm: RegExpExecArray | null;
    while ((tm = tagPattern.exec(rawContent)) !== null) {
      if (!tm[1].startsWith('/')) foundTags.add(tm[1]);
    }
    const unknownTags = [...foundTags].filter(t => !knownTags.has(t));
    const hasMaintext = !!parsed.maintext?.trim();
    const hasOptions = (parsed.options?.length ?? 0) > 0;
    const hasHistory = parsed.history !== null;
    const hasValidContent = hasMaintext || hasOptions || hasHistory;
    const isEmpty = !rawContent.trim();
    if (!hasValidContent) {
      const detail = isEmpty
        ? 'AI 返回空内容'
        : unknownTags.length > 0
          ? `使用了未定义标签: <${unknownTags.join('>, <')}>`
          : '缺少有效标签 (maintext/option/history)';
      console.warn(`[SillyTavern] 回退: ${detail}`);
      parser.reset();
      if (!skipUser) await doRetract();
      // Toast 由 ChatPage.handleSend 统一显示（避免顶端中央出现重复 toast）
      return { aborted: true, retractedText: userText, formatError: true };
    }

    // 通知订阅者：AI 回复已收到（剧情历史等模块自行处理）
    gameBus.emit('message_received', {
      rawContent,
      parsed,
      preVars: JSON.parse(JSON.stringify(preVars)),
      chat: updatedChat,
      userName: effectiveSettings.userName,
    });

    const oldRealTime = (preVars['世界']?.['现实']?.['时间'] ?? null) as string | null;
    const oldDreamTime = (preVars['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;
    // 双API模式: 第一API不处理变量  [SillyTavern] 第一API完成
    const isDual = effectiveSettings.apiMode === 'dual' && effectiveApi.secondary?.enabled;
    let { nextVariables, snapshot } = isDual
      ? { nextVariables: JSON.parse(JSON.stringify(preVars)), snapshot: JSON.parse(JSON.stringify(preVars)) }
      : applyParsedToChat(preVars, parsed);
    if (!isDual) autoTagDreamItems(preVars, nextVariables);
    console.log('[SillyTavern] 第一API完成, 正文:', rawContent.length, '模式:', isDual ? 'dual(变量由第二API处理)' : 'single');
    setLastRawContent(rawContent);

    let apiUsed: 'primary' | 'secondary' | 'dual' = 'primary';
    let secondaryRaw = '';
    let varsUpdated = false;
    let patchCount = 0;
    let semenPatches: any[] = []; // AI 修改宫内精液.总量的 patch，用于重置注入时间
    let fertilizationEvents: FertilizationResult[] = [];
    let varChanges: import('../sillytavern/types').VarChange[] | undefined;
    if (isDual && effectiveApi.secondary.baseUrl && effectiveApi.secondary.apiKey) {
      setDualRunning(true);
      const maintextForVars = parsed.maintext || rawContent;
      if (maintextForVars.trim()) {
        try {
          const varsPreset = effectiveSettings.presets.find(
            p => p.id === effectiveSettings.activeVarsPresetId && p.type === 'vars',
          );

          if (varsPreset) {
            const lorebooks = effectiveSettings.lorebooks ?? [];
            const secMacroCtx = {
              userName: effectiveSettings.userName,
              characterName: effectiveSettings.characterName,
              userInput: userText,
              playerDescription: effectiveSettings.playerDescription,
              characterDescription: effectiveSettings.characterDescription,
              varsListText: formatVariablesForPrompt(nextVariables),
              lastMaintext: maintextForVars,
              fullVars: nextVariables,
            };
            const secMessages: Array<{ role: string; content: string }> = [];
            const secStageMessages: Record<string, Array<{ role: string; content: string }>> = {};
            const secStageTokens: Record<string, number> = {};
            const secStageOrder: string[] = [];
            const secStageNames: Record<string, string> = {};
            let secTotalTokens = 0;
            for (const block of varsPreset.blocks) {
              if (!block.enabled || !block.content?.trim()) continue;
              let resolved = resolveLorebyMacro(block.content, lorebooks);
              resolved = replaceMacros(resolved, secMacroCtx);
              if (!resolved.trim()) continue;
              secMessages.push({ role: block.role, content: resolved });
              const tokenEst = Math.round(resolved.length / 4);
              secTotalTokens += tokenEst;
              secStageMessages[block.identifier] = [{ role: block.role, content: resolved }];
              secStageTokens[block.identifier] = tokenEst;
              secStageOrder.push(block.identifier);
              secStageNames[block.identifier] = block.name || block.identifier;
            }
            // 同步更新提示词查看弹窗
            if (secStageOrder.length > 0) {
              setLastSecondaryPrompt({
                messages: [],
                estimatedTokens: secTotalTokens,
                stageTokens: secStageTokens,
                stageMessages: secStageMessages,
                stageOrder: secStageOrder,
                stageNames: secStageNames,
              });
            }
            console.log('[SillyTavern] 第二API调用, 消息数:', secMessages.length);

            const dualController = new AbortController();
            dualAbortRef.current = dualController;
            const secResult = await freshRouter.call('vars', {
              messages: secMessages as any,
              stream: false,
              temperature: effectiveApi.secondary.temperature ?? 0.3,
              max_tokens: effectiveApi.secondary.maxTokens ?? 2048,
            }, dualController.signal);
            if (secResult.response.ok) {
              const d = await secResult.response.json();
              const raw = d?.choices?.[0]?.message?.content ?? '';
              console.log('[SillyTavern] 第二API完成, 长度:', raw.length);
              secondaryRaw = raw;

              // JSONPatch 数组
              const mArr = raw.match(/\[[\s\S]*\]/);
              if (mArr) {
                try {
                  const patches = JSON.parse(mArr[0]);
                  if (Array.isArray(patches) && patches.length > 0) {
                    nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: {}, patches }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
                    // 记录AI修改了哪些角色的宫内精液.总量，稍后重置注入时间
                    for (const p of patches) if (p.path && (p.path.includes('宫内精液.总量') || p.path.includes('宫内精液.来源列表'))) semenPatches.push(p);
                    autoTagDreamItems(preVars, nextVariables);
                    snapshot = JSON.parse(JSON.stringify(nextVariables));
                    apiUsed = 'dual';
                    varsUpdated = true;
                    patchCount = patches.length;
                  }
                } catch { /* JSON parse failed */ }
              }
              // JSON 合并对象（后备）
              if (apiUsed !== 'dual') {
                const mObj = raw.match(/\{[\s\S]*\}/);
                if (mObj) {
                  try {
                    const sp = JSON.parse(mObj[0]);
                    if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
                      nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: sp }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
                      autoTagDreamItems(preVars, nextVariables);
                      snapshot = JSON.parse(JSON.stringify(nextVariables));
                      apiUsed = 'dual';
                      varsUpdated = true;
                      patchCount = Object.keys(sp).length;
                    }
                  } catch { /* fallback */ }
                }
              }
              // 第二API有返回但未能解析出有效补丁 → 通知玩家
              if (apiUsed !== 'dual' && raw.trim()) {
                console.warn('[SillyTavern] 第二API返回无法解析:', raw.slice(0, 200));
                showTopCenter('第二API返回格式异常，变量未更新');
              }
            }
          } else {
            console.log('[SillyTavern] 第二API跳过: 未找到变量预设');
          }
        } catch (e) {
          console.error('[SillyTavern] 第二API失败(非致命):', e);
          showTopCenter('第二API调用失败，变量未更新');
        }
      }
    } else if (isDual) {
      console.log('[SillyTavern] 第二API跳过: 未配置URL/Key');
    }
    if (varsUpdated) varChanges = buildVarChanges(preVars, nextVariables);
    dualAbortRef.current = null;
    setDualRunning(false);

    // 通知订阅者：变量已更新（梦境锚点等模块自行处理）
    gameBus.emit('vars_applied', {
      preVars: JSON.parse(JSON.stringify(preVars)),
      postVars: JSON.parse(JSON.stringify(nextVariables)),
      varChanges,
    });

    // 第二API输出追加到正文（确保查看原文能显示完整的XML标签结构）
    // 第一API输出：若不含 <maintext 标签则包裹
    let displayContent = rawContent;
    if (!/<maintext/i.test(displayContent)) {
      displayContent = `<maintext>\n${displayContent}\n</maintext>`;
    }
    // 第二API输出：若不含 <JSONPatch / <Analysis 标签则包裹
    if (secondaryRaw) {
      let taggedSecondary = secondaryRaw;
      if (!/<JSONPatch/i.test(taggedSecondary)) {
        taggedSecondary = `<JSONPatch>\n${taggedSecondary}\n</JSONPatch>`;
      }
      if (!/<Analysis/i.test(taggedSecondary)) {
        taggedSecondary = `<Analysis>\n变量分析\n</Analysis>\n${taggedSecondary}`;
      }
      displayContent = displayContent + '\n\n' + taggedSecondary;
    }
    const finalContent = displayContent;
    setLastRawContent(finalContent);
    const msgId = crypto.randomUUID();

    // 梦境锚点 — 由 dream-anchor subscriber 处理
    let updatedDreamAnchor = getUpdatedDreamAnchor(updatedChat.dreamAnchor ?? {}) ?? { ...(updatedChat.dreamAnchor ?? {}) };
    // 梦境状态切换时重拍快照（锚点变化意味着装备验证可能修改了变量）
    if (getUpdatedDreamAnchor(updatedChat.dreamAnchor ?? {})) {
      snapshot = JSON.parse(JSON.stringify(nextVariables));
    }

    // AI 修改了宫内精液 → 同步总量（注入时间由 AI 负责）
    const processedSemenNodes = new Set<any>();
    for (const p of semenPatches) {
      const parts = (p.path as string).split('/');
      const semenIdx = parts.indexOf('宫内精液');
      if (semenIdx > 0) {
        const base = parts.slice(0, semenIdx + 1);
        let node: any = nextVariables;
        for (const seg of base) { if (node && typeof node === 'object') node = node[seg]; else break; }
        if (!node || typeof node !== 'object' || processedSemenNodes.has(node)) continue;
        processedSemenNodes.add(node);
        // 同步总量 = sum(来源列表[*].容量)
        if (Array.isArray(node['来源列表'])) {
          node['总量'] = node['来源列表'].reduce((sum: number, e: any) => sum + (e['容量'] || 0), 0);
        }
      }
    }

    // 生理 tick — 由 physiology subscriber 处理
    const newRealTime = (nextVariables?.['世界']?.['现实']?.['时间'] ?? null) as string | null;
    const newDreamTime = (nextVariables?.['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;

    if (newRealTime !== oldRealTime || newDreamTime !== oldDreamTime) {
      gameBus.emit('time_changed', {
        oldRealTime, newRealTime, oldDreamTime, newDreamTime,
        vars: nextVariables,
        preVars: JSON.parse(JSON.stringify(preVars)),
      });
      fertilizationEvents.push(...getLastFertilizationEvents());
      snapshot = JSON.parse(JSON.stringify(nextVariables));
    }

    // 剧情历史 — 由 plot-history subscriber 处理
    const basePlotHistory: HistoryTimeline = updatedChat.plotHistory ?? { reality: [], dream: [] };
    const { timeline: plotHistory } = applyPlotHistory(basePlotHistory);
    if (parsed.history && plotHistory !== basePlotHistory) {
      // subscriber 已追加了新节点，同步更新 parsed.history 供存储
      const enriched = enrichHistory(parsed.history, nextVariables, effectiveSettings.userName);
      parsed.history = enriched;
    }
    const plotHistorySnapshot = JSON.parse(JSON.stringify(plotHistory));

    const assistantMsg: ChatMessage = {
      id: msgId, role: 'assistant',
      content: finalContent,
      timestamp: Date.now(), parsed, variablesAfter: snapshot, dreamAnchorAfter: { ...updatedDreamAnchor }, plotHistoryAfter: plotHistorySnapshot, apiUsed, varChanges,
    };
    const updatedMessages = [...updatedChat.messages, assistantMsg];
    const finalChat: ChatSession = { ...updatedChat, messages: updatedMessages, variables: nextVariables, dreamAnchor: updatedDreamAnchor, plotHistory, updatedAt: Date.now() };
    await db.chats.put(finalChat);
    setChats(prev => prev.map(c => c.id === finalChat.id ? finalChat : c));

    abortRef.current = null;
    return { aborted: false, varsUpdated, patchCount, varChanges, fertilizationEvents };
  }, [activeChat, settings, parser]);

  const jumpToFloor = useCallback(async (messageId: string) => {
    // Read latest from DB to avoid stale closure over activeChat
    const allChats = await db.chats.toArray();
    const chat = allChats.find(c => c.id === activeChatId);
    if (!chat) return;
    const idx = chat.messages.findIndex(m => m.id === messageId);
    if (idx < 0) return;
    const truncated = chat.messages.slice(0, idx + 1);
    const target = truncated[truncated.length - 1];
    // 从截断后的消息中，反向查找最近的 assistant 的 variablesAfter（兼容旧存档点无此字段）
    const lastVarsAfter = (() => {
      for (let i = truncated.length - 1; i >= 0; i--) {
        if (truncated[i].role === 'assistant' && truncated[i].variablesAfter) return truncated[i].variablesAfter;
      }
      return undefined;
    })();
    const restoredVars = lastVarsAfter ?? JSON.parse(JSON.stringify(DEFAULT_WORLD_VARS));
    const lastAnchorAfter = (() => {
      for (let i = truncated.length - 1; i >= 0; i--) {
        if (truncated[i].role === 'assistant' && truncated[i].dreamAnchorAfter) return truncated[i].dreamAnchorAfter;
      }
      return undefined;
    })();
    const restoredAnchor = lastAnchorAfter ?? chat.dreamAnchor ?? {};
    const lastPlotAfter = (() => {
      for (let i = truncated.length - 1; i >= 0; i--) {
        if (truncated[i].role === 'assistant' && truncated[i].plotHistoryAfter) return truncated[i].plotHistoryAfter;
      }
      return undefined;
    })();
    const restoredPlotHistory = lastPlotAfter ?? chat.plotHistory;
    const next: ChatSession = { ...chat, messages: truncated, variables: restoredVars, dreamAnchor: restoredAnchor, plotHistory: restoredPlotHistory, updatedAt: Date.now() };
    await db.chats.put(next);
    // 从 DB 重新读取全部 chats 后直接 setState，避免 updater 竞态导致 UI 不刷新
    const freshChats = await db.chats.toArray();
    setChats(freshChats);
    parser.reset();  // 清空流式状态，让 rawMaintext 回退到 latestAssistant
    setJumpVersion(v => v + 1);  // 强制触发 ChatPage 刷新
  }, [activeChatId, parser]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    // 重新提取 maintext/thinking 等字段，确保编辑后界面显示正确
    const extractTag = (tag: string) => {
      const m = newContent.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, 'i'));
      return m ? m[1] : undefined;
    };

    // 乐观更新：先更新 React state（即时渲染），再异步写 DB
    setChats(prev => {
      const chat = prev.find(c => c.id === activeChatId);
      if (!chat) return prev;
      const nextMessages = chat.messages.map(m => {
        if (m.id !== messageId) return m;
        const oldParsed = m.parsed;
        const updatedParsed = oldParsed ? {
          ...oldParsed,
          maintext: extractTag('maintext') ?? oldParsed.maintext,
          thinking: extractTag('think(?:ing)?') ?? oldParsed.thinking,
        } : undefined;
        return { ...m, content: newContent, parsed: updatedParsed };
      });
      const next: ChatSession = { ...chat, messages: nextMessages, updatedAt: Date.now() };
      db.chats.put(next).catch(e => console.error('[editMessage] DB 写入失败:', e));
      return prev.map(c => c.id === next.id ? next : c);
    });
    // 清空流式状态，让 rawMaintext 回退到 latestAssistant.parsed.maintext
    parser.reset();
  }, [activeChatId, parser]);

  const regenerateLast = useCallback(async (): Promise<string | null> => {
    if (!activeChat) return null;
    // 从 DB 读取最新 chat，避免闭包过期
    const dbChats = await db.chats.toArray();
    const chat = dbChats.find(c => c.id === activeChat.id) ?? activeChat;
    const lastUserIdx = [...chat.messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx < 0) return null;
    const targetIdx = chat.messages.length - 1 - lastUserIdx;
    const userText = chat.messages[targetIdx].content;
    // 保留最后一条 user 消息，仅删除其后的 assistant 回复
    const truncated = chat.messages.slice(0, targetIdx + 1);
    const lastUser = truncated[truncated.length - 1]; // 保留的最后一个 user 消息
    const lastAssistant = [...truncated].reverse().find(m => m.role === 'assistant');
    const restoredPlotHistory = lastAssistant?.plotHistoryAfter ?? chat.plotHistory;
    const restoredVars = lastAssistant?.variablesAfter ?? lastUser?.variablesAfter ?? chat.variables ?? {};
    const restoredAnchor = lastAssistant?.dreamAnchorAfter ?? chat.dreamAnchor ?? {};
    const next: ChatSession = { ...chat, messages: truncated, variables: restoredVars, dreamAnchor: restoredAnchor, plotHistory: restoredPlotHistory, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
    // skipUserMessage: 不追加新 user 消息，复用已有的
    try {
      const result = await sendGameMessage(userText, { skipUserMessage: true });
      if (result.aborted) {
        // 中止 → 保持截断状态（assistant已删除），返回玩家输入
        return userText;
      }
      if (result.formatError) {
        showTopCenter('AI 回复缺少必要标签，请重试', 'warning');
        return userText;
      }
      return null;
    } catch (err: any) {
      // API 网络错误等 → 保持截断状态，返回玩家输入
      showTopCenter(err?.message || String(err), 'error');
      return userText;
    }
  }, [activeChat, sendGameMessage]);

  const regenerateVarsOnly = useRegenerateVars({
    activeChat, settings, db, setDualRunning, dualAbortRef,
    setLastRawContent, setChats, setLastSecondaryPrompt,
  });

  const setChatVariables = useCallback(async (vars: Record<string, any>) => {
    if (!activeChat) return;
    const next: ChatSession = { ...activeChat, variables: vars, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
  }, [activeChat]);

  const refreshPrompt = useCallback(async (simulateInput?: string) => {
    if (!settings) return;
    const latestSettings = await getSettings();
    const effectiveSettings = {
      ...(latestSettings ?? DEFAULT_SETTINGS),
      ...(settings ?? {}),
      presetBlocks: latestSettings?.presetBlocks ?? settings?.presetBlocks ?? DEFAULT_PRESET_BLOCKS,
      lorebooks: latestSettings?.lorebooks ?? settings?.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
      presetParams: latestSettings?.presetParams ?? settings?.presetParams,
    };
    const chatVars = activeChat?.variables ?? DEFAULT_WORLD_VARS;
    const chatHistory = activeChat?.messages ?? [];
    const userInput = simulateInput
      ?? [...chatHistory].reverse().find(m => m.role === 'user')?.content
      ?? '';
    const { messages, totalTokens, stageTokens, stageMessages, stageOrder, stageNames } = assemblePrompt({
      userInput,
      history: chatHistory,
      presetBlocks: effectiveSettings.presetBlocks,
      lorebooks: effectiveSettings.lorebooks,
      userName: effectiveSettings.userName ?? DEFAULT_SETTINGS.userName,
      characterName: effectiveSettings.characterName ?? DEFAULT_SETTINGS.characterName,
      playerDescription: effectiveSettings.playerDescription,
      characterDescription: effectiveSettings.characterDescription,
      squashSystemMessages: effectiveSettings.squashSystemMessages,
      mapTree: chatVars['地图'],
      characters: chatVars['主要人物'],
      fullVariables: chatVars,
      currentLocation: chatVars['世界']?.['现实']?.['地点'] ?? '',
      isDream: chatVars['世界']?.['位于梦境'] ?? false,
      plotHistory: activeChat?.plotHistory,
      dreamAnchor: activeChat?.dreamAnchor,
      recentMessageCount: effectiveSettings.recentMessageCount ?? DEFAULT_SETTINGS.recentMessageCount,
      useProcessedMap: effectiveSettings.useProcessedMap,
      useProcessedCharacters: effectiveSettings.useProcessedCharacters,
    });
    setLastPrompt({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      estimatedTokens: totalTokens,
      stageTokens,
      stageMessages,
      stageOrder,
      stageNames,
    });

    // 重建第二API提示词预览
    buildSecondaryPrompt(effectiveSettings, activeChat);
  }, [activeChat, settings, buildSecondaryPrompt]);

  return {
    settings, chats, activeChat, initialized, lastPrompt, lastSecondaryPrompt,
    createChat, selectChat, removeChat, sendGameMessage, jumpToFloor, editMessage, regenerateLast, regenerateVarsOnly,
    updateSettings, setChatVariables, refreshPrompt,
    streamState: parser.state, abortStream: () => { abortRef.current?.abort(); parser.reset(); },
    abortDual: () => { dualAbortRef.current?.abort(); dualAbortRef.current = null; setDualRunning(false); },
    dualRunning, lastRawContent, jumpVersion,
    // Agent mode
    pendingToolCalls, completedToolCalls,
  };
}

// ── Type export for Context ──

export type SillytavernContextType = ReturnType<typeof useSillytavern>;
