import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, AlertTriangle, ScrollText, Terminal, Heart, Sparkles } from 'lucide-react';

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
  catch { /* quota exceeded */ }
}

/* ── Config ── */
type Channel = 'terminal' | 'log';
const CHANNELS: { key: Channel; label: string; Icon: any; accent: string; desc: string }[] = [
  { key: 'terminal', label: '终端', Icon: Terminal,   accent: '#ef4444', desc: '系统运行正常' },
  { key: 'log',      label: '日志', Icon: ScrollText, accent: '#00f2ff', desc: '暂无剧情事件' },
];

const TYPE_STYLE: Record<string, { icon: any; color: string; glow: string; dot: string }> = {
  ok:      { icon: CheckIcon, color: '#34d399', glow: 'rgba(52,211,153,0.3)',  dot: 'bg-emerald-400' },
  info:    { icon: Sparkles,  color: '#00f2ff', glow: 'rgba(0,242,255,0.3)',   dot: 'bg-aether-cyan' },
  warning: { icon: AlertTriangle, color: '#f0a43c', glow: 'rgba(240,164,60,0.3)', dot: 'bg-amber-400' },
  error:   { icon: X,         color: '#ef4444', glow: 'rgba(239,68,68,0.4)',   dot: 'bg-red-400' },
  success: { icon: Heart,     color: '#f472b6', glow: 'rgba(244,114,182,0.3)', dot: 'bg-pink-400' },
};

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   STATUS BELL — PRO MAX
   ══════════════════════════════════════════════════════════ */
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
    setEvents((prev) => prev.map((e) => (e.channel === 'log' && !e.read ? { ...e, read: true } : e)));
  const clearChannel = () => { setEvents((prev) => prev.filter((e) => e.channel !== channel)); setConfirmClear(false); };

  /* ── Derived ── */
  const terminalEvents = events.filter((e) => (e.channel ?? 'terminal') === 'terminal');
  const logEvents = events.filter((e) => e.channel === 'log');
  const visibleEvents = channel === 'terminal' ? terminalEvents : logEvents;
  const terminalUnread = terminalEvents.filter((e) => !e.read).length;
  const logUnread = logEvents.filter((e) => !e.read).length;
  const hasTerminalError = terminalEvents.some((e) => e.type === 'error');
  const totalUnread = terminalUnread + logUnread;
  const channelCfg = CHANNELS.find((c) => c.key === channel)!;

  return (
    <>
      {/* ═══ Bell Button ═══ */}
      <motion.div
        drag dragMomentum={false} dragElastic={0.1}
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        className="fixed top-20 right-4 z-[80]"
      >
        <motion.button
          onClick={() => { setOpen(!open); setConfirmClear(false); }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2.5 rounded-xl transition-colors clickable"
          style={{
            background: 'linear-gradient(135deg, rgba(10,18,30,0.85), rgba(6,12,20,0.9))',
            border: hasTerminalError
              ? '1px solid rgba(239,68,68,0.4)'
              : '1px solid rgba(0,242,255,0.15)',
            boxShadow: hasTerminalError
              ? '0 0 20px rgba(239,68,68,0.2), 0 4px 16px rgba(0,0,0,0.4)'
              : '0 0 16px rgba(0,242,255,0.06), 0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {/* Ambient ring */}
          <motion.div
            animate={{
              scale: hasTerminalError ? [1, 1.15, 1] : [1, 1.08, 1],
              opacity: hasTerminalError ? [0.4, 0.8, 0.4] : [0.2, 0.4, 0.2],
            }}
            transition={{ duration: hasTerminalError ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-xl"
            style={{
              boxShadow: hasTerminalError
                ? '0 0 16px rgba(239,68,68,0.3)'
                : '0 0 12px rgba(0,242,255,0.15)',
            }}
          />

          <Bell
            size={18}
            className={`relative z-10 transition-all duration-500 ${
              hasTerminalError
                ? 'text-red-400/90 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]'
                : logUnread > 0
                  ? 'text-aether-cyan/90 drop-shadow-[0_0_6px_rgba(0,242,255,0.5)]'
                  : 'text-white/35'
            }`}
          />

          {/* Badge */}
          <AnimatePresence>
            {totalUnread > 0 && (
              <motion.span
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ type: 'spring', damping: 14, stiffness: 300 }}
                className="absolute -top-1.5 -right-1.5 z-20 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold font-mono"
                style={{
                  background: hasTerminalError
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #00f2ff, #00a8cc)',
                  color: '#000a0d',
                  boxShadow: hasTerminalError
                    ? '0 0 10px rgba(239,68,68,0.5)'
                    : '0 0 10px rgba(0,242,255,0.5)',
                }}
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
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320, mass: 0.8 }}
              className="fixed right-4 top-[120px] w-[340px] max-h-[62vh] z-[90] flex flex-col overflow-hidden rounded-2xl"
              style={{
                background: 'linear-gradient(180deg, rgba(12,18,28,0.97) 0%, rgba(8,12,20,0.98) 100%)',
                border: '1px solid rgba(0,242,255,0.12)',
                boxShadow: `0 0 0 1px rgba(0,242,255,0.04), 0 0 60px rgba(0,242,255,0.04), 0 16px 48px rgba(0,0,0,0.5)`,
              }}
            >
              {/* ── Top accent line ── */}
              <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-aether-cyan/30 to-transparent" />

              {/* ═══ Header ═══ */}
              <div className="shrink-0 px-4 pt-3.5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <motion.div
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-2 h-2 rounded-full ${
                      hasTerminalError ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]' :
                      logUnread > 0 ? 'bg-aether-cyan shadow-[0_0_6px_rgba(0,242,255,0.6)]' :
                      'bg-white/15'
                    }`}
                  />
                  <h3 className="font-display text-xs tracking-[0.15em] text-white/55 uppercase select-none">
                    通知中心
                  </h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-white/20 hover:text-white/55 hover:bg-white/[0.04] transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {/* ═══ Segmented Channel Tabs ═══ */}
              <div className="shrink-0 px-4 pb-3">
                <div className="flex p-0.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {CHANNELS.map((ch) => {
                    const active = channel === ch.key;
                    const unread = ch.key === 'terminal' ? terminalUnread : logUnread;
                    const isErr = ch.key === 'terminal' && hasTerminalError;
                    return (
                      <button
                        key={ch.key}
                        onClick={() => { setChannel(ch.key); setConfirmClear(false); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[11px] font-display tracking-wider transition-all relative ${
                          active
                            ? 'text-white/90'
                            : 'text-white/25 hover:text-white/40'
                        }`}
                      >
                        {active && (
                          <motion.div
                            layoutId="activeChannelPill"
                            transition={{ type: 'spring', damping: 22, stiffness: 360 }}
                            className="absolute inset-0 rounded-[10px]"
                            style={{
                              background: isErr
                                ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.06))'
                                : 'linear-gradient(135deg, rgba(0,242,255,0.12), rgba(0,242,255,0.04))',
                              border: isErr
                                ? '1px solid rgba(239,68,68,0.2)'
                                : '1px solid rgba(0,242,255,0.15)',
                              boxShadow: isErr
                                ? '0 0 10px rgba(239,68,68,0.08)'
                                : '0 0 10px rgba(0,242,255,0.06)',
                            }}
                          />
                        )}
                        <ch.Icon size={12} className="relative z-10" />
                        <span className="relative z-10">{ch.label}</span>
                        {unread > 0 && (
                          <motion.span
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className={`relative z-10 text-[9px] font-mono font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center ${
                              isErr
                                ? 'bg-red-400/20 text-red-400'
                                : 'bg-aether-cyan/15 text-aether-cyan/70'
                            }`}
                          >
                            {unread}
                          </motion.span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ═══ Toolbar ═══ */}
              <div className="shrink-0 px-4 pb-2 flex items-center justify-between">
                <span className="text-[9px] font-mono text-white/15">
                  {visibleEvents.length} 条记录
                </span>
                <div className="flex items-center gap-3">
                  {channel === 'log' && logUnread > 0 && (
                    <button onClick={markAllRead}
                      className="text-[9px] text-aether-cyan/40 hover:text-aether-cyan font-display tracking-wide transition-colors">
                      全部已读
                    </button>
                  )}
                  {visibleEvents.length > 0 && (
                    confirmClear ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[9px] text-red-400/50 font-mono">确认清空？</span>
                        <button onClick={clearChannel} className="text-[9px] text-red-400 hover:text-red-300 font-bold clickable">是</button>
                        <button onClick={() => setConfirmClear(false)} className="text-[9px] text-white/25 hover:text-white/50 clickable">否</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmClear(true)}
                        className="text-[9px] text-white/20 hover:text-white/45 font-display tracking-wide transition-colors">
                        清空
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* ═══ Divider ═══ */}
              <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent shrink-0" />

              {/* ═══ Event List ═══ */}
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {visibleEvents.length === 0 ? (
                  <EmptyState channel={channel} />
                ) : (
                  <div className="relative pl-5">
                    {/* Timeline line */}
                    <div
                      className="absolute left-[11px] top-2 bottom-2 w-px"
                      style={{ background: `linear-gradient(180deg, ${channelCfg.accent}10, ${channelCfg.accent}08, transparent)` }}
                    />

                    {visibleEvents.map((e, i) => {
                      const style = TYPE_STYLE[e.type] ?? TYPE_STYLE.info;
                      const isTerminal = channel === 'terminal';
                      return (
                        <motion.button
                          key={e.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => markRead(e.id)}
                          className="w-full text-left relative group mb-1 last:mb-0"
                        >
                          {/* Timeline dot */}
                          <div className="absolute left-[-17px] top-3 z-10">
                            <div
                              className={`w-[7px] h-[7px] rounded-full ring-2 ring-black/40 transition-all duration-300 ${
                                !e.read ? style.dot : 'bg-white/10'
                              }`}
                              style={{
                                boxShadow: !e.read ? `0 0 8px ${style.glow}` : 'none',
                              }}
                            />
                          </div>

                          {/* Card */}
                          <div
                            className={`px-3 py-2.5 rounded-xl transition-all duration-300 border ${
                              !e.read
                                ? isTerminal
                                  ? 'bg-red-400/[0.03] border-red-400/8 hover:border-red-400/20'
                                  : 'bg-aether-cyan/[0.02] border-white/[0.03] hover:border-aether-cyan/15'
                                : 'border-transparent hover:bg-white/[0.01] hover:border-white/[0.03]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Icon */}
                              <div
                                className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                                style={{
                                  background: `${style.color}10`,
                                  border: `1px solid ${style.color}20`,
                                }}
                              >
                                <style.icon size={13} style={{ color: style.color, opacity: e.read ? 0.35 : 0.8 }} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-[12px] font-semibold leading-tight ${
                                    isTerminal ? 'font-mono tracking-tight' : 'font-display tracking-wide'
                                  }`}
                                  style={{ color: e.read ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.82)' }}
                                >
                                  {e.title}
                                </p>
                                <p
                                  className="text-[10px] leading-relaxed mt-0.5"
                                  style={{ color: e.read ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.42)' }}
                                >
                                  {e.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  {e.source && (
                                    <span
                                      className="text-[8px] font-mono tracking-wider px-1 py-0.5 rounded"
                                      style={{
                                        color: `${style.color}60`,
                                        background: `${style.color}08`,
                                      }}
                                    >
                                      {e.source}
                                    </span>
                                  )}
                                  <span className="text-[8px] font-mono text-white/10">
                                    {new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </div>
                              </div>

                              {/* Unread indicator */}
                              {!e.read && (
                                <div
                                  className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                                  style={{ background: style.color, boxShadow: `0 0 6px ${style.glow}` }}
                                />
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Bottom accent line ── */}
              <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-aether-cyan/15 to-transparent" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════ */
function EmptyState({ channel }: { channel: Channel }) {
  const cfg = CHANNELS.find((c) => c.key === channel)!;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <motion.div
        animate={{ y: [0, -4, 0], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-4"
      >
        <cfg.Icon size={36} style={{ color: cfg.accent, opacity: 0.15 }} />
      </motion.div>
      <p className="text-[11px] font-display tracking-wider text-white/15">{cfg.desc}</p>
      <div className="mt-3 h-px w-16 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
    </motion.div>
  );
}
