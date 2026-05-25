import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Undo2, Save } from 'lucide-react';
import type { PresetBlock } from '../../../sillytavern/types';
import type { PromptEditDrawerProps } from './types';
import { ROLE_COLORS } from './types';

export default function PromptEditDrawer({ block, open, onClose, onSave }: PromptEditDrawerProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<PresetBlock['role']>('system');
  const [content, setContent] = useState('');
  const [marker, setMarker] = useState(false);
  const [forbidOverrides, setForbidOverrides] = useState(false);

  useEffect(() => {
    if (block) {
      setName(block.name);
      setRole(block.role);
      setContent(block.content);
      setMarker(block.marker ?? false);
      setForbidOverrides(block.forbid_overrides ?? false);
    }
  }, [block]);

  const handleSave = () => {
    onSave({ name, role, content, marker, forbid_overrides: forbidOverrides });
    onClose();
  };

  const handleReset = () => {
    if (block) {
      setName(block.name);
      setRole(block.role);
      setContent(block.content);
      setMarker(block.marker ?? false);
      setForbidOverrides(block.forbid_overrides ?? false);
    }
  };

  const changed = block ? (
    name !== block.name ||
    role !== block.role ||
    content !== block.content ||
    marker !== (block.marker ?? false) ||
    forbidOverrides !== (block.forbid_overrides ?? false)
  ) : false;

  const isOverridable = block?.identifier === 'main' || block?.identifier === 'jailbreak';

  return (
    <AnimatePresence>
      {open && block && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[140]"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] bg-aether-dark/95 border-l border-aether-border/20 z-[150] shadow-2xl overflow-y-auto"
          >
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display text-white/60">编辑词块</h3>
                <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] text-white/25 font-display tracking-wide uppercase mb-1 block">名称</label>
                <input
                  type="text" value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-aether-dark/50 border border-aether-border/25 rounded px-3 py-1.5 text-[12px] text-white/65 focus:outline-none focus:border-aether-purple/50 transition-all font-display"
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-[10px] text-white/25 font-display tracking-wide uppercase mb-1 block">角色</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as PresetBlock['role'])}
                  className="w-full bg-aether-dark/50 border border-aether-border/25 rounded px-3 py-1.5 text-[12px] text-white/55 focus:outline-none focus:border-aether-purple/50 transition-all"
                >
                  <option value="system">system</option>
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                </select>
                <div className="flex gap-2 mt-1.5">
                  {(['system', 'user', 'assistant'] as const).map(r => (
                    <span key={r} className={`text-[8px] px-1.5 py-0.5 rounded border font-mono uppercase ${ROLE_COLORS[r]}`}>{r}</span>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="text-[10px] text-white/25 font-display tracking-wide uppercase mb-1 block">
                  内容 {marker && <span className="text-aether-purple/30 ml-1">(标记块，内容不可编辑)</span>}
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  disabled={marker}
                  rows={10}
                  placeholder="提示词内容..."
                  className="w-full bg-aether-dark/50 border border-aether-border/25 rounded px-3 py-2 text-[11px] text-white/65 placeholder:text-white/10 focus:outline-none focus:border-aether-purple/50 transition-all resize-none font-mono leading-relaxed disabled:opacity-30 disabled:cursor-not-allowed"
                />
                <p className="text-[9px] text-white/10 mt-1">
                  宏:{' '}
                  <code className="text-aether-cyan/25">{'{{user}}'}</code>{' '}
                  <code className="text-aether-cyan/25">{'{{char}}'}</code>{' '}
                  <code className="text-aether-cyan/25">{'{{original}}'}</code>{' '}
                  <code className="text-white/8">{'{{setvar::}} {{addvar::}} {{getvar::}} {{MAP}} {{VARS_LIST}} {{trim}}'}</code>
                </p>
              </div>

              {/* Marker checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox" checked={marker}
                  onChange={e => setMarker(e.target.checked)}
                  className="accent-aether-purple h-3 w-3 shrink-0"
                />
                <label className="text-[11px] text-white/35 font-display cursor-pointer">标记块（结构标记，内容不可编辑）</label>
              </div>

              {/* Forbid Overrides */}
              {isOverridable && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox" checked={forbidOverrides}
                    onChange={e => setForbidOverrides(e.target.checked)}
                    className="accent-aether-purple h-3 w-3 shrink-0"
                  />
                  <label className="text-[11px] text-white/35 font-display cursor-pointer">禁止角色卡覆盖</label>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center gap-2 pt-3 border-t border-aether-border/10">
                <button
                  onClick={handleReset}
                  disabled={!changed}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] tracking-wide border border-aether-border/20 text-white/30 hover:text-white/50 disabled:opacity-10 transition-all font-display"
                >
                  <Undo2 size={12} /> 重置
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[11px] tracking-wide bg-aether-purple/20 border border-aether-purple/40 text-aether-purple hover:bg-aether-purple/30 transition-all font-display ml-auto"
                >
                  <Save size={12} /> 保存
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
