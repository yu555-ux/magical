/**
 * 生理 tick 订阅者
 * 监听 time_changed 事件，自动运行生殖系统模拟
 */

import { gameBus } from '../event-bus';
import { tickAllFemales, tickAges, type FertilizationResult } from '../physiology';

let lastEmittedFertilization: FertilizationResult[] = [];

/** 注册生理 tick 订阅者。在应用初始化时调用一次 */
export function initPhysiologySubscriber() {
  gameBus.on('time_changed', ({ oldRealTime, newRealTime, oldDreamTime, newDreamTime, vars, preVars }) => {
    lastEmittedFertilization = [];

    if (newRealTime && newRealTime !== oldRealTime) {
      tickAges(vars, oldRealTime, newRealTime);
      lastEmittedFertilization.push(
        ...tickAllFemales(vars, oldRealTime, newRealTime, { dreamOnly: false, prevVariables: preVars }),
      );
    }

    if (newDreamTime && newDreamTime !== oldDreamTime) {
      lastEmittedFertilization.push(
        ...tickAllFemales(vars, oldDreamTime, newDreamTime, { dreamOnly: true, prevVariables: preVars }),
      );
    }
  });
}

/** 获取最近一次生理 tick 产生的受孕事件 */
export function getLastFertilizationEvents(): FertilizationResult[] {
  return lastEmittedFertilization;
}

/** 清除缓存的受孕事件 */
export function clearFertilizationEvents() {
  lastEmittedFertilization = [];
}
