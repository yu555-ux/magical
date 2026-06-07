import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, ChevronDown, ChevronRight, Eye, Pencil, Check, Trash2, Plus, Search } from 'lucide-react';
import AetherModal from '../../shared/AetherModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variables: Record<string, any>;
  onSave: (vars: Record<string, any>) => void;
}

type EditTarget = { path: string[]; key: string; value: string } | null;

/* ===== Flatten for search ===== */
interface FlatVarEntry {
  path: string[];
  key: string;
  value: any;
}

function flattenVars(obj: Record<string, any>, parentPath: string[]): FlatVarEntry[] {
  const result: FlatVarEntry[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = [...parentPath, k];
    result.push({ path: parentPath, key: k, value: v });
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result.push(...flattenVars(v, p));
    }
  }
  return result;
}

export default function VariableViewerModal({ isOpen, onClose, variables, onSave }: Props) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['世界']));
  const [editing, setEditing] = useState<EditTarget>(null);
  const [search, setSearch] = useState('');

  // Flattened list for search
  const flatList = useMemo(() => flattenVars(variables, []), [variables]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    return flatList.filter((e) => e.key.toLowerCase().includes(q)).slice(0, 30);
  }, [flatList, search]);

  // On search result click: expand all ancestor paths and scroll to the key
  const handleSearchSelect = (entry: FlatVarEntry) => {
    const newExpanded = new Set(expandedPaths);
    // Expand all ancestor paths
    for (let i = 0; i < entry.path.length; i++) {
      newExpanded.add(entry.path.slice(0, i + 1).join('.'));
    }
    // Also expand the entry itself if it's an object
    if (entry.value !== null && typeof entry.value === 'object' && !Array.isArray(entry.value)) {
      newExpanded.add([...entry.path, entry.key].join('.'));
    }
    setExpandedPaths(newExpanded);
    setSearch('');
  };

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

  const toggleBool = (path: string[], key: string) => {
    const next = JSON.parse(JSON.stringify(variables));
    let target = next;
    for (const seg of path) {
      if (!target[seg]) target[seg] = {};
      target = target[seg];
    }
    target[key] = !target[key];
    onSave(next);
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

  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="世界变量">
      {/* Search bar */}
          <div className="shrink-0 px-5 pt-3 pb-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
              style={{
                background: 'rgba(6,8,14,0.6)',
                borderColor: search ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.06)',
                boxShadow: search ? '0 0 12px rgba(0,242,255,0.06)' : 'none',
              }}
            >
              <Search size={14} className="text-aether-cyan/40 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索变量名..."
                className="bg-transparent text-[12px] font-mono text-white/70 placeholder:text-white/20 outline-none flex-1"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-white/20 hover:text-white/50 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto px-5 pb-5">
            {searchResults ? (
              /* Search results — flat list with paths */
              searchResults.length === 0 ? (
                <p className="text-[11px] text-white/20 font-mono text-center py-8">
                  未找到匹配 "{search}" 的变量
                </p>
              ) : (
                <div className="space-y-0.5 pt-1">
                  {searchResults.map((entry) => (
                    <button
                      key={[...entry.path, entry.key].join('.')}
                      onClick={() => handleSearchSelect(entry)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-white/[0.04] transition-colors flex items-center gap-2.5 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-aether-cyan/40 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[12px] font-mono text-white/70 font-semibold">{entry.key}</span>
                        {entry.path.length > 0 && (
                          <span className="text-[9px] font-mono text-white/20 ml-2">
                            {entry.path.join(' › ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-white/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {typeof entry.value === 'object' && entry.value !== null && !Array.isArray(entry.value)
                          ? '{…}'
                          : String(entry.value).slice(0, 20)}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              /* Normal tree view */
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
                onToggleBool={toggleBool}
                              />
            )}
          </div>

    </AetherModal>
  );
}

/* ────── Tree Node ────── */
function TreeNode({
  data, path, depth, expandedPaths, onToggle, editing, onStartEdit, onSaveEdit, onDelete, onAdd, onToggleBool,
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
  onToggleBool: (path: string[], key: string) => void;
}) {
  const entries = Object.entries(data);
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
            <div className="flex items-center gap-1.5 py-1.5 hover:bg-white/[0.02] rounded px-1 -mx-1 transition-colors flex-nowrap">
              {/* Expand/collapse */}
              {isObject ? (
                <button onClick={() => onToggle(pathStr)} className="text-white/25 hover:text-white/50 p-0.5">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <span className="w-5" />
              )}

              {/* Key */}
              <span className={`font-mono tracking-wide whitespace-nowrap ${isObject ? 'text-white/50 text-[13px] font-semibold' : 'text-white/30 text-[12px]'}`}>
                {key}
              </span>

              {/* Value (non-object) */}
              {!isObject && (
                typeof value === 'boolean' ? (
                  <button
                    onClick={() => onToggleBool(path, key)}
                    className={`relative ml-2 w-8 h-4 rounded-full transition-colors ${
                      value ? 'bg-aether-green/40 border border-aether-green/50' : 'bg-white/10 border border-white/15'
                    }`}
                  >
                    <motion.div
                      animate={{ x: value ? 14 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`absolute top-0.5 w-3 h-3 rounded-full ${value ? 'bg-aether-green' : 'bg-white/30'}`}
                    />
                  </button>
                ) : (
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
                      className={`text-[12px] ml-2 font-mono cursor-pointer whitespace-nowrap ${
                        typeof value === 'number' ? 'text-aether-gold' : 'text-white/60'
                      }`}
                      onClick={() => onStartEdit(path, key, value)}
                      title="点击编辑"
                    >
                      {String(value)}
                    </span>
                  )
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
                  onToggleBool={onToggleBool}
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
