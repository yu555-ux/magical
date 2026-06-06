import { Diamond, Skull, Package } from 'lucide-react';

/* ===== Types ===== */
export interface CharacterCard {
  name: string; group: string; category: string; profile: any;
}

/* ===== Group labels ===== */
export const GROUP_LABELS: Record<string, string> = {
  '女性-异人': '女性 · 异人',
  '女性-普通人': '女性 · 普通人',
  '男性-异人': '男性 · 异人',
  '男性-普通人': '男性 · 普通人',
};

/* ===== Rating styles ===== */
export const RATING_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
  '灭世': { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10' },
  '夷地': { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10' },
  '覆国': { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10' },
  '摧城': { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10' },
  '撼山': { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10' },
  '磐岩': { text: 'text-yellow-400',border: 'border-yellow-400/50',glow: 'shadow-[0_0_11px_rgba(250,204,21,0.35)]',bg: 'bg-yellow-400/10' },
  '凝石': { text: 'text-green-400', border: 'border-green-400/50', glow: 'shadow-[0_0_10px_rgba(74,222,128,0.3)]', bg: 'bg-green-400/10' },
  '聚砂': { text: 'text-purple-400',border: 'border-purple-400/50',glow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)]',bg: 'bg-purple-400/10' },
  '微尘': { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10' },
};

export const ITEM_RANK_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
  '灭世': { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10' },
  '绝域': { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10' },
  '倾国': { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10' },
  '祸城': { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10' },
  '凶煞': { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10' },
  '微末': { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10' },
};

export const CATEGORY_META: Record<string, { label: string; Icon: typeof Diamond }> = {
  '灵宝': { label: '灵宝', Icon: Diamond },
  '诡物': { label: '诡物', Icon: Skull },
  '物品': { label: '物品', Icon: Package },
};

/* ===== Proficiency helpers ===== */
export const PROFICIENCY_STAGES = ['初窥', '粗浅', '掌握', '熟练', '小成', '入门', '精进', '深谙', '登峰', '造极'];
export const getStage = (proficiency: number) => PROFICIENCY_STAGES[Math.min(Math.floor(proficiency / 100), 9)];

export const PROFICIENCY_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
  '初窥': { text: 'text-gray-400',   border: 'border-gray-400/40',   glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',   bg: 'bg-gray-400/10' },
  '粗浅': { text: 'text-stone-400',  border: 'border-stone-400/45',  glow: 'shadow-[0_0_9px_rgba(168,162,158,0.25)]',  bg: 'bg-stone-400/10' },
  '掌握': { text: 'text-teal-400',   border: 'border-teal-400/45',   glow: 'shadow-[0_0_10px_rgba(45,212,191,0.3)]',   bg: 'bg-teal-400/10' },
  '熟练': { text: 'text-cyan-400',   border: 'border-cyan-400/45',   glow: 'shadow-[0_0_10px_rgba(34,211,238,0.3)]',   bg: 'bg-cyan-400/10' },
  '小成': { text: 'text-sky-400',    border: 'border-sky-400/50',    glow: 'shadow-[0_0_11px_rgba(56,189,248,0.35)]',  bg: 'bg-sky-400/10' },
  '入门': { text: 'text-blue-400',   border: 'border-blue-400/50',   glow: 'shadow-[0_0_12px_rgba(96,165,250,0.35)]',  bg: 'bg-blue-400/10' },
  '精进': { text: 'text-indigo-400', border: 'border-indigo-400/50', glow: 'shadow-[0_0_13px_rgba(129,140,248,0.4)]',bg: 'bg-indigo-400/10' },
  '深谙': { text: 'text-purple-400', border: 'border-purple-400/50', glow: 'shadow-[0_0_14px_rgba(168,85,247,0.4)]', bg: 'bg-purple-400/10' },
  '登峰': { text: 'text-amber-300',  border: 'border-amber-400/50',  glow: 'shadow-[0_0_15px_rgba(251,191,36,0.45)]', bg: 'bg-amber-400/10' },
  '造极': { text: 'text-orange-400', border: 'border-orange-400/50', glow: 'shadow-[0_0_16px_rgba(251,146,60,0.5)]', bg: 'bg-orange-400/10' },
};
