import React, { useState } from 'react';
import { Circle, CheckCircle2, Download, Pencil, X } from 'lucide-react';
import type { PresetSelectorProps } from './types';
import type { SavedPreset } from '../../../sillytavern/types';

export default function PresetSelector({
  presets, activeId, onSelect, onNew, onDelete, onRename, onExport,
}: PresetSelectorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const startRename = (preset: SavedPreset) => {
    setEditingId(preset.id);
    setNameDraft(preset.name);
  };

  const commitRename = (id: string) => {
    const trimmed = nameDraft.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  return (
    <div className="space-y-1 mb-4">
      {presets.map(preset => {
        const isActive = preset.id === activeId;
        const isEditing = editingId === preset.id;
        return (
          <div
            key={preset.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
              isActive
                ? 'border-aether-purple/30 bg-aether-purple/[0.04]'
                : 'border-aether-border/10 bg-aether-dark/20'
            }`}
          >
            {/* Select */}
            <button
              onClick={() => onSelect(preset)}
              className="shrink-0 transition-colors"
              title="选择此预设"
            >
              {isActive ? (
                <CheckCircle2 size={16} className="text-aether-purple/60" />
              ) : (
                <Circle size={16} className="text-white/15 hover:text-aether-purple/40" />
              )}
            </button>

            {/* Name */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text" value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={() => commitRename(preset.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(preset.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="w-full bg-aether-dark/50 border border-aether-purple/30 rounded px-2 py-0.5 text-xs text-white/70 font-display focus:outline-none focus:border-aether-purple/50"
                />
              ) : (
                <span className="text-xs font-display text-white/60 truncate block">{preset.name}</span>
              )}
            </div>

            {/* Type badge */}
            <span className={`text-[8px] px-1.5 py-0.5 rounded font-display tracking-wider border shrink-0 ${
              preset.type === 'vars'
                ? 'border-amber-400/25 bg-amber-400/8 text-amber-300/70'
                : 'border-aether-cyan/25 bg-aether-cyan/8 text-aether-cyan/60'
            }`}>
              {preset.type === 'vars' ? '变量' : '剧情'}
            </span>

            {/* Info */}
            <span className="text-[9px] text-white/15 font-mono shrink-0 hidden sm:inline">
              {preset.blocks.length} 块{preset.source ? ` · ${preset.source}` : ''}
            </span>

            {/* Export */}
            <button onClick={() => onExport(preset)}
              className="text-white/12 hover:text-aether-purple/50 transition-colors p-0.5" title="导出预设">
              <Download size={11} />
            </button>

            {/* Rename */}
            <button onClick={() => startRename(preset)}
              className="text-white/12 hover:text-aether-purple/50 transition-colors p-0.5" title="重命名">
              <Pencil size={11} />
            </button>

            {/* Delete */}
            <button onClick={() => onDelete(preset.id)}
              className="text-white/10 hover:text-aether-red/50 transition-colors p-0.5" title="删除预设">
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
