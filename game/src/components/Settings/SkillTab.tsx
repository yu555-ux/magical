import { Sparkles, Puzzle, AlertTriangle } from 'lucide-react';
import type { AppSettings } from '../../sillytavern/types';
import { SKILL_META } from '../../sillytavern/skills/skill-registry';

interface Props {
  draft: AppSettings;
  setDraft: (d: AppSettings) => void;
}

export default function SkillTab({ draft, setDraft }: Props) {
  const enabledSkills = draft.enabledSkills ?? [];
  const isAgent = draft.api?.agentMode === true;
  const enabledCount = SKILL_META.filter(s => enabledSkills.includes(s.id)).length;

  const toggleSkill = (skillId: string) => {
    const next = enabledSkills.includes(skillId)
      ? enabledSkills.filter(id => id !== skillId)
      : [...enabledSkills, skillId];
    setDraft({ ...draft, enabledSkills: next });
  };

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg border border-aether-purple/30 bg-aether-purple/10 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-aether-purple" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-display font-semibold text-aether-purple/80 tracking-wider uppercase">Skill</span>
          <span className="text-[10px] text-white/20 font-mono">{enabledCount}/{SKILL_META.length} 启用</span>
        </div>
      </div>

      {/* Agent mode warning */}
      {!isAgent && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-aether-amber/8 border border-aether-amber/10">
          <AlertTriangle size={13} className="text-aether-amber/50 flex-shrink-0 mt-px" />
          <span className="text-[10px] text-aether-amber/45 leading-relaxed">
            Skill 仅在 Agent 模式下生效。请先在「API 配置」中开启 Agent 模式。
          </span>
        </div>
      )}

      {/* Skill list */}
      {SKILL_META.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Puzzle size={28} className="text-white/8 mb-3" />
          <p className="text-xs text-white/20">暂无可用的 Skill</p>
          <p className="text-[10px] text-white/10 mt-0.5">新增 Skill 后会自动出现在这里</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {SKILL_META.map((skill) => {
            const enabled = enabledSkills.includes(skill.id);
            return (
              <div
                key={skill.id}
                onClick={() => isAgent && toggleSkill(skill.id)}
                className={`group flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 ${
                  isAgent ? 'cursor-pointer' : 'cursor-default'
                } ${
                  enabled
                    ? 'bg-aether-dark/40 border-aether-purple/15 hover:border-aether-purple/25'
                    : 'bg-aether-dark/20 border-white/[0.04] hover:border-white/[0.08]'
                }`}
              >
                {/* Toggle switch */}
                <button
                  onClick={e => { e.stopPropagation(); if (isAgent) toggleSkill(skill.id); }}
                  disabled={!isAgent}
                  className={`relative w-8 h-4.5 rounded-full transition-all duration-200 flex-shrink-0 ${
                    !isAgent
                      ? 'bg-white/[0.06] cursor-not-allowed'
                      : enabled
                        ? 'bg-aether-purple/80 shadow-[0_0_8px_rgba(168,85,247,0.25)]'
                        : 'bg-white/[0.12] group-hover:bg-white/[0.18]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                      enabled ? 'left-[16px]' : 'left-[2px]'
                    }`}
                  />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-display font-semibold tracking-wide transition-colors ${
                      enabled ? 'text-white/85' : 'text-white/40 group-hover:text-white/55'
                    }`}>
                      {skill.name}
                    </span>
                    {enabled && (
                      <span className="inline-flex text-[9px] bg-aether-purple/15 text-aether-purple/60 px-1.5 py-px rounded-full font-mono">
                        已启用
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/25 leading-relaxed mt-0.5 line-clamp-2">
                    {skill.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
