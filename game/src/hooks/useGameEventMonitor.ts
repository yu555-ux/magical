import { useEffect, useRef } from 'react';
import { getDatabase } from '../sillytavern/database';
import { getAffectionStage, type StageDef } from '../sillytavern/social-stages';
import { pushStatus } from '../components/StatusBell';

export interface ToastOptions {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  channel: 'variable' | 'story';
}

/**
 * Polls IndexedDB every 3s, diffs female character affection values,
 * and pushes story-log notifications to both the bell and (optionally) toast.
 *
 * Detects:
 *  - 好感值 numeric increase (every +1 or more)
 *  - 好感阶段 threshold crossing (e.g. 平淡→友善)
 */

interface CharSnapshot {
  name: string;
  affection: number;
  stage: string;
}

function collectFemaleChars(vars: Record<string, any> | undefined): CharSnapshot[] {
  if (!vars) return [];
  const chars = vars['主要人物'] ?? {};
  const result: CharSnapshot[] = [];
  for (const genderKey of ['女性-异人', '女性-普通人']) {
    const genderData = chars[genderKey];
    if (!genderData || typeof genderData !== 'object') continue;
    for (const [, members] of Object.entries(genderData as Record<string, any>)) {
      if (!members || typeof members !== 'object') continue;
      for (const [name, profile] of Object.entries(members as Record<string, any>)) {
        if (!profile || typeof profile !== 'object') continue;
        const aff = profile['好感值'];
        if (aff === undefined || aff === null) continue;
        const stage = getAffectionStage(aff).name;
        result.push({ name, affection: aff, stage });
      }
    }
  }
  return result;
}

let firstRun = true; // suppress notifications on initial load

export function useGameEventMonitor(addToast?: (opts: ToastOptions) => void) {
  const prevRef = useRef<Map<string, CharSnapshot>>(new Map());

  useEffect(() => {
    const db = getDatabase();

    const tick = async () => {
      try {
        const chats = await db.chats.toArray();
        const vars = chats[chats.length - 1]?.variables;
        const current = collectFemaleChars(vars);
        if (current.length === 0) return;

        const prev = prevRef.current;

        if (firstRun) {
          // Seed snapshot without firing notifications
          for (const c of current) prev.set(c.name, { ...c });
          firstRun = false;
          return;
        }

        for (const cur of current) {
          const old = prev.get(cur.name);
          if (!old) {
            // New character appeared
            prev.set(cur.name, { ...cur });
            continue;
          }

          // ── Affection value increased ──
          if (cur.affection > old.affection) {
            const diff = cur.affection - old.affection;
            const msg = `好感度 +${diff}  (${old.affection} → ${cur.affection})`;
            pushStatus({
              title: cur.name,
              message: msg,
              type: 'success',
              source: '好感变化',
              channel: 'story',
            });
            addToast?.({ message: `${cur.name}  ${msg}`, type: 'success', channel: 'story' });
          }

          // ── Stage changed (threshold crossed) ──
          if (cur.stage !== old.stage) {
            const msg = `好感阶段：${old.stage} → ${cur.stage}`;
            pushStatus({
              title: cur.name,
              message: msg,
              type: 'info',
              source: '阶段突破',
              channel: 'story',
            });
            addToast?.({ message: `${cur.name}  ${msg}`, type: 'info', channel: 'story' });
          }

          // Update snapshot
          prev.set(cur.name, { ...cur });
        }

        // Remove characters no longer in the world
        const currentNames = new Set(current.map((c) => c.name));
        for (const name of prev.keys()) {
          if (!currentNames.has(name)) prev.delete(name);
        }
      } catch {
        // DB not ready yet — silently skip
      }
    };

    tick(); // immediate first diff after seed
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, []);
}
