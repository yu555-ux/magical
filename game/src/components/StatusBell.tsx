import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, AlertTriangle, Wifi, WifiOff, Server, Globe } from 'lucide-react';

export interface StatusEvent {
  id: string;
  code?: number;
  title: string;
  message: string;
  type: 'ok' | 'info' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
  source?: string;
}

let globalAddStatus: ((e: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) => void) | null = null;

/** Call from anywhere to push a status event to the bell */
export function pushStatus(event: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) {
  globalAddStatus?.(event);
}

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  ok: { icon: CheckIcon, color: 'text-aether-green', bg: 'bg-aether-green/10 border-aether-green/20' },
  info: { icon: Globe, color: 'text-aether-cyan', bg: 'bg-aether-cyan/10 border-aether-cyan/20' },
  warning: { icon: AlertTriangle, color: 'text-aether-gold', bg: 'bg-aether-gold/10 border-aether-gold/20' },
  error: { icon: X, color: 'text-aether-red', bg: 'bg-aether-red/10 border-aether-red/20' },
};

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function StatusBell() {
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [open, setOpen] = useState(false);
  const unread = events.filter(e => !e.read).length;
  const lastError = events.find(e => e.type === 'error');

  const addStatus = useCallback((e: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setEvents(prev => [{ ...e, id, timestamp: Date.now(), read: false }, ...prev].slice(0, 50));
  }, []);

  globalAddStatus = addStatus;

  const markRead = (id: string) => setEvents(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
  const clearAll = () => setEvents([]);

  return (
    <>
      <motion.div
        drag dragMomentum={false} dragElastic={0.1}
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        className="fixed top-20 right-4 z-[80] clickable"
      >
        <button
          onClick={() => setOpen(!open)}
          className="relative p-2 glass-panel press-scale transition-all hover:border-aether-cyan"
        >
          <Bell size={18} className={`transition-colors ${lastError ? 'text-aether-red/70 hover:text-aether-red' : 'text-white/40 hover:text-aether-cyan'}`} />
          {unread > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
              className={`absolute -top-1 -right-1 w-4 h-4 text-aether-dark text-[9px] font-bold font-mono flex items-center justify-center rounded-full ${
                lastError ? 'bg-aether-red' : 'bg-aether-cyan'
              }`}>{unread}</motion.span>
          )}
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[85]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="fixed right-4 top-36 w-80 max-h-[55vh] glass-panel border-glow overflow-hidden z-[90] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="p-3 border-b border-aether-border/30 flex items-center justify-between bg-aether-cyan/[0.03]">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${lastError ? 'bg-aether-red animate-pulse' : 'bg-aether-green'}`} />
                  <h3 className="font-display text-xs tracking-widest text-aether-cyan/80 uppercase">系统状态</h3>
                </div>
                <div className="flex items-center gap-2">
                  {events.length > 0 && (
                    <button onClick={clearAll} className="text-[10px] text-white/25 hover:text-white/50 transition-colors font-display tracking-wide">清空</button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={14} /></button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[48vh]">
                {events.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-aether-green/5 border border-aether-green/10 flex items-center justify-center mx-auto mb-3">
                      <Wifi size={18} className="text-aether-green/40" />
                    </div>
                    <p className="text-xs text-white/25 font-display tracking-wide">系统运行正常</p>
                    <p className="text-[10px] text-white/10 mt-1">无异常事件记录</p>
                  </div>
                ) : (
                  events.map((e) => {
                    const cfg = typeConfig[e.type];
                    return (
                      <button key={e.id} onClick={() => markRead(e.id)}
                        className={`w-full text-left p-3 border-b border-aether-border/10 transition-all hover:bg-aether-cyan/[0.02] ${
                          !e.read ? 'bg-aether-cyan/[0.02]' : ''
                        }`}>
                        <div className="flex items-start gap-2.5">
                          {!e.read && <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${e.type === 'error' ? 'bg-aether-red animate-pulse' : 'bg-aether-cyan'}`} />}
                          <cfg.icon size={14} className={`${cfg.color} shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-display font-medium text-white/80">{e.title}</p>
                              {e.code && <span className={`text-[9px] font-mono px-1 rounded ${cfg.bg} ${cfg.color}`}>{e.code}</span>}
                            </div>
                            <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{e.message}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {e.source && <span className="text-[8px] text-white/15 font-mono">{e.source}</span>}
                              <span className="text-[8px] text-white/12 font-mono">{new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
