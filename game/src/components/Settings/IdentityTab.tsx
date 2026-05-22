import { User } from 'lucide-react';
import { InputRow, TextAreaRow } from './SettingsFields';
import type { AppSettings } from '../../sillytavern/types';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
}

export default function IdentityTab({ draft, setDraft }: Props) {
  return (
    <div className="p-5">
      <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full border-2 border-aether-cyan/40 bg-aether-cyan/10 flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-aether-cyan" />
          </div>
          <div>
            <h4 className="text-sm font-display font-semibold text-aether-cyan tracking-wide">玩家信息</h4>
            <p className="text-[10px] text-white/25">设定玩家名与角色设定</p>
          </div>
        </div>
        <InputRow label="玩家名" value={draft.userName} onChange={(v) => setDraft({ ...draft, userName: v })} placeholder="输入你的名字" hint="使用宏 {{user}} 在提示词中引用" />
        <TextAreaRow label="玩家设定" value={draft.playerDescription ?? ''} onChange={(v) => setDraft({ ...draft, playerDescription: v })} placeholder="描述你的角色设定、背景故事、性格特征... AI 会在对话中参考这些设定" rows={4} />
      </section>
    </div>
  );
}
