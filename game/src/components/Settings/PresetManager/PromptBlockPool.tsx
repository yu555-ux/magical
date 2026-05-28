import React, { useRef } from 'react';
import { Plus, Upload, Download, Undo2 } from 'lucide-react';
import type { PresetBlock, PresetParams, SavedPreset } from '../../../sillytavern/types';
import { importPresetFromJson } from '../../../sillytavern/presetImporter';

interface Props {
  blocks: PresetBlock[];
  onNew: () => void;
  onImport: (blocks: PresetBlock[], params?: PresetParams, name?: string) => void;
  onExport: () => void;
  onResetOrder: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export default function PromptBlockPool({ blocks, onNew, onImport, onExport, onResetOrder, onToast }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const result = importPresetFromJson(raw);
      if (result.blocks.length === 0) {
        onToast('未识别到任何预设词块', 'error');
        return;
      }
      onImport(result.blocks, result.params, result.name || file.name.replace(/\.json$/i, ''));
      onToast(`已导入「${result.name || file.name}」: ${result.blocks.length} 个词块`, 'success');
    } catch (err: any) {
      onToast(`导入失败: ${err?.message || '无法解析'}`, 'error');
    }
    try { e.target.value = ''; } catch { /* ignore */ }
  };

  return (
    <div className="flex items-center gap-2 pt-3 border-t border-aether-border/8">
      {/* New */}
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide bg-aether-purple/15 border border-aether-purple/30 text-aether-purple hover:bg-aether-purple/25 transition-all font-display"
      >
        <Plus size={13} /> 新建词块
      </button>

      {/* Import */}
      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 cursor-pointer transition-all font-display">
        <Upload size={13} /> 导入词块
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
      </label>

      {/* Export */}
      <button
        onClick={onExport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 transition-all font-display"
        title="导出当前预设的所有词块"
      >
        <Download size={13} /> 导出
      </button>

      {/* Reset order */}
      <button
        onClick={onResetOrder}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 transition-all font-display ml-auto"
        title="恢复到默认顺序"
      >
        <Undo2 size={13} /> 重置顺序
      </button>

      {/* Block count */}
      {blocks.length > 0 && (
        <span className="text-[10px] text-white/15 font-mono shrink-0">{blocks.length} 个词块</span>
      )}
    </div>
  );
}
