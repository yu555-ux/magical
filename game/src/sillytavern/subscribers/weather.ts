/**
 * 天气 tick 订阅者
 * 监听 time_changed 事件，自动轮换现实天气 + 重算梦境月相
 */

import { gameBus } from '../event-bus';
import { getDatePart } from '../physiology';
import { updateWeatherOnTimeTick } from '../weather';

/** 注册天气 tick 订阅者。在应用初始化时调用一次 */
export function initWeatherSubscriber() {
  gameBus.on('time_changed', ({ oldRealTime, newRealTime, oldDreamTime, newDreamTime, vars }) => {
    const oldRealDate = oldRealTime ? getDatePart(oldRealTime) : null;
    const newRealDate = newRealTime ? getDatePart(newRealTime) : null;
    const oldDreamDate = oldDreamTime ? getDatePart(oldDreamTime) : null;
    const newDreamDate = newDreamTime ? getDatePart(newDreamTime) : null;

    if (!newRealDate && !newDreamDate) return;

    const currentReality = vars?.['世界']?.['现实']?.['天气'] ?? '阴天';
    const currentDream = vars?.['世界']?.['梦境存档']?.['天气'] ?? '残月';

    const updated = updateWeatherOnTimeTick(
      oldRealDate,
      newRealDate ?? '',
      currentReality,
      currentDream,
      newDreamDate ?? '',
      oldDreamDate,
    );

    if (vars?.['世界']?.['现实']) {
      vars['世界']['现实']['天气'] = updated.reality;
    }
    if (vars?.['世界']?.['梦境存档']) {
      vars['世界']['梦境存档']['天气'] = updated.dream;
    }
  });
}
