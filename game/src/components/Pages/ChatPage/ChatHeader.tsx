import { Clock, MapPin, CloudSun, BookOpen } from 'lucide-react';

interface ChatHeaderProps {
  currentTime: Date;
  location: string;
  weather: { icon: string; temp: number; humidity: number };
  onOpenReader?: () => void;
}

export default function ChatHeader({ currentTime, location, weather, onOpenReader }: ChatHeaderProps) {
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
          <MapPin size={13} className="text-aether-blue/70" />
          <span className="font-display text-[14px] text-white/65 tracking-[0.08em]">{location}</span>
        </div>
        <div className="w-px h-4 bg-aether-border/50" />
        <div className="flex items-center gap-2">
          <CloudSun size={14} className="text-aether-blue/70" />
          <span className="font-display text-[14px] text-white/55 tracking-[0.06em]">
            {weather.icon} · {weather.temp}°C
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Plot reader button */}
      {onOpenReader && (
        <button
          onClick={onOpenReader}
          className="relative group flex items-center gap-2 px-3 py-1.5 rounded-sm text-white/50 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.06]"
        >
          <BookOpen size={17} />
          {/* Tooltip */}
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            阅读
          </span>
        </button>
      )}
    </div>
  );
}
