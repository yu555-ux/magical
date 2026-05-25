import React from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import PromptBlockItem from './PromptBlockItem';
import type { PromptBlockListProps } from './types';

export default function PromptBlockList({
  blocks, onReorder, onToggle, onEdit, onRemove, editingId,
}: PromptBlockListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex(b => b.identifier === active.id);
    const newIdx = blocks.findIndex(b => b.identifier === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = [...blocks];
    const [moved] = next.splice(oldIdx, 1);
    next.splice(newIdx, 0, moved);
    onReorder(next);
  };

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
        <p className="text-white/15 text-xs font-display tracking-wide mb-1">暂无预设词块</p>
        <p className="text-white/8 text-[10px]">点击「新建词块」来创建提示词段落</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.identifier)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {blocks.map((block, index) => (
            <PromptBlockItem
              key={block.identifier}
              block={block}
              index={index}
              isEditing={editingId === block.identifier}
              onToggle={(enabled) => onToggle(block.identifier, enabled)}
              onEdit={() => onEdit(block.identifier)}
              onRemove={() => onRemove(block.identifier)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
