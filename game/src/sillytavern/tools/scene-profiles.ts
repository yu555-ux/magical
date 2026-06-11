/**
 * 场景配置 — 定义每个场景下可见的变量工具。
 *
 * 查询工具（get_status, lookup_world, lookup_location）和基础机制工具（roll_dice, save_point）
 * 在所有场景始终可见，不在此处管理。本文件只管理变量工具（category: variable）的场景分配。
 *
 * 场景切换方式：LLM 调用 switch_scene("combat")，engine 自动过滤工具列表。
 */

/** 所有场景类型 */
export type SceneType = 'combat' | 'exploration' | 'social' | 'intimate' | 'dream';

/** 每个场景的变量工具白名单 */
export const SCENE_VARIABLE_TOOLS: Record<SceneType, string[]> = {
  combat: [
    'advance_time', 'change_weather', 'commit_turn',
    'update_resource', 'add_condition', 'remove_condition',
    'update_skill', 'add_item', 'remove_item',
  ],
  exploration: [
    'advance_time', 'change_weather', 'commit_turn',
    'change_location', 'update_map', 'update_npc_info',
    'add_item', 'remove_item', 'add_condition',
  ],
  social: [
    'advance_time', 'change_weather', 'commit_turn',
    'update_social', 'update_npc_info', 'update_outfit', 'update_resource',
  ],
  intimate: [
    'advance_time', 'change_weather', 'commit_turn',
    'update_body_development', 'update_outfit', 'update_social',
    'update_resource', 'add_condition', 'remove_condition',
  ],
  dream: [
    'advance_time', 'change_weather', 'commit_turn',
    'toggle_dream', 'change_location', 'update_map',
    'add_condition', 'remove_condition', 'update_resource',
  ],
};

/** 场景的中文标签 */
export const SCENE_LABELS: Record<SceneType, string> = {
  combat: '⚔️ 战斗',
  exploration: '🗺️ 探索',
  social: '💬 社交',
  intimate: '❤️ 亲密',
  dream: '🌙 梦境',
};

/** 所有场景类型列表（供 LLM 参考） */
export const SCENE_OPTIONS = Object.keys(SCENE_VARIABLE_TOOLS) as SceneType[];
