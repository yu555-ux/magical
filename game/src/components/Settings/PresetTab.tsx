import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Upload, AlertTriangle, CheckCircle, Settings2, Circle, CheckCircle2, Pencil, X } from 'lucide-react';
import type { AppSettings, PresetBlock, PresetParams, SavedPreset } from '../../sillytavern/types';
import { DEFAULT_PRESET_PARAMS } from '../../sillytavern/types';
import { importPresetFromJson } from '../../sillytavern/chaoxiAdapter';
import type { ImportResult } from '../../sillytavern/chaoxiAdapter';
import { saveSettings } from '../../sillytavern/database';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
}

function newBlock(): PresetBlock {
  return {
    identifier: crypto.randomUUID(),
    name: '新预设块',
    role: 'system',
    enabled: true,
    content: '',
  };
}

const ROLE_COLORS: Record<string, string> = {
  system: 'bg-aether-cyan/10 text-aether-cyan/45 border-aether-cyan/20',
  user: 'bg-aether-green/10 text-aether-green/45 border-aether-green/20',
  assistant: 'bg-aether-blue/10 text-aether-blue/45 border-aether-blue/20',
};

export default function PresetTab({ draft, setDraft }: Props) {
  const presets: SavedPreset[] = draft.presets ?? [];
  const activeId = draft.activePresetId;
  const activePreset = presets.find(p => p.id === activeId) ?? null;
  const blocks: PresetBlock[] = activePreset?.blocks ?? [];
  const params: PresetParams = activePreset?.params ?? draft.presetParams ?? DEFAULT_PRESET_PARAMS;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [paramsExpanded, setParamsExpanded] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const saveDraft = async (patch: Partial<AppSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    try { await saveSettings(next); } catch { showToast('保存失败', 'error'); }
  };

  // ── Preset list ops ──

  const selectPreset = (preset: SavedPreset) => {
    saveDraft({
      activePresetId: preset.id,
      presetBlocks: preset.blocks,
      presetParams: preset.params ?? DEFAULT_PRESET_PARAMS,
    });
  };

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const result = importPresetFromJson(raw);
      if (result.blocks.length === 0) {
        showToast('未识别到任何预设词块', 'error');
        return;
      }
      const newPreset: SavedPreset = {
        id: crypto.randomUUID(),
        name: result.name || file.name.replace(/\.json$/i, ''),
        source: result.source,
        description: result.description,
        blocks: result.blocks.map(b => ({ ...b, identifier: crypto.randomUUID() })),
        params: result.params,
        createdAt: Date.now(),
      };
      const nextPresets = [...presets, newPreset];
      saveDraft({
        presets: nextPresets,
        activePresetId: newPreset.id,
        presetBlocks: newPreset.blocks,
        presetParams: newPreset.params ?? DEFAULT_PRESET_PARAMS,
      });
      showToast(`已导入「${newPreset.name}」: ${newPreset.blocks.length} 个词块`, 'success');
    } catch (err: any) {
      showToast(`导入失败: ${err?.message || '无法解析'}`, 'error');
    }
    try { e.target.value = ''; } catch { /* ignore */ }
  }, [presets, showToast]);

  const handleNewPreset = () => {
    const newPreset: SavedPreset = {
      id: crypto.randomUUID(),
      name: '新预设',
      source: 'manual',
      blocks: [{
        identifier: crypto.randomUUID(),
        name: '系统指令',
        role: 'system',
        enabled: true,
        content: '',
      }],
      params: { ...DEFAULT_PRESET_PARAMS },
      createdAt: Date.now(),
    };
    const nextPresets = [...presets, newPreset];
    saveDraft({
      presets: nextPresets,
      activePresetId: newPreset.id,
      presetBlocks: newPreset.blocks,
      presetParams: newPreset.params,
    });
  };

  const deletePreset = (id: string) => {
    if (presets.length <= 1) { showToast('请至少保留一个预设', 'error'); return; }
    const nextPresets = presets.filter(p => p.id !== id);
    const nextActiveId = id === activeId ? nextPresets[0].id : activeId;
    const newActive = nextPresets.find(p => p.id === nextActiveId);
    saveDraft({
      presets: nextPresets,
      activePresetId: nextActiveId,
      presetBlocks: newActive?.blocks ?? [],
      presetParams: newActive?.params ?? DEFAULT_PRESET_PARAMS,
    });
  };

  const startRename = (preset: SavedPreset) => {
    setEditingPresetId(preset.id);
    setPresetNameDraft(preset.name);
  };

  const commitRename = (id: string) => {
    const trimmed = presetNameDraft.trim();
    if (trimmed) {
      const nextPresets = presets.map(p => p.id === id ? { ...p, name: trimmed } : p);
      setDraft({ ...draft, presets: nextPresets });
      saveSettings({ ...draft, presets: nextPresets });
    }
    setEditingPresetId(null);
  };

  // ── Block editing ops (on active preset) ──

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const updateActiveBlocks = (next: PresetBlock[]) => {
    const nextPresets = presets.map(p => p.id === activeId ? { ...p, blocks: next } : p);
    setDraft({ ...draft, presets: nextPresets, presetBlocks: next });
    saveSettings({ ...draft, presets: nextPresets, presetBlocks: next });
  };

  const updateBlock = (index: number, patch: Partial<PresetBlock>) => {
    const next = [...blocks];
    next[index] = { ...next[index], ...patch };
    updateActiveBlocks(next);
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    updateActiveBlocks(next);
  };

  const removeBlock = (index: number) => {
    updateActiveBlocks(blocks.filter((_, i) => i !== index));
  };

  const addBlock = () => {
    const b = newBlock();
    updateActiveBlocks([...blocks, b]);
    setExpandedIds(prev => { const s = new Set(prev); s.add(b.identifier); return s; });
  };

  const updateParams = (patch: Partial<PresetParams>) => {
    const merged = { ...params, ...patch };
    const nextPresets = presets.map(p => p.id === activeId ? { ...p, params: merged } : p);
    setDraft({ ...draft, presets: nextPresets, presetParams: merged });
    saveSettings({ ...draft, presets: nextPresets, presetParams: merged });
  };

  return (
    <div className="p-5">
      <section>
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 cursor-pointer transition-all font-display">
            <Upload size={13} /> 导入预设
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleNewPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 transition-all font-display">
            <Plus size={13} /> 新建预设
          </button>
          <span className="text-[10px] text-white/15 font-mono ml-auto">
            {presets.length} 个预设，当前使用: <span className="text-aether-purple/40">{activePreset?.name ?? '无'}</span>
          </span>
        </div>

        {/* ── Preset list ── */}
        <div className="space-y-1 mb-4">
          {presets.map(preset => {
            const isActive = preset.id === activeId;
            const isEditing = editingPresetId === preset.id;
            return (
              <div key={preset.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                  isActive ? 'border-aether-purple/30 bg-aether-purple/[0.04]' : 'border-aether-border/10 bg-aether-dark/20'
                }`}>
                {/* Radio selection */}
                <button onClick={() => selectPreset(preset)}
                  className="shrink-0 text-lg transition-colors"
                  title="选择此预设">
                  {isActive ? (
                    <CheckCircle2 size={16} className="text-aether-purple/60" />
                  ) : (
                    <Circle size={16} className="text-white/15 hover:text-aether-purple/40" />
                  )}
                </button>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input type="text" value={presetNameDraft}
                      onChange={e => setPresetNameDraft(e.target.value)}
                      onBlur={() => commitRename(preset.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(preset.id); if (e.key === 'Escape') setEditingPresetId(null); }}
                      className="w-full bg-aether-dark/50 border border-aether-purple/30 rounded px-2 py-0.5 text-xs text-white/70 font-display focus:outline-none focus:border-aether-purple/50" />
                  ) : (
                    <span className="text-xs font-display text-white/60 truncate block">{preset.name}</span>
                  )}
                </div>

                {/* Info */}
                <span className="text-[9px] text-white/15 font-mono shrink-0 hidden sm:inline">
                  {preset.blocks.length} 块 {preset.source ? `· ${preset.source}` : ''}
                </span>

                {/* Rename */}
                <button onClick={() => startRename(preset)}
                  className="text-white/12 hover:text-aether-purple/50 transition-colors p-0.5"
                  title="重命名">
                  <Pencil size={11} />
                </button>

                {/* Delete */}
                <button onClick={() => deletePreset(preset.id)}
                  className="text-white/10 hover:text-aether-red/50 transition-colors p-0.5"
                  title="删除预设">
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {!activePreset ? (
          <div className="flex flex-col items-center justify-center py-14 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
            <p className="text-white/15 text-xs font-display tracking-wide mb-1">请选择一个预设</p>
            <p className="text-white/8 text-[10px]">点击预设左侧圆圈选中，或导入/新建一个预设</p>
          </div>
        ) : (
          <>
            {/* ── Preset Parameters Card ── */}
            <div className={`rounded-lg border mb-3 overflow-hidden transition-all ${
              paramsExpanded ? 'border-aether-purple/20 bg-aether-dark/30' : 'border-aether-border/10 bg-aether-dark/20'
            }`}>
              <button onClick={() => setParamsExpanded(!paramsExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-aether-purple/[0.03] transition-colors">
                <Settings2 size={14} className="text-aether-purple/40 shrink-0" />
                <span className="text-xs font-display font-medium text-white/55">预设参数</span>
                <span className="text-[9px] text-white/15 ml-auto">{paramsExpanded ? '▴ 收起' : '▾ 展开'}</span>
              </button>
              <AnimatePresence initial={false}>
                {paramsExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }} className="overflow-hidden border-t border-aether-border/8">
                    <div className="px-3 py-3 space-y-3">
                      <div>
                        <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">采样参数</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                          <NumberField label="温度" value={params.temperature} onChange={v => updateParams({ temperature: v })} step={0.1} min={0} max={2} />
                          <NumberField label="Top P" value={params.top_p} onChange={v => updateParams({ top_p: v })} step={0.05} min={0} max={1} />
                          <NumberField label="Top K" value={params.top_k} onChange={v => updateParams({ top_k: v })} min={0} max={1000} />
                          <NumberField label="Top A" value={params.top_a} onChange={v => updateParams({ top_a: v })} step={0.05} min={0} max={1} />
                          <NumberField label="Min P" value={params.min_p} onChange={v => updateParams({ min_p: v })} step={0.05} min={0} max={1} />
                          <NumberField label="频率惩罚" value={params.frequency_penalty} onChange={v => updateParams({ frequency_penalty: v })} step={0.1} min={-2} max={2} />
                          <NumberField label="存在惩罚" value={params.presence_penalty} onChange={v => updateParams({ presence_penalty: v })} step={0.1} min={-2} max={2} />
                          <NumberField label="重复惩罚" value={params.repetition_penalty} onChange={v => updateParams({ repetition_penalty: v })} step={0.1} min={1} max={2} />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">上下文</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                          <NumberField label="最大上下文" value={params.openai_max_context} onChange={v => updateParams({ openai_max_context: v })} min={1000} max={4000000} />
                          <NumberField label="最大输出Token" value={params.openai_max_tokens} onChange={v => updateParams({ openai_max_tokens: v })} min={256} max={128000} />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">选项</span>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <CheckField label="流式输出" checked={params.stream_openai} onChange={v => updateParams({ stream_openai: v })} />
                          <CheckField label="引号包裹" checked={params.wrap_in_quotes} onChange={v => updateParams({ wrap_in_quotes: v })} />
                          <CheckField label="解锁上下文" checked={params.max_context_unlocked} onChange={v => updateParams({ max_context_unlocked: v })} />
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-white/20">名字行为</span>
                            <input type="number" value={params.names_behavior}
                              onChange={e => updateParams({ names_behavior: Number(e.target.value) })}
                              className="w-14 bg-aether-dark/60 border border-aether-border/25 rounded px-1.5 py-0.5 text-[10px] text-white/55 focus:outline-none focus:border-aether-purple/50 transition-all" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Blocks toolbar ── */}
            <div className="flex items-center gap-2 mb-3">
              <button onClick={addBlock}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide bg-aether-purple/15 border border-aether-purple/30 text-aether-purple hover:bg-aether-purple/25 transition-all font-display">
                <Plus size={13} /> 新建词块
              </button>
              {blocks.length > 0 && (
                <span className="text-[10px] text-white/15 font-mono">{blocks.length} 个词块</span>
              )}
            </div>

            {/* ── Block list ── */}
            <div className="space-y-1">
              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
                  <p className="text-white/15 text-xs font-display tracking-wide mb-1">暂无预设词块</p>
                  <p className="text-white/8 text-[10px]">点击「新建词块」来创建提示词段落</p>
                </div>
              ) : (
                blocks.map((block, index) => {
                  const enabled = block.enabled;
                  const isExpanded = expandedIds.has(block.identifier);
                  return (
                    <div key={block.identifier}
                      className={`rounded border transition-all ${enabled ? 'border-aether-border/12 bg-aether-dark/30' : 'border-aether-border/6 bg-aether-dark/15 opacity-55'}`}>
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <input type="checkbox" checked={enabled}
                          onChange={e => updateBlock(index, { enabled: e.target.checked })}
                          className="accent-aether-purple shrink-0 h-3.5 w-3.5" />
                        <button onClick={() => enabled && toggleExpanded(block.identifier)} disabled={!enabled}
                          className={`flex-1 text-left flex items-center gap-1 min-w-0 ${enabled ? 'cursor-pointer' : 'cursor-default'}`}>
                          <span className={`shrink-0 text-[9px] ${isExpanded && enabled ? 'text-white/30' : 'text-white/10'}`}>
                            {isExpanded && enabled ? '▾' : '▸'}
                          </span>
                          <span className={`text-[11px] leading-tight truncate ${enabled ? 'text-white/65' : 'text-white/25'}`}>
                            {block.name || '未命名'}
                          </span>
                        </button>
                        <span className={`text-[8px] px-1 py-0.5 rounded border font-mono uppercase shrink-0 ${ROLE_COLORS[block.role] || ROLE_COLORS.system}`}>{block.role}</span>
                        <button disabled={index === 0} onClick={() => moveBlock(index, -1)} className="text-[10px] text-white/12 hover:text-white/35 disabled:opacity-8 px-0.5 shrink-0" title="上移">↑</button>
                        <button disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} className="text-[10px] text-white/12 hover:text-white/35 disabled:opacity-8 px-0.5 shrink-0" title="下移">↓</button>
                        <button onClick={() => removeBlock(index)} className="text-[10px] text-white/10 hover:text-aether-red/50 transition-colors px-0.5 shrink-0" title="删除">✕</button>
                      </div>
                      <AnimatePresence initial={false}>
                        {enabled && isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }} className="overflow-hidden">
                            <div className="px-3 pb-3 border-t border-aether-border/6 pt-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <input type="text" value={block.name}
                                  onChange={e => updateBlock(index, { name: e.target.value })}
                                  placeholder="词块名称"
                                  className="flex-1 bg-aether-dark/50 border border-aether-border/25 rounded px-2 py-1 text-[11px] text-white/65 focus:outline-none focus:border-aether-purple/50 transition-all" />
                                <select value={block.role}
                                  onChange={e => updateBlock(index, { role: e.target.value as PresetBlock['role'] })}
                                  className="bg-aether-dark/50 border border-aether-border/25 rounded px-2 py-1 text-[11px] text-white/55 focus:outline-none focus:border-aether-purple/50 transition-all">
                                  <option value="system">system</option>
                                  <option value="user">user</option>
                                  <option value="assistant">assistant</option>
                                </select>
                              </div>
                              <textarea value={block.content}
                                onChange={e => updateBlock(index, { content: e.target.value })}
                                rows={6} placeholder="提示词内容..."
                                className="w-full bg-aether-dark/50 border border-aether-border/25 rounded px-3 py-2 text-[11px] text-white/65 placeholder:text-white/10 focus:outline-none focus:border-aether-purple/50 transition-all resize-none font-mono leading-relaxed" />
                              <p className="text-[9px] text-white/10">
                                宏: <code className="text-aether-cyan/25">{'{{user}}'}</code>{' '}
                                <code className="text-aether-cyan/25">{'{{char}}'}</code>{' '}
                                <code className="text-aether-cyan/25">{'{{original}}'}</code>{' '}
                                <code className="text-white/8">{'{{setvar::}} {{addvar::}} {{getvar::}} {{trim}}'}</code>
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium z-[200] ${
              toast.type === 'success' ? 'bg-aether-green/20 border border-aether-green/30 text-aether-green' : 'bg-aether-red/20 border border-aether-red/30 text-aether-red'
            }`}>
            {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1, min, max }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  return (
    <label className="flex items-center gap-2 bg-aether-dark/40 border border-aether-border/15 rounded px-2 py-1">
      <span className="text-[9px] text-white/20 shrink-0 font-mono">{label}</span>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        step={step} min={min} max={max}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-white/55 focus:outline-none text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
    </label>
  );
}

function CheckField({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="accent-aether-purple h-3 w-3 shrink-0" />
      <span className={`text-[9px] font-mono transition-colors ${checked ? 'text-white/40' : 'text-white/15'}`}>{label}</span>
    </label>
  );
}
