import type { VarsPatch, JsonPatchOp } from './types';

export function parseVarsBlock(raw: string): VarsPatch {
  const trimmed = raw.trim();
  if (!trimmed) return { merge: {} };

  // 1) New format: <JSONPatch>[...]</JSONPatch> (with optional <Analysis> before it)
  const jpMatch = trimmed.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/);
  if (jpMatch) {
    try {
      const parsed = JSON.parse(jpMatch[1]);
      if (Array.isArray(parsed)) {
        return { merge: {}, patches: parsed as JsonPatchOp[] };
      }
    } catch { /* fall through */ }
  }

  // 2) Legacy format: pure JSON (array → patches, object → deep merge)
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { merge: {}, patches: parsed as JsonPatchOp[] };
    }
    if (parsed && typeof parsed === 'object') {
      return { merge: parsed as Record<string, any> };
    }
  } catch { /* fall through */ }

  return { merge: {} };
}

export function applyVarsPatch(
  existing: Record<string, any>,
  patch: VarsPatch,
): Record<string, any> {
  return deepMerge(existing, patch.merge);
}

// ── JSON Patch (RFC 6902 + delta extension) ──

export function applyJsonPatch(
  existing: Record<string, any>,
  patches: JsonPatchOp[],
): Record<string, any> {
  const state = JSON.parse(JSON.stringify(existing));

  for (const op of patches) {
    switch (op.op) {
      case 'replace': patchReplace(state, op); break;
      case 'delta':   patchDelta(state, op);   break;
      case 'insert':  patchInsert(state, op);  break;
      case 'remove':  patchRemove(state, op);  break;
    }
  }

  return state;
}

function resolveParent(
  obj: Record<string, any>,
  path: string,
): { parent: any; key: string | number } | null {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  let current: any = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    if (current == null || typeof current !== 'object') return null;
    current = current[segments[i]];
  }

  if (current == null || typeof current !== 'object') return null;

  const lastSeg = segments[segments.length - 1];
  const key = lastSeg === '-' ? '-' : isNaN(Number(lastSeg)) ? lastSeg : Number(lastSeg);
  return { parent: current, key };
}

function patchReplace(state: Record<string, any>, op: JsonPatchOp): void {
  const r = resolveParent(state, op.path);
  if (!r) return;
  if (Array.isArray(r.parent) && typeof r.key === 'number') {
    r.parent[r.key] = op.value;
  } else if (!Array.isArray(r.parent)) {
    r.parent[r.key] = op.value;
  }
}

function patchDelta(state: Record<string, any>, op: JsonPatchOp): void {
  const r = resolveParent(state, op.path);
  if (!r) return;
  const current = r.parent[r.key];
  if (typeof current === 'number' && typeof op.value === 'number') {
    r.parent[r.key] = current + op.value;
  }
}

function patchInsert(state: Record<string, any>, op: JsonPatchOp): void {
  const r = resolveParent(state, op.path);
  if (!r) return;
  if (Array.isArray(r.parent) && r.key === '-') {
    r.parent.push(op.value);
  } else if (Array.isArray(r.parent) && typeof r.key === 'number') {
    r.parent.splice(r.key, 0, op.value);
  } else if (!Array.isArray(r.parent)) {
    r.parent[r.key] = op.value;
  }
}

function patchRemove(state: Record<string, any>, op: JsonPatchOp): void {
  const r = resolveParent(state, op.path);
  if (!r) return;
  if (Array.isArray(r.parent) && typeof r.key === 'number') {
    r.parent.splice(r.key, 1);
  } else if (!Array.isArray(r.parent)) {
    delete r.parent[r.key];
  }
}

// ── traditional deep merge (backward compatible) ──

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = out[key];
    if (Array.isArray(sv)) {
      out[key] = [...sv];
    } else if (sv && typeof sv === 'object' && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      out[key] = deepMerge(tv, sv);
    } else {
      out[key] = sv;
    }
  }
  return out;
}
