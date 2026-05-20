import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Upload, Star, Download, Pencil, Trash2, ChevronRight, Save } from 'lucide-react';
import { NumField } from './SettingsFields';
import type { ChatPreset } from '../../sillytavern/types';

interface Props {
  presets: ChatPreset[];
  activePresetId: string | null;
  expandedPresetId: string | null;
  setExpandedPresetId: (id: string | null) => void;
  presetSubTab: string;
  setPresetSubTab: (t: string) => void;
  presetDraftFull: ChatPreset | null;
  presetDirty: boolean;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onCreate: () => void;
  onDelete: (p: ChatPreset) => void;
  onRename: (p: ChatPreset) => void;
  onExport: (p: ChatPreset) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenEdit: (p: ChatPreset) => void;
  onSetName: (name: string) => void;
  onPatchSettings: (patch: Record<string, any>) => void;
  onSave: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function PresetTab(props: Props) {
  const {
    presets, activePresetId, expandedPresetId, setExpandedPresetId,
    presetSubTab, setPresetSubTab, presetDraftFull, presetDirty,
    expandedSections, setExpandedSections,
    onActivate, onDeactivate, onCreate, onDelete, onRename, onExport, onImport, onOpenEdit,
    onSetName, onPatchSettings, onSave, showToast,
  } = props;

  const presetFileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-aether-cyan text-aether-dark text-xs font-semibold tracking-wide hover:bg-white transition-all font-display">
          <Plus size={14} /> 新建预设
        </button>
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-aether-border/30 text-white/50 hover:text-white/80 hover:border-aether-purple/40 text-xs tracking-wide cursor-pointer transition-all font-display">
          <Upload size={14} /> 导入预设
          <input ref={presetFileRef} type="file" accept=".json" className="hidden" onChange={onImport} />
        </label>
      </div>

      {presets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-aether-cyan/5 border border-aether-border/20 flex items-center justify-center mb-4">
            <Star size={28} className="text-white/15" />
          </div>
          <p className="text-white/25 text-sm font-display tracking-wide mb-1">暂无预设</p>
          <p className="text-white/10 text-xs">点击「新建预设」创建采样参数配置</p>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id;
            const isExpanded = expandedPresetId === preset.id;
            return (
              <React.Fragment key={preset.id}>
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`relative rounded-lg border transition-all group cursor-pointer ${
                    isActive ? 'border-aether-purple/40 bg-aether-purple/[0.05] shadow-[0_0_12px_rgba(168,85,247,0.06)]'
                    : 'border-aether-border/20 bg-aether-dark/30 hover:border-aether-border/40'
                  }`}>
                  {isActive && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-aether-purple rounded-r-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={(ev) => { ev.stopPropagation(); isActive ? onDeactivate() : onActivate(preset.id); }}
                      className={`flex items-center justify-center w-5 h-5 flex-shrink-0 transition-all clickable press-scale ${isActive ? 'text-aether-gold hover:text-aether-gold/70' : 'text-white/15 hover:text-aether-gold/60'}`}
                      title={isActive ? '取消激活' : '激活'}>
                      <Star size={isActive ? 16 : 14} fill={isActive ? 'currentColor' : 'none'} />
                    </button>
                    <div className="flex-1 min-w-0" onClick={() => onOpenEdit(preset)}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-display font-medium tracking-wide truncate ${isActive ? 'text-white/80' : 'text-white/50'}`}>{preset.name}</span>
                        {isActive && <span className="text-[9px] bg-aether-purple/20 text-aether-purple px-1.5 py-0.5 rounded-full font-mono">激活中</span>}
                        <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }} className="text-white/20"><ChevronRight size={14} /></motion.span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/20 font-mono">
                        <span>temp: {preset.settings.temp_openai ?? 0.8}</span>
                        <span>max_tokens: {preset.settings.openai_max_tokens ?? 2048}</span>
                        <span>top_p: {preset.settings.top_p_openai ?? 0.9}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                      <button onClick={(ev) => { ev.stopPropagation(); onExport(preset); }}
                        className="p-1.5 rounded text-white/25 hover:text-aether-green hover:bg-aether-green/10 transition-all" title="导出"><Download size={13} /></button>
                      <button onClick={(ev) => { ev.stopPropagation(); onRename(preset); }}
                        className="p-1.5 rounded text-white/25 hover:text-aether-cyan hover:bg-aether-cyan/10 transition-all" title="重命名"><Pencil size={13} /></button>
                      <button onClick={(ev) => { ev.stopPropagation(); onDelete(preset); }}
                        className="p-1.5 rounded text-white/25 hover:text-aether-red hover:bg-aether-red/10 transition-all" title="删除"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </motion.div>

                {/* Expanded editor */}
                <AnimatePresence initial={false}>
                  {isExpanded && presetDraftFull && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                      <div className="ml-8 mr-2 mb-3 space-y-3 border-l border-aether-border/20 pl-4 pt-2">
                        {/* Name */}
                        <div className="bg-aether-dark/40 rounded-lg border border-aether-border/15 p-3">
                          <label className="flex items-center gap-3">
                            <span className="text-[11px] text-white/40 font-display tracking-wide shrink-0">名称</span>
                            <input type="text" value={presetDraftFull.name}
                              onChange={e => onSetName(e.target.value)}
                              className="flex-1 bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-aether-purple/60 transition-all" />
                          </label>
                        </div>

                        {/* Sub-tabs */}
                        <div className="flex gap-1 flex-wrap">
                          {([
                            ['sections', '预设词块'],
                            ['sampling', '采样参数'],
                          ] as const).map(([id, label]) => (
                            <button key={id} onClick={() => setPresetSubTab(id)}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-display tracking-wide transition-all ${
                                presetSubTab === id ? 'bg-aether-purple/30 text-aether-purple border border-aether-purple/40'
                                : 'text-white/30 hover:text-white/50 border border-transparent hover:border-white/10'}`}>{label}</button>
                          ))}
                        </div>

                        {/* Sections tab */}
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
                                    if (oi >= 0) { list[oi] = { ...list[oi], ...patch }; onPatchSettings({ prompt_order: list }); }
                                  } else {
                                    const list = [...(presetDraftFull.settings.prompts ?? [])];
                                    const pi = list.findIndex((p: any) => p.identifier === item.identifier);
                                    if (pi >= 0) { list[pi] = { ...list[pi], ...patch }; onPatchSettings({ prompts: list }); }
                                  }
                                };
                                return (
                                  <div key={item.identifier}
                                    className={`rounded-lg border transition-all ${sectionEnabled ? 'border-aether-border/15 bg-aether-dark/40' : 'border-aether-border/8 bg-aether-dark/20 opacity-60'}`}>
                                    <div className="flex items-center gap-2 px-3 py-2">
                                      <input type="checkbox" checked={sectionEnabled} onChange={e => patchItem({ enabled: e.target.checked })} className="accent-aether-purple shrink-0" />
                                      <span onClick={() => { if (!sectionEnabled) return; setExpandedSections(prev => { const next = new Set(prev); next.has(item.identifier) ? next.delete(item.identifier) : next.add(item.identifier); return next; }); }}
                                        className={`text-[12px] font-display font-medium flex-1 cursor-pointer select-none hover:text-white/80 transition-colors ${sectionEnabled ? 'text-white/60' : 'text-white/25'}`}>
                                        {isExpanded ? '▾ ' : '▸ '}{item.name || item.identifier}
                                      </span>
                                      <span className="text-[9px] text-white/15 font-mono">{item.identifier}</span>
                                      {isOrderItem && (<>
                                        <button disabled={idx === 0} onClick={() => { const list = [...(presetDraftFull.settings.prompt_order ?? [])]; [list[idx-1], list[idx]] = [list[idx], list[idx-1]]; onPatchSettings({ prompt_order: list }); }}
                                          className="text-[10px] text-white/15 hover:text-white/40 disabled:opacity-15 px-0.5" title="上移">↑</button>
                                        <button disabled={idx === orderItems.length - 1} onClick={() => { const list = [...(presetDraftFull.settings.prompt_order ?? [])]; [list[idx], list[idx+1]] = [list[idx+1], list[idx]]; onPatchSettings({ prompt_order: list }); }}
                                          className="text-[10px] text-white/15 hover:text-white/40 disabled:opacity-15 px-0.5" title="下移">↓</button>
                                      </>)}
                                    </div>
                                    {sectionEnabled && isExpanded && (
                                      <div className="px-3 pb-3">
                                        <div className="flex items-center gap-4 mb-2 text-[10px]">
                                          <span className="text-white/25 font-mono">角色: <span className="text-white/40">{item.role || 'system'}</span></span>
                                          <span className="text-white/25 font-mono">位置: <span className="text-white/40">{isOrderItem ? `第 ${idx + 1} 位` : '自定义'}</span></span>
                                        </div>
                                        <textarea value={content} onChange={e => patchItem({ content: e.target.value })}
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

                        {/* Sampling tab */}
                        {presetSubTab === 'sampling' && (
                          <div className="space-y-3">
                            <div className="bg-aether-dark/40 rounded-lg border border-aether-border/15 p-3">
                              <h4 className="text-[10px] font-display font-semibold text-white/30 uppercase tracking-wider mb-2">核心采样</h4>
                              <div className="flex flex-wrap gap-3">
                                <NumField label="温度 (Temperature)" value={presetDraftFull.settings.temp_openai} onChange={v => onPatchSettings({ temp_openai: v })} step={0.05} min={0} max={2} fallback={0.8} />
                                <NumField label="Top P" value={presetDraftFull.settings.top_p_openai} onChange={v => onPatchSettings({ top_p_openai: v })} step={0.01} min={0} max={1} fallback={0.9} />
                                <NumField label="Top K" value={presetDraftFull.settings.top_k_openai} onChange={v => onPatchSettings({ top_k_openai: v })} min={0} max={500} fallback={0} />
                                <NumField label="Top A" value={presetDraftFull.settings.top_a_openai} onChange={v => onPatchSettings({ top_a_openai: v })} step={0.01} min={0} max={1} fallback={0} />
                                <NumField label="Min P" value={presetDraftFull.settings.min_p_openai} onChange={v => onPatchSettings({ min_p_openai: v })} step={0.01} min={0} max={1} fallback={0} />
                              </div>
                            </div>
                            <div className="bg-aether-dark/40 rounded-lg border border-aether-border/15 p-3">
                              <h4 className="text-[10px] font-display font-semibold text-white/30 uppercase tracking-wider mb-2">惩罚参数</h4>
                              <div className="flex flex-wrap gap-3">
                                <NumField label="频率惩罚 (Frequency)" value={presetDraftFull.settings.freq_pen_openai} onChange={v => onPatchSettings({ freq_pen_openai: v })} step={0.1} min={-2} max={2} fallback={0} />
                                <NumField label="存在惩罚 (Presence)" value={presetDraftFull.settings.pres_pen_openai} onChange={v => onPatchSettings({ pres_pen_openai: v })} step={0.1} min={-2} max={2} fallback={0} />
                                <NumField label="重复惩罚 (Repetition)" value={presetDraftFull.settings.repetition_penalty_openai} onChange={v => onPatchSettings({ repetition_penalty_openai: v })} step={0.05} min={0} max={2} fallback={1} />
                              </div>
                            </div>
                            <div className="bg-aether-dark/40 rounded-lg border border-aether-border/15 p-3">
                              <h4 className="text-[10px] font-display font-semibold text-white/30 uppercase tracking-wider mb-2">上下文与模型</h4>
                              <div className="flex flex-wrap gap-3 items-end">
                                <NumField label="最大上下文" value={presetDraftFull.settings.openai_max_context} onChange={v => onPatchSettings({ openai_max_context: v })} step={256} min={256} max={2000000} fallback={4096} />
                                <NumField label="最大 Token 数" value={presetDraftFull.settings.openai_max_tokens} onChange={v => onPatchSettings({ openai_max_tokens: v })} step={64} min={32} max={32768} fallback={2048} />
                                <label className="flex-1 min-w-[160px]">
                                  <span className="block text-[10px] text-white/30 mb-1">模型</span>
                                  <input type="text" value={presetDraftFull.settings.openai_model ?? ''}
                                    onChange={e => onPatchSettings({ openai_model: e.target.value })} placeholder="gpt-3.5-turbo"
                                    className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1.5 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-purple/60" />
                                </label>
                              </div>
                              <div className="flex items-center gap-5 mt-3">
                                <label className="flex items-center gap-1.5 text-[10px] text-white/35 cursor-pointer">
                                  <input type="checkbox" checked={!!presetDraftFull.settings.stream_openai}
                                    onChange={e => onPatchSettings({ stream_openai: e.target.checked })} className="accent-aether-purple" /> 流式输出
                                </label>
                                <label className="flex items-center gap-1.5 text-[10px] text-white/35 cursor-pointer">
                                  <input type="checkbox" checked={!!presetDraftFull.settings.max_context_unlocked}
                                    onChange={e => onPatchSettings({ max_context_unlocked: e.target.checked })} className="accent-aether-purple" /> 解锁上下文限制
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Save */}
                        <div className="flex justify-end">
                          <button onClick={onSave} disabled={!presetDirty}
                            className={`px-4 py-1.5 rounded text-xs font-display tracking-wide transition-all ${
                              presetDirty ? 'bg-aether-purple text-white shadow-[0_0_12px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                              : 'bg-white/5 text-white/20 cursor-not-allowed'}`}>保存修改</button>
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
  );
}
