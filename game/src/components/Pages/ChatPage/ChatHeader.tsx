import { useMemo } from 'react';
import { Clock, MapPin, CloudSun, BookOpen } from 'lucide-react';

interface ChatHeaderProps {
  currentTime: Date;
  variables?: Record<string, any>;
  onOpenReader?: () => void;
  onOpenVariables?: () => void;
}

function getDisplayData(vars: Record<string, any> | undefined) {
  const world = vars?.世界 ?? {};
  const inDream = world?.梦境定位?.位于梦境 === true;

  const time = inDream
    ? (world?.梦境存档?.时间 || '--')
    : (world?.现实?.时间 || '--');

  const location = inDream
    ? (world?.梦境存档?.地点 || '--')
    : (world?.现实?.地点 || '--');

  const weather = inDream
    ? (world?.天气?.梦境 || '--')
    : (world?.天气?.现实 || '--');

  return { time, location, weather: { icon: weather.slice(0, 2) || '--', detail: weather }, inDream };
}

export default function ChatHeader({ currentTime, variables, onOpenReader, onOpenVariables }: ChatHeaderProps) {
  const display = useMemo(() => getDisplayData(variables), [variables]);

  return (
    <div className="px-6 py-3.5 border-b border-aether-cyan/20 bg-aether-deep/90 flex items-center shrink-0 shadow-[0_1px_8px_rgba(0,242,255,0.03)]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <Clock size={14} className="text-aether-blue/70" />
          <span className="font-display text-[14px] text-white/60 tracking-[0.08em]">
            {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="w-px h-4 bg-aether-border/50" />
        <div className="flex items-center gap-2">
          <MapPin size={13} className={display.inDream ? 'text-aether-purple/70' : 'text-aether-blue/70'} />
          <span className="font-display text-[13px] text-white/65 tracking-[0.06em] max-w-[200px] truncate">{display.location}</span>
        </div>
        <div className="w-px h-4 bg-aether-border/50" />
        <div className="flex items-center gap-2">
          <CloudSun size={14} className={display.inDream ? 'text-aether-purple/70' : 'text-aether-blue/70'} />
          <span className="font-display text-[13px] text-white/55 tracking-[0.06em] max-w-[120px] truncate">{display.weather.detail}</span>
        </div>
        {display.inDream && (
          <>
            <div className="w-px h-4 bg-aether-border/50" />
            <span className="text-[10px] text-aether-purple/50 font-mono tracking-[0.12em]">🌙 梦境</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Variable viewer button */}
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

      {/* Plot reader button */}
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
  );
}
