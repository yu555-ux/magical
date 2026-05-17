import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cpu, Server, Key, Zap, AlertTriangle, CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import { useSillytavern } from '../hooks/useSillytavern';
import type { AppSettings, ApiSettings } from '../sillytavern/types';
import { DEFAULT_SETTINGS } from '../sillytavern/types';
import { fetchModels, testConnection } from '../sillytavern/api-tools';

/* ─────────── Tabs ─────────── */
type TabId = 'api';
interface Tab { id: TabId; label: string; }
const TABS: Tab[] = [{ id: 'api', label: 'API 配置' }];

/* ─────────── Props ─────────── */
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

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

/* ══════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════ */
export default function SystemSettingsModal({ isOpen, onClose }: Props) {
  const ss = useSillytavern();
  const [tab, setTab] = useState<TabId>('api');

  // ── draft settings ──
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // init draft from persisted settings
  useEffect(() => {
    if (isOpen && ss.initialized && ss.settings) {
      setDraft(JSON.parse(JSON.stringify(ss.settings)));
    }
  }, [isOpen, ss.initialized, ss.settings]);

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
           draft.characterName !== ss.settings.characterName;
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
    setDraft({
      ...draft,
      api: { ...draft.api, secondary: { ...secondary, ...patch } },
    });
  };

  // ── actions ──
  const handleSave = async () => {
    if (!draft || !ss.settings) return;
    try {
      await ss.updateSettings({
        api: draft.api,
        apiMode: draft.apiMode,
        userName: draft.userName,
        characterName: draft.characterName,
      });
      showToast('配置已保存', 'success');
    } catch {
      showToast('保存失败', 'error');
    }
  };

  const handleFetchModels = async (which: 'primary' | 'secondary') => {
    setBusy(`fetch-${which}`);
    try {
      const target = which === 'primary'
        ? { baseUrl: api.baseUrl, apiKey: api.apiKey }
        : { baseUrl: secondary.baseUrl, apiKey: secondary.apiKey };
      const { models, source, error } = await fetchModels(target);
      if (source === 'remote') {
        showToast(`获取到 ${models.length} 个模型`, 'success');
      } else {
        showToast(`获取失败 (${error})，已回退常用模型列表`, 'error');
      }
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

  // ── render ──
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        {/* backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md"
        />

        {/* panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[640px] glass-panel border-glow overflow-hidden"
        >
          {/* ─── Top decorative line ─── */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/40 to-transparent" />

          {/* ─── Header ─── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-aether-border/30 bg-aether-cyan/[0.03]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-30" />
              </div>
              <h2 className="font-display font-bold text-sm tracking-[0.2em] text-aether-cyan uppercase">
                系统设置
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-aether-cyan transition-colors p-1.5 clickable press-scale"
            >
              <X size={18} />
            </button>
          </div>

          {/* ─── Tab bar ─── */}
          <div className="flex gap-1 px-5 py-3 border-b border-aether-border/20 bg-aether-dark/40">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-1.5 rounded-full text-xs tracking-wider transition-all font-display ${
                  tab === t.id
                    ? 'bg-aether-cyan text-aether-dark font-semibold'
                    : 'text-white/40 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ─── Content ─── */}
          <div className="max-h-[55vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {tab === 'api' && draft && (
                  <div className="p-5 space-y-6">
                    {/* ── API Mode selector ── */}
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
                              {mode === 'single'
                                ? '一个模型处理所有任务'
                                : '主 API 负责剧情 · 次 API 负责变量'}
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    {/* ── Primary API ── */}
                    <section>
                      <SectionHeader icon={Server} label="主 API" accent="bg-aether-cyan" />
                      <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4 space-y-1">
                        <InputRow
                          label="Base URL"
                          value={api.baseUrl}
                          onChange={(v) => patchApi({ baseUrl: v })}
                          placeholder="https://api.openai.com/v1"
                        />
                        <InputRow
                          label="API Key"
                          type="password"
                          value={api.apiKey}
                          onChange={(v) => patchApi({ apiKey: v })}
                          placeholder="sk-..."
                        />
                        <InputRow
                          label="Model"
                          value={api.model}
                          onChange={(v) => patchApi({ model: v })}
                          placeholder="gpt-3.5-turbo"
                        />
                        <div className="flex gap-2 pt-2">
                          <ActionButton
                            busy={busy === 'fetch-primary'}
                            onClick={() => handleFetchModels('primary')}
                            label={busy === 'fetch-primary' ? '获取中…' : '获取模型列表'}
                          />
                          <ActionButton
                            busy={busy === 'test-primary'}
                            onClick={() => handleTestConnection('primary')}
                            label={busy === 'test-primary' ? '测试中…' : '测试连通性'}
                            variant="secondary"
                          />
                        </div>
                      </div>
                    </section>

                    {/* ── Secondary API (dual only) ── */}
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
                            <InputRow
                              label="Base URL"
                              value={secondary.baseUrl}
                              onChange={(v) => patchSecondary({ baseUrl: v, enabled: true })}
                              placeholder="https://api.deepseek.com/v1"
                            />
                            <InputRow
                              label="API Key"
                              type="password"
                              value={secondary.apiKey}
                              onChange={(v) => patchSecondary({ apiKey: v, enabled: true })}
                              placeholder="sk-..."
                            />
                            <InputRow
                              label="Model"
                              value={secondary.model}
                              onChange={(v) => patchSecondary({ model: v, enabled: true })}
                              placeholder="deepseek-chat"
                            />
                            <div className="flex gap-3 pt-1">
                              <InputRow
                                label="温度"
                                value={String(secondary.temperature ?? 0.7)}
                                onChange={(v) => patchSecondary({ temperature: Number(v) || 0.7, enabled: true })}
                              />
                              <InputRow
                                label="Max Tokens"
                                value={String(secondary.maxTokens ?? 8000)}
                                onChange={(v) => patchSecondary({ maxTokens: Number(v) || 8000, enabled: true })}
                              />
                            </div>
                            <div className="flex gap-2 pt-2">
                              <ActionButton
                                busy={busy === 'fetch-secondary'}
                                onClick={() => handleFetchModels('secondary')}
                                label={busy === 'fetch-secondary' ? '获取中…' : '获取模型列表'}
                              />
                              <ActionButton
                                busy={busy === 'test-secondary'}
                                onClick={() => handleTestConnection('secondary')}
                                label={busy === 'test-secondary' ? '测试中…' : '测试连通性'}
                                variant="secondary"
                              />
                            </div>
                            <p className="text-[10px] text-white/20 mt-2 flex items-center gap-1">
                              <AlertTriangle size={10} />
                              次 API 失败时自动回退到主 API
                            </p>
                          </div>
                        </motion.section>
                      )}
                    </AnimatePresence>

                    {/* ── Identity ── */}
                    <section>
                      <SectionHeader icon={Key} label="角色身份" accent="bg-aether-purple" />
                      <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4">
                        <div className="flex gap-3">
                          <InputRow
                            label="玩家名"
                            value={draft.userName}
                            onChange={(v) => setDraft({ ...draft, userName: v })}
                            placeholder="用户"
                          />
                          <InputRow
                            label="AI 角色名"
                            value={draft.characterName}
                            onChange={(v) => setDraft({ ...draft, characterName: v })}
                            placeholder="AI"
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ─── Bottom decorative line ─── */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />

          {/* ─── Save bar ─── */}
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

          {/* ─── Toast ─── */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium ${
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
        </motion.div>
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
