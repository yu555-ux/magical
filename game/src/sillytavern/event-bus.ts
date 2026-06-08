/**
 * 游戏事件总线 — 轻量发布/订阅
 *
 * 把「发生了一件事」和「这件事发生后要做什么」分开。
 * sendGameMessage 只管发消息+收回复，副作用由订阅者独立处理。
 *
 * 用法:
 *   import { gameBus } from './event-bus';
 *   gameBus.on('time_changed', ({ oldTime, newTime }) => { ... });
 *   gameBus.emit('time_changed', { oldTime: '...', newTime: '...' });
 */

// ── 事件类型定义 ──

import type { ChatSession, ChatMessage, VarChange, HistoryTimeline, ParsedTags } from './types';
import type { FertilizationResult } from './physiology';

export interface MessageReceivedEvent {
  rawContent: string;
  parsed: ParsedTags;
  preVars: Record<string, any>;
  chat: ChatSession;
  userName: string;
}

export interface VarsAppliedEvent {
  preVars: Record<string, any>;
  postVars: Record<string, any>;
  varChanges?: VarChange[];
}

export interface TimeChangedEvent {
  oldRealTime: string | null;
  newRealTime: string | null;
  oldDreamTime: string | null;
  newDreamTime: string | null;
  /** 变量树引用（订阅者会直接修改它来应用生理变化） */
  vars: Record<string, any>;
  preVars: Record<string, any>;
}

export interface TurnCompleteEvent {
  chat: ChatSession;
  preVars: Record<string, any>;
  postVars: Record<string, any>;
  varChanges?: VarChange[];
  fertilizationEvents: FertilizationResult[];
}

export interface GameEvents {
  message_received: MessageReceivedEvent;
  vars_applied: VarsAppliedEvent;
  time_changed: TimeChangedEvent;
  turn_complete: TurnCompleteEvent;
}

// ── 事件总线实现 ──

type EventHandler<T> = (payload: T) => void | Promise<void>;

class GameEventBus {
  private handlers = new Map<string, EventHandler<any>[]>();

  /** 订阅事件。返回取消订阅函数 */
  on<K extends keyof GameEvents>(event: K, handler: EventHandler<GameEvents[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: EventHandler<GameEvents[K]>) {
    const list = this.handlers.get(event);
    if (list) this.handlers.set(event, list.filter(h => h !== handler));
  }

  /** 发布事件。按注册顺序串行执行所有订阅者 */
  async emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]) {
    for (const h of (this.handlers.get(event) ?? [])) {
      await h(payload);
    }
  }
}

export const gameBus = new GameEventBus();
