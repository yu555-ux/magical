import { motion, AnimatePresence } from 'motion/react';
import { Server, Zap, AlertTriangle } from 'lucide-react';
import { SectionHeader, InputRow, ActionButton } from './SettingsFields';
import type { ApiSettings, AppSettings } from '../../sillytavern/types';
import { DEFAULT_SETTINGS } from '../../sillytavern/types';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
  busy: string | null;
  primaryModels: string[];
  secondaryModels: string[];
  onFetchModels: (which: 'primary' | 'secondary') => void;
  onTestConnection: (which: 'primary' | 'secondary') => void;
}

export default function ApiTab({ draft, setDraft, busy, primaryModels, secondaryModels, onFetchModels, onTestConnection }: Props) {
  const isDual = draft.apiMode === 'dual';
  const api = draft.api ?? DEFAULT_SETTINGS.api;
  const secondary = api.secondary ?? { enabled: false, baseUrl: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 8000 };

  const patchApi = (patch: Partial<ApiSettings>) => setDraft({ ...draft, api: { ...draft.api, ...patch } });
  const patchSecondary = (patch: Partial<NonNullable<ApiSettings['secondary']>>) =>
    setDraft({ ...draft, api: { ...draft.api, secondary: { ...secondary, ...patch } } });

  return (
    <div className="p-5 space-y-6">
      {/* API Mode */}
      <div className="flex gap-3">
        {(['single', 'dual'] as const).map((mode) => (
          <motion.button key={mode} onClick={() => setDraft({ ...draft, apiMode: mode })}
            className={`relative flex-1 p-4 rounded-lg border text-left transition-all ${
              draft.apiMode === mode
                ? 'border-aether-cyan/50 bg-aether-cyan/[0.06] shadow-[0_0_20px_rgba(0,242,255,0.08)]'
                : 'border-aether-border/20 bg-white/[0.02] hover:border-aether-border/40'
            }`}>
            {draft.apiMode === mode && (
              <motion.div layoutId="apiMode"
                className="absolute inset-0 rounded-lg border border-aether-cyan/30 bg-aether-cyan/[0.03]"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }} />
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
              <select onChange={(e) => { if (e.target.value) patchApi({ model: e.target.value }); }}
                className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60 transition-all" defaultValue="">
                <option value="" disabled>-- 点击选择 --</option>
                {primaryModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <ActionButton busy={busy === 'fetch-primary'} onClick={() => onFetchModels('primary')} label={busy === 'fetch-primary' ? '获取中…' : '获取模型列表'} />
            <ActionButton busy={busy === 'test-primary'} onClick={() => onTestConnection('primary')} label={busy === 'test-primary' ? '测试中…' : '测试连通性'} variant="secondary" />
          </div>
        </div>
      </section>

      {/* Secondary API */}
      <AnimatePresence>
        {isDual && (
          <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <SectionHeader icon={Zap} label="次 API" accent="bg-aether-blue" />
            <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4 space-y-1">
              <InputRow label="Base URL" value={secondary.baseUrl} onChange={(v) => patchSecondary({ baseUrl: v, enabled: true })} placeholder="https://api.deepseek.com/v1" />
              <InputRow label="API Key" type="password" value={secondary.apiKey} onChange={(v) => patchSecondary({ apiKey: v, enabled: true })} placeholder="sk-..." />
              <InputRow label="Model" value={secondary.model} onChange={(v) => patchSecondary({ model: v, enabled: true })} placeholder="deepseek-chat" />
              {secondaryModels.length > 0 && (
                <label className="block mb-3">
                  <span className="block text-[10px] text-white/25 mb-1">选择模型 ({secondaryModels.length})</span>
                  <select onChange={(e) => { if (e.target.value) patchSecondary({ model: e.target.value, enabled: true }); }}
                    className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/70 font-mono focus:outline-none focus:border-aether-blue/60 transition-all" defaultValue="">
                    <option value="" disabled>-- 点击选择 --</option>
                    {secondaryModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              )}
              <div className="flex gap-3 pt-1">
                <InputRow label="温度" value={String(secondary.temperature ?? 0.7)} onChange={(v) => patchSecondary({ temperature: Number(v) || 0.7, enabled: true })} />
                <InputRow label="Max Tokens" value={String(secondary.maxTokens ?? 8000)} onChange={(v) => patchSecondary({ maxTokens: Number(v) || 8000, enabled: true })} />
              </div>
              <div className="flex gap-2 pt-2">
                <ActionButton busy={busy === 'fetch-secondary'} onClick={() => onFetchModels('secondary')} label={busy === 'fetch-secondary' ? '获取中…' : '获取模型列表'} />
                <ActionButton busy={busy === 'test-secondary'} onClick={() => onTestConnection('secondary')} label={busy === 'test-secondary' ? '测试中…' : '测试连通性'} variant="secondary" />
              </div>
              <p className="text-[10px] text-white/20 mt-2 flex items-center gap-1">
                <AlertTriangle size={10} /> 次 API 失败时自动回退到主 API
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
