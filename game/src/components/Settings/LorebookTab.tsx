import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Upload, BookOpen, Download, Pencil, Trash2, ChevronRight, Save } from 'lucide-react';
import { StatPill, ChipInput } from './SettingsFields';
import type { Lorebook, LorebookEntry } from '../../sillytavern/types';

interface Props {
  lorebookList: Lorebook[];
  lorebookActiveIds: Set<string>;
  expandedLorebookId: string | null;
  setExpandedLorebookId: (id: string | null) => void;
  editingEntryId: string | null;
  entryDraft: LorebookEntry | null;
  entryDirty: boolean;
  onToggleLorebook: (id: string) => void;
  onCreateLorebook: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportLorebook: (lb: Lorebook) => void;
  onRenameLorebook: (lb: Lorebook) => void;
  onDeleteLorebook: (lb: Lorebook) => void;
  onNewEntry: (lb: Lorebook) => void;
  onOpenEntry: (entry: LorebookEntry) => void;
  onCloseEntry: () => void;
  onSaveEntry: (lb: Lorebook) => void;
  onDeleteEntry: (lb: Lorebook, entryId: string) => void;
  onPatchEntry: (patch: Partial<LorebookEntry>) => void;
  onUpdateLorebook: (lb: Lorebook) => void;
  refreshLorebookList: () => Promise<void>;
}

export default function LorebookTab(props: Props) {
  const {
    lorebookList, lorebookActiveIds, expandedLorebookId, setExpandedLorebookId,
    editingEntryId, entryDraft, entryDirty,
    onToggleLorebook, onCreateLorebook, onImportJson, onExportLorebook,
    onRenameLorebook, onDeleteLorebook, onNewEntry, onOpenEntry, onCloseEntry,
    onSaveEntry, onDeleteEntry, onPatchEntry, onUpdateLorebook, refreshLorebookList,
  } = props;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCreateLorebook}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-aether-cyan text-aether-dark text-xs font-semibold tracking-wide hover:bg-white transition-all font-display">
          <Plus size={14} /> 新建世界书
        </button>
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-aether-border/30 text-white/50 hover:text-white/80 hover:border-aether-cyan/40 text-xs tracking-wide cursor-pointer transition-all font-display">
          <Upload size={14} /> 导入 JSON
          <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={onImportJson} />
        </label>
      </div>

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
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`relative rounded-lg border transition-all group cursor-pointer ${
                    isActive ? 'border-aether-cyan/30 bg-aether-cyan/[0.04] shadow-[0_0_12px_rgba(0,242,255,0.04)]'
                    : 'border-aether-border/20 bg-aether-dark/30 hover:border-aether-border/40'
                  }`}>
                  {isActive && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-aether-cyan rounded-r-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={(ev) => { ev.stopPropagation(); onToggleLorebook(lb.id); }}
                      className={`relative w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                        isActive ? 'border-aether-cyan bg-aether-cyan/20 shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-white/15 bg-transparent group-hover:border-white/30'
                      }`}>
                      {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2.5 h-2.5 bg-aether-cyan rounded-sm" />}
                    </button>
                    <div className="flex-1 min-w-0" onClick={() => setExpandedLorebookId(isExpanded ? null : lb.id)}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-display font-medium tracking-wide truncate ${isActive ? 'text-white/80' : 'text-white/50'}`}>{lb.name}</span>
                        <StatPill count={lb.entries.length} />
                        <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }} className="text-white/20"><ChevronRight size={14} /></motion.span>
                      </div>
                      {lb.description && <p className="text-[11px] text-white/25 truncate mt-0.5">{lb.description}</p>}
                      {!isExpanded && lb.entries.length > 0 && (
                        <p className="text-[10px] text-white/15 mt-1 truncate">{lb.entries.slice(0, 3).map(e => e.comment || e.content.slice(0, 20)).join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                      <button onClick={(ev) => { ev.stopPropagation(); onExportLorebook(lb); }}
                        className="p-1.5 rounded text-white/25 hover:text-aether-green hover:bg-aether-green/10 transition-all" title="导出"><Download size={13} /></button>
                      <button onClick={(ev) => { ev.stopPropagation(); onRenameLorebook(lb); }}
                        className="p-1.5 rounded text-white/25 hover:text-aether-cyan hover:bg-aether-cyan/10 transition-all" title="重命名"><Pencil size={13} /></button>
                      <button onClick={(ev) => { ev.stopPropagation(); onDeleteLorebook(lb); }}
                        className="p-1.5 rounded text-white/25 hover:text-aether-red hover:bg-aether-red/10 transition-all" title="删除"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </motion.div>

                {/* Expanded: settings + entry list + inline editor */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                      <div className="ml-8 mr-2 mb-3 space-y-3 border-l border-aether-border/20 pl-4 pt-2">
                        {/* Worldbook settings */}
                        <div className="bg-aether-dark/40 rounded-lg border border-aether-border/15 p-3">
                          <h4 className="text-[11px] font-display font-semibold text-white/40 uppercase tracking-wider mb-2">世界书设置</h4>
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-1.5 text-[11px] text-white/40 cursor-pointer">
                              <input type="checkbox" checked={lb.recursiveScanning}
                                onChange={async () => { await onUpdateLorebook({ ...lb, recursiveScanning: !lb.recursiveScanning, updatedAt: Date.now() }); await refreshLorebookList(); }}
                                className="accent-aether-cyan" /> 递归扫描
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] text-white/40 cursor-pointer">
                              <input type="checkbox" checked={lb.caseSensitive}
                                onChange={async () => { await onUpdateLorebook({ ...lb, caseSensitive: !lb.caseSensitive, updatedAt: Date.now() }); await refreshLorebookList(); }}
                                className="accent-aether-cyan" /> 区分大小写
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] text-white/40 cursor-pointer">
                              <input type="checkbox" checked={lb.matchWholeWords}
                                onChange={async () => { await onUpdateLorebook({ ...lb, matchWholeWords: !lb.matchWholeWords, updatedAt: Date.now() }); await refreshLorebookList(); }}
                                className="accent-aether-cyan" /> 全词匹配
                            </label>
                            <StatPill count={lb.entries.length} />
                          </div>
                        </div>

                        {/* New entry button */}
                        <button onClick={() => onNewEntry(lb)}
                          className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg bg-aether-cyan/15 border border-aether-cyan/25 text-aether-cyan text-xs font-semibold tracking-wide hover:bg-aether-cyan/25 transition-all font-display justify-center">
                          <Plus size={14} /> 新建条目
                        </button>

                        {/* Entry list */}
                        {lb.entries.length > 0 && (
                          <div className="space-y-1">
                            {lb.entries.map((entry, idx) => {
                              const isEditing = editingEntryId === entry.id;
                              return (
                                <div key={entry.id}
                                  className={`rounded-lg border transition-all ${
                                    isEditing ? 'border-aether-cyan/25 bg-aether-cyan/[0.03]'
                                    : entry.disable ? 'border-aether-border/10 bg-aether-dark/30 opacity-60' : 'border-aether-border/15 bg-aether-dark/30 hover:border-aether-border/30'
                                  }`}>
                                  <div onClick={() => isEditing ? onCloseEntry() : onOpenEntry(entry)}
                                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer group">
                                    <motion.span animate={{ rotate: isEditing ? 90 : 0 }} transition={{ duration: 0.15 }} className="text-white/20"><ChevronRight size={13} /></motion.span>
                                    <span className="text-[10px] text-white/15 font-mono w-5 shrink-0">#{idx + 1}</span>
                                    <span className={`text-[12px] font-display truncate flex-1 ${isEditing ? 'text-aether-cyan/80' : entry.disable ? 'text-white/30' : 'text-white/55'}`}>
                                      {entry.comment || entry.content.slice(0, 35) || '(未命名)'}
                                    </span>
                                    {entry.constant && <span className="text-[8px] bg-aether-purple/15 text-aether-purple/50 px-1.5 py-0.5 rounded font-mono shrink-0">常驻</span>}
                                    {entry.selective && <span className="text-[8px] bg-aether-blue/15 text-aether-blue/50 px-1.5 py-0.5 rounded font-mono shrink-0">选择性</span>}
                                    {entry.disable && <span className="text-[8px] bg-aether-red/10 text-aether-red/40 px-1.5 py-0.5 rounded font-mono shrink-0">已禁用</span>}
                                    <span className="text-[9px] text-white/10 font-mono shrink-0">{entry.keys.slice(0, 3).join(', ') || '无关键词'}</span>
                                  </div>

                                  {/* Inline editor */}
                                  <AnimatePresence>
                                    {isEditing && entryDraft && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }} className="overflow-hidden">
                                        <div className="px-4 pb-4 space-y-3 border-t border-aether-border/10 pt-3">
                                          <label className="block">
                                            <span className="block text-[10px] text-white/30 mb-1">备注</span>
                                            <input type="text" value={entryDraft.comment ?? ''}
                                              onChange={e => onPatchEntry({ comment: e.target.value })} placeholder="条目显示名称"
                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 placeholder:text-white/15 focus:outline-none focus:border-aether-cyan/60 transition-all" />
                                          </label>
                                          <ChipInput label="主关键词" values={entryDraft.keys} onChange={keys => onPatchEntry({ keys })}
                                            placeholder="输入关键词，回车添加" />
                                          <ChipInput label="次级关键词" values={entryDraft.secondaryKeys}
                                            onChange={secondaryKeys => onPatchEntry({ secondaryKeys })} placeholder="选择性模式下启用" />

                                          {/* Position + Order + Depth/Role/Outlet */}
                                          <div className="flex gap-3 flex-wrap items-end">
                                            <label className="flex-1 min-w-[140px]">
                                              <span className="block text-[10px] text-white/30 mb-1">位置</span>
                                              <select value={entryDraft.position}
                                                onChange={e => onPatchEntry({ position: e.target.value as LorebookEntry['position'] })}
                                                className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/60 focus:outline-none focus:border-aether-cyan/60 transition-all">
                                                <option value="before_char">角色前</option><option value="after_char">角色后</option>
                                                <option value="before_example">示例前</option><option value="after_example">示例后</option>
                                                <option value="at_depth">按深度</option><option value="example_msg_top">示例消息顶</option>
                                                <option value="example_msg_bottom">示例消息底</option><option value="outlet">出口</option>
                                              </select>
                                            </label>
                                            <label className="w-20">
                                              <span className="block text-[10px] text-white/30 mb-1">优先级</span>
                                              <input type="number" value={entryDraft.order} onChange={e => onPatchEntry({ order: Number(e.target.value) || 100 })}
                                                className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                            </label>
                                            {entryDraft.position === 'at_depth' && (<>
                                              <label className="w-20"><span className="block text-[10px] text-white/30 mb-1">深度</span>
                                                <input type="number" value={entryDraft.depth ?? 4} onChange={e => onPatchEntry({ depth: Number(e.target.value) || 4 })}
                                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" /></label>
                                              <label className="w-24"><span className="block text-[10px] text-white/30 mb-1">角色</span>
                                                <select value={entryDraft.role ?? 0} onChange={e => onPatchEntry({ role: Number(e.target.value) })}
                                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/60 focus:outline-none focus:border-aether-cyan/60">
                                                  <option value={0}>系统</option><option value={1}>用户</option><option value={2}>助手</option></select></label>
                                            </>)}
                                            {entryDraft.position === 'outlet' && (
                                              <label className="flex-1 min-w-[120px]"><span className="block text-[10px] text-white/30 mb-1">出口名称</span>
                                                <input type="text" value={entryDraft.outletName ?? ''} onChange={e => onPatchEntry({ outletName: e.target.value })}
                                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" /></label>
                                            )}
                                          </div>

                                          {/* Toggles */}
                                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                            <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer"><input type="checkbox" checked={entryDraft.constant} onChange={e => onPatchEntry({ constant: e.target.checked })} className="accent-aether-purple" /> 常驻</label>
                                            <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer"><input type="checkbox" checked={entryDraft.disable ?? false} onChange={e => onPatchEntry({ disable: e.target.checked })} className="accent-aether-red" /> 禁用</label>
                                            <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer"><input type="checkbox" checked={entryDraft.addMemo} onChange={e => onPatchEntry({ addMemo: e.target.checked })} className="accent-aether-cyan" /> 添加备注</label>
                                            <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer"><input type="checkbox" checked={entryDraft.ignoreBudget ?? false} onChange={e => onPatchEntry({ ignoreBudget: e.target.checked })} className="accent-aether-cyan" /> 忽略预算</label>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                            <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer"><input type="checkbox" checked={entryDraft.selective} onChange={e => onPatchEntry({ selective: e.target.checked })} className="accent-aether-blue" /> 选择性</label>
                                            {entryDraft.selective && (
                                              <select value={entryDraft.selectiveLogic} onChange={e => onPatchEntry({ selectiveLogic: e.target.value as any })}
                                                className="bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-[10px] text-white/50 focus:outline-none focus:border-aether-blue/60">
                                                <option value="and_any">与/任一</option><option value="not_all">非全部</option><option value="not_any">无任一</option><option value="and_all">与/全部</option></select>
                                            )}
                                            <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer"><input type="checkbox" checked={entryDraft.useProbability ?? false} onChange={e => onPatchEntry({ useProbability: e.target.checked })} className="accent-aether-gold" /> 概率触发</label>
                                            {entryDraft.useProbability && (
                                              <label className="flex items-center gap-1 text-[10px] text-white/30">
                                                <input type="number" value={entryDraft.probability} min={0} max={100} onChange={e => onPatchEntry({ probability: Math.min(100, Math.max(0, Number(e.target.value) || 100)) })}
                                                  className="w-16 bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-[10px] text-white/70 font-mono focus:outline-none focus:border-aether-gold/60" /> %
                                              </label>
                                            )}
                                          </div>

                                          {/* sticky / cooldown / delay / weight / scanDepth */}
                                          <div className="flex gap-3 flex-wrap">
                                            {(['sticky','cooldown','delay','weight','scanDepth'] as const).map(k => (
                                              <label key={k} className="flex-1 min-w-[80px]">
                                                <span className="block text-[10px] text-white/30 mb-1">{k === 'sticky' ? '粘性回合' : k === 'cooldown' ? '冷却回合' : k === 'delay' ? '延迟回合' : k === 'weight' ? '权重' : '扫描深度'}</span>
                                                <input type="number" value={(entryDraft as any)[k] ?? (k === 'weight' ? 100 : 0)}
                                                  onChange={e => onPatchEntry({ [k]: Number(e.target.value) || 0 } as any)}
                                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60" />
                                              </label>
                                            ))}
                                          </div>

                                          {/* Advanced options */}
                                          <details className="border-t border-aether-border/10 pt-2">
                                            <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/40 transition-colors font-display tracking-wide select-none">匹配选项与角色卡过滤</summary>
                                            <div className="pt-2 space-y-2">
                                              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                                                {(['caseSensitive','matchWholeWords','excludeRecursion','preventRecursion','delayUntilRecursion'] as const).map(k => (
                                                  <label key={k} className="flex items-center gap-1.5 text-[10px] text-white/35 cursor-pointer">
                                                    <input type="checkbox" checked={(entryDraft as any)[k] ?? false} onChange={e => onPatchEntry({ [k]: e.target.checked } as any)} className="accent-aether-cyan" />
                                                    {k === 'caseSensitive' ? '区分大小写' : k === 'matchWholeWords' ? '全词匹配' : k === 'excludeRecursion' ? '排除递归' : k === 'preventRecursion' ? '阻止递归' : '延迟至递归触发'}
                                                  </label>
                                                ))}
                                              </div>
                                              <fieldset className="border border-aether-border/10 rounded p-2">
                                                <legend className="text-[9px] text-white/20 px-1">角色卡匹配</legend>
                                                <div className="flex flex-wrap gap-x-5 gap-y-1">
                                                  {(['matchPersonaDescription','matchCharacterDescription','matchCharacterPersonality','matchCharacterDepthPrompt','matchScenario','matchCreatorNotes'] as const).map(k => (
                                                    <label key={k} className="flex items-center gap-1.5 text-[10px] text-white/30 cursor-pointer">
                                                      <input type="checkbox" checked={(entryDraft as any)[k] ?? false} onChange={e => onPatchEntry({ [k]: e.target.checked } as any)} className="accent-aether-purple" />
                                                      {k === 'matchPersonaDescription' ? '人设描述' : k === 'matchCharacterDescription' ? '角色描述' : k === 'matchCharacterPersonality' ? '角色性格' : k === 'matchCharacterDepthPrompt' ? '深层提示' : k === 'matchScenario' ? '场景' : '创建者备注'}
                                                    </label>
                                                  ))}
                                                </div>
                                              </fieldset>
                                              <label className="block">
                                                <span className="block text-[9px] text-white/20 mb-0.5">装饰器（逗号分隔）</span>
                                                <input type="text" value={(entryDraft.decorators ?? []).join(', ')}
                                                  onChange={e => onPatchEntry({ decorators: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-[10px] text-white/60 focus:outline-none focus:border-aether-cyan/60" />
                                              </label>
                                            </div>
                                          </details>

                                          {/* Content — at bottom */}
                                          <label className="block">
                                            <span className="block text-[10px] text-white/30 mb-1">内容</span>
                                            <textarea value={entryDraft.content} onChange={e => onPatchEntry({ content: e.target.value })} rows={6}
                                              placeholder="匹配后注入到提示词中的正文内容..."
                                              className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 placeholder:text-white/15 focus:outline-none focus:border-aether-cyan/60 transition-all resize-none font-mono leading-relaxed" />
                                            <p className="text-[9px] text-white/12 mt-1">支持宏：{`{{user}}`} {`{{char}}`}</p>
                                          </label>

                                          {/* Actions */}
                                          <div className="flex items-center justify-between pt-2 border-t border-aether-border/10">
                                            <button onClick={() => onDeleteEntry(lb, entry.id)}
                                              className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] text-white/20 hover:text-aether-red hover:bg-aether-red/[0.06] transition-all font-display tracking-wide">
                                              <Trash2 size={11} /> 删除条目
                                            </button>
                                            <div className="flex items-center gap-2">
                                              <button onClick={onCloseEntry} className="px-3 py-1.5 rounded text-[10px] text-white/30 hover:text-white/60 transition-colors font-display tracking-wide">取消</button>
                                              <button onClick={() => onSaveEntry(lb)} disabled={!entryDirty}
                                                className={`flex items-center gap-1 px-4 py-1.5 rounded text-[11px] font-display tracking-wide transition-all ${
                                                  entryDirty ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_12px_rgba(0,242,255,0.2)] hover:shadow-[0_0_20px_rgba(0,242,255,0.35)]' : 'bg-white/5 text-white/15 cursor-not-allowed'
                                                }`}><Save size={12} /> 保存条目</button>
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {lb.entries.length === 0 && !editingEntryId && (
                          <p className="text-[11px] text-white/15 text-center py-6">暂无条目，点击上方按钮新建</p>
                        )}
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
