import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, AlertTriangle, Heart } from 'lucide-react';

export interface StatusEvent {
  id: string;
  code?: number;
  title: string;
  message: string;
  type: 'ok' | 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  read: boolean;
  source?: string;
  channel?: 'terminal' | 'log';
  onClick?: () => void;
}

let globalAddStatus: ((e: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) => void) | null = null;
export function pushStatus(event: Omit<StatusEvent, 'id' | 'timestamp' | 'read'>) {
  globalAddStatus?.(event);
}

/* ── Persistence ── */
const STORAGE_KEY = 'aether_status_events';
function loadEvents(): StatusEvent[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveEvents(events: StatusEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 100))); }
  catch { /* quota */ }
}

/* ── Config ── */
type Channel = 'terminal' | 'log';
const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'terminal', label: '终端' },
  { key: 'log',      label: '日志' },
];

const TYPE_STYLE: Record<string, { icon: any; color: string }> = {
  ok:      { icon: CheckIcon, color: 'var(--color-aether-green)' },
  info:    { icon: Bell, color: 'var(--color-aether-cyan)' },
  warning: { icon: AlertTriangle, color: 'var(--color-aether-gold)' },
  error:   { icon: X, color: 'var(--color-aether-red)' },
  success: { icon: Heart, color: '#f472b6' },
};

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function StatusBell() {
  const [events, setEvents] = useState<StatusEvent[]>(loadEvents);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>('log');
  const [confirmClear, setConfirmClear] = useState(false);

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
    setEvents((prev) => prev.map((e) =>
      (e.channel === 'log' || (!e.channel && channel === 'terminal')) && !e.read
        ? { ...e, read: true } : e,
    ));

  const clearChannel = () => {
    setEvents((prev) => prev.filter((e) => {
      const ec = e.channel ?? 'terminal';
      return ec !== channel;
    }));
    setConfirmClear(false);
  };

  /* ── Derived ── */
  const channelEvents = (ch: Channel) => events.filter((e) => (e.channel ?? 'terminal') === ch);
  const visibleEvents = channelEvents(channel);
  const terminalEvents = channelEvents('terminal');
  const logEvents = channelEvents('log');
  const terminalUnread = terminalEvents.filter((e) => !e.read).length;
  const logUnread = logEvents.filter((e) => !e.read).length;
  const hasTerminalError = terminalEvents.some((e) => e.type === 'error');
  const totalUnread = terminalUnread + logUnread;

  return (
    <>
      {/* ═══ Bell ═══ */}
      <motion.div
        drag dragMomentum={false} dragElastic={0.1}
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        className="fixed top-20 right-4 z-[80]"
      >
        <motion.button
          onClick={() => { setOpen(!open); setConfirmClear(false); }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="relative w-9 h-9 flex items-center justify-center clickable transition-all glass-panel hover:border-aether-cyan/60"
        >
          <Bell
            size={18}
            className={`transition-colors ${
              totalUnread > 0
                ? 'text-aether-cyan'
                : 'text-white/40'
            }`}
          />
          <AnimatePresence>
            {totalUnread > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-[18px] h-[18px] flex items-center justify-center rounded-sm text-[9px] font-bold font-mono text-aether-dark bg-aether-cyan"
              >
                {totalUnread}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* ═══ Panel ═══ */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[85]"
              onClick={() => { setOpen(false); setConfirmClear(false); }}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-4 top-[120px] w-[340px] max-h-[60vh] flex flex-col overflow-hidden z-[90] glass-panel border-glow"
            >
              {/* ═══ Header ═══ */}
              <div className="shrink-0 px-5 py-3 border-b border-aether-border/30 flex items-center justify-between bg-aether-cyan/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${
                    totalUnread > 0 ? 'bg-aether-cyan shadow-[0_0_6px_rgba(0,242,255,0.5)]' : 'bg-white/15'
                  }`} />
                  <h3 className="font-display text-xs tracking-[0.12em] text-white/50 uppercase">系统状态</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-white/25 hover:text-white/60 transition-colors">
                  <X size={15} />
                </button>
              </div>

              {/* ═══ Channel Tabs ═══ */}
              <div className="shrink-0 flex border-b border-aether-border/20">
                {CHANNELS.map((ch) => {
                  const active = channel === ch.key;
                  const unread = ch.key === 'terminal' ? terminalUnread : logUnread;
                  const badgeError = ch.key === 'terminal' && hasTerminalError;
                  return (
                    <button
                      key={ch.key}
                      onClick={() => { setChannel(ch.key); setConfirmClear(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-display tracking-widest transition-all ${
                        active
                          ? 'text-aether-cyan border-b border-aether-cyan/60 bg-aether-cyan/[0.04]'
                          : 'text-white/25 hover:text-white/40 border-b border-transparent'
                      }`}
                    >
                      {ch.label}
                      {unread > 0 && (
                        <span className={`text-[9px] font-mono font-bold px-1 rounded-sm ${
                          badgeError ? 'bg-aether-red/20 text-aether-red/90' : 'bg-aether-cyan/10 text-aether-cyan/60'
                        }`}>
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ═══ Toolbar ═══ */}
              <div className="shrink-0 px-5 py-2 flex items-center justify-between border-b border-aether-border/10">
                <span className="text-[9px] font-mono text-white/15">
                  {visibleEvents.length} 条记录
                </span>
                <div className="flex items-center gap-3">
                  {channel === 'log' && logUnread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[9px] font-display tracking-wider text-aether-cyan/40 hover:text-aether-cyan transition-colors"
                    >
                      全部已读
                    </button>
                  )}
                  {visibleEvents.length > 0 && (
                    confirmClear ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-red-400/50">确认清空？</span>
                        <button onClick={clearChannel} className="text-[9px] text-red-400 hover:text-red-300 font-bold clickable">是</button>
                        <button onClick={() => setConfirmClear(false)} className="text-[9px] text-white/25 hover:text-white/50 clickable">否</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmClear(true)}
                        className="text-[9px] font-display tracking-wider text-white/20 hover:text-white/40 transition-colors"
                      >
                        清空
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* ═══ Event List ═══ */}
              <div className="flex-1 overflow-y-auto">
                {visibleEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14">
                    <div className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-aether-cyan/20" />
                    </div>
                    <p className="text-[11px] font-display tracking-wider text-white/15">
                      {channel === 'terminal' ? '系统运行正常' : '暂无剧情事件'}
                    </p>
                  </div>
                ) : (
                  visibleEvents.map((e) => {
                    const style = TYPE_STYLE[e.type] ?? TYPE_STYLE.info;
                    const isTerminal = channel === 'terminal';
                    return (
                      <button
                        key={e.id}
                        onClick={() => { markRead(e.id); e.onClick?.(); }}
                        className={`w-full text-left px-5 py-3 border-b border-aether-border/10 transition-colors hover:bg-aether-cyan/[0.02] cursor-pointer ${
                          !e.read ? 'bg-aether-cyan/[0.02]' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Unread dot — colored by event type */}
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                            style={{ background: !e.read ? style.color : 'rgba(255,255,255,0.08)' }}
                          />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-[12px] font-medium ${
                                isTerminal ? 'font-mono text-white/60' : 'font-display tracking-wide text-white/75'
                              }`}>
                                {e.title}
                              </p>
                            </div>
                            <p className={`text-[10px] leading-relaxed mt-0.5 ${
                              isTerminal ? 'font-mono text-white/30' : 'text-white/35'
                            }`}>
                              {e.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {e.source && (
                                <span className={`text-[8px] font-mono tracking-wider px-1 py-0.5 rounded-sm ${
                                  isTerminal ? 'text-white/12 bg-white/[0.02]' : 'text-aether-cyan/30 bg-aether-cyan/[0.03]'
                                }`}>
                                  {e.source}
                                </span>
                              )}
                              <span className="text-[8px] font-mono text-white/10">
                                {new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              {!e.read && (
                                <span className="text-[8px] font-mono text-aether-cyan/40 ml-auto">新</span>
                              )}
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
