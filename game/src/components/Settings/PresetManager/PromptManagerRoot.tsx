import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle, Plus, Upload } from 'lucide-react';
import type { AppSettings, PresetBlock, PresetParams, SavedPreset } from '../../../sillytavern/types';
import { DEFAULT_PRESET_PARAMS } from '../../../sillytavern/types';
import { importPresetFromJson } from '../../../sillytavern/presetImporter';
import type { PromptManagerProps } from './types';
import { newBlock } from './types';
import PresetSelector from './PresetSelector';
import PresetParamsCard from './PresetParamsCard';
import PromptBlockList from './PromptBlockList';
import PromptBlockPool from './PromptBlockPool';
import PromptEditDrawer from './PromptEditDrawer';
import QuickEditArea from './QuickEditArea';

export default function PromptManagerRoot({ draft, setDraft, onPersist }: PromptManagerProps) {
  const presets: SavedPreset[] = draft.presets ?? [];
  const [presetFilter, setPresetFilter] = useState<'story' | 'vars'>('story');
  const activeStoryId = draft.activePresetId;
  const activeVarsId = draft.activeVarsPresetId;
  const activeId = presetFilter === 'story' ? activeStoryId : activeVarsId;
  const activePreset = presets.find(p => p.id === activeId) ?? null;
  const blocks: PresetBlock[] = activePreset?.blocks ?? [];
  const params: PresetParams = activePreset?.params ?? draft.presetParams ?? DEFAULT_PRESET_PARAMS;

  const filteredPresets = presets.filter(p => p.type === presetFilter);

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const saveDraft = async (patch: Partial<AppSettings>) => {
    setDraft({ ...draft, ...patch });
    try { await onPersist(patch); } catch { showToast('保存失败', 'error'); }
  };

  // ── Preset ops ──

  const handleSelectPreset = (preset: SavedPreset) => {
    const isVars = preset.type === 'vars';
    const patch: Partial<AppSettings> = {};
    if (isVars) {
      patch.activeVarsPresetId = preset.id;
    } else {
      patch.activePresetId = preset.id;
      patch.presetBlocks = preset.blocks;
      patch.presetParams = preset.params ?? DEFAULT_PRESET_PARAMS;
    }
    saveDraft(patch);
    showToast(`${isVars ? '变量' : '剧情'}预设已切换为「${preset.name}」`, 'success');
  };

  const handleNewPreset = () => {
    const isVars = presetFilter === 'vars';
    const newPreset: SavedPreset = {
      id: crypto.randomUUID(),
      name: isVars ? '新变量预设' : '新剧情预设',
      source: 'manual',
      type: presetFilter,
      blocks: [{ ...newBlock(), name: isVars ? '变量指令' : '系统指令' }],
      params: { ...DEFAULT_PRESET_PARAMS },
      createdAt: Date.now(),
    };
    const nextPresets = [...presets, newPreset];
    saveDraft({
      presets: nextPresets,
      ...(isVars
        ? { activeVarsPresetId: newPreset.id }
        : {
            activePresetId: newPreset.id,
            presetBlocks: newPreset.blocks,
            presetParams: newPreset.params,
          }
      ),
    });
  };

  const handleDeletePreset = (id: string) => {
    if (presets.length <= 1) { showToast('请至少保留一个预设', 'error'); return; }
    const deleted = presets.find(p => p.id === id);
    const isVars = deleted?.type === 'vars';
    const nextPresets = presets.filter(p => p.id !== id);

    if (isVars) {
      // 删除变量预设：下一个同类型预设自动激活
      const nextVars = nextPresets.filter(p => p.type === 'vars')[0];
      saveDraft({
        presets: nextPresets,
        ...(nextVars ? { activeVarsPresetId: nextVars.id } : {}),
      });
    } else {
      const nextActiveId = id === activeId ? (nextPresets.filter(p => p.type === 'story')[0]?.id ?? nextPresets[0]?.id) : activeId;
      const newActive = nextPresets.find(p => p.id === nextActiveId);
      saveDraft({
        presets: nextPresets,
        activePresetId: nextActiveId,
        presetBlocks: newActive?.blocks ?? [],
        presetParams: newActive?.params ?? DEFAULT_PRESET_PARAMS,
      });
    }
  };

  const handleRenamePreset = (id: string, name: string) => {
    const nextPresets = presets.map(p => p.id === id ? { ...p, name } : p);
    saveDraft({ presets: nextPresets });
  };

  const handleExportPreset = (preset: SavedPreset) => {
    const p = preset.params ?? DEFAULT_PRESET_PARAMS;
    const data: Record<string, any> = {
      name: preset.name,
      ...p,
      prompts: preset.blocks.map(b => ({
        identifier: b.identifier,
        name: b.name,
        role: b.role,
        enabled: b.enabled,
        content: b.content,
        system_prompt: b.role === 'system',
        marker: b.marker ?? false,
        forbid_overrides: b.forbid_overrides ?? false,
        injection_position: b.injection_position,
        injection_trigger: b.injection_trigger,
      })),
      prompt_order: [{
        character_id: 100001,
        order: preset.blocks.map(b => ({ identifier: b.identifier, enabled: b.enabled })),
      }],
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${preset.name}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`已导出「${preset.name}」`, 'success');
  };

  const handleImportPreset = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const result = importPresetFromJson(raw);
      if (result.blocks.length === 0) {
        showToast('未识别到任何预设词块', 'error');
        return;
      }
      const isVarsImport = presetFilter === 'vars';
      // 类型特有过滤
      const filteredBlocks = result.blocks.filter(b => {
        // SPresetSettings 对任何类型都无用（ST正则扩展配置）
        if (b.identifier === 'SPresetSettings') return false;
        // 变量预设：排除ST内部结构块（marker块和system_prompt占位块）
        if (isVarsImport) {
          if (b.marker) return false;
          if (['nsfw', 'jailbreak', 'enhanceDefinitions'].includes(b.identifier)) return false;
        }
        return true;
      });
      const newPreset: SavedPreset = {
        id: crypto.randomUUID(),
        name: result.name || file.name.replace(/\.json$/i, ''),
        source: result.source,
        description: result.description,
        type: presetFilter,
        blocks: filteredBlocks.map(b => ({ ...b, identifier: crypto.randomUUID() })),
        params: result.params,
        createdAt: Date.now(),
      };
      const nextPresets = [...presets, newPreset];
      const isVars = newPreset.type === 'vars';
      saveDraft({
        presets: nextPresets,
        ...(isVars
          ? {
              activeVarsPresetId: newPreset.id,
              activePresetId: draft.activePresetId,
            }
          : {
              activePresetId: newPreset.id,
              presetBlocks: newPreset.blocks,
              presetParams: newPreset.params ?? DEFAULT_PRESET_PARAMS,
            }
        ),
      });
      const skipped = result.blocks.length - filteredBlocks.length;
      showToast(`已导入「${newPreset.name}」: ${filteredBlocks.length} 个词块${skipped > 0 ? `（已跳过${skipped}个内部块）` : ''}`, 'success');
    } catch (err: any) {
      showToast(`导入失败: ${err?.message || '无法解析'}`, 'error');
    }
    try { e.target.value = ''; } catch { /* ignore */ }
  }, [presets, presetFilter, showToast]);

  // ── Block ops ──

  const updateActiveBlocks = (next: PresetBlock[]) => {
    const nextPresets = presets.map(p => p.id === activeId ? { ...p, blocks: next } : p);
    saveDraft({ presets: nextPresets, presetBlocks: next });
  };

  const handleReorder = (next: PresetBlock[]) => updateActiveBlocks(next);

  const handleToggle = (id: string, enabled: boolean) => {
    updateActiveBlocks(blocks.map(b => b.identifier === id ? { ...b, enabled } : b));
  };

  const handleEditBlock = (id: string) => setEditingBlockId(id);

  const handleSaveBlock = (patch: Partial<PresetBlock>) => {
    if (!editingBlockId) return;
    updateActiveBlocks(blocks.map(b => b.identifier === editingBlockId ? { ...b, ...patch } : b));
  };

  const handleRemoveBlock = (id: string) => {
    updateActiveBlocks(blocks.filter(b => b.identifier !== id));
  };

  const handleNewBlock = () => {
    const b = newBlock();
    updateActiveBlocks([...blocks, b]);
    setEditingBlockId(b.identifier);
  };

  const handleQuickUpdate = (id: string, patch: Partial<PresetBlock>) => {
    updateActiveBlocks(blocks.map(b => b.identifier === id ? { ...b, ...patch } : b));
  };

  const handleImportBlocks = (impBlocks: PresetBlock[], impParams?: PresetParams, name?: string) => {
    // Merge: blocks with same identifier get overwritten, new ones appended
    const existingIds = new Set(blocks.map(b => b.identifier));
    const merged = [
      ...blocks.map(b => {
        const match = impBlocks.find(ib => ib.identifier === b.identifier);
        return match ? { ...b, ...match, identifier: b.identifier } : b;
      }),
      ...impBlocks.filter(ib => !existingIds.has(ib.identifier)).map(b => ({ ...b, identifier: crypto.randomUUID() })),
    ];
    updateActiveBlocks(merged);
    if (impParams) {
      const nextPresets = presets.map(p => p.id === activeId ? { ...p, params: { ...p.params, ...impParams } } : p);
      setDraft({ ...draft, presets: nextPresets });
    }
  };

  const handleResetOrder = () => {
    updateActiveBlocks([...blocks]);
    showToast('顺序未变更（当前无默认顺序基准）', 'error');
  };

  const fileRef = React.useRef<HTMLInputElement>(null);
  const editingBlock = blocks.find(b => b.identifier === editingBlockId) ?? null;

  return (
    <div className="p-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Type filter tabs */}
        <div className="flex items-center gap-1 mr-2">
          {(['story', 'vars'] as const).map(t => (
            <button
              key={t}
              onClick={() => setPresetFilter(t)}
              className={`px-3 py-1.5 text-[11px] font-display tracking-wide transition-all border ${
                presetFilter === t
                  ? t === 'vars'
                    ? 'border-amber-400/40 bg-amber-400/8 text-amber-300'
                    : 'border-aether-cyan/40 bg-aether-cyan/8 text-aether-cyan'
                  : 'border-white/8 text-white/25 hover:text-white/45 hover:border-white/15'
              }`}
            >
              {t === 'vars' ? '变量预设' : '剧情预设'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 cursor-pointer transition-all font-display">
          <Upload size={13} /> 导入预设
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportPreset} />
        </label>
        <button onClick={handleNewPreset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 transition-all font-display">
          <Plus size={13} /> 新建预设
        </button>
        {/* 当前激活的预设名 */}
        <span className="text-[10px] font-display tracking-wide ml-auto flex items-center gap-3">
          <span className="text-white/20">剧情:</span>
          <span className={activeStoryId ? 'text-aether-cyan/50' : 'text-white/15'}>
            {presets.find(p => p.id === activeStoryId)?.name ?? '无'}
          </span>
          <span className="text-white/10">|</span>
          <span className="text-white/20">变量:</span>
          <span className={activeVarsId ? 'text-amber-300/50' : 'text-white/15'}>
            {presets.find(p => p.id === activeVarsId)?.name ?? '无'}
          </span>
        </span>
      </div>

      {/* Preset list */}
      <PresetSelector
        presets={filteredPresets}
        activeId={activeId}
        onSelect={handleSelectPreset}
        onNew={handleNewPreset}
        onDelete={handleDeletePreset}
        onRename={handleRenamePreset}
        onExport={handleExportPreset}
        onImport={() => {}}
      />

      {/* Active preset content */}
      {!activePreset ? (
        <div className="flex flex-col items-center justify-center py-14 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
          <p className="text-white/15 text-xs font-display tracking-wide mb-1">请选择一个预设</p>
          <p className="text-white/8 text-[10px]">点击预设左侧圆圈选中，或导入/新建一个预设</p>
        </div>
      ) : (
        <>
          <PresetParamsCard params={params} onChange={patch => {
            const merged = { ...params, ...patch };
            const nextPresets = presets.map(p => p.id === activeId ? { ...p, params: merged } : p);
            saveDraft({ presets: nextPresets, presetParams: merged });
          }} />

          {/* Blocks */}
          <PromptBlockList
            blocks={blocks}
            onReorder={handleReorder}
            onToggle={handleToggle}
            onEdit={handleEditBlock}
            onRemove={handleRemoveBlock}
            editingId={editingBlockId}
          />

          <QuickEditArea blocks={blocks} onUpdate={handleQuickUpdate} />

          <PromptBlockPool
            blocks={blocks}
            onNew={handleNewBlock}
            onImport={(impBlocks, impParams, name) => handleImportBlocks(impBlocks, impParams, name)}
            onExport={() => activePreset && handleExportPreset(activePreset)}
            onResetOrder={handleResetOrder}
            onToast={showToast}
          />
        </>
      )}

      {/* Edit drawer */}
      <PromptEditDrawer
        block={editingBlock}
        open={editingBlockId !== null}
        onClose={() => setEditingBlockId(null)}
        onSave={handleSaveBlock}
      />

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
