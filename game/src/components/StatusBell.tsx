import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, AlertTriangle, Wifi, ScrollText, Terminal } from 'lucide-react';

export interface StatusEvent {
  id: string;
  code?: number;
  title: string;
  message: string;
  type: 'ok' | 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  read: boolean;
  source?: string;
  /** 'terminal' = system/API errors, 'log' = story events */
  channel?: 'terminal' | 'log';
}

let globalAddStatus: ((e: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) => void) | null = null;

/** Call from anywhere to push a status event to the bell */
export function pushStatus(event: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) {
  globalAddStatus?.(event);
}

/* ── Persistence ── */
const STORAGE_KEY = 'aether_status_events';
function loadEvents(): StatusEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveEvents(events: StatusEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 100)));
  } catch { /* quota exceeded — silently drop oldest */ }
}

/* ── Type configs ── */
const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  ok:      { icon: CheckIcon,      color: 'text-aether-green',  bg: 'bg-aether-green/10 border-aether-green/20' },
  info:    { icon: ScrollText,     color: 'text-aether-cyan',   bg: 'bg-aether-cyan/10 border-aether-cyan/20' },
  warning: { icon: AlertTriangle,  color: 'text-aether-gold',   bg: 'bg-aether-gold/10 border-aether-gold/20' },
  error:   { icon: X,              color: 'text-aether-red',    bg: 'bg-aether-red/10 border-aether-red/20' },
  success: { icon: CheckIcon,      color: 'text-aether-green',  bg: 'bg-aether-green/10 border-aether-green/20' },
};

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Channel definitions ── */
type Channel = 'terminal' | 'log';
const CHANNELS: { key: Channel; label: string; Icon: any; desc: string }[] = [
  { key: 'terminal', label: '终端', Icon: Terminal, desc: '系统运行正常' },
  { key: 'log', label: '日志', Icon: ScrollText, desc: '暂无剧情事件' },
];

export default function StatusBell() {
  const [events, setEvents] = useState<StatusEvent[]>(loadEvents);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>('log');
  const [confirmClear, setConfirmClear] = useState(false);

  // Persist on change
  useEffect(() => { saveEvents(events); }, [events]);

  const addStatus = useCallback((e: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setEvents((prev) => {
      const next = [{ ...e, id, timestamp: Date.now(), read: false }, ...prev];
      if (next.length > 100) next.length = 100;
      return next;
    });
  }, []);

  globalAddStatus = addStatus;

  const markRead = (id: string) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, read: true } : e)));

  const markAllRead = () =>
    setEvents((prev) =>
      prev.map((e) =>
        e.channel === 'log' && !e.read ? { ...e, read: true } : e,
      ),
    );

  const clearChannel = () => {
    setEvents((prev) => prev.filter((e) => e.channel !== channel));
    setConfirmClear(false);
  };

  // ── Derived ──
  const terminalEvents = events.filter((e) => (e.channel ?? 'terminal') === 'terminal');
  const logEvents = events.filter((e) => e.channel === 'log');
  const visibleEvents = channel === 'terminal' ? terminalEvents : logEvents;

  const terminalUnread = terminalEvents.filter((e) => !e.read).length;
  const logUnread = logEvents.filter((e) => !e.read).length;

  const hasTerminalError = terminalEvents.some((e) => e.type === 'error');
  const totalUnread = terminalUnread + logUnread;

  return (
    <>
      {/* ── Bell button ── */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.1}
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        className="fixed top-20 right-4 z-[80] clickable"
      >
        <button
          onClick={() => { setOpen(!open); setConfirmClear(false); }}
          className={`relative p-2 press-scale transition-all glass-panel ${
            hasTerminalError
              ? 'border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
              : 'border-aether-border hover:border-aether-cyan'
          }`}
        >
          <Bell
            size={18}
            className={`transition-colors ${
              hasTerminalError
                ? 'text-red-400/80 animate-pulse'
                : logUnread > 0
                  ? 'text-aether-cyan/80'
                  : 'text-white/40 hover:text-aether-cyan'
            }`}
          />
          {totalUnread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`absolute -top-1 -right-1 w-4 h-4 text-aether-dark text-[9px] font-bold font-mono flex items-center justify-center rounded-full ${
                hasTerminalError ? 'bg-aether-red' : 'bg-aether-cyan'
              }`}
            >
              {totalUnread}
            </motion.span>
          )}
        </button>
      </motion.div>

      {/* ── Panel ── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[85]"
              onClick={() => { setOpen(false); setConfirmClear(false); }}
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="fixed right-4 top-36 w-80 max-h-[60vh] glass-panel border-glow overflow-hidden z-[90] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col"
            >
              {/* ── Channel tabs ── */}
              <div className="flex border-b border-aether-border/30 shrink-0">
                {CHANNELS.map((ch) => {
                  const active = channel === ch.key;
                  const errCount = ch.key === 'terminal' ? terminalUnread : logUnread;
                  const isErr = ch.key === 'terminal' && hasTerminalError;
                  return (
                    <button
                      key={ch.key}
                      onClick={() => { setChannel(ch.key); setConfirmClear(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-display tracking-wider transition-all ${
                        active
                          ? isErr
                            ? 'text-red-400 border-b-2 border-red-400/60 bg-red-400/[0.04]'
                            : 'text-aether-cyan border-b-2 border-aether-cyan/60 bg-aether-cyan/[0.04]'
                          : 'text-white/25 hover:text-white/45'
                      }`}
                    >
                      <ch.Icon size={13} />
                      {ch.label}
                      {errCount > 0 && (
                        <span className={`text-[9px] font-mono font-bold px-1 rounded-sm ${
                          isErr ? 'bg-red-400/20 text-red-400' : 'bg-aether-cyan/15 text-aether-cyan/70'
                        }`}>
                          {errCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Toolbar ── */}
              <div className="px-3 py-2 border-b border-aether-border/15 flex items-center justify-between shrink-0 bg-aether-cyan/[0.01]">
                <span className="text-[9px] font-mono text-white/20">
                  {visibleEvents.length} 条记录
                </span>
                <div className="flex items-center gap-2">
                  {channel === 'log' && logUnread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[9px] text-aether-cyan/50 hover:text-aether-cyan font-display tracking-wide transition-colors"
                    >
                      全部已读
                    </button>
                  )}
                  {visibleEvents.length > 0 && (
                    confirmClear ? (
                      <span className="flex items-center gap-1">
                        <span className="text-[9px] text-red-400/60 font-mono">确认清空？</span>
                        <button onClick={clearChannel} className="text-[9px] text-red-400 hover:text-red-300 font-bold">是</button>
                        <button onClick={() => setConfirmClear(false)} className="text-[9px] text-white/30 hover:text-white/60">否</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmClear(true)}
                        className="text-[9px] text-white/25 hover:text-white/50 font-display tracking-wide transition-colors"
                      >
                        清空
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* ── Event list ── */}
              <div className="flex-1 overflow-y-auto">
                {visibleEvents.length === 0 ? (
                  <div className="p-8 text-center">
                    {(() => {
                      const ChIcon = CHANNELS.find((c) => c.key === channel)?.Icon ?? ScrollText;
                      return <ChIcon size={32} className="text-white/8 mx-auto mb-3" />;
                    })()}
                    <p className="text-xs text-white/25 font-display tracking-wide">
                      {CHANNELS.find((c) => c.key === channel)?.desc}
                    </p>
                  </div>
                ) : (
                  visibleEvents.map((e) => {
                    const cfg = typeConfig[e.type];
                    const isTerminal = channel === 'terminal';
                    return (
                      <button
                        key={e.id}
                        onClick={() => markRead(e.id)}
                        className={`w-full text-left p-3 border-b border-aether-border/10 transition-all hover:bg-aether-cyan/[0.02] ${
                          !e.read ? (isTerminal ? 'bg-red-400/[0.02]' : 'bg-aether-cyan/[0.02]') : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Unread dot */}
                          {!e.read && (
                            <div
                              className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                                isTerminal ? 'bg-red-400 animate-pulse' : 'bg-aether-cyan'
                              }`}
                            />
                          )}
                          <cfg.icon size={14} className={`${cfg.color} shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-xs font-display font-medium ${
                                isTerminal ? 'text-white/70 font-mono' : 'text-white/80'
                              }`}>
                                {e.title}
                              </p>
                              {e.code && (
                                <span className={`text-[9px] font-mono px-1 rounded ${cfg.bg} ${cfg.color}`}>
                                  {e.code}
                                </span>
                              )}
                            </div>
                            <p className={`text-[10px] leading-relaxed mt-0.5 ${
                              isTerminal ? 'text-white/35 font-mono' : 'text-white/40'
                            }`}>
                              {e.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {e.source && (
                                <span className={`text-[8px] font-mono ${
                                  isTerminal ? 'text-white/15' : 'text-aether-cyan/30'
                                }`}>
                                  {e.source}
                                </span>
                              )}
                              <span className="text-[8px] text-white/12 font-mono">
                                {new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
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
