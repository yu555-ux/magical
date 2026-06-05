import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStreamParser } from './useStreamParser';
import { createApiRouter } from '../sillytavern/api-router';
import { applyParsedToChat, autoTagDreamItems, enrichHistory, validateEquipment, formatVariablesForPrompt, buildVarChanges } from '../sillytavern/variables';
import { assemblePrompt, replaceMacros } from '../sillytavern/prompt-assembler';
import { DEFAULT_TAGS, DEFAULT_OPAQUE_TAGS, DEFAULT_SETTINGS, DEFAULT_PRESET_BLOCKS, DEFAULT_PRESET_PARAMS, type AppSettings, type ChatSession, type ChatMessage, type HistoryTimeline } from '../sillytavern/types';
import { getDatabase, initializeDatabase, getSettings, getChats, saveChat, deleteChat, saveSettings } from '../sillytavern/database';
import { DEFAULT_WORLD_VARS } from '../sillytavern/default-world-vars';
import { showTopCenter } from '../components/shared/TopCenterToast';
import { tickAllFemales, type FertilizationResult } from '../sillytavern/physiology';

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

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) ?? null, [chats, activeChatId]);

  /** 将 {{LOREBY::pattern}} 替换为匹配的世界书条目内容（按条目标题/检索词匹配） */
  const resolveLorebyMacro = useCallback((content: string, lorebooks: typeof settings extends { lorebooks: infer L } ? L : any): string => {
    if (!lorebooks?.length) return content.replace(/\{\{LOREBY::[^}]+\}\}/g, '');
    const patterns: string[] = [];
    const re = /\{\{LOREBY::([^}]+)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      patterns.push(m[1].trim());
    }
    if (patterns.length === 0) return content;
    // 按世界书条目标题(comment)匹配
    const parts: string[] = [];
    for (const lb of lorebooks) {
      console.log('[LOREBY] 世界书:', lb.name, '条目数:', lb.entries?.length);
      for (const entry of (lb.entries ?? [])) {
        if (!entry.enabled) continue;
        const keys = (entry.keys || []).concat(entry.secondaryKeys || []);
        const matchText = [entry.comment || '', ...keys].join(' ');
        if (patterns.some(p => matchText.includes(p))) {
          console.log('[LOREBY] 命中:', entry.comment);
          parts.push(entry.content);
        }
      }
    }
    console.log('[LOREBY] 匹配条目数:', parts.length);
    const replacement = parts.join('\n\n');
    return replacement ? content.replace(/\{\{LOREBY::[^}]+\}\}/g, replacement) : content.replace(/\{\{LOREBY::[^}]+\}\}/g, '');
  }, []);

  // 构建第二API提示词预览（响应 settings / activeChat 变化）
  const buildSecondaryPrompt = useCallback((s: AppSettings, chat: ChatSession | null) => {
    const varsPreset = s.presets?.find(
      p => p.id === s.activeVarsPresetId && p.type === 'vars',
    );
    if (!varsPreset) { setLastSecondaryPrompt(null); return; }

    const chatVars = chat?.variables ?? {};
    const lastAssistant = [...(chat?.messages ?? [])].reverse().find(m => m.role === 'assistant');
    const lastMaintext = lastAssistant?.parsed?.maintext ?? '';

    const secMacroCtx = {
      userName: s.userName ?? DEFAULT_SETTINGS.userName,
      characterName: s.characterName ?? DEFAULT_SETTINGS.characterName,
      userInput: '',
      playerDescription: s.playerDescription,
      characterDescription: s.characterDescription,
      varsListText: formatVariablesForPrompt(chatVars),
      lastMaintext: lastMaintext || '(暂无AI回复正文)',
      fullVars: chatVars,
    };

    const secStageMessages: Record<string, Array<{ role: string; content: string }>> = {};
    const secStageTokens: Record<string, number> = {};
    const secStageOrder: string[] = [];
    const secStageNames: Record<string, string> = {};
    let secTotalTokens = 0;

    const lorebooks = s.lorebooks ?? [];
    for (const block of varsPreset.blocks) {
      if (!block.enabled || !block.content?.trim()) continue;
      let resolved = resolveLorebyMacro(block.content, lorebooks);
      resolved = replaceMacros(resolved, secMacroCtx);
      if (!resolved.trim()) continue;
      const tokenEst = Math.round(resolved.length / 4);
      secTotalTokens += tokenEst;
      secStageMessages[block.identifier] = [{ role: block.role, content: resolved }];
      secStageTokens[block.identifier] = tokenEst;
      secStageOrder.push(block.identifier);
      secStageNames[block.identifier] = block.name || block.identifier;
    }

    if (secStageOrder.length > 0) {
      setLastSecondaryPrompt({
        messages: [],
        estimatedTokens: secTotalTokens,
        stageTokens: secStageTokens,
        stageMessages: secStageMessages,
        stageOrder: secStageOrder,
        stageNames: secStageNames,
      });
    } else {
      setLastSecondaryPrompt(null);
    }
  }, []);

  // 响应 settings 变化自动重建第二API提示词预览
  useEffect(() => {
    if (settings && initialized) {
      buildSecondaryPrompt(settings, activeChat);
    }
  }, [settings, activeChat, initialized, buildSecondaryPrompt]);

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
    // 不烘焙用户名——保留<user>/{{user}}宏，显示层根据当前settings实时解析
    const openingText = DEFAULT_OPENING;

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

    // 没有导入预设 → 阻止游戏，提示错误
    if (!effectiveSettings.presetBlocks || effectiveSettings.presetBlocks.length === 0) {
      throw new Error('请先在设置中导入提示词预设');
    }

    const skipUser = opts?.skipUserMessage === true;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText, timestamp: Date.now() };
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
      isDream: chatVars['世界']?.['梦境定位']?.['位于梦境'] ?? false,
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
            try { const json = JSON.parse(data); const delta = json?.choices?.[0]?.delta?.content ?? ''; if (delta) { rawContent += delta; parser.feed(delta); } } catch { /* ignore */ }
          }
        }
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

    const preVars = updatedChat.variables ?? {};
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
            for (const block of varsPreset.blocks) {
              if (!block.enabled || !block.content?.trim()) continue;
              let resolved = resolveLorebyMacro(block.content, lorebooks);
              resolved = replaceMacros(resolved, secMacroCtx);
              if (resolved.trim()) secMessages.push({ role: block.role, content: resolved });
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
                    for (const p of patches) if (p.path && p.path.includes('宫内精液.总量')) semenPatches.push(p);
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

    // Auto-unequip items that don't match current plane
    const oldInDream = preVars?.世界?.梦境定位?.位于梦境 === true;
    const newInDream = nextVariables?.世界?.梦境定位?.位于梦境 === true;

    // 检测梦境状态转移，更新锚点（用于倒计时计算）
    let updatedDreamAnchor = { ...(updatedChat.dreamAnchor ?? {}) };
    if (oldInDream !== newInDream) {
      validateEquipment(nextVariables);
      snapshot = JSON.parse(JSON.stringify(nextVariables));

      if (oldInDream && !newInDream) {
        // 从梦境苏醒 → 记录现实时间作为锚点
        updatedDreamAnchor.lastWokeAt = nextVariables?.['世界']?.['现实']?.['时间'] ?? '';
      } else if (!oldInDream && newInDream) {
        // 进入梦境 → 记录梦境时间作为锚点
        updatedDreamAnchor.lastEnteredAt = nextVariables?.['世界']?.['梦境存档']?.['时间'] ?? '';
      }
    }

    // AI 修改了宫内精液.总量 → 重置注入时间，代码从新值开始衰减
    for (const p of semenPatches) {
      const parts = (p.path as string).split('/');
      const semenIdx = parts.indexOf('宫内精液');
      if (semenIdx > 0) {
        const base = parts.slice(0, semenIdx + 1);
        let node: any = nextVariables;
        for (const seg of base) { if (node && typeof node === 'object') node = node[seg]; else break; }
        if (node && typeof node === 'object') {
          const worldTime = (nextVariables?.['世界']?.['现实']?.['时间'] ?? '') as string;
          if (worldTime) node['注入时间'] = worldTime;
        }
      }
    }

    // 只有世界时间实际变化时才跑生理 tick
    const newRealTime = (nextVariables?.['世界']?.['现实']?.['时间'] ?? null) as string | null;
    const newDreamTime = (nextVariables?.['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;

    if (newRealTime && newRealTime !== oldRealTime) {
      fertilizationEvents.push(...tickAllFemales(nextVariables, oldRealTime, newRealTime, { dreamOnly: false }));
    }
    if (newDreamTime && newDreamTime !== oldDreamTime) {
      fertilizationEvents.push(...tickAllFemales(nextVariables, oldDreamTime, newDreamTime, { dreamOnly: true }));
    }
    if (newRealTime !== oldRealTime || newDreamTime !== oldDreamTime) {
      snapshot = JSON.parse(JSON.stringify(nextVariables));
    }

    // enrichHistory 使用 postVars（变量更新后的最新状态）
    let plotHistory: HistoryTimeline = updatedChat.plotHistory ?? { reality: [], dream: [] };
    if (parsed.history) {
      parsed.history = enrichHistory(parsed.history, nextVariables, effectiveSettings.userName);
      // 增量追加到本轮的 plotHistory
      const sp = parsed.history;
      plotHistory = {
        reality: [...plotHistory.reality],
        dream: [...plotHistory.dream],
      };
      if (sp.world === '现实') {
        plotHistory.reality.push({ ...sp, sequence: plotHistory.reality.length + 1 });
      } else if (sp.world === '梦境') {
        plotHistory.dream.push({ ...sp, sequence: plotHistory.dream.length + 1 });
      }
    }
    // 无论是否有 <history>，都保存快照（回档时恢复用）
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
    const chats = await db.chats.toArray();
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    const nextMessages = chat.messages.map(m =>
      m.id === messageId ? { ...m, content: newContent } : m,
    );
    const next: ChatSession = { ...chat, messages: nextMessages, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
  }, [activeChatId]);

  const regenerateLast = useCallback(async () => {
    if (!activeChat) return;
    // 从 DB 读取最新 chat，避免闭包过期
    const dbChats = await db.chats.toArray();
    const chat = dbChats.find(c => c.id === activeChat.id) ?? activeChat;
    const lastUserIdx = [...chat.messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx < 0) return;
    const targetIdx = chat.messages.length - 1 - lastUserIdx;
    const userText = chat.messages[targetIdx].content;
    // 保存原始快照，用于取消时恢复
    const backup = {
      messages: [...chat.messages],
      variables: chat.variables,
      dreamAnchor: chat.dreamAnchor,
      plotHistory: chat.plotHistory,
    };
    // 保留最后一条 user 消息，仅删除其后的 assistant 回复
    const truncated = chat.messages.slice(0, targetIdx + 1);
    const lastAssistant = [...truncated].reverse().find(m => m.role === 'assistant');
    const restoredPlotHistory = lastAssistant?.plotHistoryAfter ?? chat.plotHistory;
    const restoredVars = lastAssistant?.variablesAfter ?? chat.variables ?? {};
    const restoredAnchor = lastAssistant?.dreamAnchorAfter ?? chat.dreamAnchor ?? {};
    const next: ChatSession = { ...chat, messages: truncated, variables: restoredVars, dreamAnchor: restoredAnchor, plotHistory: restoredPlotHistory, updatedAt: Date.now() };
    await db.chats.put(next);
    setChats(prev => prev.map(c => c.id === next.id ? next : c));
    // skipUserMessage: 不追加新 user 消息，复用已有的
    const result = await sendGameMessage(userText, { skipUserMessage: true });
    // 取消重roll → 恢复原始消息、变量、锚点和剧情历史
    if (result.aborted) {
      const restored: ChatSession = { ...chat, messages: backup.messages, variables: backup.variables, dreamAnchor: backup.dreamAnchor, plotHistory: backup.plotHistory, updatedAt: Date.now() };
      await db.chats.put(restored);
      setChats(prev => prev.map(c => c.id === restored.id ? restored : c));
    }
  }, [activeChat, sendGameMessage]);

  // 重写变量：保留正文，仅用第二API重新提取变量
  const regenerateVarsOnly = useCallback(async (): Promise<{
    patchCount: number;
    varChanges: import('../sillytavern/types').VarChange[];
    fertilizationEvents: FertilizationResult[];
  } | null> => {
    if (!activeChat || !settings) return null;
    setDualRunning(true);
    // 从 DB 读取最新 chat，避免闭包过期
    const dbChats = await db.chats.toArray();
    const chat = dbChats.find(c => c.id === activeChat.id) ?? activeChat;
    const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant?.parsed?.maintext) { setDualRunning(false); return null; }

    const latestSettings = await getSettings();
    const effectiveApi = latestSettings?.api ?? settings.api ?? DEFAULT_SETTINGS.api;
    const effectiveSettings = {
      ...(latestSettings ?? DEFAULT_SETTINGS),
      ...(settings ?? {}),
      api: effectiveApi,
      presetBlocks: latestSettings?.presetBlocks ?? settings?.presetBlocks ?? DEFAULT_PRESET_BLOCKS,
      lorebooks: latestSettings?.lorebooks ?? settings?.lorebooks ?? DEFAULT_SETTINGS.lorebooks,
    };

    if (!effectiveApi.secondary?.enabled || !effectiveApi.secondary.baseUrl) { setDualRunning(false); return null; }

    const router = createApiRouter(effectiveApi);
    const preVars = chat.variables ?? {};
    const maintextForVars = lastAssistant.parsed.maintext;

    const varsPreset = effectiveSettings.presets?.find(
      (p) => p.id === effectiveSettings.activeVarsPresetId && p.type === 'vars',
    );

    if (!varsPreset) { setDualRunning(false); return null; }

    try {
      const secMessages: Array<{ role: string; content: string }> = [];
      const lorebooks = effectiveSettings.lorebooks ?? [];
      const secMacroCtx = {
        userName: effectiveSettings.userName,
        characterName: effectiveSettings.characterName,
        userInput: '',
        playerDescription: effectiveSettings.playerDescription,
        characterDescription: effectiveSettings.characterDescription,
        varsListText: formatVariablesForPrompt(preVars),
        lastMaintext: maintextForVars,
        fullVars: preVars,
      };

      for (const block of varsPreset.blocks) {
        if (!block.enabled || !block.content?.trim()) continue;
        let resolved = resolveLorebyMacro(block.content, lorebooks);
        resolved = replaceMacros(resolved, secMacroCtx);
        if (resolved.trim()) secMessages.push({ role: block.role, content: resolved });
      }

      const dualController = new AbortController();
      dualAbortRef.current = dualController;
      const { response } = await router.call('vars', {
        messages: secMessages as any,
        stream: false,
        temperature: effectiveApi.secondary.temperature ?? 0.3,
        max_tokens: effectiveApi.secondary.maxTokens ?? 2048,
      }, dualController.signal);

      if (!response.ok) return;
      const d = await response.json();
      const raw = d?.choices?.[0]?.message?.content ?? '';
      let nextVariables = JSON.parse(JSON.stringify(preVars));
      let patchCount = 0;
      const semenPatches: any[] = [];

      const mArr = raw.match(/\[[\s\S]*\]/);
      let varsRegenerated = false;
      if (mArr) {
        try {
          const patches = JSON.parse(mArr[0]);
          if (Array.isArray(patches) && patches.length > 0) {
            nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: {}, patches }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
            autoTagDreamItems(preVars, nextVariables);
            patchCount = patches.length;
            for (const p of patches) if (p.path && (p.path as string).includes('宫内精液.总量')) semenPatches.push(p);
            varsRegenerated = true;
          }
        } catch { /* ignore */ }
      }
      if (nextVariables === preVars) {
        const mObj = raw.match(/\{[\s\S]*\}/);
        if (mObj) {
          try {
            const sp = JSON.parse(mObj[0]);
            if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
              nextVariables = applyParsedToChat(nextVariables, { varsCommands: { merge: sp }, varsRaw: '', maintext: '', options: [], history: null, thinking: '', unknown: {} }).nextVariables;
              autoTagDreamItems(preVars, nextVariables);
              patchCount = Object.keys(sp).length;
              varsRegenerated = true;
            }
          } catch { /* ignore */ }
        }
      }

      // 计算变量变更
      const varChanges = varsRegenerated ? buildVarChanges(preVars, nextVariables) : [];

      // 精液注入时间重置（AI 修改了宫内精液.总量 → 重置注入时间）
      for (const p of semenPatches) {
        const parts = (p.path as string).split('/');
        const semenIdx = parts.indexOf('宫内精液');
        if (semenIdx > 0) {
          const base = parts.slice(0, semenIdx + 1);
          let node: any = nextVariables;
          for (const seg of base) { if (node && typeof node === 'object') node = node[seg]; else break; }
          if (node && typeof node === 'object') {
            const worldTime = (nextVariables?.['世界']?.['现实']?.['时间'] ?? '') as string;
            if (worldTime) node['注入时间'] = worldTime;
          }
        }
      }

      // 生理 tick → 受孕检测
      const oldRealTime = (preVars?.['世界']?.['现实']?.['时间'] ?? null) as string | null;
      const oldDreamTime = (preVars?.['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;
      const newRealTime = (nextVariables?.['世界']?.['现实']?.['时间'] ?? null) as string | null;
      const newDreamTime = (nextVariables?.['世界']?.['梦境存档']?.['时间'] ?? null) as string | null;
      const fertilizationEvents: FertilizationResult[] = [];
      if (newRealTime && newRealTime !== oldRealTime) {
        fertilizationEvents.push(...tickAllFemales(nextVariables, oldRealTime, newRealTime, { dreamOnly: false }));
      }
      if (newDreamTime && newDreamTime !== oldDreamTime) {
        fertilizationEvents.push(...tickAllFemales(nextVariables, oldDreamTime, newDreamTime, { dreamOnly: true }));
      }

      // 更新查看原文：构建带标签结构的显示内容
      if (raw) {
        let tagged = raw;
        if (!/<JSONPatch/i.test(tagged)) {
          tagged = `<JSONPatch>\n${tagged}\n</JSONPatch>`;
        }
        if (!/<Analysis/i.test(tagged)) {
          tagged = `<Analysis>\n变量分析\n</Analysis>\n${tagged}`;
        }
        setLastRawContent(`<maintext>\n${lastAssistant.parsed.maintext}\n</maintext>\n\n${tagged}`);
      }

      // 更新最后一条 assistant 消息的 varChanges（确保 VariableDiffModal 显示正确数据）
      const updatedMessages = chat.messages.map(m =>
        m.id === lastAssistant.id ? { ...m, varChanges } : m
      );

      const next: ChatSession = { ...chat, messages: updatedMessages, variables: nextVariables, updatedAt: Date.now() };
      await db.chats.put(next);
      setChats(prev => prev.map(c => c.id === next.id ? next : c));
      return varsRegenerated ? { patchCount, varChanges, fertilizationEvents } : null;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      console.error('[SillyTavern] 变量重写失败:', e);
      return null;
    } finally {
      dualAbortRef.current = null;
      setDualRunning(false);
    }
  }, [activeChat, settings]);

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
      isDream: chatVars['世界']?.['梦境定位']?.['位于梦境'] ?? false,
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
  };
}

// ── Type export for Context ──

export type SillytavernContextType = ReturnType<typeof useSillytavern>;
