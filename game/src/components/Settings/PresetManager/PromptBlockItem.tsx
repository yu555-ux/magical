import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Eye, Link2Off, ToggleLeft, ToggleRight } from 'lucide-react';
import type { PromptBlockItemProps } from './types';
import { ROLE_COLORS } from './types';
import TokenBadge from './TokenBadge';

function getIcon(block: PromptBlockItemProps['block']): string | null {
  if (block.marker) return '📌';
  if (block.forbid_overrides) return '⭐';
  if (block.injection_position === 1) return '💉';
  if (block.injection_position === 2) return '📎';
  return null;
}

export default function PromptBlockItem({
  block, isEditing, onToggle, onEdit, onRemove, onDetach,
}: PromptBlockItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: block.identifier });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : block.enabled ? 1 : 0.55,
  };

  const icon = getIcon(block);
  const canToggle = !block.marker;
  const canEdit = !block.marker;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-2 rounded border transition-all ${
        isEditing
          ? 'border-aether-purple/30 bg-aether-purple/[0.04]'
          : block.enabled
            ? 'border-aether-border/12 bg-aether-dark/30'
            : 'border-aether-border/6 bg-aether-dark/15'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-white/10 hover:text-white/30 cursor-grab active:cursor-grabbing touch-none"
        title="拖拽排序"
      >
        <GripVertical size={14} />
      </button>

      {/* Type icon */}
      {icon && <span className="text-[10px] shrink-0">{icon}</span>}

      {/* Name */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className={`text-[11px] leading-tight truncate ${block.enabled ? 'text-white/65' : 'text-white/25'}`}>
          {block.name || '未命名'}
        </span>
        {block.injection_position === 1 && block.injection_depth !== undefined && (
          <span className="text-[8px] text-aether-purple/30 font-mono">@{block.injection_depth}</span>
        )}
      </div>

      {/* Role badge */}
      <span className={`text-[8px] px-1 py-0.5 rounded border font-mono uppercase shrink-0 ${ROLE_COLORS[block.role] || ROLE_COLORS.system}`}>
        {block.role}
      </span>

      {/* Toggle */}
      {canToggle && (
        <button onClick={() => onToggle(!block.enabled)} className="shrink-0 text-white/20 hover:text-white/50 transition-colors" title={block.enabled ? '禁用' : '启用'}>
          {block.enabled ? <ToggleRight size={15} className="text-aether-purple/50" /> : <ToggleLeft size={15} />}
        </button>
      )}

      {/* Token count */}
      <TokenBadge content={block.content} />

      {/* Edit / View */}
      <button
        onClick={onEdit}
        className="shrink-0 text-white/12 hover:text-aether-purple/50 transition-colors p-0.5"
        title={canEdit ? '编辑' : '查看'}
      >
        {canEdit ? <Pencil size={12} /> : <Eye size={12} />}
      </button>

      {/* Detach */}
      {onDetach && (
        <button
          onClick={onDetach}
          className="shrink-0 text-white/10 hover:text-aether-red/50 transition-colors p-0.5"
          title="分离"
        >
          <Link2Off size={12} />
        </button>
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        className="shrink-0 text-white/10 hover:text-aether-red/50 transition-colors p-0.5"
        title="删除"
      >
        <span className="text-[10px]">✕</span>
      </button>
    </div>
  );
}
