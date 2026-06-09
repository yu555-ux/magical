import { motion, AnimatePresence } from 'motion/react';
import { Server, Zap, AlertTriangle, Bot, Wrench } from 'lucide-react';
import { SectionHeader, InputRow, ActionButton } from './SettingsFields';
import type { ApiSettings, AppSettings } from '../../sillytavern/types';
import { DEFAULT_SETTINGS } from '../../sillytavern/types';
import { ALL_TOOLS } from '../../sillytavern/tools/registry';

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
  const isAgent = api?.agentMode === true;

  const patchApi = (patch: Partial<ApiSettings>) => setDraft({ ...draft, api: { ...draft.api, ...patch } });
  const patchSecondary = (patch: Partial<NonNullable<ApiSettings['secondary']>>) =>
    setDraft({ ...draft, api: { ...draft.api, secondary: { ...secondary, ...patch } } });

  const toggleTool = (toolName: string) => {
    const current = api?.enabledTools ?? [];
    const next = current.includes(toolName)
      ? current.filter(n => n !== toolName)
      : [...current, toolName];
    patchApi({ enabledTools: next });
  };

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

      {/* Agent Mode Toggle */}
      <section>
        <div
          onClick={() => patchApi({ agentMode: !isAgent })}
          className={`relative p-4 rounded-lg border cursor-pointer transition-all ${
            isAgent
              ? 'border-purple-400/50 bg-purple-400/[0.06] shadow-[0_0_20px_rgba(168,85,247,0.1)]'
              : 'border-aether-border/20 bg-white/[0.02] hover:border-aether-border/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-5 rounded-full transition-colors relative ${isAgent ? 'bg-purple-400' : 'bg-white/10'}`}>
              <motion.div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                animate={{ left: isAgent ? 16 : 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            </div>
            <Bot size={20} className={isAgent ? 'text-purple-400' : 'text-white/30'} />
            <div>
              <div className={`text-sm font-display font-semibold tracking-wide ${isAgent ? 'text-purple-400' : 'text-white/50'}`}>
                Agent 模式
              </div>
              <div className="text-[11px] text-white/30 leading-relaxed">
                AI 通过工具调用管理状态，不需要预设和双 API
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Mode Settings */}
      <AnimatePresence>
        {isAgent && (
          <motion.section
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden"
          >
            <SectionHeader icon={Wrench} label="Agent 配置" accent="bg-purple-400" />
            <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4 space-y-4">
              {/* Max turns */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">最大轮数</span>
                <input type="number" min={1} max={30} value={api?.maxTurnsPerMessage ?? 10}
                  onChange={(e) => patchApi({ maxTurnsPerMessage: Math.max(1, Math.min(30, Number(e.target.value) || 10)) })}
                  className="w-16 bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-xs text-white/70 text-center focus:outline-none focus:border-purple-400/60" />
              </div>

              {/* Cache control */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">缓存控制</span>
                <select value={api?.cacheControl ?? 'auto'}
                  onChange={(e) => patchApi({ cacheControl: e.target.value as 'auto' | 'enabled' | 'disabled' })}
                  className="bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-purple-400/60">
                  <option value="auto">自动</option>
                  <option value="enabled">启用</option>
                  <option value="disabled">禁用</option>
                </select>
              </div>

              {/* Tools */}
              <div>
                <span className="block text-xs text-white/50 mb-2">
                  启用的工具
                  <span className="text-white/20 ml-1">
                    ({api?.enabledTools?.length ?? 0}/{ALL_TOOLS.length})
                  </span>
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_TOOLS.map((tool) => {
                    const checked = (api?.enabledTools ?? []).includes(tool.name);
                    return (
                      <motion.div key={tool.name}
                        whileTap={{ scale: 0.96 }}
                        onClick={(e) => { e.preventDefault(); toggleTool(tool.name); }}
                        role="checkbox"
                        aria-checked={checked}
                        className={`relative flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer select-none overflow-hidden ${
                          checked
                            ? 'bg-purple-400/15 text-purple-300 border border-purple-400/30'
                            : 'bg-white/[0.02] text-white/40 border border-transparent hover:border-white/10 hover:bg-white/[0.04] hover:text-white/60'
                        }`}
                      >
                        {/* Background flash on toggle */}
                        <AnimatePresence>
                          {checked && (
                            <motion.div
                              key="glow"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 rounded bg-purple-400/10 pointer-events-none"
                              layoutId={`tool-glow-${tool.name}`}
                              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            />
                          )}
                        </AnimatePresence>

                        {/* Animated checkbox */}
                        <motion.div
                          animate={{
                            scale: checked ? 1 : 0.9,
                            borderColor: checked ? 'rgba(168, 85, 247, 1)' : 'rgba(255,255,255,0.15)',
                            backgroundColor: checked ? 'rgba(168, 85, 247, 1)' : 'transparent',
                          }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0"
                        >
                          <motion.div
                            animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15, delay: checked ? 0.05 : 0 }}
                          >
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </motion.div>
                        </motion.div>

                        <motion.div
                          className="flex-1 truncate"
                          animate={{ x: checked ? 1 : 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                          <div className="font-mono text-[11px]">{tool.name}</div>
                          <div className="text-[10px] opacity-50 truncate">{tool.label}</div>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-white/20 flex items-center gap-1">
                <AlertTriangle size={10} /> Agent 模式开启后，预设和双 API 将被忽略
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

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

      {/* Secondary API — hidden in Agent mode */}
      <AnimatePresence>
        {isDual && !isAgent && (
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
