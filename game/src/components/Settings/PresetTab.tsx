import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, Plus, Upload, AlertTriangle, CheckCircle, Settings2 } from 'lucide-react';
import { SectionHeader } from './SettingsFields';
import type { AppSettings, PresetBlock, PresetParams } from '../../sillytavern/types';
import { DEFAULT_PRESET_PARAMS } from '../../sillytavern/types';
import { importPresetFromJson } from '../../sillytavern/chaoxiAdapter';
import type { ImportResult } from '../../sillytavern/chaoxiAdapter';
import { saveSettings } from '../../sillytavern/database';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
}

function newBlock(): PresetBlock {
  return {
    identifier: crypto.randomUUID(),
    name: '新预设块',
    role: 'system',
    enabled: true,
    content: '',
  };
}

const ROLE_COLORS: Record<string, string> = {
  system: 'bg-aether-cyan/10 text-aether-cyan/45 border-aether-cyan/20',
  user: 'bg-aether-green/10 text-aether-green/45 border-aether-green/20',
  assistant: 'bg-aether-blue/10 text-aether-blue/45 border-aether-blue/20',
};

export default function PresetTab({ draft, setDraft }: Props) {
  const blocks: PresetBlock[] = draft.presetBlocks ?? [];
  const params: PresetParams = draft.presetParams ?? DEFAULT_PRESET_PARAMS;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [paramsExpanded, setParamsExpanded] = useState(false);
  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateBlock = (index: number, patch: Partial<PresetBlock>) => {
    const next = [...blocks];
    next[index] = { ...next[index], ...patch };
    setDraft({ ...draft, presetBlocks: next });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft({ ...draft, presetBlocks: next });
  };

  const removeBlock = (index: number) => {
    setDraft({ ...draft, presetBlocks: blocks.filter((_, i) => i !== index) });
  };

  const addBlock = () => {
    const b = newBlock();
    const next = [...blocks, b];
    setDraft({ ...draft, presetBlocks: next });
    setExpandedIds(prev => { const s = new Set(prev); s.add(b.identifier); return s; });
  };

  const updateParams = (patch: Partial<PresetParams>) => {
    setDraft({ ...draft, presetParams: { ...params, ...patch } });
  };

  // ── Import ──

  const handleFilePicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      console.log('[PresetTab] File keys:', Object.keys(raw));
      console.log('[PresetTab] prompts count:', raw.prompts?.length, 'prompt_order:', !!raw.prompt_order);
      const result = importPresetFromJson(raw);
      console.log('[PresetTab] Imported:', result.blocks.length, 'blocks, source:', result.source, 'name:', result.name);
      if (result.blocks.length === 0) {
        showToast('未识别到任何预设词块，请确认文件格式', 'error');
        return;
      }
      setPendingImport(result);
    } catch (err: any) {
      console.error('[PresetTab] Import error:', err);
      showToast(`导入失败: ${err?.message || '无法解析 JSON 文件'}`, 'error');
    }
    e.target.value = '';
  }, [showToast]);

  const applyImport = useCallback(async (mode: 'replace' | 'append') => {
    if (!pendingImport) return;
    const importedBlocks = pendingImport.blocks.map(b => ({
      ...b,
      identifier: crypto.randomUUID(),
    }));
    const nextBlocks = mode === 'replace' ? importedBlocks : [...blocks, ...importedBlocks];
    const nextDraft: AppSettings = {
      ...draft,
      presetBlocks: nextBlocks,
      presetParams: mode === 'replace'
        ? pendingImport.params
        : (draft.presetParams ?? pendingImport.params),
    };
    setDraft(nextDraft);

    try {
      await saveSettings(nextDraft);
      showToast(
        `已导入「${pendingImport.name}」: ${importedBlocks.length} 个词块（${mode === 'replace' ? '替换' : '追加'}）— 已自动保存`,
        'success',
      );
    } catch {
      showToast('导入成功但保存失败，请手动保存', 'error');
    }

    if (importedBlocks.length > 0) {
      setExpandedIds(prev => { const s = new Set(prev); s.add(importedBlocks[0].identifier); return s; });
    }
    setPendingImport(null);
  }, [pendingImport, blocks, draft, setDraft, showToast]);

  // ── Render ──

  return (
    <div className="p-5">
      <section className="max-w-2xl">
        <SectionHeader icon={Sliders} label="预设配置" accent="bg-aether-purple" />

        {/* ── Preset Parameters Card ── */}
        <div className={`rounded-lg border mb-3 overflow-hidden transition-all ${
          paramsExpanded ? 'border-aether-purple/20 bg-aether-dark/30' : 'border-aether-border/10 bg-aether-dark/20'
        }`}>
          <button
            onClick={() => setParamsExpanded(!paramsExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-aether-purple/[0.03] transition-colors"
          >
            <Settings2 size={14} className="text-aether-purple/40 shrink-0" />
            <span className="text-xs font-display font-medium text-white/55">预设参数</span>
            <span className="text-[9px] text-white/15 ml-auto">{paramsExpanded ? '▴ 收起' : '▾ 展开'}</span>
          </button>

          <AnimatePresence initial={false}>
            {paramsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-aether-border/8"
              >
                <div className="px-3 py-3 space-y-3">

                  {/* ── Sampling ── */}
                  <div>
                    <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">采样参数</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                      <NumberField label="温度" value={params.temperature} onChange={v => updateParams({ temperature: v })} step={0.1} min={0} max={2} />
                      <NumberField label="Top P" value={params.top_p} onChange={v => updateParams({ top_p: v })} step={0.05} min={0} max={1} />
                      <NumberField label="Top K" value={params.top_k} onChange={v => updateParams({ top_k: v })} min={0} max={1000} />
                      <NumberField label="Top A" value={params.top_a} onChange={v => updateParams({ top_a: v })} step={0.05} min={0} max={1} />
                      <NumberField label="Min P" value={params.min_p} onChange={v => updateParams({ min_p: v })} step={0.05} min={0} max={1} />
                      <NumberField label="频率惩罚" value={params.frequency_penalty} onChange={v => updateParams({ frequency_penalty: v })} step={0.1} min={-2} max={2} />
                      <NumberField label="存在惩罚" value={params.presence_penalty} onChange={v => updateParams({ presence_penalty: v })} step={0.1} min={-2} max={2} />
                      <NumberField label="重复惩罚" value={params.repetition_penalty} onChange={v => updateParams({ repetition_penalty: v })} step={0.1} min={1} max={2} />
                    </div>
                  </div>

                  {/* ── Context ── */}
                  <div>
                    <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">上下文</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                      <NumberField label="最大上下文" value={params.openai_max_context} onChange={v => updateParams({ openai_max_context: v })} min={1000} max={4000000} />
                      <NumberField label="最大输出Token" value={params.openai_max_tokens} onChange={v => updateParams({ openai_max_tokens: v })} min={256} max={128000} />
                    </div>
                  </div>

                  {/* ── Options ── */}
                  <div>
                    <span className="text-[10px] text-white/25 font-display tracking-wide uppercase">选项</span>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <CheckField label="流式输出" checked={params.stream_openai} onChange={v => updateParams({ stream_openai: v })} />
                      <CheckField label="引号包裹" checked={params.wrap_in_quotes} onChange={v => updateParams({ wrap_in_quotes: v })} />
                      <CheckField label="解锁上下文" checked={params.max_context_unlocked} onChange={v => updateParams({ max_context_unlocked: v })} />
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/20">名字行为</span>
                        <input
                          type="number"
                          value={params.names_behavior}
                          onChange={e => updateParams({ names_behavior: Number(e.target.value) })}
                          className="w-14 bg-aether-dark/60 border border-aether-border/25 rounded px-1.5 py-0.5 text-[10px] text-white/55 focus:outline-none focus:border-aether-purple/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Templates ── */}
                  <div>
                    <button
                      onClick={() => setTemplatesExpanded(!templatesExpanded)}
                      className="flex items-center gap-1.5 text-[10px] text-white/25 font-display tracking-wide uppercase hover:text-white/40 transition-colors"
                    >
                      <span className="text-[8px]">{templatesExpanded ? '▾' : '▸'}</span>
                      提示模板 ({TEMPLATE_FIELDS.length})
                    </button>
                    <AnimatePresence initial={false}>
                      {templatesExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 mt-1.5">
                            {TEMPLATE_FIELDS.map(f => (
                              <div key={f.key}>
                                <label className="text-[9px] text-white/20 font-mono block mb-0.5">{f.label}</label>
                                <textarea
                                  value={(params as any)[f.key] || ''}
                                  onChange={e => updateParams({ [f.key]: e.target.value } as any)}
                                  rows={2}
                                  className="w-full bg-aether-dark/60 border border-aether-border/25 rounded px-2 py-1 text-[10px] text-white/50 placeholder:text-white/8 focus:outline-none focus:border-aether-purple/50 transition-all resize-none font-mono leading-relaxed"
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={addBlock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide bg-aether-purple/15 border border-aether-purple/30 text-aether-purple hover:bg-aether-purple/25 transition-all font-display"
          >
            <Plus size={13} /> 新建词块
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/30 text-white/40 hover:text-white/70 hover:border-aether-purple/40 cursor-pointer transition-all font-display">
            <Upload size={13} /> 导入预设
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFilePicked} />
          </label>
          {blocks.length > 0 && (
            <span className="text-[10px] text-white/15 font-mono ml-auto">{blocks.length} 个词块</span>
          )}
        </div>

        {/* ── Pending import banner ── */}
        <AnimatePresence>
          {pendingImport && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-3 p-3 rounded-lg border border-aether-purple/30 bg-aether-purple/[0.04]"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs text-aether-purple/80 font-display font-semibold">{pendingImport.name}</span>
                  <span className="text-[10px] text-white/25 ml-2 font-mono">{pendingImport.blocks.length} 词块</span>
                  <span className="text-[9px] text-white/12 ml-1">({pendingImport.source})</span>
                </div>
                <button onClick={() => setPendingImport(null)} className="text-white/15 hover:text-white/40 text-[10px]">取消</button>
              </div>
              <div className="max-h-24 overflow-y-auto mb-2 space-y-0.5">
                {pendingImport.blocks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className={`shrink-0 ${b.enabled ? 'text-aether-purple/40' : 'text-white/10'}`}>
                      {b.enabled ? '☑' : '☐'}
                    </span>
                    <span className={`truncate flex-1 ${b.enabled ? 'text-white/55' : 'text-white/20 line-through'}`}>
                      {b.name}
                    </span>
                    <span className="text-white/12 font-mono text-[9px] uppercase shrink-0">{b.role}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => applyImport('replace')}
                  className="px-3 py-1 rounded text-[10px] font-display tracking-wide bg-aether-purple/25 border border-aether-purple/40 text-aether-purple hover:bg-aether-purple/35 transition-all">
                  替换当前
                </button>
                <button onClick={() => applyImport('append')}
                  className="px-3 py-1 rounded text-[10px] font-display tracking-wide border border-aether-purple/30 text-aether-purple/70 hover:bg-aether-purple/[0.06] transition-all">
                  追加到末尾
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 词块 card list ── */}
        <div className="space-y-1">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
              <div className="w-10 h-10 rounded-full bg-aether-purple/5 border border-aether-border/20 flex items-center justify-center mb-2">
                <Sliders size={18} className="text-white/10" />
              </div>
              <p className="text-white/15 text-xs font-display tracking-wide mb-1">暂无预设词块</p>
              <p className="text-white/8 text-[10px]">点击「新建词块」或「导入预设」加载潮汐/酒馆预设</p>
            </div>
          ) : (
            blocks.map((block, index) => {
              const enabled = block.enabled;
              const isExpanded = expandedIds.has(block.identifier);
              return (
                <div
                  key={block.identifier}
                  className={`rounded border transition-all ${
                    enabled
                      ? 'border-aether-border/12 bg-aether-dark/30'
                      : 'border-aether-border/6 bg-aether-dark/15 opacity-55'
                  }`}
                >
                  {/* ── Card header ── */}
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={e => updateBlock(index, { enabled: e.target.checked })}
                      className="accent-aether-purple shrink-0 h-3.5 w-3.5"
                    />

                    {/* Expand toggle + Name */}
                    <button
                      onClick={() => enabled && toggleExpanded(block.identifier)}
                      disabled={!enabled}
                      className={`flex-1 text-left flex items-center gap-1 min-w-0 ${
                        enabled ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <span className={`shrink-0 text-[9px] transition-colors ${
                        isExpanded && enabled ? 'text-white/30' : 'text-white/10'
                      }`}>
                        {isExpanded && enabled ? '▾' : '▸'}
                      </span>
                      <span className={`text-[11px] leading-tight truncate ${
                        enabled ? 'text-white/65' : 'text-white/25'
                      }`}>
                        {block.name || '未命名'}
                      </span>
                    </button>

                    {/* Role badge */}
                    <span className={`text-[8px] px-1 py-0.5 rounded border font-mono uppercase shrink-0 ${ROLE_COLORS[block.role] || ROLE_COLORS.system}`}>
                      {block.role}
                    </span>

                    {/* Identifier (short) */}
                    <span className="text-[8px] text-white/10 font-mono shrink-0 hidden sm:inline">
                      {block.identifier.length > 8 ? block.identifier.slice(0, 8) + '…' : block.identifier}
                    </span>

                    {/* Order buttons */}
                    <button disabled={index === 0} onClick={() => moveBlock(index, -1)}
                      className="text-[10px] text-white/12 hover:text-white/35 disabled:opacity-8 px-0.5 leading-none shrink-0" title="上移">↑</button>
                    <button disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}
                      className="text-[10px] text-white/12 hover:text-white/35 disabled:opacity-8 px-0.5 leading-none shrink-0" title="下移">↓</button>

                    {/* Delete */}
                    <button onClick={() => removeBlock(index)}
                      className="text-[10px] text-white/10 hover:text-aether-red/50 transition-colors px-0.5 shrink-0" title="删除">✕</button>
                  </div>

                  {/* ── Expanded content ── */}
                  <AnimatePresence initial={false}>
                    {enabled && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-aether-border/6 pt-2 space-y-2">
                          {/* Name + Role row */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={block.name}
                              onChange={e => updateBlock(index, { name: e.target.value })}
                              placeholder="词块名称"
                              className="flex-1 bg-aether-dark/50 border border-aether-border/25 rounded px-2 py-1 text-[11px] text-white/65 focus:outline-none focus:border-aether-purple/50 transition-all"
                            />
                            <select
                              value={block.role}
                              onChange={e => updateBlock(index, { role: e.target.value as PresetBlock['role'] })}
                              className="bg-aether-dark/50 border border-aether-border/25 rounded px-2 py-1 text-[11px] text-white/55 focus:outline-none focus:border-aether-purple/50 transition-all"
                            >
                              <option value="system">system</option>
                              <option value="user">user</option>
                              <option value="assistant">assistant</option>
                            </select>
                            <span className="text-[9px] text-white/15 font-mono shrink-0">#{index + 1}</span>
                          </div>

                          {/* Content textarea */}
                          <textarea
                            value={block.content}
                            onChange={e => updateBlock(index, { content: e.target.value })}
                            rows={6}
                            placeholder="提示词内容..."
                            className="w-full bg-aether-dark/50 border border-aether-border/25 rounded px-3 py-2 text-[11px] text-white/65 placeholder:text-white/10 focus:outline-none focus:border-aether-purple/50 transition-all resize-none font-mono leading-relaxed"
                          />
                          <p className="text-[9px] text-white/10">
                            宏: <code className="text-aether-cyan/25">{'{{user}}'}</code>{' '}
                            <code className="text-aether-cyan/25">{'{{char}}'}</code>{' '}
                            <code className="text-aether-cyan/25">{'{{original}}'}</code>{' '}
                            <code className="text-white/8">{'{{setvar::}} {{addvar::}} {{getvar::}} {{trim}}'}</code>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Toast ── */}
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

// ── Helper sub-components ──

function NumberField({ label, value, onChange, step = 1, min, max }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex items-center gap-2 bg-aether-dark/40 border border-aether-border/15 rounded px-2 py-1">
      <span className="text-[9px] text-white/20 shrink-0 font-mono">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        step={step}
        min={min}
        max={max}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-white/55 focus:outline-none text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}

function CheckField({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent-aether-purple h-3 w-3 shrink-0"
      />
      <span className={`text-[9px] font-mono transition-colors ${checked ? 'text-white/40' : 'text-white/15'}`}>
        {label}
      </span>
    </label>
  );
}

const TEMPLATE_FIELDS: { key: keyof PresetParams; label: string }[] = [
  { key: 'impersonation_prompt', label: '扮演提示 (impersonation_prompt)' },
  { key: 'new_chat_prompt', label: '新聊天提示 (new_chat_prompt)' },
  { key: 'new_group_chat_prompt', label: '新群聊提示 (new_group_chat_prompt)' },
  { key: 'new_example_chat_prompt', label: '示例聊天提示 (new_example_chat_prompt)' },
  { key: 'continue_nudge_prompt', label: '继续推动 (continue_nudge_prompt)' },
  { key: 'group_nudge_prompt', label: '群聊推动 (group_nudge_prompt)' },
  { key: 'wi_format', label: '世界书格式 (wi_format)' },
  { key: 'scenario_format', label: '场景格式 (scenario_format)' },
  { key: 'personality_format', label: '性格格式 (personality_format)' },
  { key: 'send_if_empty', label: '空时发送 (send_if_empty)' },
  { key: 'bias_preset_selected', label: '偏置预设 (bias_preset_selected)' },
];
