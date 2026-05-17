import { useMemo } from 'react';
import { Clock, MapPin, CloudSun, BookOpen, Eye, Hourglass } from 'lucide-react';

interface ChatHeaderProps {
  variables?: Record<string, any>;
  onOpenReader?: () => void;
  onOpenVariables?: () => void;
}

function getDisplayData(vars: Record<string, any> | undefined) {
  const world = vars?.世界 ?? {};
  const inDream = world?.梦境定位?.位于梦境 === true;

  const source = inDream ? (world?.梦境存档 ?? {}) : (world?.现实 ?? {});
  const time = source?.时间 || '--';
  const location = source?.地点 || '--';
  const weather = source?.天气 || '--';

  const countdown = inDream
    ? (world?.倒计时?.离开梦境倒计时 || '--')
    : (world?.倒计时?.可进入梦境倒计时 || '--');
  const countdownLabel = inDream ? '离开梦境' : '进入梦境';

  return { time, location, weather, countdown, countdownLabel, inDream };
}

export default function ChatHeader({ variables, onOpenReader, onOpenVariables }: ChatHeaderProps) {
  const display = useMemo(() => getDisplayData(variables), [variables]);

  const realmColor = display.inDream ? 'aether-red' : 'aether-blue';
  const iconClass = display.inDream ? 'text-aether-red/60' : 'text-aether-blue/60';

  return (
    <div className="px-6 py-3 border-b border-aether-cyan/[0.12] bg-gradient-to-b from-aether-deep/95 to-aether-deep/80 flex items-center shrink-0 relative overflow-hidden">
      {/* Subtle top glow line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/10 to-transparent" />

      {/* ── Left: info group ── */}
      <div className="flex items-center gap-5">
        {/* Time */}
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${display.inDream ? 'bg-aether-red/[0.06]' : 'bg-aether-blue/[0.05]'}`}>
            <Clock size={13} className={iconClass} />
          </div>
          <span className="font-display text-[13px] text-white/55 tracking-[0.05em] whitespace-nowrap select-none">
            {display.time}
          </span>
        </div>

        <div className="w-px h-3 bg-white/[0.06]" />

        {/* Location */}
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${display.inDream ? 'bg-aether-red/[0.06]' : 'bg-aether-blue/[0.05]'}`}>
            <MapPin size={13} className={iconClass} />
          </div>
          <span className="font-display text-[13px] text-white/60 tracking-[0.04em] max-w-[180px] truncate select-none">
            {display.location}
          </span>
        </div>

        <div className="w-px h-3 bg-white/[0.06]" />

        {/* Weather */}
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${display.inDream ? 'bg-aether-red/[0.06]' : 'bg-aether-blue/[0.05]'}`}>
            <CloudSun size={13} className={iconClass} />
          </div>
          <span className="font-display text-[13px] text-white/50 tracking-[0.04em] max-w-[100px] truncate select-none">
            {display.weather}
          </span>
        </div>
      </div>

      {/* ── Center: countdown pill ── */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Hourglass size={11} className="text-white/20" />
          <span className="text-[10px] text-white/20 font-display tracking-[0.12em] uppercase">{display.countdownLabel}</span>
          <span className="font-mono text-[12px] text-white/40 tracking-[0.04em]">{display.countdown}</span>
        </div>
      </div>

      {/* ── Right: buttons ── */}
      <div className="flex items-center gap-1 ml-auto">
        {onOpenVariables && (
          <button
            onClick={onOpenVariables}
            className="relative group flex items-center justify-center w-8 h-8 rounded-sm text-white/30 hover:text-aether-cyan hover:bg-aether-cyan/[0.04] transition-all"
          >
            <Eye size={16} />
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/70 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              变量
            </span>
          </button>
        )}

        {onOpenReader && (
          <button
            onClick={onOpenReader}
            className="relative group flex items-center justify-center w-8 h-8 rounded-sm text-white/40 hover:text-aether-cyan hover:bg-aether-cyan/[0.04] transition-all"
          >
            <BookOpen size={16} />
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/70 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              阅读
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
