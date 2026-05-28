import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Download, Trash2, AlertTriangle, CheckCircle, Plus, Search, ChevronLeft, ChevronRight, ChevronDown, Pencil, X, Settings } from 'lucide-react';
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
  { value: 4, label: '在深度' },
  { value: 2, label: '示例之前' },
  { value: 3, label: '示例之后' },
];

const TRIGGER_OPTIONS = [
  { value: 'keyword', label: '关键词' },
  { value: 'constant', label: '常驻' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

// ── MiniSelect ──
function MiniSelect<V extends string | number>({
  value, options, onChange, className = '',
}: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; className?: string }) {
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
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono bg-aether-dark/40 border border-aether-border/15 text-white/35 hover:text-white/55 hover:border-aether-border/25 transition-colors">
        <span className="truncate max-w-[80px]">{selected?.label ?? value}</span>
        <ChevronDown size={8} className="text-white/20 shrink-0" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 z-50 min-w-full rounded-md border border-aether-border/25 bg-aether-dark/95 backdrop-blur-md shadow-lg shadow-black/40 overflow-hidden">
            {options.map(o => (
              <button key={String(o.value)} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full text-left text-[10px] px-2.5 py-1.5 font-mono transition-colors ${
                  o.value === value ? 'text-aether-purple/70 bg-aether-purple/8' : 'text-white/40 hover:text-white/65 hover:bg-white/[0.04]'
                }`}>{o.label}</button>
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
  onDelete: () => void;
}

const EntryRow: React.FC<EntryRowProps> = ({ entry, isExpanded, onToggleExpand, onUpdate, onDelete }) => {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(entry.comment);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNameDraft(entry.comment); }, [entry.comment]);
  useEffect(() => {
    if (editingName && nameRef.current) { nameRef.current.focus(); }
  }, [editingName]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== entry.comment) onUpdate({ comment: trimmed });
    else setNameDraft(entry.comment);
    setEditingName(false);
  };

  const showDepth = entry.position === 4;

  return (
    <div className={`rounded border transition-all ${entry.enabled ? 'border-aether-border/10 bg-aether-dark/25' : 'border-aether-border/5 bg-aether-dark/15 opacity-60'}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 min-w-0">

        {/* 1. Expand arrow */}
        <button onClick={onToggleExpand}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-aether-border/25 bg-aether-dark/30 text-white/35 hover:text-white/65 hover:border-aether-purple/40 hover:bg-aether-purple/10 transition-all">
          <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
        </button>

        {/* 2. Enable toggle */}
        <button onClick={() => onUpdate({ enabled: !entry.enabled })}
          className={`shrink-0 w-4 h-4 rounded-full border-2 transition-all duration-200 ${
            entry.enabled ? 'bg-aether-purple/70 border-aether-purple/50 shadow-[0_0_6px_rgba(139,92,246,0.3)]' : 'bg-transparent border-aether-border/25 hover:border-aether-border/45'
          }`} title={entry.enabled ? '已启用' : '已禁用'} />

        {/* 3. Entry name */}
        <div className="flex-1 min-w-[80px]">
          {editingName ? (
            <input ref={nameRef} type="text" value={nameDraft}
              onChange={e => setNameDraft(e.target.value)} onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(entry.comment); setEditingName(false); } }}
              onClick={e => e.stopPropagation()}
              className="w-full bg-aether-dark/50 border border-aether-purple/30 rounded px-1.5 py-0.5 text-[11px] text-white/70 focus:outline-none focus:border-aether-purple/50 font-mono" />
          ) : (
            <div onClick={() => setEditingName(true)}
              className="w-full text-left text-[11px] truncate px-1.5 py-0.5 rounded border border-aether-border/30 bg-aether-dark/35 cursor-pointer hover:border-aether-purple/30 transition-colors"
              title="点击编辑名称"
              style={{ color: entry.enabled ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)' }}>
              {entry.comment || '未命名条目'}
            </div>
          )}
        </div>

        {/* 4. Trigger */}
        <MiniSelect value={entry.constant ? 'constant' : 'keyword'}
          options={TRIGGER_OPTIONS as { value: string; label: string }[]}
          onChange={(v) => onUpdate({ constant: v === 'constant' })} />

        {/* 5. Position */}
        <MiniSelect value={entry.position} options={POSITION_OPTIONS}
          onChange={(v) => onUpdate({ position: v as number })} />

        {/* 6. Depth D{N} */}
        {showDepth && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-white/30 font-mono">
            <span className="text-white/15">D</span>
            <input type="number" value={entry.depth ?? 0} min={0} max={99}
              onChange={e => onUpdate({ depth: Number(e.target.value) || 0 })}
              onClick={e => e.stopPropagation()}
              className="w-8 bg-aether-dark/40 border border-aether-border/15 rounded px-1 py-0.5 text-[10px] text-white/40 focus:outline-none focus:border-aether-purple/40 text-center font-mono transition-colors" />
          </span>
        )}

        {/* 7. Order */}
        <span className="shrink-0 flex items-center gap-0.5 text-[9px] text-white/15 font-mono">
          顺序
          <input type="number" value={entry.order ?? 100} min={0} max={9999}
            onChange={e => onUpdate({ order: Number(e.target.value) || 0 })}
            onClick={e => e.stopPropagation()}
            className="w-9 bg-aether-dark/40 border border-aether-border/15 rounded px-1 py-0.5 text-[9px] text-white/40 focus:outline-none focus:border-aether-purple/40 text-center font-mono transition-colors" />
        </span>

        {/* 8. Delete entry */}
        <button onClick={onDelete}
          className="shrink-0 text-white/10 hover:text-aether-red/50 transition-colors p-0.5"
          title="删除条目">
          <X size={12} />
        </button>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="px-2 pb-2 border-t border-aether-border/5 pt-1.5 space-y-2">
              <EntryEditor entry={entry} onUpdate={onUpdate} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── EntryEditor: expanded content ──
function EntryEditor({ entry, onUpdate }: { entry: LorebookEntry; onUpdate: (p: Partial<LorebookEntry>) => void }) {
  const [keyInput, setKeyInput] = useState('');
  const [secKeyInput, setSecKeyInput] = useState('');

  const addKey = () => {
    const k = keyInput.trim();
    if (k && !entry.keys.includes(k)) {
      onUpdate({ keys: [...entry.keys, k] });
      setKeyInput('');
    }
  };

  const removeKey = (k: string) => {
    onUpdate({ keys: entry.keys.filter(x => x !== k) });
  };

  const addSecKey = () => {
    const k = secKeyInput.trim();
    if (k && !entry.secondaryKeys.includes(k)) {
      onUpdate({ secondaryKeys: [...entry.secondaryKeys, k] });
      setSecKeyInput('');
    }
  };

  const removeSecKey = (k: string) => {
    onUpdate({ secondaryKeys: entry.secondaryKeys.filter(x => x !== k) });
  };

  return (
    <div className="space-y-3">
      {/* Keywords */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-white/25 font-mono shrink-0">关键词</span>
          <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
            {entry.keys.map(k => (
              <span key={k} className="inline-flex items-center gap-1 text-[11px] bg-aether-cyan/10 border border-aether-cyan/25 text-aether-cyan/50 px-2 py-0.5 rounded font-mono">
                {k}
                <button onClick={() => removeKey(k)} className="text-aether-cyan/30 hover:text-aether-red/50 leading-none text-sm">&times;</button>
              </span>
            ))}
            {entry.keys.length === 0 && (
              <span className="text-[11px] text-white/10 italic">无</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-14">
          <input type="text" value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addKey(); }}
            placeholder="添加关键词…"
            className="flex-1 bg-aether-dark/50 border border-aether-border/30 rounded px-2 py-1 text-[11px] text-white/55 placeholder:text-white/10 focus:outline-none focus:border-aether-purple/50 font-mono" />
          <button onClick={addKey}
            className="text-xs px-2.5 py-1 rounded border border-aether-border/25 text-white/30 hover:text-aether-purple/50 hover:border-aether-purple/35 font-mono transition-colors">+</button>
        </div>
        {/* Secondary keys */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-white/15 font-mono shrink-0 ml-14">次要</span>
          <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
            {entry.secondaryKeys.map(k => (
              <span key={k} className="inline-flex items-center gap-1 text-[10px] bg-aether-purple/5 border border-aether-purple/20 text-aether-purple/40 px-2 py-0.5 rounded font-mono">
                {k}
                <button onClick={() => removeSecKey(k)} className="text-aether-purple/30 hover:text-aether-red/50 leading-none text-sm">&times;</button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1 ml-14">
          <input type="text" value={secKeyInput}
            onChange={e => setSecKeyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addSecKey(); }}
            placeholder="添加次要关键词…"
            className="flex-1 bg-aether-dark/50 border border-aether-border/30 rounded px-2 py-1 text-[10px] text-white/45 placeholder:text-white/10 focus:outline-none focus:border-aether-purple/50 font-mono" />
          <button onClick={addSecKey}
            className="text-[10px] px-2.5 py-1 rounded border border-aether-border/25 text-white/25 hover:text-aether-purple/45 hover:border-aether-purple/35 font-mono transition-colors">+</button>
        </div>
      </div>

      {/* Settings row */}
      <div className="flex items-center gap-4 flex-wrap py-1.5 px-3 rounded border border-aether-border/15 bg-aether-dark/20">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={entry.excludeRecursion ?? false}
            onChange={() => onUpdate({ excludeRecursion: !entry.excludeRecursion })}
            className="accent-aether-purple h-3.5 w-3.5" />
          <span className="text-[11px] text-white/35 font-mono">不可递归</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={entry.preventRecursion ?? false}
            onChange={() => onUpdate({ preventRecursion: !entry.preventRecursion })}
            className="accent-aether-purple h-3.5 w-3.5" />
          <span className="text-[11px] text-white/35 font-mono">防止递归</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={entry.selective ?? false}
            onChange={() => onUpdate({ selective: !entry.selective })}
            className="accent-aether-purple h-3.5 w-3.5" />
          <span className="text-[11px] text-white/35 font-mono">选择性</span>
        </label>
        {entry.selective && (
          <MiniSelect
            value={entry.selectiveLogic ?? 0}
            options={[
              { value: 0, label: '主AND次OR' },
              { value: 1, label: '主非全次AND' },
              { value: 2, label: '主非任次OR' },
              { value: 3, label: '主OR次AND' },
            ]}
            onChange={(v) => onUpdate({ selectiveLogic: v as number })}
          />
        )}
        {/* Probability */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={entry.useProbability ?? false}
            onChange={() => onUpdate({ useProbability: !entry.useProbability })}
            className="accent-aether-purple h-3.5 w-3.5" />
          <span className="text-[11px] text-white/35 font-mono">触发概率</span>
        </label>
        {entry.useProbability && (
          <div className="flex items-center gap-1.5">
            <input type="range" min={0} max={100}
              value={entry.probability ?? 100}
              onChange={e => onUpdate({ probability: Number(e.target.value) })}
              className="h-3 w-20 accent-aether-purple" />
            <span className="text-[11px] text-aether-purple/45 font-mono w-8">{entry.probability ?? 100}%</span>
          </div>
        )}
      </div>

      {/* Content — editable */}
      <div>
        <div className="text-[11px] text-white/20 font-mono mb-1">内容</div>
        <textarea
          value={entry.content}
          onChange={e => onUpdate({ content: e.target.value })}
          rows={8}
          className="w-full bg-aether-dark/40 border border-aether-border/25 rounded p-3 text-xs text-white/55 placeholder:text-white/10 focus:outline-none focus:border-aether-purple/50 transition-colors font-mono whitespace-pre-wrap leading-relaxed resize-y"
        />
      </div>
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
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [bookNameDraft, setBookNameDraft] = useState('');
  const [showBookSettings, setShowBookSettings] = useState<Record<string, boolean>>({});
  const bookNameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const save = async (next: Lorebook[]) => {
    const nextDraft = { ...draft, lorebooks: next };
    setDraft(nextDraft);
    try { await saveSettings(nextDraft); } catch {
      showToast('保存失败，请重试', 'error');
    }
  };

  const updateBook = async (bookId: string, patch: Partial<Lorebook>) => {
    const next = lorebooks.map(b => b.id !== bookId ? b : { ...b, ...patch });
    await save(next);
  };

  const updateEntry = async (bookId: string, entryId: string, patch: Partial<LorebookEntry>) => {
    const next = lorebooks.map(b => b.id !== bookId ? b : {
      ...b, entries: b.entries.map(e => e.id === entryId ? { ...e, ...patch } : e),
    });
    await save(next);
  };

  const deleteEntry = async (bookId: string, entryId: string) => {
    const next = lorebooks.map(b => b.id !== bookId ? b : {
      ...b, entries: b.entries.filter(e => e.id !== entryId),
    });
    await save(next);
  };

  const handleEditBookName = (book: Lorebook) => {
    setEditingBookId(book.id);
    setBookNameDraft(book.name);
  };

  const commitBookName = () => {
    const trimmed = bookNameDraft.trim();
    if (trimmed && editingBookId) {
      updateBook(editingBookId, { name: trimmed });
    }
    setEditingBookId(null);
  };

  useEffect(() => {
    if (editingBookId && bookNameRef.current) {
      bookNameRef.current.focus();
    }
  }, [editingBookId]);

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
      showToast(`已导入「${book.name}」: ${book.entries.length} 个条目`, 'success');
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
      excludeRecursion: false, preventRecursion: false, probability: 100, useProbability: false,
    };
    const next = lorebooks.map(b =>
      b.id !== targetId ? b : { ...b, entries: [...b.entries, newEntry] }
    );
    setExpandedBook(targetId);
    setExpandedEntry(newEntry.id);
    await save(next);
    showToast('已添加新条目', 'success');
  };

  const removeBook = async (bookId: string) => {
    await save(lorebooks.filter(b => b.id !== bookId));
  };

  const toggleBookSetting = (bookId: string) => {
    setShowBookSettings(prev => ({ ...prev, [bookId]: !prev[bookId] }));
  };

  const getPage = (bookId: string) => pages[bookId] || 1;
  const setPage = (bookId: string, p: number) => setPages(prev => ({ ...prev, [bookId]: p }));

  return (
    <div className="p-5">
      <section>
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
              showSearch ? 'border-aether-purple/40 text-aether-purple/60 bg-aether-purple/5' : 'border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40'
            }`}><Search size={13} /> 搜索条目</button>
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
                  className="w-full bg-aether-dark/60 border border-aether-border/25 rounded px-3 py-1.5 text-[11px] text-white/60 placeholder:text-white/12 focus:outline-none focus:border-aether-purple/50 transition-all font-mono" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Lorebook list ── */}
        {lorebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
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
              const showSettings = showBookSettings[book.id] ?? false;

              return (
                <div key={book.id} className="rounded-lg border border-aether-border/15 bg-aether-dark/30 overflow-hidden">
                  {/* Book header */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    {/* Big expand/collapse button */}
                    <button onClick={() => setExpandedBook(isExpanded ? null : book.id)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-aether-border/25 bg-aether-dark/40 text-white/40 hover:text-white/70 hover:border-aether-purple/40 hover:bg-aether-purple/10 transition-all">
                      <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                    </button>

                    {/* Book name */}
                    <div className="flex-1 min-w-0">
                      {editingBookId === book.id ? (
                        <input ref={bookNameRef} type="text" value={bookNameDraft}
                          onChange={e => setBookNameDraft(e.target.value)}
                          onBlur={commitBookName}
                          onKeyDown={e => { if (e.key === 'Enter') commitBookName(); if (e.key === 'Escape') setEditingBookId(null); }}
                          className="w-full bg-aether-dark/50 border border-aether-purple/30 rounded px-2 py-0.5 text-xs text-white/70 font-display focus:outline-none focus:border-aether-purple/50" />
                      ) : (
                        <span className="text-sm font-display font-medium text-white/65 truncate block">{book.name}</span>
                      )}
                    </div>

                    {/* Entry count */}
                    <span className="text-[10px] text-white/20 font-mono shrink-0">
                      {enabledCount}/{allEntries.length}
                    </span>

                    {/* Edit name */}
                    <button onClick={() => handleEditBookName(book)}
                      className="text-white/15 hover:text-aether-purple/50 transition-colors p-1"
                      title="编辑名称">
                      <Pencil size={13} />
                    </button>

                    {/* Settings toggle */}
                    <button onClick={() => toggleBookSetting(book.id)}
                      className={`p-1 rounded transition-colors ${showSettings ? 'text-aether-purple/50 bg-aether-purple/10' : 'text-white/15 hover:text-white/40'}`}
                      title="世界书设置">
                      <Settings size={13} />
                    </button>

                    {/* Delete book */}
                    <button onClick={() => removeBook(book.id)}
                      className="text-white/12 hover:text-aether-red/50 transition-colors p-1"
                      title="删除世界书">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Per-book settings panel */}
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="px-3 py-2 border-t border-aether-border/8 border-b border-aether-border/8 bg-aether-dark/20">
                          <div className="flex items-center gap-4">
                            {/* Recursive */}
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox" checked={book.recursive}
                                onChange={() => updateBook(book.id, { recursive: !book.recursive })}
                                className="accent-aether-purple h-3 w-3" />
                              <span className="text-[10px] text-white/35 font-mono">递归扫描</span>
                            </label>
                            {/* Case sensitive */}
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox" checked={book.caseSensitive ?? false}
                                onChange={() => updateBook(book.id, { caseSensitive: !book.caseSensitive })}
                                className="accent-aether-purple h-3 w-3" />
                              <span className="text-[10px] text-white/35 font-mono">区分大小写</span>
                            </label>
                            {/* Match whole words */}
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox" checked={book.matchWholeWords ?? false}
                                onChange={() => updateBook(book.id, { matchWholeWords: !book.matchWholeWords })}
                                className="accent-aether-purple h-3 w-3" />
                              <span className="text-[10px] text-white/35 font-mono">全词匹配</span>
                            </label>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                                className="text-white/20 hover:text-white/50 disabled:opacity-30"><ChevronLeft size={12} /></button>
                              <span className="text-[9px] text-white/25 font-mono w-6 text-center">{page}</span>
                              <button onClick={() => setPage(book.id, page + 1)} disabled={page >= totalPages}
                                className="text-white/20 hover:text-white/50 disabled:opacity-30"><ChevronRight size={12} /></button>
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
                                <EntryRow key={entry.id} entry={entry}
                                  isExpanded={entryExpanded}
                                  onToggleExpand={() => setExpandedEntry(entryExpanded ? null : entry.id)}
                                  onUpdate={(patch) => { void updateEntry(book.id, entry.id, patch); }}
                                  onDelete={() => { void deleteEntry(book.id, entry.id); }}
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
                                className="text-white/20 hover:text-white/50 disabled:opacity-30"><ChevronLeft size={12} /></button>
                              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let p: number;
                                if (totalPages <= 5) p = i + 1;
                                else if (page <= 3) p = i + 1;
                                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                                else p = page - 2 + i;
                                return (
                                  <button key={p} onClick={() => setPage(book.id, p)}
                                    className={`text-[9px] w-5 h-5 rounded font-mono transition-colors ${p === page ? 'bg-aether-purple/20 text-aether-purple/60' : 'text-white/25 hover:text-white/50'}`}>{p}</button>
                                );
                              })}
                              <button onClick={() => setPage(book.id, page + 1)} disabled={page >= totalPages}
                                className="text-white/20 hover:text-white/50 disabled:opacity-30"><ChevronRight size={12} /></button>
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
      </section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
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
