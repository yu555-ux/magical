import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Server, BookOpen, Sliders, User, Monitor } from 'lucide-react';
import { showTopCenter } from './shared/TopCenterToast';
import { useSS } from '../hooks/SillytavernContext';
import type { AppSettings, ApiSettings } from '../sillytavern/types';
import { DEFAULT_SETTINGS } from '../sillytavern/types';
import { fetchModels, testConnection } from '../sillytavern/api-tools';
import ApiTab from './Settings/ApiTab';
import IdentityTab from './Settings/IdentityTab';
import FrontendConfigTab from './Settings/FrontendConfigTab';
import PromptManagerRoot from './Settings/PresetManager/PromptManagerRoot';
import LorebookTab from './Settings/LorebookTab';

type TabId = 'api' | 'lorebook' | 'preset' | 'identity' | 'frontend';
const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'api', label: 'API 配置', icon: Server },
  { id: 'lorebook', label: '世界书配置', icon: BookOpen },
  { id: 'preset', label: '预设配置', icon: Sliders },
  { id: 'identity', label: '玩家身份', icon: User },
  { id: 'frontend', label: '前端配置', icon: Monitor },
];

export default function SystemSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const ss = useSS();
  const [tab, setTab] = useState<TabId>('api');

  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [primaryModels, setPrimaryModels] = useState<string[]>([]);
  const [secondaryModels, setSecondaryModels] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && ss.initialized && ss.settings) {
      setDraft(JSON.parse(JSON.stringify(ss.settings)));
    }
  }, [isOpen, ss.initialized, ss.settings]);

  const dirty = useMemo(() => {
    if (!draft || !ss.settings) return false;
    return JSON.stringify(draft.api) !== JSON.stringify(ss.settings.api)
      || draft.apiMode !== ss.settings.apiMode
      || draft.userName !== ss.settings.userName
      || draft.characterName !== ss.settings.characterName
      || (draft.playerTitle ?? '') !== (ss.settings.playerTitle ?? '')
      || (draft.characterDescription ?? '') !== (ss.settings.characterDescription ?? '')
      || (draft.scenario ?? '') !== (ss.settings.scenario ?? '')
      || JSON.stringify(draft.presetBlocks) !== JSON.stringify(ss.settings.presetBlocks)
      || JSON.stringify(draft.lorebooks) !== JSON.stringify(ss.settings.lorebooks)
      || JSON.stringify(draft.presetParams) !== JSON.stringify(ss.settings.presetParams)
      || JSON.stringify(draft.presets) !== JSON.stringify(ss.settings.presets)
      || draft.activePresetId !== ss.settings.activePresetId
      || draft.activeVarsPresetId !== ss.settings.activeVarsPresetId
      || draft.messageWidthPercent !== (ss.settings.messageWidthPercent ?? DEFAULT_SETTINGS.messageWidthPercent)
      || JSON.stringify(draft.richTextConfig) !== JSON.stringify(ss.settings.richTextConfig)
      || draft.recentMessageCount !== (ss.settings.recentMessageCount ?? DEFAULT_SETTINGS.recentMessageCount)
      || draft.useProcessedMap !== (ss.settings.useProcessedMap ?? true)
      || draft.useProcessedCharacters !== (ss.settings.useProcessedCharacters ?? true);
  }, [draft, ss.settings]);

  const handleSave = async () => {
    if (!draft || !ss.settings) return;
    try {
      await ss.updateSettings({
        api: draft.api, apiMode: draft.apiMode, userName: draft.userName,
        characterName: draft.characterName, playerTitle: draft.playerTitle,
        characterDescription: draft.characterDescription, scenario: draft.scenario,
        presetBlocks: draft.presetBlocks,
        lorebooks: draft.lorebooks,
        presetParams: draft.presetParams,
        presets: draft.presets,
        activePresetId: draft.activePresetId,
        activeVarsPresetId: draft.activeVarsPresetId,
        messageWidthPercent: draft.messageWidthPercent ?? DEFAULT_SETTINGS.messageWidthPercent,
        richTextConfig: draft.richTextConfig,
        recentMessageCount: draft.recentMessageCount ?? DEFAULT_SETTINGS.recentMessageCount,
        useProcessedMap: draft.useProcessedMap ?? true,
        useProcessedCharacters: draft.useProcessedCharacters ?? true,
      });
      showTopCenter('配置已保存', 'success');
    } catch { showTopCenter('保存失败', 'error'); }
  };

  const handleFetchModels = async (which: 'primary' | 'secondary') => {
    if (!draft) return;
    setBusy(`fetch-${which}`);
    try {
      const api = draft.api;
      const sec = api.secondary ?? { enabled: false, baseUrl: '', apiKey: '', model: '' };
      const target = which === 'primary' ? { baseUrl: api.baseUrl, apiKey: api.apiKey } : { baseUrl: sec.baseUrl, apiKey: sec.apiKey };
      const { source, models, error } = await fetchModels(target);
      if (which === 'primary') setPrimaryModels(models); else setSecondaryModels(models);
      source === 'remote' ? showTopCenter(`获取到 ${models.length} 个模型`, 'success') : showTopCenter(`获取失败 (${error})`, 'error');
    } finally { setBusy(null); }
  };

  const handleTestConnection = async (which: 'primary' | 'secondary') => {
    if (!draft) return;
    setBusy(`test-${which}`);
    try {
      const api = draft.api;
      const sec = api.secondary ?? { enabled: false, baseUrl: '', apiKey: '', model: '' };
      const target = which === 'primary' ? { baseUrl: api.baseUrl, apiKey: api.apiKey, model: api.model } : { baseUrl: sec.baseUrl, apiKey: sec.apiKey, model: sec.model };
      const result = await testConnection(target);
      result.ok ? showTopCenter(`${which === 'primary' ? '主' : '次'} API 连通正常`, 'success') : showTopCenter(`测试失败: HTTP ${result.status ?? result.error}`, 'error');
    } finally { setBusy(null); }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md" />
        <motion.div initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[900px] max-h-full glass-panel border-glow overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/40 to-transparent" />

          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-aether-border/30 bg-aether-cyan/[0.03]">
            <div className="flex items-center gap-3">
              <div className="relative"><div className="w-2.5 h-2.5 bg-aether-cyan rounded-full" /><div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-30" /></div>
              <h2 className="font-display font-bold text-sm tracking-[0.2em] text-aether-cyan uppercase">系统设置</h2>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-aether-cyan transition-colors p-1.5"><X size={18} /></button>
          </div>

          <div className="shrink-0 flex gap-1 px-5 py-3 border-b border-aether-border/20 bg-aether-dark/40 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs tracking-wider transition-all font-display whitespace-nowrap ${
                  tab === t.id ? 'bg-aether-cyan text-aether-dark font-semibold' : 'text-white/40 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}><t.icon size={13} />{t.label}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {tab === 'api' && draft && (
                  <ApiTab draft={draft} setDraft={setDraft} busy={busy}
                    primaryModels={primaryModels} secondaryModels={secondaryModels}
                    onFetchModels={handleFetchModels} onTestConnection={handleTestConnection} />
                )}
                {tab === 'lorebook' && draft && <LorebookTab draft={draft} setDraft={setDraft} onPersist={(patch) => ss.updateSettings(patch)} />}
                {tab === 'preset' && draft && <PromptManagerRoot draft={draft} setDraft={setDraft} onPersist={(patch) => ss.updateSettings(patch)} />}
                {tab === 'identity' && draft && <IdentityTab draft={draft} setDraft={setDraft} />}
                {tab === 'frontend' && draft && <FrontendConfigTab draft={draft} setDraft={setDraft} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />

          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-aether-border/30 bg-aether-dark/60">
            <div className="text-[11px] text-white/25">{dirty ? '有未保存的修改' : '配置已是最新'}</div>
            <motion.button onClick={handleSave} disabled={!dirty} whileTap={dirty ? { scale: 0.97 } : undefined}
              className={`relative px-6 py-2 rounded font-display text-xs tracking-widest uppercase transition-all ${
                dirty ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_20px_rgba(0,242,255,0.25)]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}>
              保存配置
            </motion.button>
          </div>
        </motion.div>

      </div>
    </AnimatePresence>
  );
}
