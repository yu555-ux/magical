import type { AppSettings, PresetBlock, PresetParams, SavedPreset } from '../../../sillytavern/types';

export interface PromptManagerProps {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
  onPersist: (patch: Partial<AppSettings>) => Promise<void>;
}

export interface PresetSelectorProps {
  presets: SavedPreset[];
  activeId: string | null;
  onSelect: (preset: SavedPreset) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onExport: (preset: SavedPreset) => void;
  onImport: (result: { blocks: PresetBlock[]; params?: PresetParams; name: string; source?: string; description?: string }) => void;
}

export interface PresetParamsCardProps {
  params: PresetParams;
  onChange: (patch: Partial<PresetParams>) => void;
}

export interface PromptBlockListProps {
  blocks: PresetBlock[];
  onReorder: (blocks: PresetBlock[]) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onDetach?: (id: string) => void;
  editingId: string | null;
}

export interface PromptBlockItemProps {
  block: PresetBlock;
  index: number;
  isEditing: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
  onDetach?: () => void;
  dragHandleProps?: Record<string, any>;
}

export interface PromptEditDrawerProps {
  block: PresetBlock | null;
  open: boolean;
  onClose: () => void;
  onSave: (patch: Partial<PresetBlock>) => void;
}

export interface PromptBlockPoolProps {
  blocks: PresetBlock[];
  onNew: () => void;
  onImport: (result: { blocks: PresetBlock[]; params?: PresetParams; name: string }) => void;
  onExport: () => void;
  onResetOrder: () => void;
}

export interface QuickEditAreaProps {
  blocks: PresetBlock[];
  onUpdate: (id: string, patch: Partial<PresetBlock>) => void;
}

export const ROLE_COLORS: Record<string, string> = {
  system: 'bg-aether-cyan/10 text-aether-cyan/45 border-aether-cyan/20',
  user: 'bg-aether-green/10 text-aether-green/45 border-aether-green/20',
  assistant: 'bg-aether-blue/10 text-aether-blue/45 border-aether-blue/20',
};

export function newBlock(): PresetBlock {
  return {
    identifier: crypto.randomUUID(),
    name: '新预设块',
    role: 'system',
    enabled: true,
    content: '',
  };
}
