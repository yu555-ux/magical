/**
 * Affection / friendliness / corruption stage definitions.
 * Decoupled from SocialPage so other components can reuse.
 */

export interface StageDef { min: number; max: number; name: string; color: string }

/* ===== Affection (female, -200~200, 50 per stage) ===== */
export const AFFECTION_STAGES: StageDef[] = [
  { min: -200, max: -150, name: '厌恶', color: '#ef4444' },
  { min: -150, max: -100, name: '敌视', color: '#f97316' },
  { min: -100, max: -50,  name: '冷淡', color: '#9ca3af' },
  { min: -50,  max: 0,    name: '平淡', color: '#eab308' },
  { min: 0,    max: 50,   name: '友善', color: '#22c55e' },
  { min: 50,   max: 100,  name: '亲密', color: '#3b82f6' },
  { min: 100,  max: 150,  name: '倾心', color: '#a78bfa' },
  { min: 150,  max: 200,  name: '挚爱', color: '#f472b6' },
];

/* ===== Friendliness (male, -200~200, 50 per stage) ===== */
export const FRIENDLINESS_STAGES: StageDef[] = [
  { min: -200, max: -150, name: '敌视', color: '#ef4444' },
  { min: -150, max: -100, name: '厌恶', color: '#f97316' },
  { min: -100, max: -50,  name: '疏远', color: '#9ca3af' },
  { min: -50,  max: 0,    name: '平淡', color: '#eab308' },
  { min: 0,    max: 50,   name: '友善', color: '#22c55e' },
  { min: 50,   max: 100,  name: '信任', color: '#3b82f6' },
  { min: 100,  max: 150,  name: '知己', color: '#a78bfa' },
  { min: 150,  max: 200,  name: '生死之交', color: '#f472b6' },
];

/* ===== Corruption (female, 0~500, 100 per stage) ===== */
export const CORRUPTION_STAGES: StageDef[] = [
  { min: 0,   max: 100, name: '纯洁', color: '#22c55e' },
  { min: 100, max: 200, name: '动摇', color: '#eab308' },
  { min: 200, max: 300, name: '微骚', color: '#f97316' },
  { min: 300, max: 400, name: '淫靡', color: '#ef4444' },
  { min: 400, max: 500, name: '欲奴', color: '#a855f7' },
];

/* ===== Helpers ===== */

export function getAffectionStage(v: number): StageDef {
  return AFFECTION_STAGES.find((s) => v >= s.min && v <= s.max) ?? AFFECTION_STAGES[3];
}

export function getFriendlinessStage(v: number): StageDef {
  return FRIENDLINESS_STAGES.find((s) => v >= s.min && v <= s.max) ?? FRIENDLINESS_STAGES[3];
}

export function getCorruptionStage(v: number): StageDef {
  return CORRUPTION_STAGES.find((s) => v >= s.min && v <= s.max) ?? CORRUPTION_STAGES[0];
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
