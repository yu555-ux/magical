import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { SectionHeader, TextAreaRow, InputRow } from './SettingsFields';
import type { AppSettings, PresetBlock } from '../../sillytavern/types';

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
  const blocks = draft.presetBlocks ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setDraft({ ...draft, presetBlocks: [...blocks, newBlock()] });
    setExpandedId(blocks.length > 0 ? blocks[blocks.length - 1].identifier : null);
  };

  return (
    <div className="p-5">
      <section className="max-w-2xl">
        <SectionHeader icon={Sliders} label="预设配置" accent="bg-aether-purple" />

        <div className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-display font-semibold text-aether-purple tracking-wide">提示词块</h4>
              <p className="text-[10px] text-white/25 mt-0.5">
                按顺序组装发送给 AI 的提示词。拖拽或使用上下箭头调整顺序。
              </p>
            </div>
            <button
              onClick={addBlock}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] tracking-wide bg-aether-purple/15 border border-aether-purple/30 text-aether-purple hover:bg-aether-purple/25 transition-all"
            >
              <Plus size={12} /> 添加预设块
            </button>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {blocks.map((block, index) => {
                const isExpanded = expandedId === block.identifier;
                return (
                  <motion.div
                    key={block.identifier}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-lg border transition-all ${
                      block.enabled
                        ? 'border-aether-border/20 bg-aether-dark/40'
                        : 'border-aether-border/10 bg-aether-dark/20 opacity-60'
                    }`}
                  >
                    {/* Header bar */}
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      {/* Order controls */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveBlock(index, -1)}
                          disabled={index === 0}
                          className="text-white/20 hover:text-white/50 disabled:opacity-15 transition-colors leading-none"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => moveBlock(index, 1)}
                          disabled={index === blocks.length - 1}
                          className="text-white/20 hover:text-white/50 disabled:opacity-15 transition-colors leading-none"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      {/* Enable/disable */}
                      <button
                        onClick={() => updateBlock(index, { enabled: !block.enabled })}
                        className="text-white/25 hover:text-white/50 transition-colors shrink-0"
                        title={block.enabled ? '已启用' : '已禁用'}
                      >
                        {block.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>

                      {/* Name */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : block.identifier)}
                        className="flex-1 text-left px-2"
                      >
                        <span className={`text-sm font-display tracking-wide ${
                          block.enabled ? 'text-white/70' : 'text-white/30'
                        }`}>
                          {block.name || '未命名'}
                        </span>
                      </button>

                      {/* Role badge */}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        block.role === 'system'
                          ? 'bg-aether-cyan/10 text-aether-cyan/50'
                          : block.role === 'user'
                            ? 'bg-aether-green/10 text-aether-green/50'
                            : 'bg-aether-blue/10 text-aether-blue/50'
                      }`}>
                        {block.role}
                      </span>

                      {/* Delete */}
                      <button
                        onClick={() => removeBlock(index)}
                        className="text-white/15 hover:text-aether-red/60 transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 border-t border-aether-border/10 space-y-1">
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <InputRow
                                  label="名称"
                                  value={block.name}
                                  onChange={(v) => updateBlock(index, { name: v })}
                                  placeholder="系统指令"
                                />
                              </div>
                              <label className="block mb-3" style={{ width: 120 }}>
                                <span className="block text-[11px] font-medium text-white/40 mb-1.5 tracking-wide uppercase">角色</span>
                                <select
                                  value={block.role}
                                  onChange={(e) => updateBlock(index, { role: e.target.value as PresetBlock['role'] })}
                                  className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-sm text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60 transition-all"
                                >
                                  <option value="system">system</option>
                                  <option value="user">user</option>
                                  <option value="assistant">assistant</option>
                                </select>
                              </label>
                            </div>
                            <TextAreaRow
                              label="提示词内容"
                              value={block.content}
                              onChange={(v) => updateBlock(index, { content: v })}
                              placeholder="输入提示词内容...&#10;支持宏：{{user}} {{char}} {{original}}"
                              rows={6}
                            />
                            <p className="text-[10px] text-white/20 pt-1">
                              宏：<code className="text-aether-cyan/40">{'{{user}}'}</code> 玩家名{' '}
                              <code className="text-aether-cyan/40">{'{{char}}'}</code> AI角色名{' '}
                              <code className="text-aether-cyan/40">{'{{original}}'}</code> 用户输入
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sliders size={32} className="text-white/8 mb-3" />
                <p className="text-white/15 text-xs font-display tracking-wide">暂无预设块</p>
                <p className="text-white/8 text-[10px] mt-1 mb-4">点击上方按钮添加</p>
                <button
                  onClick={addBlock}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] tracking-wide bg-aether-purple/15 border border-aether-purple/30 text-aether-purple hover:bg-aether-purple/25 transition-all"
                >
                  <Plus size={12} /> 添加预设块
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Macros reference */}
        <div className="bg-aether-dark/20 rounded-lg border border-aether-border/15 p-3">
          <p className="text-[10px] text-white/25 leading-relaxed">
            <span className="text-aether-cyan/50 font-semibold">提示词按顺序发送：</span>
            每个启用的预设块按列表中从上到下的顺序依次组装。system 角色的块会被合并为一个系统消息，user/assistant 角色则单独发送。
            使用 <code className="text-aether-cyan/30">{'{{user}}'}</code> / <code className="text-aether-cyan/30">{'{{char}}'}</code> / <code className="text-aether-cyan/30">{'{{original}}'}</code> 宏在内容中引用动态值。
          </p>
        </div>
      </section>
    </div>
  );
}
