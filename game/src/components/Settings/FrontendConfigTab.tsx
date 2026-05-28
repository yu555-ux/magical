import React from 'react';
import { AlignCenter, Type, Bold, Italic, MessageSquare, Minus, Plus } from 'lucide-react';
import type { AppSettings, RichTextConfig, RichTextSymbolConfig } from '../../sillytavern/types';
import { DEFAULT_RICH_TEXT_CONFIG, DEFAULT_SETTINGS } from '../../sillytavern/types';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
}

const SYMBOLS: { key: keyof RichTextConfig; label: string; sample: string }[] = [
  { key: 'bold',            label: '粗体（**text**）',  sample: '重要内容' },
  { key: 'italic',          label: '斜体（*text*）',    sample: '内心独白' },
  { key: 'cornerBrackets',  label: '方头括号（【】）',   sample: '系统提示' },
  { key: 'angleBrackets',   label: '直角引号（「」）',   sample: '特殊对话' },
  { key: 'quotes',          label: '弯引号（""）',      sample: '引用内容' },
];

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f0a43c', // amber/gold
  '#34d399', // green
  '#00f2ff', // cyan
  '#3b82f6', // blue
  '#a78bfa', // purple
  '#ec4899', // pink
  '#ffffff', // white
  '#9ca3af', // gray
];

function patchSymbol(
  draft: AppSettings,
  setDraft: (d: AppSettings) => void,
  key: keyof RichTextConfig,
  patch: Partial<RichTextSymbolConfig>,
) {
  const cfg = draft.richTextConfig ?? DEFAULT_RICH_TEXT_CONFIG;
  setDraft({
    ...draft,
    richTextConfig: {
      ...cfg,
      [key]: { ...cfg[key], ...patch },
    },
  });
}

function WrapperLabel({ keyName }: { keyName: keyof RichTextConfig }) {
  if (keyName === 'bold') return <>**</>;
  if (keyName === 'italic') return <>*</>;
  if (keyName === 'quotes') return <>&ldquo;</>;
  if (keyName === 'cornerBrackets') return <>&#x3010;</>;
  if (keyName === 'angleBrackets') return <>&#x300C;</>;
  return null;
}

function WrapperLabelEnd({ keyName }: { keyName: keyof RichTextConfig }) {
  if (keyName === 'bold') return <>**</>;
  if (keyName === 'italic') return <>*</>;
  if (keyName === 'quotes') return <>&rdquo;</>;
  if (keyName === 'cornerBrackets') return <>&#x3011;</>;
  if (keyName === 'angleBrackets') return <>&#x300D;</>;
  return null;
}

export default function FrontendConfigTab({ draft, setDraft }: Props) {
  const cfg = draft.richTextConfig ?? DEFAULT_RICH_TEXT_CONFIG;
  const width = draft.messageWidthPercent ?? DEFAULT_SETTINGS.messageWidthPercent;

  return (
    <div className="p-5 space-y-6">
      {/* ══════ Message Width ══════ */}
      <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full border-2 border-aether-cyan/40 bg-aether-cyan/10 flex items-center justify-center flex-shrink-0">
            <AlignCenter size={20} className="text-aether-cyan" />
          </div>
          <div>
            <h4 className="text-sm font-display font-semibold text-aether-cyan tracking-wide">消息区域宽度</h4>
            <p className="text-[10px] text-white/25">调节正文在消息区的左右宽度占比</p>
          </div>
          <div className="ml-auto text-right">
            <span className="text-2xl font-mono font-bold text-aether-cyan tabular-nums">{width}</span>
            <span className="text-xs text-white/30 ml-0.5">%</span>
          </div>
        </div>

        <input
          type="range"
          min={50}
          max={100}
          value={width}
          onChange={e => setDraft({ ...draft, messageWidthPercent: Number(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                     bg-white/[0.08]
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-aether-cyan
                     [&::-webkit-slider-thumb]:shadow-[0_0_16px_rgba(0,242,255,0.5)]
                     [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                     [&::-webkit-slider-thumb]:hover:scale-110
                     [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-aether-cyan [&::-moz-range-thumb]:border-0
                     [&::-moz-range-thumb]:shadow-[0_0_16px_rgba(0,242,255,0.5)] [&::-moz-range-thumb]:cursor-pointer"
        />

        <div className="mt-4 flex justify-center">
          <div className="w-full max-w-md bg-aether-dark/40 rounded-lg border border-aether-border/15 overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-aether-border/10">
              <div className="w-1.5 h-1.5 rounded-full bg-white/15" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
              <span className="text-[9px] text-white/15 ml-2 font-mono">消息预览</span>
            </div>
            <div className="flex justify-center py-4">
              <div
                className="h-2 rounded-full bg-aether-cyan/20 transition-all duration-200"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══════ Chat History Message Count ══════ */}
      <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full border-2 border-aether-green/40 bg-aether-green/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare size={20} className="text-aether-green" />
          </div>
          <div>
            <h4 className="text-sm font-display font-semibold text-aether-green tracking-wide">聊天记录保留</h4>
            <p className="text-[10px] text-white/25">发送给 AI 的最近消息条数，更早的由剧情历史概括</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          {/* Decrease */}
          <button
            onClick={() => {
              const cur = draft.recentMessageCount ?? 6;
              if (cur > 0) setDraft({ ...draft, recentMessageCount: Math.max(0, cur - 2) });
            }}
            disabled={(draft.recentMessageCount ?? 6) <= 0}
            className="w-10 h-10 rounded-full border border-aether-border/30 bg-aether-dark/40 flex items-center justify-center
                       text-white/40 hover:text-aether-green hover:border-aether-green/50 transition-all
                       disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Minus size={16} />
          </button>

          {/* Number display + input */}
          <div className="flex items-baseline gap-1.5">
            <input
              type="number"
              min={0}
              max={100}
              value={draft.recentMessageCount ?? 6}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setDraft({ ...draft, recentMessageCount: Math.max(0, Math.min(100, v)) });
              }}
              className="w-16 text-center text-3xl font-mono font-bold text-aether-green bg-transparent border-b-2 border-aether-green/30
                         focus:outline-none focus:border-aether-green/70 transition-colors
                         [&::-webkit-inner-spin-button]:appearance-none [&::-moz-spin-button]:appearance-none"
            />
            <span className="text-xs text-white/25 font-display tracking-wide">
              {(draft.recentMessageCount ?? 6) === 0 ? '不限制' : '条'}
            </span>
          </div>

          {/* Increase */}
          <button
            onClick={() => {
              const cur = draft.recentMessageCount ?? 6;
              setDraft({ ...draft, recentMessageCount: Math.min(100, cur === 0 ? 2 : cur + 2) });
            }}
            disabled={(draft.recentMessageCount ?? 6) >= 100}
            className="w-10 h-10 rounded-full border border-aether-border/30 bg-aether-dark/40 flex items-center justify-center
                       text-white/40 hover:text-aether-green hover:border-aether-green/50 transition-all
                       disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Quick presets */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {[0, 2, 6, 10, 20].map(n => {
            const cur = draft.recentMessageCount ?? 6;
            return (
              <button
                key={n}
                onClick={() => setDraft({ ...draft, recentMessageCount: n })}
                className={`px-3 py-1 rounded-full text-[11px] font-mono transition-all ${
                  cur === n
                    ? 'bg-aether-green/20 text-aether-green border border-aether-green/40'
                    : 'text-white/30 border border-white/[0.06] hover:text-white/50 hover:border-white/15'
                }`}
              >
                {n === 0 ? '不限' : n}
              </button>
            );
          })}
        </div>
      </section>

      {/* ══════ Rich Text Symbols ══════ */}
      <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full border-2 border-aether-purple/40 bg-aether-purple/10 flex items-center justify-center flex-shrink-0">
            <Type size={20} className="text-aether-purple" />
          </div>
          <div>
            <h4 className="text-sm font-display font-semibold text-aether-purple tracking-wide">富文本符号</h4>
            <p className="text-[10px] text-white/25">为特殊符号包裹的文本添加颜色与样式</p>
          </div>
        </div>

        <div className="space-y-2">
          {SYMBOLS.map(({ key, label, sample }) => {
            const s = cfg[key] ?? DEFAULT_RICH_TEXT_CONFIG[key];
            return (
              <div
                key={key}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 ${
                  s.enabled
                    ? 'bg-aether-dark/40 border-aether-border/15 hover:border-aether-border/30'
                    : 'bg-aether-dark/20 border-white/[0.04] opacity-50'
                }`}
              >
                {/* Toggle switch */}
                <button
                  onClick={() => patchSymbol(draft, setDraft, key, { enabled: !s.enabled })}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    s.enabled ? 'bg-aether-cyan/80' : 'bg-white/[0.12]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      s.enabled ? 'left-[18px]' : 'left-[2px]'
                    }`}
                  />
                </button>

                {/* Label */}
                <span className="text-xs text-white/60 font-display tracking-wide w-36 flex-shrink-0">
                  {label}
                </span>

                {/* Live preview */}
                <span
                  className="text-xs font-display tracking-wide flex-shrink-0 px-2 py-0.5 rounded min-w-[80px] text-center"
                  style={{
                    color: s.color,
                    fontWeight: s.bold ? 700 : undefined,
                    fontStyle: s.italic ? 'italic' : undefined,
                  }}
                >
                  <WrapperLabel keyName={key} />
                  {sample}
                  <WrapperLabelEnd keyName={key} />
                </span>

                {/* Style toggles: Bold + Italic */}
                <div className="flex items-center gap-0.5 ml-auto mr-2">
                  <button
                    onClick={() => patchSymbol(draft, setDraft, key, { bold: !s.bold })}
                    title="粗体"
                    className={`w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold transition-all ${
                      s.bold
                        ? 'bg-aether-cyan/20 text-aether-cyan shadow-[0_0_6px_rgba(0,242,255,0.2)]'
                        : 'text-white/20 hover:text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Bold size={12} />
                  </button>
                  <button
                    onClick={() => patchSymbol(draft, setDraft, key, { italic: !s.italic })}
                    title="斜体"
                    className={`w-6 h-6 flex items-center justify-center rounded text-[11px] italic transition-all ${
                      s.italic
                        ? 'bg-aether-purple/20 text-aether-purple shadow-[0_0_6px_rgba(167,139,250,0.2)]'
                        : 'text-white/20 hover:text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Italic size={12} />
                  </button>
                </div>

                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => patchSymbol(draft, setDraft, key, { color })}
                      title={color}
                      className={`w-5 h-5 rounded-full transition-all flex-shrink-0 ${
                        s.color.toLowerCase() === color.toLowerCase()
                          ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-aether-dark/40 scale-110'
                          : 'hover:scale-110 hover:ring-1 hover:ring-white/30'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
