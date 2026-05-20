import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Server, BookOpen, Sliders, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { useSillytavern } from '../hooks/useSillytavern';
import type { AppSettings, ApiSettings, Lorebook, LorebookEntry, ChatPreset } from '../sillytavern/types';
import { DEFAULT_SETTINGS } from '../sillytavern/types';
import { fetchModels, testConnection } from '../sillytavern/api-tools';
import { getDatabase } from '../sillytavern/database';
import { importMultipleLorebooks, renameLorebook, exportToJson, exportLorebook, exportPreset, importPreset } from '../sillytavern/importer';
import ApiTab from './Settings/ApiTab';
import LorebookTab from './Settings/LorebookTab';
import PresetTab from './Settings/PresetTab';
import IdentityTab from './Settings/IdentityTab';

const db = getDatabase();

type TabId = 'api' | 'lorebook' | 'preset' | 'identity';
const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'api', label: 'API 配置', icon: Server },
  { id: 'lorebook', label: '世界书配置', icon: BookOpen },
  { id: 'preset', label: '预设配置', icon: Sliders },
  { id: 'identity', label: '玩家身份', icon: User },
];

export default function SystemSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const ss = useSillytavern();
  const [tab, setTab] = useState<TabId>('api');

  // ── draft ──
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [primaryModels, setPrimaryModels] = useState<string[]>([]);
  const [secondaryModels, setSecondaryModels] = useState<string[]>([]);

  // ── lorebook ──
  const [lorebookList, setLorebookList] = useState<Lorebook[]>([]);
  const [lorebookActiveIds, setLorebookActiveIds] = useState<Set<string>>(new Set());
  const [expandedLorebookId, setExpandedLorebookId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState<LorebookEntry | null>(null);
  const [entryDirty, setEntryDirty] = useState(false);

  // ── preset ──
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [presetSubTab, setPresetSubTab] = useState<string>('sections');
  const [presetDraftFull, setPresetDraftFull] = useState<ChatPreset | null>(null);
  const [presetDirty, setPresetDirty] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

  // ── init ──
  useEffect(() => {
    if (isOpen && ss.initialized) {
      if (ss.settings) setDraft(JSON.parse(JSON.stringify(ss.settings)));
      setLorebookList([...ss.lorebooks]);
    }
  }, [isOpen, ss.initialized, ss.settings, ss.lorebooks]);

  useEffect(() => {
    const fetchActive = async () => {
      const s = await db.settings.toArray();
      setLorebookActiveIds(new Set(s[0]?.activeLorebookIds ?? []));
    };
    if (isOpen) fetchActive();
  }, [isOpen, ss.lorebooks]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── dirty check (api + identity tabs) ──
  const dirty = useMemo(() => {
    if (!draft || !ss.settings) return false;
    return JSON.stringify(draft.api) !== JSON.stringify(ss.settings.api)
      || draft.apiMode !== ss.settings.apiMode
      || draft.userName !== ss.settings.userName
      || draft.characterName !== ss.settings.characterName
      || (draft.playerTitle ?? '') !== (ss.settings.playerTitle ?? '')
      || (draft.characterDescription ?? '') !== (ss.settings.characterDescription ?? '')
      || (draft.scenario ?? '') !== (ss.settings.scenario ?? '');
  }, [draft, ss.settings]);

  const handleSave = async () => {
    if (!draft || !ss.settings) return;
    try {
      await ss.updateSettings({
        api: draft.api, apiMode: draft.apiMode, userName: draft.userName,
        characterName: draft.characterName, playerTitle: draft.playerTitle,
        characterDescription: draft.characterDescription, scenario: draft.scenario,
      });
      showToast('配置已保存', 'success');
    } catch { showToast('保存失败', 'error'); }
  };

  // ── API handlers ──
  const handleFetchModels = async (which: 'primary' | 'secondary') => {
    if (!draft) return;
    setBusy(`fetch-${which}`);
    try {
      const api = draft.api;
      const secondary = api.secondary ?? { enabled: false, baseUrl: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 8000 };
      const target = which === 'primary' ? { baseUrl: api.baseUrl, apiKey: api.apiKey } : { baseUrl: secondary.baseUrl, apiKey: secondary.apiKey };
      const { source, models, error } = await fetchModels(target);
      if (which === 'primary') setPrimaryModels(models); else setSecondaryModels(models);
      if (source === 'remote') showToast(`获取到 ${models.length} 个模型`, 'success');
      else showToast(`获取失败 (${error})，已回退常用模型列表`, 'error');
    } finally { setBusy(null); }
  };

  const handleTestConnection = async (which: 'primary' | 'secondary') => {
    if (!draft) return;
    setBusy(`test-${which}`);
    try {
      const api = draft.api;
      const secondary = api.secondary ?? { enabled: false, baseUrl: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 8000 };
      const target = which === 'primary' ? { baseUrl: api.baseUrl, apiKey: api.apiKey, model: api.model } : { baseUrl: secondary.baseUrl, apiKey: secondary.apiKey, model: secondary.model };
      const result = await testConnection(target);
      if (result.ok) showToast(`${which === 'primary' ? '主' : '次'} API 连通正常`, 'success');
      else showToast(`测试失败: HTTP ${result.status ?? result.error}`, 'error');
    } finally { setBusy(null); }
  };

  // ── lorebook handlers ──
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
    if (existing && existing.id !== lb.id) { if (!confirm(`已存在名为 "${v}" 的世界书。确认覆盖？`)) return; await db.lorebooks.delete(existing.id); }
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
    exportToJson(exportLorebook(lb), `${lb.name}.json`);
    showToast(`世界书 "${lb.name}" 已导出`, 'success');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const inputs = await Promise.all(files.map(async (f: File) => ({ fileName: f.name, json: JSON.parse(await f.text()) })));
    const { successes, failures } = importMultipleLorebooks(inputs);
    const newIds: string[] = [];
    for (const s of successes) {
      const name = s.lorebook.name !== '导入的世界书' ? s.lorebook.name : s.fileName.replace(/\.json$/i, '');
      const id = crypto.randomUUID();
      await ss.addLorebook({ ...s.lorebook, name, id, createdAt: Date.now(), updatedAt: Date.now() });
      newIds.push(id);
    }
    if (failures.length) showToast(`${failures.length} 个文件导入失败`, 'error');
    setLorebookList(await db.lorebooks.toArray());
    // Auto-activate imported worldbooks
    if (newIds.length > 0) {
      const currentIds = new Set(lorebookActiveIds);
      newIds.forEach(id => currentIds.add(id));
      setLorebookActiveIds(currentIds);
      const settings = await db.settings.toArray();
      if (settings[0]) {
        await db.settings.put({ ...settings[0], activeLorebookIds: Array.from(currentIds) });
      }
    }
    if (successes.length) showToast(`成功导入 ${successes.length} 本世界书（已自动激活）`, 'success');
    e.target.value = '';
  };

  // ── entry handlers ──
  const openEntryEditor = useCallback((entry: LorebookEntry) => {
    setEditingEntryId(entry.id);
    setEntryDraft(JSON.parse(JSON.stringify(entry)));
    setEntryDirty(false);
  }, []);

  const closeEntryEditor = useCallback(() => {
    setEditingEntryId(null); setEntryDraft(null); setEntryDirty(false);
  }, []);

  const handleNewEntry = useCallback((lb: Lorebook) => {
    const entry: LorebookEntry = {
      id: crypto.randomUUID(), keys: [], secondaryKeys: [], content: '', comment: '',
      order: 100, position: 'after_char', selective: false, selectiveLogic: 'and_any',
      constant: false, probability: 100, useProbability: false, addMemo: false,
      disable: false, delayUntilRecursion: false, ignoreBudget: false,
    };
    openEntryEditor(entry);
  }, [openEntryEditor]);

  const handleSaveEntry = useCallback(async (lb: Lorebook) => {
    if (!entryDraft || !editingEntryId) return;
    const idx = lb.entries.findIndex(e => e.id === editingEntryId);
    const nextEntries = idx >= 0 ? lb.entries.map((e, i) => i === idx ? entryDraft : e) : [...lb.entries, entryDraft];
    await ss.updateLorebook({ ...lb, entries: nextEntries, updatedAt: Date.now() });
    setLorebookList(await db.lorebooks.toArray());
    closeEntryEditor();
    showToast('条目已保存', 'success');
  }, [entryDraft, editingEntryId, ss, closeEntryEditor, showToast]);

  const handleDeleteEntry = useCallback(async (lb: Lorebook, entryId: string) => {
    if (!confirm('确定删除此条目？')) return;
    await ss.updateLorebook({ ...lb, entries: lb.entries.filter(e => e.id !== entryId), updatedAt: Date.now() });
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
    try { await ss.addPresetFromDefault(name); showToast(`预设 "${name}" 已创建`, 'success'); }
    catch { showToast('创建预设失败', 'error'); }
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
    exportToJson(exportPreset(preset), `${preset.name}.json`);
    showToast(`预设 "${preset.name}" 已导出`, 'success');
  };

  const handleImportPreset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const imported = importPreset(data);
      const fallbackName = file.name.replace(/\.json$/i, '');
      const newId = crypto.randomUUID();
      await ss.addPreset({ ...imported, name: imported.name !== '导入的预设' ? imported.name : fallbackName, id: newId, createdAt: Date.now(), updatedAt: Date.now() });
      // Auto-activate imported preset
      await ss.updateSettings({ activePresetId: newId });
      showToast(`预设 "${imported.name}" 已导入并激活`, 'success');
    } catch { showToast('导入失败: 文件格式无效', 'error'); }
    e.target.value = '';
  };

  const openPresetEdit = (preset: ChatPreset) => {
    if (expandedPresetId === preset.id) { setExpandedPresetId(null); return; }
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

  // ── render ──
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md" />
        <motion.div initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[960px] glass-panel border-glow overflow-hidden">
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
            <button onClick={onClose} className="text-white/30 hover:text-aether-cyan transition-colors p-1.5 clickable press-scale"><X size={18} /></button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-5 py-3 border-b border-aether-border/20 bg-aether-dark/40 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs tracking-wider transition-all font-display whitespace-nowrap ${
                  tab === t.id ? 'bg-aether-cyan text-aether-dark font-semibold' : 'text-white/40 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}><t.icon size={13} />{t.label}</button>
            ))}
          </div>

          {/* Content */}
          <div className="max-h-[62vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {tab === 'api' && draft && (
                  <ApiTab draft={draft} setDraft={setDraft} busy={busy}
                    primaryModels={primaryModels} secondaryModels={secondaryModels}
                    onFetchModels={handleFetchModels} onTestConnection={handleTestConnection} />
                )}
                {tab === 'lorebook' && (
                  <LorebookTab lorebookList={lorebookList} lorebookActiveIds={lorebookActiveIds}
                    expandedLorebookId={expandedLorebookId} setExpandedLorebookId={setExpandedLorebookId}
                    editingEntryId={editingEntryId} entryDraft={entryDraft} entryDirty={entryDirty}
                    onToggleLorebook={(id) => { ss.toggleLorebook(id); setLorebookActiveIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }}
                    onCreateLorebook={handleCreateLorebook} onImportJson={handleImportJson}
                    onExportLorebook={handleExportLorebook} onRenameLorebook={handleRenameLorebook}
                    onDeleteLorebook={handleDeleteLorebook}
                    onNewEntry={handleNewEntry} onOpenEntry={openEntryEditor} onCloseEntry={closeEntryEditor}
                    onSaveEntry={handleSaveEntry} onDeleteEntry={handleDeleteEntry}
                    onPatchEntry={patchEntryDraft}
                    onUpdateLorebook={(lb) => ss.updateLorebook(lb)}
                    refreshLorebookList={async () => { setLorebookList(await db.lorebooks.toArray()); }} />
                )}
                {tab === 'preset' && (
                  <PresetTab presets={ss.presets} activePresetId={ss.settings?.activePresetId ?? null}
                    expandedPresetId={expandedPresetId} setExpandedPresetId={setExpandedPresetId}
                    presetSubTab={presetSubTab} setPresetSubTab={setPresetSubTab}
                    presetDraftFull={presetDraftFull} presetDirty={presetDirty}
                    expandedSections={expandedSections} setExpandedSections={setExpandedSections}
                    onActivate={(id) => { ss.updateSettings({ activePresetId: id }); showToast('预设已激活', 'success'); }}
                    onDeactivate={() => { ss.updateSettings({ activePresetId: null }); showToast('已取消激活', 'success'); }}
                    onCreate={handleCreatePreset} onDelete={handleDeletePreset}
                    onRename={handleRenamePreset} onExport={handleExportPreset} onImport={handleImportPreset}
                    onOpenEdit={openPresetEdit}
                    onSetName={(name) => { if (presetDraftFull) { setPresetDraftFull({ ...presetDraftFull, name }); setPresetDirty(true); } }}
                    onPatchSettings={presetPatchSettings} onSave={handleSavePresetEdits}
                    showToast={showToast} />
                )}
                {tab === 'identity' && draft && <IdentityTab draft={draft} setDraft={setDraft} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />

          {/* Save bar */}
          {(tab === 'api' || tab === 'identity') && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-aether-border/30 bg-aether-dark/60">
              <div className="text-[11px] text-white/25">{dirty ? '有未保存的修改' : '配置已是最新'}</div>
              <motion.button onClick={handleSave} disabled={!dirty} whileTap={dirty ? { scale: 0.97 } : undefined}
                className={`relative px-6 py-2 rounded font-display text-xs tracking-widest uppercase transition-all ${
                  dirty ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_20px_rgba(0,242,255,0.25)] hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] hover:bg-white'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'}`}>
                <span className="relative z-10">保存配置</span>
                {dirty && <motion.div layoutId="saveGlow" className="absolute inset-0 rounded bg-aether-cyan/20 blur-sm" transition={{ type: 'spring', damping: 25, stiffness: 300 }} />}
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className={`fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium z-[200] ${
                toast.type === 'success' ? 'bg-aether-green/20 border border-aether-green/30 text-aether-green' : 'bg-aether-red/20 border border-aether-red/30 text-aether-red'
              }`}>
              {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
