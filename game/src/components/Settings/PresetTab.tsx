import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, Plus, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { SectionHeader } from './SettingsFields';
import type { AppSettings, PresetBlock } from '../../sillytavern/types';
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

export default function PresetTab({ draft, setDraft }: Props) {
  const blocks: PresetBlock[] = draft.presetBlocks ?? [];
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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

  // ── Import ──

  const handleFilePicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      console.log('[PresetTab] Imported JSON keys:', Object.keys(raw));
      const result = importPresetFromJson(raw);
      console.log('[PresetTab] Parsed blocks:', result.blocks.length, 'name:', result.name);
      if (result.blocks.length === 0) {
        showToast('未识别到任何预设词块，请确认文件格式', 'error');
        return;
      }
      setPendingImport(result);
    } catch (err: any) {
      console.error('[PresetTab] Import error:', err);
      showToast(`导入失败: ${err?.message || '无法解析 JSON 文件'}`, 'error');
    }
    // Reset input value so same file can be re-imported
    e.target.value = '';
  }, [showToast]);

  const applyImport = useCallback(async (mode: 'replace' | 'append') => {
    if (!pendingImport) return;
    const importedBlocks = pendingImport.blocks.map(b => ({
      ...b,
      identifier: crypto.randomUUID(),
    }));
    const nextBlocks = mode === 'replace' ? importedBlocks : [...blocks, ...importedBlocks];
    const nextDraft = { ...draft, presetBlocks: nextBlocks };
    setDraft(nextDraft);

    // Auto-save to DB so imported preset takes effect immediately
    try {
      await saveSettings(nextDraft);
      showToast(
        `已导入「${pendingImport.name}」: ${pendingImport.blocks.length} 个词块（${mode === 'replace' ? '替换' : '追加'}）— 已自动保存`,
        'success',
      );
    } catch {
      showToast(`已导入但保存失败，请手动点击「保存配置」`, 'error');
    }

    // Auto-expand first imported block
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

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={addBlock}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-aether-purple/20 border border-aether-purple/40 text-aether-purple text-xs font-semibold tracking-wide hover:bg-aether-purple/30 transition-all font-display"
          >
            <Plus size={14} /> 新建词块
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-aether-border/30 text-white/50 hover:text-white/80 hover:border-aether-purple/40 text-xs tracking-wide cursor-pointer transition-all font-display">
            <Upload size={14} /> 导入预设
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFilePicked} />
          </label>
        </div>

        {/* ── Pending import banner ── */}
        <AnimatePresence>
          {pendingImport && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-3 p-4 rounded-lg border border-aether-purple/30 bg-aether-purple/[0.04] shadow-[0_0_24px_rgba(168,85,247,0.06)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs text-aether-purple/80 font-display font-semibold tracking-wide">
                    {pendingImport.name}
                  </span>
                  <span className="text-[10px] text-white/25 ml-2 font-mono">{pendingImport.blocks.length} 个词块</span>
                </div>
                <button
                  onClick={() => setPendingImport(null)}
                  className="text-white/15 hover:text-white/40 transition-colors text-[10px] font-display tracking-wide"
                >
                  取消
                </button>
              </div>
              <div className="space-y-0.5 mb-3 max-h-28 overflow-y-auto">
                {pendingImport.blocks.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-[10px] py-0.5">
                    <span className="text-white/15 font-mono w-4 text-right shrink-0">{i + 1}</span>
                    <span className={`font-display tracking-wide flex-1 ${b.enabled ? 'text-white/50' : 'text-white/20 line-through'}`}>
                      {b.name}
                    </span>
                    <span className="text-white/12 font-mono text-[9px] uppercase">{b.role}</span>
                    <span className="text-white/8 truncate max-w-[140px] hidden sm:inline">
                      {b.content ? b.content.slice(0, 40) + '...' : '—'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => applyImport('replace')}
                  className="px-4 py-1.5 rounded text-[11px] tracking-wide bg-aether-purple/25 border border-aether-purple/45 text-aether-purple hover:bg-aether-purple/35 transition-all font-display font-semibold"
                >
                  替换当前
                </button>
                <button
                  onClick={() => applyImport('append')}
                  className="px-4 py-1.5 rounded text-[11px] tracking-wide border border-aether-purple/30 text-aether-purple/70 hover:bg-aether-purple/[0.06] transition-all font-display"
                >
                  追加到末尾
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Word block cards ── */}
        <div className="space-y-1.5">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-aether-dark/20 rounded-lg border border-aether-border/10">
              <div className="w-12 h-12 rounded-full bg-aether-purple/5 border border-aether-border/20 flex items-center justify-center mb-3">
                <Sliders size={22} className="text-white/10" />
              </div>
              <p className="text-white/20 text-xs font-display tracking-wide mb-1">暂无预设词块</p>
              <p className="text-white/10 text-[10px]">点击「新建词块」创建，或「导入预设」加载潮汐/酒馆预设文件</p>
            </div>
          ) : (
            blocks.map((block, index) => {
              const enabled = block.enabled;
              const isExpanded = expandedIds.has(block.identifier);
              return (
                <div
                  key={block.identifier}
                  className={`rounded-lg border transition-all ${
                    enabled
                      ? 'border-aether-border/15 bg-aether-dark/40'
                      : 'border-aether-border/8 bg-aether-dark/20 opacity-60'
                  }`}
                >
                  {/* ── Card header ── */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {/* Enable checkbox */}
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={e => updateBlock(index, { enabled: e.target.checked })}
                      className="accent-aether-purple shrink-0"
                    />

                    {/* Name (click to expand/collapse) */}
                    <button
                      onClick={() => { if (enabled) toggleExpanded(block.identifier); }}
                      disabled={!enabled}
                      className={`flex-1 text-left flex items-center gap-1 select-none ${
                        enabled
                          ? 'cursor-pointer hover:text-white/80'
                          : 'cursor-default'
                      } transition-colors`}
                    >
                      <span className={`text-[9px] ${isExpanded ? 'text-white/30' : 'text-white/12'}`}>
                        {isExpanded ? '▾' : '▸'}
                      </span>
                      <span className={`text-[12px] font-display font-medium ${
                        enabled ? 'text-white/60' : 'text-white/25'
                      }`}>
                        {block.name || '未命名'}
                      </span>
                    </button>

                    {/* Identifier badge */}
                    <span className="text-[9px] text-white/12 font-mono truncate max-w-[100px]" title={block.identifier}>
                      {block.identifier.length > 20 ? block.identifier.slice(0, 18) + '…' : block.identifier}
                    </span>

                    {/* Role badge */}
                    <span className={`text-[8px] px-1 py-0.5 rounded font-mono uppercase shrink-0 ${
                      block.role === 'system'
                        ? 'bg-aether-cyan/10 text-aether-cyan/40'
                        : block.role === 'user'
                          ? 'bg-aether-green/10 text-aether-green/40'
                          : 'bg-aether-blue/10 text-aether-blue/40'
                    }`}>
                      {block.role}
                    </span>

                    {/* Reorder */}
                    <button
                      disabled={index === 0}
                      onClick={() => moveBlock(index, -1)}
                      className="text-[11px] text-white/15 hover:text-white/40 disabled:opacity-10 disabled:cursor-default px-0.5 leading-none"
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      disabled={index === blocks.length - 1}
                      onClick={() => moveBlock(index, 1)}
                      className="text-[11px] text-white/15 hover:text-white/40 disabled:opacity-10 disabled:cursor-default px-0.5 leading-none"
                      title="下移"
                    >
                      ↓
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => removeBlock(index)}
                      className="text-[11px] text-white/15 hover:text-aether-red/50 transition-colors px-0.5"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>

                  {/* ── Expanded content ── */}
                  <AnimatePresence initial={false}>
                    {enabled && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-aether-border/8 pt-2">
                          {/* Name + Role row */}
                          <div className="flex items-center gap-3 mb-2">
                            <label className="flex-1">
                              <span className="block text-[10px] text-white/25 mb-0.5">名称</span>
                              <input
                                type="text"
                                value={block.name}
                                onChange={e => updateBlock(index, { name: e.target.value })}
                                className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-aether-purple/60 transition-all font-mono"
                              />
                            </label>
                            <label style={{ width: 100 }}>
                              <span className="block text-[10px] text-white/25 mb-0.5">角色</span>
                              <select
                                value={block.role}
                                onChange={e => updateBlock(index, { role: e.target.value as PresetBlock['role'] })}
                                className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-aether-purple/60 transition-all font-mono"
                              >
                                <option value="system">system</option>
                                <option value="user">user</option>
                                <option value="assistant">assistant</option>
                              </select>
                            </label>
                            <label style={{ width: 100 }}>
                              <span className="block text-[10px] text-white/25 mb-0.5">位置</span>
                              <input
                                type="text"
                                value={`第 ${index + 1} 位`}
                                disabled
                                className="w-full bg-aether-dark/40 border border-aether-border/15 rounded px-2 py-1 text-xs text-white/25 font-mono cursor-not-allowed"
                              />
                            </label>
                          </div>

                          {/* Content textarea */}
                          <textarea
                            value={block.content}
                            onChange={e => updateBlock(index, { content: e.target.value })}
                            rows={block.identifier === 'main' || block.name === '系统指令' ? 6 : 4}
                            placeholder="输入提示词内容...&#10;支持宏：{{user}} {{char}} {{original}}"
                            className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 placeholder:text-white/12 focus:outline-none focus:border-aether-purple/60 transition-all resize-none font-mono leading-relaxed"
                          />

                          {/* Macro hints */}
                          <p className="text-[9px] text-white/12 mt-1.5">
                            支持宏：
                            <code className="text-aether-cyan/30">{'{{user}}'}</code>{' '}
                            <code className="text-aether-cyan/30">{'{{char}}'}</code>{' '}
                            <code className="text-aether-cyan/30">{'{{original}}'}</code>
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

        {/* ── Info footer ── */}
        <div className="bg-aether-dark/20 rounded-lg border border-aether-border/15 p-3 mt-4">
          <p className="text-[10px] text-white/20 leading-relaxed">
            <span className="text-aether-purple/40 font-semibold">词块按顺序发送：</span>
            每个词块按列表从上到下的顺序依次组装为 prompt。勾选框控制是否包含该词块。
            相同角色的词块会被合并。使用「导入预设」可加载潮汐/酒馆的 .json 预设文件。
          </p>
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
