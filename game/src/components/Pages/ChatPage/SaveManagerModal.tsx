import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Upload, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { exportAllData, importAllData, FullBackup } from '../../../sillytavern/database';
import { exportToJson, importJsonFile } from '../../../sillytavern/importer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  addNotification?: (title: string, message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
}

export default function SaveManagerModal({ isOpen, onClose, addNotification }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'loading' | 'done' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const handleSave = useCallback(async () => {
    setBusy(true);
    setStatus('saving');
    setStatusMsg('正在导出存档...');
    try {
      const backup = await exportAllData();
      const ts = new Date(backup.exportedAt).toLocaleString('zh-CN');
      exportToJson(backup, `梦·异常_存档_${ts.replace(/[/:]/g, '-')}.json`);
      setStatus('done');
      setStatusMsg(`存档已导出 (${backup.chats.length} 个对话)`);
      addNotification?.('存档成功', `已导出 ${backup.chats.length} 个对话，${backup.lorebooks.length} 本世界书。`, 'success');
      setTimeout(() => { setStatus('idle'); setStatusMsg(''); }, 3000);
    } catch (e: any) {
      setStatus('error');
      setStatusMsg(e?.message || '导出失败');
      addNotification?.('存档失败', e?.message || '导出过程出错', 'error');
    }
    setBusy(false);
  }, [addNotification]);

  const handleLoad = useCallback(async () => {
    setBusy(true);
    setStatus('loading');
    setStatusMsg('正在选择存档文件...');
    try {
      const backup = await importJsonFile<FullBackup>();
      if (!backup) { setStatus('idle'); setStatusMsg(''); setBusy(false); return; }
      if (!backup.version || !Array.isArray(backup.chats)) {
        throw new Error('存档文件格式不正确');
      }
      setStatusMsg('正在恢复存档...');
      await importAllData(backup);
      setStatus('done');
      setStatusMsg(`已恢复 ${backup.chats.length} 个对话`);
      addNotification?.('读档成功', `已恢复 ${backup.chats.length} 个对话。页面将刷新以加载新数据。`, 'success');
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch (e: any) {
      setStatus('error');
      setStatusMsg(e?.message || '导入失败');
      addNotification?.('读档失败', e?.message || '导入过程出错', 'error');
    }
    setBusy(false);
  }, [addNotification]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-aether-dark/90 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel border-glow w-[360px] shadow-[0_0_40px_rgba(0,242,255,0.06)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-aether-cyan/20 bg-aether-cyan/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-4 bg-aether-cyan rounded-full shadow-[0_0_6px_rgba(0,242,255,0.4)]" />
                <h3 className="font-display text-sm tracking-[0.12em] text-aether-cyan/90">存档管理</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-white/25 hover:text-white/60 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Save */}
              <button
                onClick={handleSave}
                disabled={busy}
                className="w-full flex items-center gap-4 p-4 border border-aether-cyan/20 bg-aether-cyan/[0.03]
                           hover:border-aether-cyan/40 hover:bg-aether-cyan/[0.06]
                           transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-full border border-aether-cyan/30 flex items-center justify-center shrink-0
                                group-hover:border-aether-cyan/50 group-hover:shadow-[0_0_12px_rgba(0,242,255,0.15)] transition-all">
                  {busy && status === 'saving' ? (
                    <Loader2 size={18} className="text-aether-cyan animate-spin" />
                  ) : (
                    <Download size={18} className="text-aether-cyan/70" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-display font-bold text-white/80">导出存档</p>
                  <p className="text-[10px] font-mono text-white/25 mt-0.5">下载完整游戏数据到本地 (.json)</p>
                </div>
              </button>

              {/* Load */}
              <button
                onClick={handleLoad}
                disabled={busy}
                className="w-full flex items-center gap-4 p-4 border border-white/[0.06] bg-white/[0.01]
                           hover:border-aether-cyan/30 hover:bg-aether-cyan/[0.03]
                           transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-full border border-white/[0.08] flex items-center justify-center shrink-0
                                group-hover:border-aether-cyan/40 group-hover:shadow-[0_0_12px_rgba(0,242,255,0.1)] transition-all">
                  {busy && status === 'loading' ? (
                    <Loader2 size={18} className="text-aether-cyan animate-spin" />
                  ) : (
                    <Upload size={18} className="text-white/40 group-hover:text-aether-cyan/70 transition-colors" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-display font-bold text-white/70">导入存档</p>
                  <p className="text-[10px] font-mono text-white/25 mt-0.5">从本地 .json 文件恢复游戏数据</p>
                </div>
              </button>

              {/* Status */}
              {status !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-[11px] font-mono
                    ${status === 'error'
                      ? 'bg-aether-red/[0.06] border border-aether-red/20 text-aether-red/70'
                      : status === 'done'
                        ? 'bg-aether-green/[0.06] border border-aether-green/20 text-aether-green/70'
                        : 'bg-aether-cyan/[0.04] border border-aether-cyan/15 text-aether-cyan/60'
                    }`}
                >
                  {status === 'error' ? <AlertTriangle size={13} /> : status === 'done' ? <CheckCircle size={13} /> : <Loader2 size={13} className="animate-spin" />}
                  {statusMsg}
                </motion.div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-aether-gold/[0.04] border border-aether-gold/10">
                <AlertTriangle size={12} className="text-aether-gold/50 shrink-0 mt-0.5" />
                <p className="text-[10px] font-mono text-aether-gold/45 leading-relaxed">
                  导入存档将覆盖当前所有数据（对话、世界书、预设、设置）。建议先导出备份。
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
