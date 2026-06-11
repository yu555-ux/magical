/**
 * 梦境锚点订阅者
 * 监听 vars_applied 事件，检测梦境/现实切换并更新锚点
 */

import { gameBus } from '../event-bus';
import { validateEquipment } from '../variables';
import type { DreamAnchor } from '../types';

let lastUpdatedAnchor: DreamAnchor | null = null;

/** 注册梦境锚点订阅者 */
export function initDreamAnchorSubscriber() {
  gameBus.on('vars_applied', ({ preVars, postVars }) => {
    const wasInDream = preVars?.['世界']?.['位于梦境'] === true;
    const nowInDream = postVars?.['世界']?.['位于梦境'] === true;

    if (wasInDream === nowInDream) {
      lastUpdatedAnchor = null;
      return;
    }

    // 梦境状态切换 → 自动卸下不适配位面的装备
    validateEquipment(postVars);

    const newAnchor: DreamAnchor = {};

    if (wasInDream && !nowInDream) {
      // 从梦境苏醒 → 记录现实时间
      newAnchor.lastWokeAt = postVars?.['世界']?.['现实']?.['时间'] ?? '';
    } else if (!wasInDream && nowInDream) {
      // 进入梦境 → 记录梦境时间
      newAnchor.lastEnteredAt = postVars?.['世界']?.['梦境存档']?.['时间'] ?? '';
    }

    lastUpdatedAnchor = newAnchor;
  });
}

/** 获取本轮更新的梦境锚点（无变化时返回 null） */
export function getUpdatedDreamAnchor(current: DreamAnchor): DreamAnchor | null {
  if (!lastUpdatedAnchor) return null;
  return { ...current, ...lastUpdatedAnchor };
}

/** 清除锚点缓存 */
export function clearDreamAnchor() {
  lastUpdatedAnchor = null;
}
