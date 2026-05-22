import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Upload, Download, Trash2, AlertTriangle, CheckCircle, RefreshCw, Plus, Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import type { AppSettings, Lorebook, LorebookEntry } from '../../sillytavern/types';
import { importLorebookFromJson, exportLorebookToJson } from '../../sillytavern/lorebookImporter';
import { saveSettings } from '../../sillytavern/database';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
}

const POSITION_OPTIONS = [
  { value: 0, label: '角色定位之前' },
  { value: 1, label: '角色定位之后' },
  { value: 2, label: 'D2 之前' },
  { value: 3, label: 'D2 之后' },
];

const TRIGGER_OPTIONS = [
  { value: 'keyword', label: '关键词' },
  { value: 'constant', label: '常驻' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

// ── MiniSelect: custom dark-themed dropdown to fix native select brightness & lag ──
function MiniSelect<V extends string | number>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono bg-aether-dark/40 border border-aether-border/15 text-white/35 hover:text-white/55 hover:border-aether-border/25 transition-colors"
      >
        <span className="truncate max-w-[80px]">{selected?.label ?? value}</span>
        <ChevronDown size={8} className="text-white/20 shrink-0" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 z-50 min-w-full rounded-md border border-aether-border/25 bg-aether-dark/95 backdrop-blur-md shadow-lg shadow-black/40 overflow-hidden"
          >
            {options.map(o => (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full text-left text-[10px] px-2.5 py-1.5 font-mono transition-colors ${
                  o.value === value
                    ? 'text-aether-purple/70 bg-aether-purple/8'
                    : 'text-white/40 hover:text-white/65 hover:bg-white/[0.04]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── EntryRow ──
interface EntryRowProps {
  entry: LorebookEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<LorebookEntry>) => void;
}

const EntryRow: React.FC<EntryRowProps> = ({ entry, isExpanded, onToggleExpand, onUpdate }) => {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(entry.comment);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameDraft(entry.comment);
  }, [entry.comment]);

  useEffect(() => {
    if (editingName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [editingName]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== entry.comment) {
      onUpdate({ comment: trimmed });
    } else {
      setNameDraft(entry.comment);
    }
    setEditingName(false);
  };

  const isPosition0 = entry.position === 0;
  const hasKeys = entry.keys.length > 0;

  return (
    <div className={`rounded border transition-all ${
      entry.enabled
        ? 'border-aether-border/10 bg-aether-dark/25'
        : 'border-aether-border/5 bg-aether-dark/15 opacity-60'
    }`}>
      {/* ── Collapsed row ── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 min-w-0">

        {/* 1. Expand / collapse arrow */}
        <button
          onClick={onToggleExpand}
          className="shrink-0 text-white/15 hover:text-white/40 transition-colors p-0.5"
        >
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
          />
        </button>

        {/* 2. Enable toggle — distinct filled/empty states */}
        <button
          onClick={() => onUpdate({ enabled: !entry.enabled })}
          className={`shrink-0 w-4 h-4 rounded-full border-2 transition-all duration-200 ${
            entry.enabled
              ? 'bg-aether-purple/70 border-aether-purple/50 shadow-[0_0_6px_rgba(139,92,246,0.3)]'
              : 'bg-transparent border-aether-border/25 hover:border-aether-border/45'
          }`}
          title={entry.enabled ? '已启用 — 点击禁用' : '已禁用 — 点击启用'}
        />

        {/* 3. Entry name — wider, inline-editable */}
        <div className="flex-1 min-w-[100px]">
          {editingName ? (
            <input
              ref={nameRef}
              type="text"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') { setNameDraft(entry.comment); setEditingName(false); }
              }}
              onClick={e => e.stopPropagation()}
              className="w-full bg-aether-dark/50 border border-aether-purple/30 rounded px-1.5 py-0.5 text-[11px] text-white/70 placeholder:text-white/15 focus:outline-none focus:border-aether-purple/50 font-mono"
            />
          ) : (
            <button
              onClick={onToggleExpand}
              onDoubleClick={() => setEditingName(true)}
              className="w-full text-left text-[11px] truncate hover:text-white/65 transition-colors cursor-pointer"
              title="双击编辑名称，单击展开内容"
              style={{ color: entry.enabled ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)' }}
            >
              {entry.comment || '未命名条目'}
            </button>
          )}
        </div>

        {/* 4. Trigger strategy */}
        <MiniSelect
          value={entry.constant ? 'constant' : 'keyword'}
          options={TRIGGER_OPTIONS as { value: string; label: string }[]}
          onChange={(v) => onUpdate({ constant: v === 'constant' })}
        />

        {/* 5. Insert position */}
        <MiniSelect
          value={entry.position}
          options={POSITION_OPTIONS}
          onChange={(v) => onUpdate({ position: v as number })}
        />

        {/* 6. Depth — only for position 0 (before_char / @D0) */}
        {isPosition0 && (
          <span className="shrink-0 flex items-center gap-0.5 text-[9px] text-white/15 font-mono">
            深度
            <input
              type="number"
              value={entry.depth ?? 4}
              min={0}
              max={99}
              onChange={e => onUpdate({ depth: Number(e.target.value) || 0 })}
              onClick={e => e.stopPropagation()}
              className="w-8 bg-aether-dark/40 border border-aether-border/15 rounded px-1 py-0.5 text-[9px] text-white/40 focus:outline-none focus:border-aether-purple/40 text-center font-mono transition-colors"
            />
          </span>
        )}

        {/* 7. Order */}
        <span className="shrink-0 flex items-center gap-0.5 text-[9px] text-white/15 font-mono">
          顺序
          <input
            type="number"
            value={entry.order ?? 100}
            min={0}
            max={9999}
            onChange={e => onUpdate({ order: Number(e.target.value) || 0 })}
            onClick={e => e.stopPropagation()}
            className="w-9 bg-aether-dark/40 border border-aether-border/15 rounded px-1 py-0.5 text-[9px] text-white/40 focus:outline-none focus:border-aether-purple/40 text-center font-mono transition-colors"
          />
        </span>
      </div>

      {/* ── Expanded content ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 border-t border-aether-border/5 pt-1.5">
              {hasKeys && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {entry.keys.map((k, i) => (
                    <span key={i} className="text-[8px] bg-aether-cyan/5 border border-aether-cyan/10 text-aether-cyan/35 px-1 rounded font-mono">{k}</span>
                  ))}
                  {entry.secondaryKeys.map((k, i) => (
                    <span key={`s-${i}`} className="text-[8px] bg-aether-purple/5 border border-aether-purple/10 text-aether-purple/30 px-1 rounded font-mono">{k}</span>
                  ))}
                </div>
              )}
              <pre className="text-[10px] text-white/40 whitespace-pre-wrap leading-relaxed font-mono max-h-[200px] overflow-y-auto bg-aether-dark/30 rounded p-2">
                {entry.content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──
export default function LorebookTab({ draft, setDraft }: Props) {
  const lorebooks: Lorebook[] = draft.lorebooks ?? [];
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [showSearch, setShowSearch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const save = async (next: Lorebook[]) => {
    const nextDraft = { ...draft, lorebooks: next };
    setDraft(nextDraft);
    try {
      await saveSettings(nextDraft);
    } catch (err) {
      console.error('[LorebookTab] Save failed:', err);
      showToast('保存失败，请重试', 'error');
    }
  };

  const updateEntry = async (bookId: string, entryId: string, patch: Partial<LorebookEntry>) => {
    const next = lorebooks.map(b => b.id !== bookId ? b : {
      ...b, entries: b.entries.map(e => e.id === entryId ? { ...e, ...patch } : e),
    });
    await save(next);
  };

  const filterEntries = useCallback((entries: LorebookEntry[]) => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.keys.some(k => k.toLowerCase().includes(q)) ||
      e.secondaryKeys.some(k => k.toLowerCase().includes(q)) ||
      e.comment.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const book = importLorebookFromJson(raw, file.name);
      const next = [...lorebooks, book];
      setDraft({ ...draft, lorebooks: next });
      await saveSettings({ ...draft, lorebooks: next });
      setExpandedBook(book.id);
      showToast(`已导入「${book.name}」: ${book.entries.length} 个条目 — 已自动保存`, 'success');
    } catch (err: any) {
      showToast(`导入失败: ${err?.message || '无法解析'}`, 'error');
    }
    try { e.target.value = ''; } catch { /* ignore */ }
  }, [draft, lorebooks, showToast]);

  const handleExportAll = () => {
    if (lorebooks.length === 0) { showToast('没有可导出的世界书', 'error'); return; }
    const data = lorebooks.length === 1
      ? exportLorebookToJson(lorebooks[0])
      : lorebooks.map(b => exportLorebookToJson(b));
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lorebooks.length === 1 ? `${lorebooks[0].name}.json` : 'worldbooks.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`已导出 ${lorebooks.length} 本世界书`, 'success');
  };

  const handleNewEntry = async () => {
    if (lorebooks.length === 0) { showToast('请先导入世界书', 'error'); return; }
    const targetId = expandedBook || lorebooks[0].id;
    const newEntry: LorebookEntry = {
      id: crypto.randomUUID(), keys: [], secondaryKeys: [], content: '',
      comment: '新条目', enabled: true, position: 1, order: 100,
      constant: false, depth: 4, selective: false, selectiveLogic: 0,
    };
    const next = lorebooks.map(b =>
      b.id !== targetId ? b : { ...b, entries: [...b.entries, newEntry] }
    );
    setExpandedBook(targetId);
    setExpandedEntry(newEntry.id);
    await save(next);
    showToast('已添加新条目', 'success');
  };

  const toggleRecursive = async (bookId: string) => {
    const next = lorebooks.map(b => b.id !== bookId ? b : { ...b, recursive: !b.recursive });
    await save(next);
  };

  const removeBook = async (bookId: string) => {
    await save(lorebooks.filter(b => b.id !== bookId));
  };

  const getPage = (bookId: string) => pages[bookId] || 1;
  const setPage = (bookId: string, p: number) => setPages(prev => ({ ...prev, [bookId]: p }));

  return (
    <div className="p-5">
      <section className="max-w-2xl">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 cursor-pointer transition-all font-display">
            <Upload size={13} /> 导入世界书
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleExportAll} disabled={lorebooks.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 transition-all font-display disabled:opacity-30 disabled:cursor-not-allowed">
            <Download size={13} /> 导出全部
          </button>
          <button onClick={handleNewEntry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 transition-all font-display">
            <Plus size={13} /> 新建条目
          </button>
          <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border transition-all font-display ${
              showSearch ? 'border-aether-purple/40 text-aether-purple/60 bg-aether-purple/5'
                : 'border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40'
            }`}>
            <Search size={13} /> 搜索条目
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/20 font-mono">每页</span>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
              className="bg-aether-dark/60 border border-aether-border/25 rounded px-2 py-1.5 text-[10px] text-white/50 focus:outline-none focus:border-aether-purple/50 font-mono">
              {PAGE_SIZE_OPTIONS.map(n => (<option key={n} value={n}>{n} 条</option>))}
            </select>
          </div>
          {lorebooks.length > 0 && (
            <span className="text-[10px] text-white/15 font-mono ml-auto">
              {lorebooks.length} 本，{lorebooks.reduce((s, b) => s + b.entries.length, 0)} 条目
            </span>
          )}
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mb-3">
                <input type="text" value={searchQuery} placeholder="搜索关键词、注释或内容…"
                  onChange={e => { setSearchQuery(e.target.value); setPages({}); }}
                  className="w-full bg-aether-dark/60 border border-aether-border/25 rounded px-3 py-1.5 text-[11px] text-white/60 placeholder:text-white/12 focus:outline-none focus:border-aether-purple/50 transition-all font-mono"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Lorebook list ── */}
        {lorebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
            <div className="w-10 h-10 rounded-full bg-aether-purple/5 border border-aether-border/20 flex items-center justify-center mb-2">
              <BookOpen size={18} className="text-white/10" />
            </div>
            <p className="text-white/15 text-xs font-display tracking-wide mb-1">暂无世界书</p>
            <p className="text-white/8 text-[10px]">点击「导入世界书」加载 .json 格式的世界书文件</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lorebooks.map(book => {
              const isExpanded = expandedBook === book.id;
              const allEntries = book.entries;
              const filtered = filterEntries(allEntries);
              const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
              const page = Math.min(getPage(book.id), totalPages);
              const start = (page - 1) * pageSize;
              const paged: LorebookEntry[] = filtered.slice(start, start + pageSize);
              const enabledCount = allEntries.filter(e => e.enabled).length;

              return (
                <div key={book.id} className="rounded-lg border border-aether-border/15 bg-aether-dark/30 overflow-hidden">
                  {/* Book header */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <BookOpen size={14} className="text-aether-purple/40 shrink-0" />
                    <button onClick={() => setExpandedBook(isExpanded ? null : book.id)} className="flex-1 text-left flex items-center gap-1">
                      <span className="text-[9px] text-white/20">{isExpanded ? '▾' : '▸'}</span>
                      <span className="text-xs font-display font-medium text-white/60">{book.name}</span>
                      <span className="text-[10px] text-white/20 ml-1">{enabledCount}/{allEntries.length} 条目</span>
                    </button>
                    <button onClick={() => toggleRecursive(book.id)}
                      className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                        book.recursive ? 'bg-aether-purple/15 text-aether-purple/60' : 'text-white/15 hover:text-white/30'
                      }`} title="递归扫描">
                      <RefreshCw size={10} /> 递归
                    </button>
                    <button onClick={() => removeBook(book.id)} className="text-white/12 hover:text-aether-red/50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Entries */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }} className="overflow-hidden border-t border-aether-border/8">
                        {/* Pagination top */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-2 py-1.5 border-b border-aether-border/5">
                            <span className="text-[9px] text-white/15 font-mono">
                              {start + 1}–{Math.min(start + pageSize, filtered.length)} / {filtered.length}
                            </span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setPage(book.id, page - 1)} disabled={page <= 1}
                                className="text-white/20 hover:text-white/50 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronLeft size={12} />
                              </button>
                              <span className="text-[9px] text-white/25 font-mono w-6 text-center">{page}</span>
                              <button onClick={() => setPage(book.id, page + 1)} disabled={page >= totalPages}
                                className="text-white/20 hover:text-white/50 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-0.5 p-2">
                          {paged.length === 0 ? (
                            <p className="text-[10px] text-white/15 text-center py-4">无匹配条目</p>
                          ) : (
                            paged.map(entry => {
                              const entryExpanded = expandedEntry === entry.id;
                              return (
                                <EntryRow
                                  key={entry.id}
                                  entry={entry}
                                  isExpanded={entryExpanded}
                                  onToggleExpand={() => setExpandedEntry(entryExpanded ? null : entry.id)}
                                  onUpdate={(patch) => { void updateEntry(book.id, entry.id, patch); }}
                                />
                              );
                            })
                          )}
                        </div>

                        {/* Pagination bottom */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-2 py-1.5 border-t border-aether-border/5">
                            <span className="text-[9px] text-white/15 font-mono">共 {filtered.length} 条目，{totalPages} 页</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setPage(book.id, page - 1)} disabled={page <= 1}
                                className="text-white/20 hover:text-white/50 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronLeft size={12} />
                              </button>
                              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let p: number;
                                if (totalPages <= 5) p = i + 1;
                                else if (page <= 3) p = i + 1;
                                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                                else p = page - 2 + i;
                                return (
                                  <button key={p} onClick={() => setPage(book.id, p)}
                                    className={`text-[9px] w-5 h-5 rounded font-mono transition-colors ${
                                      p === page ? 'bg-aether-purple/20 text-aether-purple/60' : 'text-white/25 hover:text-white/50'
                                    }`}>{p}</button>
                                );
                              })}
                              <button onClick={() => setPage(book.id, page + 1)} disabled={page >= totalPages}
                                className="text-white/20 hover:text-white/50 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* Info */}
        <div className="bg-aether-dark/20 rounded-lg border border-aether-border/15 p-3 mt-4">
          <p className="text-[10px] text-white/20 leading-relaxed">
            <span className="text-aether-purple/40 font-semibold">世界书注入：</span>
            条目按触发词匹配后，根据 ST position 注入到预设的对应锚点。
            开启「递归」后，匹配到的条目内容也会触发新的匹配。
          </p>
        </div>
      </section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium z-[200] ${
              toast.type === 'success'
                ? 'bg-aether-green/20 border border-aether-green/30 text-aether-green'
                : 'bg-aether-red/20 border border-aether-red/30 text-aether-red'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
