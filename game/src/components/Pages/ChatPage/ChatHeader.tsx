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

  const iconClass = (base: string) =>
    display.inDream ? `${base} text-aether-red/70` : `${base} text-aether-blue/70`;

  return (
    <div className="px-6 py-3.5 border-b border-aether-cyan/20 bg-aether-deep/90 flex items-center shrink-0 shadow-[0_1px_8px_rgba(0,242,255,0.03)] relative">
      {/* Left: time / location / weather */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <Clock size={14} className={iconClass('')} />
          <span className="font-display text-[13px] text-white/60 tracking-[0.06em] whitespace-nowrap">{display.time}</span>
        </div>
        <div className="w-px h-4 bg-aether-border/50" />
        <div className="flex items-center gap-2">
          <MapPin size={13} className={iconClass('')} />
          <span className="font-display text-[13px] text-white/65 tracking-[0.06em] max-w-[200px] truncate">{display.location}</span>
        </div>
        <div className="w-px h-4 bg-aether-border/50" />
        <div className="flex items-center gap-2">
          <CloudSun size={14} className={iconClass('')} />
          <span className="font-display text-[13px] text-white/55 tracking-[0.06em] max-w-[120px] truncate">{display.weather}</span>
        </div>
      </div>

      {/* Center: countdown */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Hourglass size={13} className="text-white/25" />
        <span className="font-display text-[13px] text-white/35 tracking-[0.06em] whitespace-nowrap">
          {display.countdownLabel} {display.countdown}
        </span>
      </div>

      {/* Right: buttons */}
      <div className="flex items-center gap-2 ml-auto">
        {onOpenVariables && (
          <button
            onClick={onOpenVariables}
            className="relative group flex items-center gap-2 px-3 py-1.5 rounded-sm text-white/35 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.04]"
          >
            <Eye size={17} />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              变量
            </span>
          </button>
        )}

        {onOpenReader && (
          <button
            onClick={onOpenReader}
            className="relative group flex items-center gap-2 px-3 py-1.5 rounded-sm text-white/50 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.06]"
          >
            <BookOpen size={17} />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              阅读
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
