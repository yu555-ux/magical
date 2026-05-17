import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Server, Zap, AlertTriangle, CheckCircle, Loader2, ChevronRight,
  BookOpen, User, Bot, Globe, Plus, Trash2, Pencil, Upload, Sparkles, Hash,
} from 'lucide-react';
import { useSillytavern } from '../hooks/useSillytavern';
import type { AppSettings, ApiSettings, Lorebook } from '../sillytavern/types';
import { DEFAULT_SETTINGS } from '../sillytavern/types';
import { fetchModels, testConnection } from '../sillytavern/api-tools';
import { getDatabase } from '../sillytavern/database';
import { importMultipleLorebooks, renameLorebook } from '../sillytavern/importer';

const db = getDatabase();

/* ─────────── Tabs ─────────── */
type TabId = 'api' | 'lorebook' | 'identity';
interface Tab { id: TabId; label: string; icon: any; }
const TABS: Tab[] = [
  { id: 'api', label: 'API 配置', icon: Server },
  { id: 'lorebook', label: '世界书配置', icon: BookOpen },
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

  // ── lorebook list (live from DB) ──
  const [lorebookList, setLorebookList] = useState<Lorebook[]>([]);
  const [lorebookActiveIds, setLorebookActiveIds] = useState<Set<string>>(new Set());

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

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const inputs = await Promise.all(
      files.map(async (f: File) => ({ fileName: f.name, json: JSON.parse(await f.text()) }))
    );
    const { successes, failures } = importMultipleLorebooks(inputs);
    for (const s of successes) {
      await db.lorebooks.add({
        ...s.lorebook,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Lorebook);
    }
    if (failures.length) {
      showToast(`${failures.length} 个文件导入失败`, 'error');
    }
    setLorebookList(await db.lorebooks.toArray());
    if (successes.length) showToast(`成功导入 ${successes.length} 本世界书`, 'success');
    e.target.value = '';
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
          className="relative w-full max-w-[680px] glass-panel border-glow overflow-hidden"
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
          <div className="max-h-[55vh] overflow-y-auto">
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
                          return (
                            <motion.div
                              key={lb.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border transition-all group ${
                                isActive
                                  ? 'border-aether-cyan/30 bg-aether-cyan/[0.04] shadow-[0_0_12px_rgba(0,242,255,0.04)]'
                                  : 'border-aether-border/20 bg-aether-dark/30 hover:border-aether-border/40'
                              }`}
                            >
                              {/* Active indicator */}
                              {isActive && (
                                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-aether-cyan rounded-r-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                              )}

                              {/* Checkbox */}
                              <button
                                onClick={() => {
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
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-display font-medium tracking-wide truncate ${isActive ? 'text-white/80' : 'text-white/50'}`}>
                                    {lb.name}
                                  </span>
                                  <StatPill count={lb.entries.length} />
                                </div>
                                {lb.description && (
                                  <p className="text-[11px] text-white/25 truncate mt-0.5">{lb.description}</p>
                                )}
                              </div>

                              {/* Actions (hover reveal) */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleRenameLorebook(lb)}
                                  className="p-1.5 rounded text-white/25 hover:text-aether-cyan hover:bg-aether-cyan/10 transition-all"
                                  title="重命名"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteLorebook(lb)}
                                  className="p-1.5 rounded text-white/25 hover:text-aether-red hover:bg-aether-red/10 transition-all"
                                  title="删除"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════ IDENTITY ═══════════ */}
                {tab === 'identity' && draft && (
                  <div className="p-5 space-y-5">
                    {/* Player & Character cards */}
                    <div className="flex gap-4">
                      {/* Player card */}
                      <section className="flex-1 bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full border-2 border-aether-cyan/40 bg-aether-cyan/10 flex items-center justify-center flex-shrink-0">
                            <User size={20} className="text-aether-cyan" />
                          </div>
                          <div>
                            <h4 className="text-sm font-display font-semibold text-aether-cyan tracking-wide">玩家信息</h4>
                            <p className="text-[10px] text-white/25">设定你在游戏中的身份</p>
                          </div>
                        </div>
                        <InputRow label="玩家名" value={draft.userName} onChange={(v) => setDraft({ ...draft, userName: v })} placeholder="输入你的名字" />
                        <InputRow label="称号" value={draft.playerTitle ?? ''} onChange={(v) => setDraft({ ...draft, playerTitle: v })} placeholder="例：新东京流浪者" hint="你在游戏世界中的头衔或代号" />
                      </section>

                      {/* Character card */}
                      <section className="flex-1 bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full border-2 border-aether-purple/40 bg-aether-purple/10 flex items-center justify-center flex-shrink-0">
                            <Bot size={20} className="text-aether-purple" />
                          </div>
                          <div>
                            <h4 className="text-sm font-display font-semibold text-aether-purple tracking-wide">AI 角色</h4>
                            <p className="text-[10px] text-white/25">定义 AI 的身份与性格</p>
                          </div>
                        </div>
                        <InputRow label="角色名" value={draft.characterName} onChange={(v) => setDraft({ ...draft, characterName: v })} placeholder="为 AI 角色命名" />
                        <TextAreaRow label="角色描述" value={draft.characterDescription ?? ''} onChange={(v) => setDraft({ ...draft, characterDescription: v })} placeholder="描述 AI 角色的性格、说话风格、背景故事等..." rows={3} />
                      </section>
                    </div>

                    {/* Scenario */}
                    <section>
                      <SectionHeader icon={Globe} label="场景设定" accent="bg-aether-gold" />
                      <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4">
                        <TextAreaRow
                          label="世界观描述"
                          value={draft.scenario ?? ''}
                          onChange={(v) => setDraft({ ...draft, scenario: v })}
                          placeholder="描述当前世界的状态、地点、事件背景... AI 会在对话中参考这些设定"
                          rows={4}
                        />
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-white/20">
                          <Sparkles size={12} className="text-aether-gold/50" />
                          场景设定会在每次对话中注入到 AI 的系统提示词
                        </div>
                      </div>
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
