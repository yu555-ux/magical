import AetherModal from '../../shared/AetherModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  edited: string;
  onEditedChange: (v: string) => void;
  onApply: () => void;
  dirty: boolean;
}

export default function RawXmlViewerModal({ isOpen, onClose, content, edited, onEditedChange, onApply, dirty }: Props) {
  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="原始输出">
      <div className="flex-1 overflow-y-auto p-3 md:p-5 flex flex-col gap-3">
        <textarea
          value={edited}
          onChange={(e) => onEditedChange(e.target.value)}
          className="flex-1 min-h-[280px] md:min-h-[400px] text-[12px] md:text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed font-mono bg-aether-dark/40 border border-aether-border/15 rounded-lg p-3 md:p-4 resize-none focus:outline-none focus:border-aether-cyan/50 focus:ring-1 focus:ring-aether-cyan/20 transition-all"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] md:text-[10px] text-white/20 hidden sm:inline">点击文本框可直接编辑原始输出</span>
          <button
            onClick={onApply}
            disabled={!dirty}
            className={`px-4 py-2.5 md:py-2 rounded text-xs md:text-[13px] font-display tracking-wide transition-all sm:ml-auto ${
              dirty
                ? 'bg-aether-cyan text-aether-dark font-semibold shadow-[0_0_12px_rgba(0,242,255,0.25)] hover:shadow-[0_0_20px_rgba(0,242,255,0.4)]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            应用修改
          </button>
        </div>
      </div>
    </AetherModal>
  );
}
