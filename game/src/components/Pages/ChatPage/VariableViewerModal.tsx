import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, ChevronRight, Eye, Pencil, Check, Trash2, Plus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variables: Record<string, any>;
  onSave: (vars: Record<string, any>) => void;
}

// Hide these fields from the viewer (managed internally)
const HIDDEN_KEYS = new Set<string>();

type EditTarget = { path: string[]; key: string; value: string } | null;

export default function VariableViewerModal({ isOpen, onClose, variables, onSave }: Props) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['世界']));
  const [editing, setEditing] = useState<EditTarget>(null);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const startEdit = (path: string[], key: string, value: any) => {
    setEditing({ path, key, value: String(value) });
  };

  const saveEdit = () => {
    if (!editing) return;
    const next = JSON.parse(JSON.stringify(variables));
    let target = next;
    for (const seg of editing.path) {
      if (!target[seg]) target[seg] = {};
      target = target[seg];
    }
    const num = Number(editing.value);
    target[editing.key] = isNaN(num) ? editing.value : editing.value === 'true' ? true : editing.value === 'false' ? false : num;
    onSave(next);
    setEditing(null);
  };

  const deleteKey = (path: string[], key: string) => {
    const next = JSON.parse(JSON.stringify(variables));
    let target = next;
    for (let i = 0; i < path.length; i++) {
      if (!target[path[i]]) return;
      if (i === path.length - 1) break;
      target = target[path[i]];
    }
    if (path.length > 0) {
      delete target[path[path.length - 1]][key];
    } else {
      delete target[key];
    }
    onSave(next);
  };

  const addKey = (path: string[]) => {
    const k = prompt('新变量名');
    if (!k) return;
    const next = JSON.parse(JSON.stringify(variables));
    let target = next;
    for (const seg of path) {
      if (!target[seg]) target[seg] = {};
      target = target[seg];
    }
    target[k] = '';
    onSave(next);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[560px] max-h-[80vh] glass-panel border-glow overflow-hidden flex flex-col"
        >
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/40 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-aether-border/30 bg-aether-cyan/[0.03] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-30" />
              </div>
              <h2 className="font-display font-bold text-sm tracking-[0.2em] text-aether-cyan uppercase">世界变量</h2>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-aether-cyan transition-colors p-1.5">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <TreeNode
              data={variables}
              path={[]}
              depth={0}
              expandedPaths={expandedPaths}
              onToggle={toggleExpand}
              editing={editing}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onDelete={deleteKey}
              onAdd={addKey}
              hiddenKeys={HIDDEN_KEYS}
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ────── Tree Node ────── */
function TreeNode({
  data, path, depth, expandedPaths, onToggle, editing, onStartEdit, onSaveEdit, onDelete, onAdd, hiddenKeys,
}: {
  data: Record<string, any>;
  path: string[];
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (p: string) => void;
  editing: EditTarget;
  onStartEdit: (path: string[], key: string, value: any) => void;
  onSaveEdit: () => void;
  onDelete: (path: string[], key: string) => void;
  onAdd: (path: string[]) => void;
  hiddenKeys: Set<string>;
}) {
  const entries = Object.entries(data).filter(([k]) => !hiddenKeys.has(k));
  if (entries.length === 0 && depth > 0) return null;

  return (
    <div style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
      {entries.map(([key, value]) => {
        const nodePath = [...path, key];
        const pathStr = nodePath.join('.');
        const isExpanded = expandedPaths.has(pathStr);
        const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
        const isEditing = editing && editing.path.join('.') === path.join('.') && editing.key === key;

        return (
          <div key={key} className="group">
            <div className="flex items-center gap-1.5 py-1.5 hover:bg-white/[0.02] rounded px-1 -mx-1 transition-colors">
              {/* Expand/collapse */}
              {isObject ? (
                <button onClick={() => onToggle(pathStr)} className="text-white/25 hover:text-white/50 p-0.5">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <span className="w-5" />
              )}

              {/* Key */}
              <span className={`font-mono tracking-wide ${isObject ? 'text-white/50 text-[13px] font-semibold' : 'text-white/30 text-[12px]'}`}>
                {key}
              </span>

              {/* Value (non-object) */}
              {!isObject && (
                isEditing ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      autoFocus
                      value={editing?.value ?? ''}
                      onChange={(e) => onStartEdit(path, key, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onStartEdit(path, key, String(value)); }}
                      className="flex-1 bg-aether-dark border border-aether-cyan/40 rounded px-2 py-0.5 text-[12px] text-white/80 font-mono focus:outline-none"
                    />
                    <button onClick={onSaveEdit} className="p-0.5 text-aether-green hover:text-white"><Check size={12} /></button>
                  </div>
                ) : (
                  <span
                    className={`text-[12px] ml-2 font-mono cursor-pointer truncate ${
                      value === true ? 'text-aether-green' :
                      value === false ? 'text-aether-red/70' :
                      typeof value === 'number' ? 'text-aether-gold' :
                      'text-white/60'
                    }`}
                    onClick={() => onStartEdit(path, key, value)}
                    title="点击编辑"
                  >
                    {String(value)}
                  </span>
                )
              )}

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                {!isObject && !isEditing && (
                  <button onClick={() => onStartEdit(path, key, value)} className="p-0.5 text-white/20 hover:text-aether-cyan" title="编辑">
                    <Pencil size={11} />
                  </button>
                )}
                <button onClick={() => onDelete(path, key)} className="p-0.5 text-white/15 hover:text-aether-red" title="删除">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Children */}
            {isObject && isExpanded && (
              <div>
                <TreeNode
                  data={value}
                  path={nodePath}
                  depth={depth + 1}
                  expandedPaths={expandedPaths}
                  onToggle={onToggle}
                  editing={editing}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onDelete={onDelete}
                  onAdd={onAdd}
                  hiddenKeys={hiddenKeys}
                />
                <button
                  onClick={() => onAdd(nodePath)}
                  className="flex items-center gap-1 text-[10px] text-white/15 hover:text-white/35 py-1 px-6 transition-colors"
                >
                  <Plus size={10} /> 添加变量
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
