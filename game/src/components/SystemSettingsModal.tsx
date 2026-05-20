import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Server, Zap, AlertTriangle, CheckCircle, Loader2, ChevronRight, ChevronDown,
  BookOpen, User, Plus, Trash2, Pencil, Upload, Hash, Sliders, Star, Download,
  Save, GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { useSillytavern } from '../hooks/useSillytavern';
import type { AppSettings, ApiSettings, Lorebook, LorebookEntry, ChatPreset } from '../sillytavern/types';
import { DEFAULT_SETTINGS, createDefaultPreset } from '../sillytavern/types';
import { fetchModels, testConnection } from '../sillytavern/api-tools';
import { getDatabase } from '../sillytavern/database';
import { importMultipleLorebooks, renameLorebook, exportToJson, exportLorebook, exportPreset, importPreset } from '../sillytavern/importer';

const db = getDatabase();

/* ─────────── Tabs ─────────── */
type TabId = 'api' | 'lorebook' | 'preset' | 'identity';
interface Tab { id: TabId; label: string; icon: any; }
const TABS: Tab[] = [
  { id: 'api', label: 'API 配置', icon: Server },
  { id: 'lorebook', label: '世界书配置', icon: BookOpen },
  { id: 'preset', label: '预设配置', icon: Sliders },
  { id: 'identity', label: '玩家身份', icon: User },
];

/* ─────────── Props ─────────── */
interface Props { isOpen: boolean; onClose: () => void; }

/* ─────────── Helpers ─────────── */
function SectionHeader({ icon: Icon, label, accent }: { icon: any; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-1 h-5 rounded-full ${accent}`} />
      <Icon size={16} className={accent.replace('bg-', 'text-')} />
      <span className="font-display text-xs tracking-widest uppercase text-white/50">{label}</span>
    </div>
  );
}

function InputRow({ label, value, onChange, placeholder, type = 'text', hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-medium text-white/40 mb-1.5 tracking-wide uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/15
                   focus:outline-none focus:border-aether-cyan/60 focus:ring-1 focus:ring-aether-cyan/30
                   transition-all font-mono"
      />
      {hint && <span className="block text-[10px] text-white/25 mt-1">{hint}</span>}
    </label>
  );
}

function TextAreaRow({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-medium text-white/40 mb-1.5 tracking-wide uppercase">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/15
                   focus:outline-none focus:border-aether-cyan/60 focus:ring-1 focus:ring-aether-cyan/30
                   transition-all resize-none"
      />
    </label>
  );
}

function StatPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-aether-cyan/15 text-aether-cyan px-1.5 py-0.5 rounded-full font-mono">
      <Hash size={9} />{count}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════ */
export default function SystemSettingsModal({ isOpen, onClose }: Props) {
  const ss = useSillytavern();
  const [tab, setTab] = useState<TabId>('api');

  // ── draft ──
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [primaryModels, setPrimaryModels] = useState<string[]>([]);
  const [secondaryModels, setSecondaryModels] = useState<string[]>([]);

  // ── lorebook list (live from DB) ──
  const [lorebookList, setLorebookList] = useState<Lorebook[]>([]);
  const [lorebookActiveIds, setLorebookActiveIds] = useState<Set<string>>(new Set());
  const [expandedLorebookId, setExpandedLorebookId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState<LorebookEntry | null>(null);
  const [entryDirty, setEntryDirty] = useState(false);

  // ── preset ──
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [presetSubTab, setPresetSubTab] = useState<string>('sampling');
  const [presetDraftFull, setPresetDraftFull] = useState<ChatPreset | null>(null);
  const [presetDirty, setPresetDirty] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

  useEffect(() => {
    if (isOpen && ss.initialized) {
      if (ss.settings) setDraft(JSON.parse(JSON.stringify(ss.settings)));
      setLorebookList([...ss.lorebooks]);
    }
  }, [isOpen, ss.initialized, ss.settings, ss.lorebooks]);

  useEffect(() => {
    const fetchActive = async () => {
      const settings = await db.settings.toArray();
      setLorebookActiveIds(new Set(settings[0]?.activeLorebookIds ?? []));
    };
    if (isOpen) fetchActive();
  }, [isOpen, ss.lorebooks]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── dirty check ──
  const dirty = useMemo(() => {
    if (!draft || !ss.settings) return false;
    return JSON.stringify(draft.api) !== JSON.stringify(ss.settings.api) ||
           draft.apiMode !== ss.settings.apiMode ||
           draft.userName !== ss.settings.userName ||
           draft.characterName !== ss.settings.characterName ||
           (draft.playerTitle ?? '') !== (ss.settings.playerTitle ?? '') ||
           (draft.characterDescription ?? '') !== (ss.settings.characterDescription ?? '') ||
           (draft.scenario ?? '') !== (ss.settings.scenario ?? '');
  }, [draft, ss.settings]);

  // ── derived ──
  const isDual = draft?.apiMode === 'dual';
  const api = draft?.api ?? DEFAULT_SETTINGS.api;
  const secondary = api.secondary ?? { enabled: false, baseUrl: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 8000 };

  const patchApi = (patch: Partial<ApiSettings>) => {
    if (!draft) return;
    setDraft({ ...draft, api: { ...draft.api, ...patch } });
  };

  const patchSecondary = (patch: Partial<NonNullable<ApiSettings['secondary']>>) => {
    if (!draft) return;
    setDraft({ ...draft, api: { ...draft.api, secondary: { ...secondary, ...patch } } });
  };

  // ── save ──
  const handleSave = async () => {
    if (!draft || !ss.settings) return;
    try {
      await ss.updateSettings({
        api: draft.api,
        apiMode: draft.apiMode,
        userName: draft.userName,
        characterName: draft.characterName,
        playerTitle: draft.playerTitle,
        characterDescription: draft.characterDescription,
        scenario: draft.scenario,
      });
      showToast('配置已保存', 'success');
    } catch { showToast('保存失败', 'error'); }
  };

  // ── API actions ──
  const handleFetchModels = async (which: 'primary' | 'secondary') => {
    setBusy(`fetch-${which}`);
    try {
      const target = which === 'primary'
        ? { baseUrl: api.baseUrl, apiKey: api.apiKey }
        : { baseUrl: secondary.baseUrl, apiKey: secondary.apiKey };
      const { source, models, error } = await fetchModels(target);
      if (which === 'primary') setPrimaryModels(models);
      else setSecondaryModels(models);
      if (source === 'remote') showToast(`获取到 ${models.length} 个模型`, 'success');
      else showToast(`获取失败 (${error})，已回退常用模型列表`, 'error');
    } finally { setBusy(null); }
  };

  const handleTestConnection = async (which: 'primary' | 'secondary') => {
    setBusy(`test-${which}`);
    try {
      const target = which === 'primary'
        ? { baseUrl: api.baseUrl, apiKey: api.apiKey, model: api.model }
        : { baseUrl: secondary.baseUrl, apiKey: secondary.apiKey, model: secondary.model };
      const result = await testConnection(target);
      if (result.ok) showToast(`${which === 'primary' ? '主' : '次'} API 连通正常`, 'success');
      else showToast(`测试失败: HTTP ${result.status ?? result.error}`, 'error');
    } finally { setBusy(null); }
  };

  // ── lorebook actions ──
  const handleCreateLorebook = async () => {
    const name = prompt('新世界书名称', '新世界书');
    if (!name) return;
    await ss.addLorebookFromDefault(name);
    setLorebookList(await db.lorebooks.toArray());
    showToast(`世界书 "${name}" 已创建`, 'success');
  };

  const handleRenameLorebook = async (lb: Lorebook) => {
    const v = prompt('新名称', lb.name);
    if (!v || v === lb.name) return;
    const existing = await db.lorebooks.where('name').equals(v).first();
    if (existing && existing.id !== lb.id) {
      if (!confirm(`已存在名为 "${v}" 的世界书。确认覆盖？`)) return;
      await db.lorebooks.delete(existing.id);
    }
    await db.lorebooks.put(renameLorebook(lb, v));
    setLorebookList(await db.lorebooks.toArray());
    showToast(`已重命名为 "${v}"`, 'success');
  };

  const handleDeleteLorebook = async (lb: Lorebook) => {
    if (!confirm(`确定删除世界书 "${lb.name}"？`)) return;
    await ss.deleteLorebook(lb.id);
    setLorebookList(await db.lorebooks.toArray());
    showToast(`世界书 "${lb.name}" 已删除`, 'success');
  };

  const handleExportLorebook = (lb: Lorebook) => {
    const data = exportLorebook(lb);
    exportToJson(data, `${lb.name}.json`);
    showToast(`世界书 "${lb.name}" 已导出`, 'success');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const inputs = await Promise.all(
      files.map(async (f: File) => ({ fileName: f.name, json: JSON.parse(await f.text()) }))
    );
    const { successes, failures } = importMultipleLorebooks(inputs);
    for (const s of successes) {
      const name = s.lorebook.name !== '导入的世界书' ? s.lorebook.name : s.fileName.replace(/\.json$/i, '');
      const book: Lorebook = {
        ...s.lorebook,
        name,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await ss.addLorebook(book);
    }
    if (failures.length) {
      showToast(`${failures.length} 个文件导入失败`, 'error');
    }
    setLorebookList(await db.lorebooks.toArray());
    if (successes.length) showToast(`成功导入 ${successes.length} 本世界书`, 'success');
    e.target.value = '';
  };

  // ── entry editor handlers ──
  const openEntryEditor = useCallback((entry: LorebookEntry) => {
    setEditingEntryId(entry.id);
    setEntryDraft(JSON.parse(JSON.stringify(entry)));
    setEntryDirty(false);
  }, []);

  const closeEntryEditor = useCallback(() => {
    setEditingEntryId(null);
    setEntryDraft(null);
    setEntryDirty(false);
  }, []);

  const handleNewEntry = useCallback((lb: Lorebook) => {
    const entry: LorebookEntry = {
      id: crypto.randomUUID(),
      keys: [],
      secondaryKeys: [],
      content: '',
      comment: '',
      order: 100,
      position: 'after_char',
      selective: false,
      selectiveLogic: 'and_any',
      constant: false,
      probability: 100,
      useProbability: false,
      addMemo: false,
      disable: false,
      delayUntilRecursion: false,
      ignoreBudget: false,
    };
    openEntryEditor(entry);
  }, [openEntryEditor]);

  const handleSaveEntry = useCallback(async (lb: Lorebook) => {
    if (!entryDraft || !editingEntryId) return;
    const idx = lb.entries.findIndex(e => e.id === editingEntryId);
    let nextEntries: LorebookEntry[];
    if (idx >= 0) {
      nextEntries = lb.entries.slice();
      nextEntries[idx] = entryDraft;
    } else {
      nextEntries = [...lb.entries, entryDraft];
    }
    const updated: Lorebook = { ...lb, entries: nextEntries, updatedAt: Date.now() };
    await ss.updateLorebook(updated);
    setLorebookList(await db.lorebooks.toArray());
    closeEntryEditor();
    showToast('条目已保存', 'success');
  }, [entryDraft, editingEntryId, ss, closeEntryEditor, showToast]);

  const handleDeleteEntry = useCallback(async (lb: Lorebook, entryId: string) => {
    if (!confirm('确定删除此条目？')) return;
    const nextEntries = lb.entries.filter(e => e.id !== entryId);
    const updated: Lorebook = { ...lb, entries: nextEntries, updatedAt: Date.now() };
    await ss.updateLorebook(updated);
    setLorebookList(await db.lorebooks.toArray());
    if (editingEntryId === entryId) closeEntryEditor();
    showToast('条目已删除', 'success');
  }, [ss, editingEntryId, closeEntryEditor, showToast]);

  const patchEntryDraft = useCallback((patch: Partial<LorebookEntry>) => {
    setEntryDraft(prev => prev ? { ...prev, ...patch } : null);
    setEntryDirty(true);
  }, []);

  // ── preset handlers ──
  const handleCreatePreset = async () => {
    const name = prompt('新预设名称', '新预设');
    if (!name) return;
    try {
      await ss.addPresetFromDefault(name);
      showToast(`预设 "${name}" 已创建`, 'success');
    } catch { showToast('创建预设失败', 'error'); }
  };

  const handleActivatePreset = async (presetId: string) => {
    await ss.updateSettings({ activePresetId: presetId });
    showToast('预设已激活', 'success');
  };

  const handleDeletePreset = async (preset: ChatPreset) => {
    if (!confirm(`删除预设 "${preset.name}"？`)) return;
    await ss.deletePreset(preset.id);
    if (expandedPresetId === preset.id) setExpandedPresetId(null);
    showToast(`预设 "${preset.name}" 已删除`, 'success');
  };

  const handleRenamePreset = async (preset: ChatPreset) => {
    const v = prompt('新名称', preset.name);
    if (!v || v === preset.name) return;
    await ss.updatePreset({ ...preset, name: v });
    showToast(`已重命名为 "${v}"`, 'success');
  };

  const handleExportPreset = (preset: ChatPreset) => {
    const data = exportPreset(preset);
    exportToJson(data, `${preset.name}.json`);
    showToast(`预设 "${preset.name}" 已导出`, 'success');
  };

  const handleImportPreset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const imported = importPreset(data);
      // Use filename if JSON doesn't have a proper name
      const fallbackName = file.name.replace(/\.json$/i, '');
      const preset: ChatPreset = {
        ...imported,
        name: imported.name !== '导入的预设' ? imported.name : fallbackName,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await ss.addPreset(preset);
      showToast(`预设 "${preset.name}" 已导入`, 'success');
    } catch (err) {
      showToast('导入失败: 文件格式无效', 'error');
    }
    e.target.value = '';
  };

  const presetFileRef = useRef<HTMLInputElement>(null);

  const openPresetEdit = (preset: ChatPreset) => {
    if (expandedPresetId === preset.id) {
      setExpandedPresetId(null);
      return;
    }
    setExpandedPresetId(preset.id);
    setPresetSubTab('sections');
    setPresetDraftFull(JSON.parse(JSON.stringify(preset)));
    setPresetDirty(false);
    setExpandedSections(new Set(['main']));
  };

  const presetPatchSettings = (patch: Record<string, any>) => {
    if (!presetDraftFull) return;
    setPresetDraftFull({ ...presetDraftFull, settings: { ...presetDraftFull.settings, ...patch } });
    setPresetDirty(true);
  };

  const handleSavePresetEdits = async () => {
    if (!presetDraftFull) return;
    await ss.updatePreset({ ...presetDraftFull, updatedAt: Date.now() });
    setPresetDirty(false);
    showToast('预设已更新', 'success');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── render ──
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[960px] glass-panel border-glow overflow-hidden"
        >
          {/* Top line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/40 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-aether-border/30 bg-aether-cyan/[0.03]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-30" />
              </div>
              <h2 className="font-display font-bold text-sm tracking-[0.2em] text-aether-cyan uppercase">系统设置</h2>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-aether-cyan transition-colors p-1.5 clickable press-scale">
              <X size={18} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-5 py-3 border-b border-aether-border/20 bg-aether-dark/40 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs tracking-wider transition-all font-display whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-aether-cyan text-aether-dark font-semibold'
                    : 'text-white/40 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="max-h-[62vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* ═══════════ API CONFIG ═══════════ */}
                {tab === 'api' && draft && (
                  <div className="p-5 space-y-6">
                    {/* API Mode */}
                    <div className="flex gap-3">
                      {(['single', 'dual'] as const).map((mode) => (
                        <motion.button
                          key={mode}
                          onClick={() => setDraft({ ...draft, apiMode: mode })}
                          className={`relative flex-1 p-4 rounded-lg border text-left transition-all ${
                            draft.apiMode === mode
                              ? 'border-aether-cyan/50 bg-aether-cyan/[0.06] shadow-[0_0_20px_rgba(0,242,255,0.08)]'
                              : 'border-aether-border/20 bg-white/[0.02] hover:border-aether-border/40'
                          }`}
                        >
                          {draft.apiMode === mode && (
                            <motion.div
                              layoutId="apiMode"
                              className="absolute inset-0 rounded-lg border border-aether-cyan/30 bg-aether-cyan/[0.03]"
                              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            />
                          )}
                          <div className="relative z-10">
                            <div className={`text-sm font-display font-semibold tracking-wide mb-1 ${draft.apiMode === mode ? 'text-aether-cyan' : 'text-white/50'}`}>
                              {mode === 'single' ? '单 API' : '双 API'}
                            </div>
                            <div className="text-[11px] text-white/30 leading-relaxed">
                              {mode === 'single' ? '一个模型处理所有任务' : '主 API 负责剧情 · 次 API 负责变量'}
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    {/* Primary API */}
                    <section>
                      <SectionHeader icon={Server} label="主 API" accent="bg-aether-cyan" />
                      <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4 space-y-1">
                        <InputRow label="Base URL" value={api.baseUrl} onChange={(v) => patchApi({ baseUrl: v })} placeholder="https://api.openai.com/v1" />
                        <InputRow label="API Key" type="password" value={api.apiKey} onChange={(v) => patchApi({ apiKey: v })} placeholder="sk-..." />
                        <InputRow label="Model" value={api.model} onChange={(v) => patchApi({ model: v })} placeholder="gpt-3.5-turbo" />
                        {primaryModels.length > 0 && (
                          <label className="block mb-3">
                            <span className="block text-[10px] text-white/25 mb-1">选择模型 ({primaryModels.length})</span>
                            <select
                              onChange={(e) => { if (e.target.value) patchApi({ model: e.target.value }); }}
                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60 transition-all"
                              defaultValue=""
                            >
                              <option value="" disabled>-- 点击选择 --</option>
                              {primaryModels.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div className="flex gap-2 pt-2">
                          <ActionButton busy={busy === 'fetch-primary'} onClick={() => handleFetchModels('primary')} label={busy === 'fetch-primary' ? '获取中…' : '获取模型列表'} />
                          <ActionButton busy={busy === 'test-primary'} onClick={() => handleTestConnection('primary')} label={busy === 'test-primary' ? '测试中…' : '测试连通性'} variant="secondary" />
                        </div>
                      </div>
                    </section>

                    {/* Secondary API */}
                    <AnimatePresence>
                      {isDual && (
                        <motion.section
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <SectionHeader icon={Zap} label="次 API" accent="bg-aether-blue" />
                          <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4 space-y-1">
                            <InputRow label="Base URL" value={secondary.baseUrl} onChange={(v) => patchSecondary({ baseUrl: v, enabled: true })} placeholder="https://api.deepseek.com/v1" />
                            <InputRow label="API Key" type="password" value={secondary.apiKey} onChange={(v) => patchSecondary({ apiKey: v, enabled: true })} placeholder="sk-..." />
                            <InputRow label="Model" value={secondary.model} onChange={(v) => patchSecondary({ model: v, enabled: true })} placeholder="deepseek-chat" />
                            {secondaryModels.length > 0 && (
                              <label className="block mb-3">
                                <span className="block text-[10px] text-white/25 mb-1">选择模型 ({secondaryModels.length})</span>
                                <select
                                  onChange={(e) => { if (e.target.value) patchSecondary({ model: e.target.value, enabled: true }); }}
                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/70 font-mono focus:outline-none focus:border-aether-blue/60 transition-all"
                                  defaultValue=""
                                >
                                  <option value="" disabled>-- 点击选择 --</option>
                                  {secondaryModels.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <div className="flex gap-3 pt-1">
                              <InputRow label="温度" value={String(secondary.temperature ?? 0.7)} onChange={(v) => patchSecondary({ temperature: Number(v) || 0.7, enabled: true })} />
                              <InputRow label="Max Tokens" value={String(secondary.maxTokens ?? 8000)} onChange={(v) => patchSecondary({ maxTokens: Number(v) || 8000, enabled: true })} />
                            </div>
                            <div className="flex gap-2 pt-2">
                              <ActionButton busy={busy === 'fetch-secondary'} onClick={() => handleFetchModels('secondary')} label={busy === 'fetch-secondary' ? '获取中…' : '获取模型列表'} />
                              <ActionButton busy={busy === 'test-secondary'} onClick={() => handleTestConnection('secondary')} label={busy === 'test-secondary' ? '测试中…' : '测试连通性'} variant="secondary" />
                            </div>
                            <p className="text-[10px] text-white/20 mt-2 flex items-center gap-1">
                              <AlertTriangle size={10} /> 次 API 失败时自动回退到主 API
                            </p>
                          </div>
                        </motion.section>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ═══════════ LOREBOOK ═══════════ */}
                {tab === 'lorebook' && (
                  <div className="p-5 space-y-4">
                    {/* Action bar */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCreateLorebook}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-aether-cyan text-aether-dark text-xs font-semibold tracking-wide hover:bg-white transition-all font-display"
                      >
                        <Plus size={14} /> 新建世界书
                      </button>
                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-aether-border/30 text-white/50 hover:text-white/80 hover:border-aether-cyan/40 text-xs tracking-wide cursor-pointer transition-all font-display">
                        <Upload size={14} /> 导入 JSON
                        <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={handleImportJson} />
                      </label>
                    </div>

                    {/* List */}
                    {lorebookList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-aether-cyan/5 border border-aether-border/20 flex items-center justify-center mb-4">
                          <BookOpen size={28} className="text-white/15" />
                        </div>
                        <p className="text-white/25 text-sm font-display tracking-wide mb-1">暂无世界书</p>
                        <p className="text-white/10 text-xs">点击「新建世界书」或「导入 JSON」开始构建世界观</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lorebookList.map((lb) => {
                          const isActive = lorebookActiveIds.has(lb.id);
                          const isExpanded = expandedLorebookId === lb.id;
                          return (
                            <React.Fragment key={lb.id}>
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative rounded-lg border transition-all group cursor-pointer ${
                                  isActive
                                    ? 'border-aether-cyan/30 bg-aether-cyan/[0.04] shadow-[0_0_12px_rgba(0,242,255,0.04)]'
                                    : 'border-aether-border/20 bg-aether-dark/30 hover:border-aether-border/40'
                                }`}
                              >
                                {/* Active indicator */}
                                {isActive && (
                                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-aether-cyan rounded-r-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                                )}

                                <div className="flex items-center gap-3 px-4 py-3">
                                  {/* Checkbox */}
                                  <button
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      ss.toggleLorebook(lb.id);
                                      setLorebookActiveIds((prev) => {
                                        const next = new Set(prev);
                                        next.has(lb.id) ? next.delete(lb.id) : next.add(lb.id);
                                        return next;
                                      });
                                    }}
                                    className={`relative w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                      isActive
                                        ? 'border-aether-cyan bg-aether-cyan/20 shadow-[0_0_8px_rgba(0,242,255,0.3)]'
                                        : 'border-white/15 bg-transparent group-hover:border-white/30'
                                    }`}
                                  >
                                    {isActive && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-2.5 h-2.5 bg-aether-cyan rounded-sm"
                                      />
                                    )}
                                  </button>

                                  {/* Info */}
                                  <div
                                    className="flex-1 min-w-0"
                                    onClick={() => setExpandedLorebookId(isExpanded ? null : lb.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-display font-medium tracking-wide truncate ${isActive ? 'text-white/80' : 'text-white/50'}`}>
                                        {lb.name}
                                      </span>
                                      <StatPill count={lb.entries.length} />
                                      <motion.span
                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="text-white/20"
                                      >
                                        <ChevronRight size={14} />
                                      </motion.span>
                                    </div>
                                    {lb.description && (
                                      <p className="text-[11px] text-white/25 truncate mt-0.5">{lb.description}</p>
                                    )}
                                    {!isExpanded && lb.entries.length > 0 && (
                                      <p className="text-[10px] text-white/15 mt-1 truncate">
                                        {lb.entries.slice(0, 3).map(e => e.comment || e.content.slice(0, 20)).join(' · ')}
                                      </p>
                                    )}
                                  </div>

                                  {/* Actions (hover reveal) */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleExportLorebook(lb);
                                      }}
                                      className="p-1.5 rounded text-white/25 hover:text-aether-green hover:bg-aether-green/10 transition-all"
                                      title="导出"
                                    >
                                      <Download size={13} />
                                    </button>
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleRenameLorebook(lb);
                                      }}
                                      className="p-1.5 rounded text-white/25 hover:text-aether-cyan hover:bg-aether-cyan/10 transition-all"
                                      title="重命名"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleDeleteLorebook(lb);
                                      }}
                                      className="p-1.5 rounded text-white/25 hover:text-aether-red hover:bg-aether-red/10 transition-all"
                                      title="删除"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </motion.div>

                              {/* Expanded: worldbook settings + split-panel entry editor */}
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="ml-8 mr-2 mb-3 space-y-3 border-l border-aether-border/20 pl-4 pt-2">
                                      {/* Worldbook settings */}
                                      <div className="bg-aether-dark/40 rounded-lg border border-aether-border/15 p-3">
                                        <h4 className="text-[11px] font-display font-semibold text-white/40 uppercase tracking-wider mb-2">世界书设置</h4>
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <label className="flex items-center gap-1.5 text-[11px] text-white/40 cursor-pointer">
                                            <input type="checkbox" checked={lb.recursiveScanning}
                                              onChange={async () => {
                                                await ss.updateLorebook({ ...lb, recursiveScanning: !lb.recursiveScanning, updatedAt: Date.now() });
                                                setLorebookList(await db.lorebooks.toArray());
                                              }} className="accent-aether-cyan" />
                                            递归扫描
                                          </label>
                                          <label className="flex items-center gap-1.5 text-[11px] text-white/40 cursor-pointer">
                                            <input type="checkbox" checked={lb.caseSensitive}
                                              onChange={async () => {
                                                await ss.updateLorebook({ ...lb, caseSensitive: !lb.caseSensitive, updatedAt: Date.now() });
                                                setLorebookList(await db.lorebooks.toArray());
                                              }} className="accent-aether-cyan" />
                                            区分大小写
                                          </label>
                                          <label className="flex items-center gap-1.5 text-[11px] text-white/40 cursor-pointer">
                                            <input type="checkbox" checked={lb.matchWholeWords}
                                              onChange={async () => {
                                                await ss.updateLorebook({ ...lb, matchWholeWords: !lb.matchWholeWords, updatedAt: Date.now() });
                                                setLorebookList(await db.lorebooks.toArray());
                                              }} className="accent-aether-cyan" />
                                            全词匹配
                                          </label>
                                          <StatPill count={lb.entries.length} />
                                        </div>
                                      </div>

                                      {/* Entry list with inline accordion editors */}
                                      <div className="space-y-2">
                                        <button
                                          onClick={() => handleNewEntry(lb)}
                                          className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg bg-aether-cyan/15 border border-aether-cyan/25 text-aether-cyan text-xs font-semibold tracking-wide hover:bg-aether-cyan/25 transition-all font-display justify-center"
                                        >
                                          <Plus size={14} /> 新建条目
                                        </button>

                                        {lb.entries.length === 0 ? (
                                          <p className="text-[11px] text-white/15 text-center py-6">暂无条目，点击上方按钮新建</p>
                                        ) : (
                                          lb.entries.map((entry, idx) => {
                                            const isEditing = editingEntryId === entry.id;
                                            return (
                                              <div key={entry.id}
                                                className={`rounded-lg border transition-all ${
                                                  isEditing
                                                    ? 'border-aether-cyan/25 bg-aether-cyan/[0.03]'
                                                    : entry.disable
                                                      ? 'border-aether-border/10 bg-aether-dark/30 opacity-60'
                                                      : 'border-aether-border/15 bg-aether-dark/30 hover:border-aether-border/30'
                                                }`}
                                              >
                                                {/* Entry header row */}
                                                <div
                                                  onClick={() => isEditing ? closeEntryEditor() : openEntryEditor(entry)}
                                                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer group"
                                                >
                                                  <motion.span
                                                    animate={{ rotate: isEditing ? 90 : 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="text-white/20"
                                                  >
                                                    <ChevronRight size={13} />
                                                  </motion.span>
                                                  <span className="text-[10px] text-white/15 font-mono w-5 shrink-0">#{idx + 1}</span>
                                                  <span className={`text-[12px] font-display truncate flex-1 ${isEditing ? 'text-aether-cyan/80' : entry.disable ? 'text-white/30' : 'text-white/55'}`}>
                                                    {entry.comment || entry.content.slice(0, 35) || '(未命名)'}
                                                  </span>
                                                  {entry.constant && <span className="text-[8px] bg-aether-purple/15 text-aether-purple/50 px-1.5 py-0.5 rounded font-mono shrink-0">常驻</span>}
                                                  {entry.selective && <span className="text-[8px] bg-aether-blue/15 text-aether-blue/50 px-1.5 py-0.5 rounded font-mono shrink-0">选择性</span>}
                                                  {entry.disable && <span className="text-[8px] bg-aether-red/10 text-aether-red/40 px-1.5 py-0.5 rounded font-mono shrink-0">已禁用</span>}
                                                  <span className="text-[9px] text-white/10 font-mono shrink-0">{entry.keys.length > 0 ? entry.keys.slice(0,3).join(', ') : '无关键词'}</span>
                                                </div>

                                                {/* Expanded editor */}
                                                <AnimatePresence>
                                                  {isEditing && entryDraft && (
                                                    <motion.div
                                                      initial={{ height: 0, opacity: 0 }}
                                                      animate={{ height: 'auto', opacity: 1 }}
                                                      exit={{ height: 0, opacity: 0 }}
                                                      transition={{ duration: 0.2 }}
                                                      className="overflow-hidden"
                                                    >
                                                      <div className="px-4 pb-4 space-y-3 border-t border-aether-border/10 pt-3">
                                                        {/* ── Row 1: 备注 ── */}
                                                        <label className="block">
                                                          <span className="block text-[10px] text-white/30 mb-1">备注</span>
                                                          <input type="text" value={entryDraft.comment ?? ''}
                                                            onChange={e => patchEntryDraft({ comment: e.target.value })}
                                                            placeholder="条目显示名称"
                                                            className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 placeholder:text-white/15 focus:outline-none focus:border-aether-cyan/60 transition-all" />
                                                        </label>

                                                        {/* ── Row 2: 主关键词 + 次级关键词 ── */}
                                                        <ChipInput label="主关键词" values={entryDraft.keys}
                                                          onChange={keys => patchEntryDraft({ keys })} placeholder="输入关键词，回车添加" />
                                                        <ChipInput label="次级关键词" values={entryDraft.secondaryKeys}
                                                          onChange={secondaryKeys => patchEntryDraft({ secondaryKeys })} placeholder="选择性模式下启用" />

                                                        {/* ── Row 3: 位置 + 优先级 + 深度/角色/出口名 ── */}
                                                        <div className="flex gap-3 flex-wrap items-end">
                                                          <label className="flex-1 min-w-[140px]">
                                                            <span className="block text-[10px] text-white/30 mb-1">位置</span>
                                                            <select value={entryDraft.position}
                                                              onChange={e => patchEntryDraft({ position: e.target.value as LorebookEntry['position'] })}
                                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/60 focus:outline-none focus:border-aether-cyan/60 transition-all">
                                                              <option value="before_char">角色前 (before_char)</option>
                                                              <option value="after_char">角色后 (after_char)</option>
                                                              <option value="before_example">示例前 (before_example)</option>
                                                              <option value="after_example">示例后 (after_example)</option>
                                                              <option value="at_depth">按深度 (at_depth)</option>
                                                              <option value="example_msg_top">示例消息顶 (example_msg_top)</option>
                                                              <option value="example_msg_bottom">示例消息底 (example_msg_bottom)</option>
                                                              <option value="outlet">出口 (outlet)</option>
                                                            </select>
                                                          </label>
                                                          <label className="w-20">
                                                            <span className="block text-[10px] text-white/30 mb-1">优先级</span>
                                                            <input type="number" value={entryDraft.order}
                                                              onChange={e => patchEntryDraft({ order: Number(e.target.value) || 100 })}
                                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                          </label>
                                                          {entryDraft.position === 'at_depth' && (
                                                            <>
                                                              <label className="w-20">
                                                                <span className="block text-[10px] text-white/30 mb-1">深度</span>
                                                                <input type="number" value={entryDraft.depth ?? 4}
                                                                  onChange={e => patchEntryDraft({ depth: Number(e.target.value) || 4 })}
                                                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                              </label>
                                                              <label className="w-24">
                                                                <span className="block text-[10px] text-white/30 mb-1">角色</span>
                                                                <select value={entryDraft.role ?? 0}
                                                                  onChange={e => patchEntryDraft({ role: Number(e.target.value) })}
                                                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/60 focus:outline-none focus:border-aether-cyan/60">
                                                                  <option value={0}>系统</option>
                                                                  <option value={1}>用户</option>
                                                                  <option value={2}>助手</option>
                                                                </select>
                                                              </label>
                                                            </>
                                                          )}
                                                          {entryDraft.position === 'outlet' && (
                                                            <label className="flex-1 min-w-[120px]">
                                                              <span className="block text-[10px] text-white/30 mb-1">出口名称</span>
                                                              <input type="text" value={entryDraft.outletName ?? ''}
                                                                onChange={e => patchEntryDraft({ outletName: e.target.value })}
                                                                className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                            </label>
                                                          )}
                                                        </div>

                                                        {/* ── Row 4: 常驻 / 禁用 / 添加备注 / 忽略预算 ── */}
                                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                                          <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer">
                                                            <input type="checkbox" checked={entryDraft.constant}
                                                              onChange={e => patchEntryDraft({ constant: e.target.checked })}
                                                              className="accent-aether-purple" /> 常驻
                                                          </label>
                                                          <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer">
                                                            <input type="checkbox" checked={entryDraft.disable ?? false}
                                                              onChange={e => patchEntryDraft({ disable: e.target.checked })}
                                                              className="accent-aether-red" /> 禁用
                                                          </label>
                                                          <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer">
                                                            <input type="checkbox" checked={entryDraft.addMemo}
                                                              onChange={e => patchEntryDraft({ addMemo: e.target.checked })}
                                                              className="accent-aether-cyan" /> 添加备注
                                                          </label>
                                                          <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer">
                                                            <input type="checkbox" checked={entryDraft.ignoreBudget ?? false}
                                                              onChange={e => patchEntryDraft({ ignoreBudget: e.target.checked })}
                                                              className="accent-aether-cyan" /> 忽略预算
                                                          </label>
                                                        </div>

                                                        {/* ── Row 5: 选择性 + 逻辑 + 概率 ── */}
                                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                                          <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer">
                                                            <input type="checkbox" checked={entryDraft.selective}
                                                              onChange={e => patchEntryDraft({ selective: e.target.checked })}
                                                              className="accent-aether-blue" /> 选择性
                                                          </label>
                                                          {entryDraft.selective && (
                                                            <select value={entryDraft.selectiveLogic}
                                                              onChange={e => patchEntryDraft({ selectiveLogic: e.target.value as LorebookEntry['selectiveLogic'] })}
                                                              className="bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-[10px] text-white/50 focus:outline-none focus:border-aether-blue/60">
                                                              <option value="and_any">与/任一 (and_any)</option>
                                                              <option value="not_all">非全部 (not_all)</option>
                                                              <option value="not_any">无任一 (not_any)</option>
                                                              <option value="and_all">与/全部 (and_all)</option>
                                                            </select>
                                                          )}
                                                          <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer">
                                                            <input type="checkbox" checked={entryDraft.useProbability ?? false}
                                                              onChange={e => patchEntryDraft({ useProbability: e.target.checked })}
                                                              className="accent-aether-gold" /> 概率触发
                                                          </label>
                                                          {entryDraft.useProbability && (
                                                            <label className="flex items-center gap-1 text-[10px] text-white/30">
                                                              <input type="number" value={entryDraft.probability} min={0} max={100}
                                                                onChange={e => patchEntryDraft({ probability: Math.min(100, Math.max(0, Number(e.target.value) || 100)) })}
                                                                className="w-16 bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-[10px] text-white/70 font-mono focus:outline-none focus:border-aether-gold/60" />
                                                              %
                                                            </label>
                                                          )}
                                                        </div>

                                                        {/* ── Row 6: 粘性 / 冷却 / 延迟 / 权重 / 扫描深度 ── */}
                                                        <div className="flex gap-3 flex-wrap">
                                                          <label className="flex-1 min-w-[80px]">
                                                            <span className="block text-[10px] text-white/30 mb-1">粘性回合</span>
                                                            <input type="number" value={entryDraft.sticky ?? 0}
                                                              onChange={e => patchEntryDraft({ sticky: Number(e.target.value) || 0 })}
                                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                          </label>
                                                          <label className="flex-1 min-w-[80px]">
                                                            <span className="block text-[10px] text-white/30 mb-1">冷却回合</span>
                                                            <input type="number" value={entryDraft.cooldown ?? 0}
                                                              onChange={e => patchEntryDraft({ cooldown: Number(e.target.value) || 0 })}
                                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                          </label>
                                                          <label className="flex-1 min-w-[80px]">
                                                            <span className="block text-[10px] text-white/30 mb-1">延迟回合</span>
                                                            <input type="number" value={entryDraft.delay ?? 0}
                                                              onChange={e => patchEntryDraft({ delay: Number(e.target.value) || 0 })}
                                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                          </label>
                                                          <label className="flex-1 min-w-[80px]">
                                                            <span className="block text-[10px] text-white/30 mb-1">权重</span>
                                                            <input type="number" value={entryDraft.weight ?? 100}
                                                              onChange={e => patchEntryDraft({ weight: Number(e.target.value) || 100 })}
                                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                          </label>
                                                          <label className="flex-1 min-w-[80px]">
                                                            <span className="block text-[10px] text-white/30 mb-1">扫描深度</span>
                                                            <input type="number" value={entryDraft.scanDepth ?? 0}
                                                              onChange={e => patchEntryDraft({ scanDepth: Number(e.target.value) || 0 })}
                                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                                          </label>
                                                        </div>

                                                        {/* ── Row 7: 高级匹配选项 + 角色卡匹配 ── */}
                                                        <details className="border-t border-aether-border/10 pt-2">
                                                          <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/40 transition-colors font-display tracking-wide select-none">匹配选项与角色卡过滤</summary>
                                                          <div className="pt-2 space-y-2">
                                                            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                                                              {([
                                                                ['caseSensitive', '区分大小写'],
                                                                ['matchWholeWords', '全词匹配'],
                                                                ['excludeRecursion', '排除递归'],
                                                                ['preventRecursion', '阻止递归'],
                                                                ['delayUntilRecursion', '延迟至递归触发'],
                                                              ] as const).map(([k, label]) => (
                                                                <label key={k} className="flex items-center gap-1.5 text-[10px] text-white/35 cursor-pointer">
                                                                  <input type="checkbox"
                                                                    checked={(entryDraft as any)[k] ?? false}
                                                                    onChange={e => patchEntryDraft({ [k]: e.target.checked } as any)}
                                                                    className="accent-aether-cyan" />
                                                                  {label}
                                                                </label>
                                                              ))}
                                                            </div>
                                                            <fieldset className="border border-aether-border/10 rounded p-2">
                                                              <legend className="text-[9px] text-white/20 px-1">角色卡匹配</legend>
                                                              <div className="flex flex-wrap gap-x-5 gap-y-1">
                                                                {([
                                                                  ['matchPersonaDescription', '人设描述'],
                                                                  ['matchCharacterDescription', '角色描述'],
                                                                  ['matchCharacterPersonality', '角色性格'],
                                                                  ['matchCharacterDepthPrompt', '深层提示'],
                                                                  ['matchScenario', '场景'],
                                                                  ['matchCreatorNotes', '创建者备注'],
                                                                ] as const).map(([k, label]) => (
                                                                  <label key={k} className="flex items-center gap-1.5 text-[10px] text-white/30 cursor-pointer">
                                                                    <input type="checkbox"
                                                                      checked={(entryDraft as any)[k] ?? false}
                                                                      onChange={e => patchEntryDraft({ [k]: e.target.checked } as any)}
                                                                      className="accent-aether-purple" />
                                                                    {label}
                                                                  </label>
                                                                ))}
                                                              </div>
                                                            </fieldset>
                                                            {/* Decorators */}
                                                            <label className="block">
                                                              <span className="block text-[9px] text-white/20 mb-0.5">装饰器（逗号分隔）</span>
                                                              <input type="text"
                                                                value={(entryDraft.decorators ?? []).join(', ')}
                                                                onChange={e => patchEntryDraft({ decorators: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                                className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-[10px] text-white/60 focus:outline-none focus:border-aether-cyan/60" />
                                                            </label>
                                                          </div>
                                                        </details>

                                                        {/* ── Content: AT BOTTOM ── */}
                                                        <label className="block">
                                                          <span className="block text-[10px] text-white/30 mb-1">内容</span>
                                                          <textarea value={entryDraft.content}
                                                            onChange={e => patchEntryDraft({ content: e.target.value })}
                                                            rows={6}
                                                            placeholder="匹配后注入到提示词中的正文内容..."
                                                            className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 placeholder:text-white/15 focus:outline-none focus:border-aether-cyan/60 transition-all resize-none font-mono leading-relaxed" />
                                                          <p className="text-[9px] text-white/12 mt-1">支持宏：{`{{user}}`} {`{{char}}`}</p>
                                                        </label>

                                                        {/* ── Actions ── */}
                                                        <div className="flex items-center justify-between pt-2 border-t border-aether-border/10">
                                                          <button onClick={() => handleDeleteEntry(lb, entry.id)}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] text-white/20 hover:text-aether-red hover:bg-aether-red/[0.06] transition-all font-display tracking-wide">
                                                            <Trash2 size={11} /> 删除条目
                                                          </button>
                                                          <div className="flex items-center gap-2">
                                                            <button onClick={closeEntryEditor}
                                                              className="px-3 py-1.5 rounded text-[10px] text-white/30 hover:text-white/60 transition-colors font-display tracking-wide">
                                                              取消
                                                            </button>
                                                            <button onClick={() => handleSaveEntry(lb)}
                                                              disabled={!entryDirty}
                                                              className={`flex items-center gap-1 px-4 py-1.5 rounded text-[11px] font-display tracking-wide transition-all ${
                                                                entryDirty
                                                                  ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_12px_rgba(0,242,255,0.2)] hover:shadow-[0_0_20px_rgba(0,242,255,0.35)]'
                                                                  : 'bg-white/5 text-white/15 cursor-not-allowed'
                                                              }`}>
                                                              <Save size={12} /> 保存条目
                                                            </button>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </motion.div>
                                                  )}
                                                </AnimatePresence>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════ PRESET ═══════════ */}
                {tab === 'preset' && (
                  <div className="p-5 space-y-4">
                    {/* Action bar */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCreatePreset}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-aether-cyan text-aether-dark text-xs font-semibold tracking-wide hover:bg-white transition-all font-display"
                      >
                        <Plus size={14} /> 新建预设
                      </button>
                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-aether-border/30 text-white/50 hover:text-white/80 hover:border-aether-purple/40 text-xs tracking-wide cursor-pointer transition-all font-display">
                        <Upload size={14} /> 导入预设
                        <input ref={presetFileRef} type="file" accept=".json" className="hidden" onChange={handleImportPreset} />
                      </label>
                    </div>

                    {/* List */}
                    {ss.presets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-aether-cyan/5 border border-aether-border/20 flex items-center justify-center mb-4">
                          <Sliders size={28} className="text-white/15" />
                        </div>
                        <p className="text-white/25 text-sm font-display tracking-wide mb-1">暂无预设</p>
                        <p className="text-white/10 text-xs">点击「新建预设」创建采样参数配置</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ss.presets.map((preset) => {
                          const isActive = ss.settings?.activePresetId === preset.id;
                          const isExpanded = expandedPresetId === preset.id;
                          return (
                            <React.Fragment key={preset.id}>
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative rounded-lg border transition-all group cursor-pointer ${
                                  isActive
                                    ? 'border-aether-purple/40 bg-aether-purple/[0.05] shadow-[0_0_12px_rgba(168,85,247,0.06)]'
                                    : 'border-aether-border/20 bg-aether-dark/30 hover:border-aether-border/40'
                                }`}
                              >
                                {isActive && (
                                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-aether-purple rounded-r-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                )}

                                <div className="flex items-center gap-3 px-4 py-3">
                                  {/* Star — click to toggle activation */}
                                  <button
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      if (isActive) {
                                        ss.updateSettings({ activePresetId: null });
                                        showToast('已取消激活', 'success');
                                      } else {
                                        handleActivatePreset(preset.id);
                                      }
                                    }}
                                    className={`flex items-center justify-center w-5 h-5 flex-shrink-0 transition-all clickable press-scale ${isActive ? 'text-aether-gold hover:text-aether-gold/70' : 'text-white/15 hover:text-aether-gold/60'}`}
                                    title={isActive ? '点击取消激活' : '点击激活'}
                                  >
                                    <Star size={isActive ? 16 : 14} fill={isActive ? 'currentColor' : 'none'} />
                                  </button>

                                  {/* Info */}
                                  <div
                                    className="flex-1 min-w-0"
                                    onClick={() => openPresetEdit(preset)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-display font-medium tracking-wide truncate ${isActive ? 'text-white/80' : 'text-white/50'}`}>
                                        {preset.name}
                                      </span>
                                      {isActive && (
                                        <span className="text-[9px] bg-aether-purple/20 text-aether-purple px-1.5 py-0.5 rounded-full font-mono">激活中</span>
                                      )}
                                      <motion.span
                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="text-white/20"
                                      >
                                        <ChevronRight size={14} />
                                      </motion.span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/20 font-mono">
                                      <span>temp: {preset.settings.temp_openai ?? 0.8}</span>
                                      <span>max_tokens: {preset.settings.openai_max_tokens ?? 2048}</span>
                                      <span>top_p: {preset.settings.top_p_openai ?? 0.9}</span>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleExportPreset(preset);
                                      }}
                                      className="p-1.5 rounded text-white/25 hover:text-aether-green hover:bg-aether-green/10 transition-all"
                                      title="导出"
                                    >
                                      <Download size={13} />
                                    </button>
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); handleRenamePreset(preset); }}
                                      className="p-1.5 rounded text-white/25 hover:text-aether-cyan hover:bg-aether-cyan/10 transition-all"
                                      title="重命名"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); handleDeletePreset(preset); }}
                                      className="p-1.5 rounded text-white/25 hover:text-aether-red hover:bg-aether-red/10 transition-all"
                                      title="删除"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </motion.div>

                              {/* Expanded preset editor — ST-native 4-tab */}
                              <AnimatePresence initial={false}>
                                {isExpanded && presetDraftFull && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="ml-8 mr-2 mb-3 space-y-3 border-l border-aether-border/20 pl-4 pt-2">
                                      {/* Preset name */}
                                      <div className="bg-aether-dark/40 rounded-lg border border-aether-border/15 p-3">
                                        <label className="flex items-center gap-3">
                                          <span className="text-[11px] text-white/40 font-display tracking-wide shrink-0">名称</span>
                                          <input type="text" value={presetDraftFull.name}
                                            onChange={e => { setPresetDraftFull({ ...presetDraftFull, name: e.target.value }); setPresetDirty(true); }}
                                            className="flex-1 bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-aether-purple/60 transition-all" />
                                        </label>
                                      </div>

                                      {/* Sub-tabs */}
                                      <div className="flex gap-1 flex-wrap">
                                        <button
                                          onClick={() => setPresetSubTab('sections')}
                                          className={`px-3 py-1.5 rounded-full text-[11px] font-display tracking-wide transition-all ${
                                            presetSubTab === 'sections'
                                              ? 'bg-aether-purple/30 text-aether-purple border border-aether-purple/40'
                                              : 'text-white/30 hover:text-white/50 border border-transparent hover:border-white/10'
                                          }`}>
                                          预设词块
                                        </button>
                                        <button
                                          onClick={() => setPresetSubTab('sampling')}
                                          className={`px-3 py-1.5 rounded-full text-[11px] font-display tracking-wide transition-all ${
                                            presetSubTab === 'sampling'
                                              ? 'bg-aether-purple/30 text-aether-purple border border-aether-purple/40'
                                              : 'text-white/30 hover:text-white/50 border border-transparent hover:border-white/10'
                                          }`}>
                                          采样参数
                                        </button>
                                      </div>

                                      {/* TAB: 预设词块 — prompt_order + custom prompts merged */}
                                      {presetSubTab === 'sections' && (
                                        <div className="space-y-1">
                                          {(() => {
                                            const orderItems = (presetDraftFull.settings.prompt_order ?? []) as any[];
                                            const customPrompts = (presetDraftFull.settings.prompts ?? []) as any[];
                                            const orderIds = new Set(orderItems.map((i: any) => i.identifier));
                                            const extraPrompts = customPrompts.filter((p: any) => !orderIds.has(p.identifier));
                                            const allItems = [...orderItems, ...extraPrompts];
                                            if (allItems.length === 0) return <p className="text-[11px] text-white/20 text-center py-6">暂无预设词块数据</p>;
                                            return allItems.map((item: any, idx: number) => {
                                              const isOrderItem = orderIds.has(item.identifier);
                                              const sectionEnabled = item.enabled !== false;
                                              const content = item.content ?? (presetDraftFull.settings as any)[item.identifier] ?? '';
                                              const isExpanded = expandedSections.has(item.identifier);
                                              const patchItem = (patch: any) => {
                                                if (isOrderItem) {
                                                  const list = [...(presetDraftFull.settings.prompt_order ?? [])];
                                                  const oi = list.findIndex((i: any) => i.identifier === item.identifier);
                                                  if (oi >= 0) { list[oi] = { ...list[oi], ...patch }; presetPatchSettings({ prompt_order: list }); }
                                                } else {
                                                  const list = [...(presetDraftFull.settings.prompts ?? [])];
                                                  const pi = list.findIndex((p: any) => p.identifier === item.identifier);
                                                  if (pi >= 0) { list[pi] = { ...list[pi], ...patch }; presetPatchSettings({ prompts: list }); }
                                                }
                                              };
                                              return (
                                                <div key={item.identifier}
                                                  className={`rounded-lg border transition-all ${
                                                    sectionEnabled ? 'border-aether-border/15 bg-aether-dark/40' : 'border-aether-border/8 bg-aether-dark/20 opacity-60'
                                                  }`}>
                                                  <div className="flex items-center gap-2 px-3 py-2">
                                                    <input type="checkbox" checked={sectionEnabled}
                                                      onChange={e => patchItem({ enabled: e.target.checked })}
                                                      className="accent-aether-purple shrink-0" />
                                                    <span onClick={() => { if (!sectionEnabled) return;
                                                      setExpandedSections(prev => { const next = new Set(prev); next.has(item.identifier) ? next.delete(item.identifier) : next.add(item.identifier); return next; });
                                                    }}
                                                      className={`text-[12px] font-display font-medium flex-1 cursor-pointer select-none hover:text-white/80 transition-colors ${sectionEnabled ? 'text-white/60' : 'text-white/25'}`}>
                                                      {isExpanded ? '▾ ' : '▸ '}{item.name || item.identifier}
                                                    </span>
                                                    <span className="text-[9px] text-white/15 font-mono">{item.identifier}</span>
                                                    {isOrderItem && (<>
                                                      <button disabled={idx === 0}
                                                        onClick={() => {
                                                          const list = [...(presetDraftFull.settings.prompt_order ?? [])];
                                                          [list[idx-1], list[idx]] = [list[idx], list[idx-1]];
                                                          presetPatchSettings({ prompt_order: list });
                                                        }}
                                                        className="text-[10px] text-white/15 hover:text-white/40 disabled:opacity-15 px-0.5" title="上移">↑</button>
                                                      <button disabled={idx === orderItems.length - 1}
                                                        onClick={() => {
                                                          const list = [...(presetDraftFull.settings.prompt_order ?? [])];
                                                          [list[idx], list[idx+1]] = [list[idx+1], list[idx]];
                                                          presetPatchSettings({ prompt_order: list });
                                                        }}
                                                        className="text-[10px] text-white/15 hover:text-white/40 disabled:opacity-15 px-0.5" title="下移">↓</button>
                                                    </>)}
                                                  </div>
                                                  {sectionEnabled && isExpanded && (
                                                    <div className="px-3 pb-3">
                                                      <textarea value={content}
                                                        onChange={e => patchItem({ content: e.target.value })}
                                                        rows={item.identifier === 'main' ? 6 : 3}
                                                        className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 placeholder:text-white/15 focus:outline-none focus:border-aether-purple/60 transition-all resize-none font-mono leading-relaxed" />
                                                      {item.identifier === 'main' && (
                                                        <p className="text-[9px] text-white/12 mt-1">支持宏：{`{{user}}`} {`{{char}}`} {`{{original}}`} {`{{变量名}}`}</p>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            });
                                          })()}
                                        </div>
                                      )}

                                      {/* TAB: Sampling */}{/* Save */}
                                      <div className="flex justify-end">
                                        <button onClick={handleSavePresetEdits}
                                          disabled={!presetDirty}
                                          className={`px-4 py-1.5 rounded text-xs font-display tracking-wide transition-all ${
                                            presetDirty
                                              ? 'bg-aether-purple text-white shadow-[0_0_12px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                                              : 'bg-white/5 text-white/20 cursor-not-allowed'
                                          }`}>
                                          保存修改
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════ IDENTITY ═══════════ */}
                {tab === 'identity' && draft && (
                  <div className="p-5">
                    <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4 max-w-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full border-2 border-aether-cyan/40 bg-aether-cyan/10 flex items-center justify-center flex-shrink-0">
                          <User size={20} className="text-aether-cyan" />
                        </div>
                        <div>
                          <h4 className="text-sm font-display font-semibold text-aether-cyan tracking-wide">玩家信息</h4>
                          <p className="text-[10px] text-white/25">设定玩家名与角色设定</p>
                        </div>
                      </div>
                      <InputRow label="玩家名" value={draft.userName} onChange={(v) => setDraft({ ...draft, userName: v })} placeholder="输入你的名字" hint="使用宏 {{user}} 在提示词中引用" />
                      <TextAreaRow label="玩家设定" value={draft.playerDescription ?? ''} onChange={(v) => setDraft({ ...draft, playerDescription: v })} placeholder="描述你的角色设定、背景故事、性格特征... AI 会在对话中参考这些设定" rows={4} />
                    </section>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />

          {/* Save bar (only for api & identity tabs) */}
          {(tab === 'api' || tab === 'identity') && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-aether-border/30 bg-aether-dark/60">
              <div className="text-[11px] text-white/25">
                {dirty ? '有未保存的修改' : '配置已是最新'}
              </div>
              <motion.button
                onClick={handleSave}
                disabled={!dirty}
                whileTap={dirty ? { scale: 0.97 } : undefined}
                className={`relative px-6 py-2 rounded font-display text-xs tracking-widest uppercase transition-all ${
                  dirty
                    ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_20px_rgba(0,242,255,0.25)] hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] hover:bg-white'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                <span className="relative z-10">保存配置</span>
                {dirty && (
                  <motion.div
                    layoutId="saveGlow"
                    className="absolute inset-0 rounded bg-aether-cyan/20 blur-sm"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
              </motion.button>
            </div>
          )}
        </motion.div>

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
    </AnimatePresence>
  );
}

/* ─────────── Sub-component ─────────── */
function ActionButton({ busy, onClick, label, variant }: {
  busy: boolean; onClick: () => void; label: string; variant?: 'primary' | 'secondary';
}) {
  const isSecondary = variant === 'secondary';
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide transition-all disabled:opacity-40 ${
        isSecondary
          ? 'border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-border/50'
          : 'bg-aether-cyan/15 border border-aether-cyan/30 text-aether-cyan hover:bg-aether-cyan/25'
      }`}
    >
      {busy && <Loader2 size={12} className="animate-spin" />}
      {label}
      {!busy && !isSecondary && <ChevronRight size={12} />}
    </button>
  );
}

/* ─────────── Number Field ─────────── */
function NumField({ label, value, onChange, step, min, max, fallback }: {
  label: string; value: number | undefined; onChange: (n: number) => void;
  step?: number; min?: number; max?: number; fallback: number;
}) {
  return (
    <label className="flex-1 min-w-[130px]">
      <span className="block text-[10px] text-white/30 mb-1">{label}</span>
      <input type="number" step={step ?? 1} value={value ?? fallback}
        onChange={e => {
          const n = Number(e.target.value);
          if (!isNaN(n)) onChange(Math.min(max ?? 1e9, Math.max(min ?? -1e9, n)));
        }}
        className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1.5 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-purple/60" />
    </label>
  );
}

/* ─────────── Chip Input ─────────── */
function ChipInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) { setDraft(''); return; }
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <label className="block">
      <span className="block text-[10px] text-white/30 mb-1">{label}</span>
      <div className="flex flex-wrap gap-1.5 bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 min-h-[34px]
                      focus-within:border-aether-cyan/60 transition-all">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-aether-cyan/10 border border-aether-cyan/20 text-aether-cyan/70 px-2 py-0.5 rounded font-mono">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-aether-cyan/40 hover:text-aether-red transition-colors">&times;</button>
          </span>
        ))}
        <input type="text" value={draft}
          placeholder={values.length === 0 ? (placeholder ?? '输入后回车添加') : ''}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          onBlur={add}
          className="bg-transparent border-none outline-none text-xs text-white/60 placeholder:text-white/15 flex-1 min-w-[80px] py-0.5" />
      </div>
    </label>
  );
}
