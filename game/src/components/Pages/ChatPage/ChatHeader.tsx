import { useMemo } from 'react';
import { Clock, MapPin, CloudSun, BookOpen, Eye, Hourglass, Sparkles } from 'lucide-react';

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

  return (
    <div className={`px-6 py-3 border-b border-aether-cyan/20 shrink-0 relative overflow-hidden transition-colors duration-700 ${
      display.inDream
        ? 'bg-gradient-to-r from-aether-purple/[0.06] via-aether-deep/90 to-aether-deep/90'
        : 'bg-aether-deep/90'
    }`}>
      {/* ── Left: info group ── */}
      <div className="flex items-center gap-5">
        {/* Dream/Reality indicator pill */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-display tracking-[0.1em] border transition-colors duration-700 ${
          display.inDream
            ? 'text-aether-purple/70 border-aether-purple/25 bg-aether-purple/[0.06]'
            : 'text-aether-blue/50 border-aether-blue/15 bg-aether-blue/[0.04]'
        }`}>
          {display.inDream ? <Sparkles size={10} /> : <Clock size={10} />}
          {display.inDream ? '梦境' : '现世'}
        </div>

        <div className="w-px h-4 bg-aether-border/40" />

        {/* Time */}
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-aether-blue/60" />
          <span className="font-display text-[13px] text-white/55 tracking-[0.05em] whitespace-nowrap">{display.time}</span>
        </div>

        <div className="w-px h-4 bg-aether-border/40" />

        {/* Location */}
        <div className="flex items-center gap-2">
          <MapPin size={13} className="text-aether-blue/60" />
          <span className="font-display text-[13px] text-white/60 tracking-[0.04em] max-w-[200px] truncate">{display.location}</span>
        </div>

        <div className="w-px h-4 bg-aether-border/40" />

        {/* Weather */}
        <div className="flex items-center gap-2">
          <CloudSun size={14} className="text-aether-blue/60" />
          <span className="font-display text-[13px] text-white/50 tracking-[0.04em] max-w-[120px] truncate">{display.weather}</span>
        </div>
      </div>

      {/* ── Center: countdown ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Hourglass size={13} className="text-white/25" />
        <span className="font-display text-[13px] text-white/35 tracking-[0.06em] whitespace-nowrap">
          {display.countdownLabel} {display.countdown}
        </span>
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
