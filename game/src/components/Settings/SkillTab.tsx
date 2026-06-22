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

  const toggleSkill = (skillId: string) => {
    const next = enabledSkills.includes(skillId)
      ? enabledSkills.filter(id => id !== skillId)
      : [...enabledSkills, skillId];
    setDraft({ ...draft, enabledSkills: next });
  };

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full border-2 border-aether-purple/40 bg-aether-purple/10 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-aether-purple" />
          </div>
          <div>
            <h4 className="text-sm font-display font-semibold text-aether-purple tracking-wide">Skill 管理</h4>
            <p className="text-[10px] text-white/25">GM 的流程指引——不是玩家命令，是 AI 的内部工作流模板</p>
          </div>
        </div>

        {/* Agent mode warning */}
        {!isAgent && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-aether-amber/8 border border-aether-amber/15">
            <AlertTriangle size={14} className="text-aether-amber/60 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-aether-amber/50 leading-relaxed">
              Skill 仅在 Agent 模式下生效。请先在「API 配置」中开启 Agent 模式。
            </p>
          </div>
        )}
      </section>

      {/* Skill list */}
      {SKILL_META.length === 0 ? (
        <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-8 text-center">
          <Puzzle size={32} className="text-white/10 mx-auto mb-3" />
          <p className="text-xs text-white/20">暂无可用的 Skill</p>
          <p className="text-[10px] text-white/10 mt-1">新增 Skill 后会自动出现在这里</p>
        </section>
      ) : (
        <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-5">
          <div className="space-y-2">
            {SKILL_META.map((skill) => {
              const enabled = enabledSkills.includes(skill.id);
              return (
                <div
                  key={skill.id}
                  className={`flex items-start gap-4 px-4 py-3.5 rounded-lg border transition-all duration-200 ${
                    enabled
                      ? 'bg-aether-dark/40 border-aether-border/15 hover:border-aether-border/30'
                      : 'bg-aether-dark/20 border-white/[0.04] opacity-60'
                  }`}
                >
                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleSkill(skill.id)}
                    disabled={!isAgent}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 mt-0.5 ${
                      !isAgent
                        ? 'bg-white/[0.06] cursor-not-allowed'
                        : enabled
                          ? 'bg-aether-purple/80'
                          : 'bg-white/[0.12]'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                        enabled ? 'left-[18px]' : 'left-[2px]'
                      }`}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-display font-semibold tracking-wide ${
                        enabled ? 'text-white/80' : 'text-white/40'
                      }`}>
                        {skill.name}
                      </span>
                      {enabled && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] bg-aether-purple/15 text-aether-purple/70 px-1.5 py-0.5 rounded-full font-mono">
                          启用
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 leading-relaxed">
                      {skill.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* What are skills */}
      <section className="bg-aether-dark/30 rounded-lg border border-aether-border/20 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full border-2 border-aether-cyan/30 bg-aether-cyan/5 flex items-center justify-center flex-shrink-0">
            <Puzzle size={20} className="text-aether-cyan/60" />
          </div>
          <div>
            <h4 className="text-sm font-display font-semibold text-aether-cyan/60 tracking-wide">关于 Skill</h4>
            <p className="text-[10px] text-white/20">Skill 与 Tool 是两套正交机制</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-aether-dark/40 rounded-lg border border-aether-border/10 p-3">
            <span className="text-[10px] font-display font-semibold text-aether-purple/60 tracking-wider uppercase">Tool（工具）</span>
            <p className="text-[10px] text-white/25 mt-1 leading-relaxed">
              可执行的函数。AI 通过 function calling 调用，获取结构化返回值。如 roll_dice、patch_state。
            </p>
          </div>
          <div className="bg-aether-dark/40 rounded-lg border border-aether-border/10 p-3">
            <span className="text-[10px] font-display font-semibold text-aether-purple/60 tracking-wider uppercase">Skill（技能）</span>
            <p className="text-[10px] text-white/25 mt-1 leading-relaxed">
              纯指引文档。注入到 prompt 中供 AI 阅读和遵循。不走 function calling，走 prompt injection。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
