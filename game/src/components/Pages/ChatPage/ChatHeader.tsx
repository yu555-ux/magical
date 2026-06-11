import { useMemo } from 'react';
import { Clock, MapPin, CloudSun, BookOpen, Eye, Hourglass, Moon, Save, FileText } from 'lucide-react';
import { computeCountdowns } from '../../../sillytavern/countdown';
import type { DreamAnchor } from '../../../sillytavern/types';

interface ChatHeaderProps {
  variables?: Record<string, any>;
  dreamAnchor?: DreamAnchor;
  onOpenReader?: () => void;
  onOpenVariables?: () => void;
  onOpenSave?: () => void;
  onOpenPrompt?: () => void;
}

function getDisplayData(vars: Record<string, any> | undefined, anchor?: DreamAnchor) {
  const world = vars?.世界 ?? {};
  const inDream = world?.位于梦境 === true;

  const source = inDream ? (world?.梦境存档 ?? {}) : (world?.现实 ?? {});
  const time = source?.时间 || '--';
  const location = source?.地点 || '--';
  const weather = source?.天气 || '--';

  // 代码计算倒计时（完全由锚点+当前时间决定，不读取变量树中的旧值）
  const realityTime = world?.现实?.时间;
  const dreamTime = world?.梦境存档?.时间;
  const computed = computeCountdowns(inDream, realityTime, dreamTime, anchor ?? null);
  const countdown = inDream ? computed.离开梦境倒计时 : computed.可进入梦境倒计时;
  const countdownLabel = inDream ? '离开梦境' : '进入梦境';

  return { time, location, weather, countdown, countdownLabel, inDream };
}

export default function ChatHeader({ variables, dreamAnchor, onOpenReader, onOpenVariables, onOpenSave, onOpenPrompt }: ChatHeaderProps) {
  const display = useMemo(() => getDisplayData(variables, dreamAnchor), [variables, dreamAnchor]);

  const iconColor = display.inDream ? 'text-aether-purple/60' : 'text-aether-blue/70';

  return (
    <div className="px-3 md:px-6 py-2 md:py-3.5 border-b border-aether-cyan/20 bg-aether-deep/90 flex items-center shrink-0 shadow-[0_1px_8px_rgba(0,242,255,0.03)] relative">
      <div className="flex items-center gap-3 md:gap-6 flex-wrap">
        <div className="flex items-center gap-1.5 md:gap-2.5">
          <Clock size={13} className={iconColor} />
          <span className="font-display text-[12px] md:text-[14px] text-white/60 tracking-[0.06em] md:tracking-[0.08em]">{display.time}</span>
        </div>
        <div className="w-px h-3 md:h-4 bg-aether-border/50 hidden md:block" />
        <div className="flex items-center gap-1.5 md:gap-2">
          <MapPin size={12} className={iconColor} />
          <span className="font-display text-[12px] md:text-[14px] text-white/65 tracking-[0.06em] md:tracking-[0.08em] truncate max-w-[100px] md:max-w-none">{display.location}</span>
        </div>
        <div className="w-px h-3 md:h-4 bg-aether-border/50 hidden md:block" />
        <div className="flex items-center gap-1.5 md:gap-2">
          <CloudSun size={13} className={iconColor} />
          <span className="font-display text-[11px] md:text-[14px] text-white/55 tracking-[0.05em] md:tracking-[0.06em] max-w-[80px] md:max-w-[120px] truncate">{display.weather}</span>
        </div>
      </div>

      {/* Center: countdown — hidden on mobile to save space */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2">
        {display.inDream
          ? <Moon size={13} className="text-aether-purple/60" />
          : <Hourglass size={13} className="text-white/25" />
        }
        <span className="font-display text-[13px] text-white/35 tracking-[0.06em] whitespace-nowrap">
          {display.countdownLabel} {display.countdown}
        </span>
      </div>

      <div className="flex-1" />

      {/* Save button */}
      {onOpenSave && (
        <button
          onClick={onOpenSave}
          className="relative group flex items-center gap-1 md:gap-2 px-1.5 md:px-3 py-1 md:py-1.5 rounded-sm text-white/25 hover:text-white/45 hover:bg-white/[0.02] transition-colors"
        >
          <Save size={15} />
          <span className="hidden md:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            存档
          </span>
        </button>
      )}

      {/* Prompt viewer button */}
      {onOpenPrompt && (
        <button
          onClick={onOpenPrompt}
          className="relative group flex items-center gap-1 md:gap-2 px-1.5 md:px-3 py-1 md:py-1.5 rounded-sm text-white/30 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.04]"
        >
          <FileText size={15} />
          <span className="hidden md:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            请求
          </span>
        </button>
      )}

      {/* Variable viewer button */}
      {onOpenVariables && (
        <button
          onClick={onOpenVariables}
          className="relative group flex items-center gap-1 md:gap-2 px-1.5 md:px-3 py-1 md:py-1.5 rounded-sm text-white/35 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.04]"
        >
          <Eye size={15} />
          <span className="hidden md:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            变量
          </span>
        </button>
      )}

      {/* Plot reader button */}
      {onOpenReader && (
        <button
          onClick={onOpenReader}
          className="relative group flex items-center gap-1 md:gap-2 px-1.5 md:px-3 py-1 md:py-1.5 rounded-sm text-white/50 hover:text-aether-cyan transition-colors hover:bg-aether-cyan/[0.06]"
        >
          <BookOpen size={15} />
          <span className="hidden md:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-aether-cyan/80 font-display tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            阅读
          </span>
        </button>
      )}
    </div>
  );
}
