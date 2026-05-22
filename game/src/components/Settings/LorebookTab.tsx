import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Upload, Trash2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { SectionHeader } from './SettingsFields';
import type { AppSettings, Lorebook, LorebookEntry } from '../../sillytavern/types';
import { LOREBOOK_POSITION_MAP } from '../../sillytavern/types';
import { importLorebookFromJson } from '../../sillytavern/lorebookImporter';
import { saveSettings } from '../../sillytavern/database';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
}

const POSITION_LABELS: Record<string, string> = {
  worldInfoBefore: '角色定位之前',
  worldInfoAfter: '角色定位之后',
  worldInfoD2Before: 'D2之前',
  worldInfoD2After: 'D2之后',
};

export default function LorebookTab({ draft, setDraft }: Props) {
  const lorebooks: Lorebook[] = draft.lorebooks ?? [];
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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

  // ── Import ──
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      console.log('[LorebookTab] File size:', (text.length / 1024).toFixed(1), 'KB');
      const raw = JSON.parse(text);
      const book = importLorebookFromJson(raw);
      console.log('[LorebookTab] Imported book:', book.name, 'entries:', book.entries.length);
      const contentSize = book.entries.reduce((s, e) => s + e.content.length, 0);
      console.log('[LorebookTab] Total content size:', (contentSize / 1024).toFixed(1), 'KB');

      const currentDraft = { ...draft };
      const next = [...(currentDraft.lorebooks || []), book];
      currentDraft.lorebooks = next;
      console.log('[LorebookTab] Before setDraft, lorebooks count:', next.length);
      setDraft(currentDraft);
      console.log('[LorebookTab] Before saveSettings');
      await saveSettings(currentDraft);
      console.log('[LorebookTab] After saveSettings');
      setExpandedBook(book.id);
      showToast(`已导入「${book.name}」: ${book.entries.length} 个条目 — 已自动保存`, 'success');
    } catch (err: any) {
      console.log('[LorebookTab] Import error:', err?.message || err);
      showToast(`导入失败: ${err?.message || '无法解析'}`, 'error');
    }
    // Reset file input — use try since React may have cleaned up the event
    try { e.target.value = ''; } catch { /* ignore */ }
  }, [draft, showToast]);

  // ── Entry ops ──
  const toggleEntry = async (bookId: string, entryId: string) => {
    const next = lorebooks.map(b => b.id !== bookId ? b : {
      ...b, entries: b.entries.map(e => e.id === entryId ? { ...e, enabled: !e.enabled } : e),
    });
    await save(next);
  };

  const toggleRecursive = async (bookId: string) => {
    const next = lorebooks.map(b => b.id !== bookId ? b : { ...b, recursive: !b.recursive });
    await save(next);
  };

  const removeBook = async (bookId: string) => {
    await save(lorebooks.filter(b => b.id !== bookId));
  };

  const anchorLabel = (pos: number) => POSITION_LABELS[LOREBOOK_POSITION_MAP[pos]] || '角色定位之后';

  return (
    <div className="p-5">
      <section className="max-w-2xl">
        <SectionHeader icon={BookOpen} label="世界书配置" accent="bg-aether-purple" />

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 cursor-pointer transition-all font-display">
            <Upload size={13} /> 导入世界书
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          </label>
          {lorebooks.length > 0 && (
            <span className="text-[10px] text-white/15 font-mono ml-auto">
              {lorebooks.length} 本世界书，共 {lorebooks.reduce((s, b) => s + b.entries.length, 0)} 条目
            </span>
          )}
        </div>

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
              const enabledCount = book.entries.filter(e => e.enabled).length;
              return (
                <div key={book.id} className="rounded-lg border border-aether-border/15 bg-aether-dark/30 overflow-hidden">
                  {/* Book header */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <BookOpen size={14} className="text-aether-purple/40 shrink-0" />
                    <button
                      onClick={() => setExpandedBook(isExpanded ? null : book.id)}
                      className="flex-1 text-left flex items-center gap-1"
                    >
                      <span className="text-[9px] text-white/20">{isExpanded ? '▾' : '▸'}</span>
                      <span className="text-xs font-display font-medium text-white/60">{book.name}</span>
                      <span className="text-[10px] text-white/20 ml-1">{enabledCount}/{book.entries.length} 条目</span>
                    </button>
                    {/* Recursive toggle */}
                    <button
                      onClick={() => toggleRecursive(book.id)}
                      className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                        book.recursive
                          ? 'bg-aether-purple/15 text-aether-purple/60'
                          : 'text-white/15 hover:text-white/30'
                      }`}
                      title="递归扫描"
                    >
                      <RefreshCw size={10} /> 递归
                    </button>
                    <button onClick={() => removeBook(book.id)}
                      className="text-white/12 hover:text-aether-red/50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Entries */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden border-t border-aether-border/8"
                      >
                        <div className="space-y-0.5 p-2">
                          {book.entries.map(entry => {
                            const entryExpanded = expandedEntry === entry.id;
                            const hasKeys = entry.keys.length > 0;
                            return (
                              <div key={entry.id}
                                className={`rounded border transition-all ${
                                  entry.enabled
                                    ? 'border-aether-border/10 bg-aether-dark/25'
                                    : 'border-aether-border/5 bg-aether-dark/15 opacity-50'
                                }`}>
                                {/* Entry header */}
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={entry.enabled}
                                    onChange={() => toggleEntry(book.id, entry.id)}
                                    className="accent-aether-purple shrink-0 h-3 w-3"
                                  />
                                  <button
                                    onClick={() => setExpandedEntry(entryExpanded ? null : entry.id)}
                                    className="flex-1 text-left flex items-center gap-1 min-w-0"
                                  >
                                    <span className="text-[8px] text-white/15">{entryExpanded ? '▾' : '▸'}</span>
                                    <span className={`text-[11px] truncate ${entry.enabled ? 'text-white/55' : 'text-white/25'}`}>
                                      {entry.comment || '未命名条目'}
                                    </span>
                                    {entry.constant && (
                                      <span className="text-[8px] bg-aether-blue/10 text-aether-blue/40 px-1 rounded shrink-0">始终</span>
                                    )}
                                  </button>
                                  {/* Keywords */}
                                  {hasKeys && (
                                    <span className="text-[8px] text-white/15 font-mono truncate max-w-[120px] shrink-0 hidden sm:inline">
                                      {entry.keys.slice(0, 3).join(' ')}
                                    </span>
                                  )}
                                  <span className="text-[8px] text-white/12 font-mono shrink-0">
                                    {anchorLabel(entry.position)}
                                  </span>
                                </div>

                                {/* Entry content */}
                                <AnimatePresence initial={false}>
                                  {entryExpanded && (
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
                          })}
                        </div>
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
            条目按触发词匹配后，根据 ST position 注入到预设的对应锚点：
            <code className="text-aether-purple/30">worldInfoBefore</code>（角色定位之前）、
            <code className="text-aether-purple/30">worldInfoAfter</code>（角色定位之后）、
            <code className="text-aether-purple/30">worldInfoD2Before</code>（D2之前）或{' '}
            <code className="text-aether-purple/30">worldInfoD2After</code>（D2之后）。
            开启「递归」后，匹配到的条目内容也会触发新的匹配。
          </p>
        </div>
      </section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
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
