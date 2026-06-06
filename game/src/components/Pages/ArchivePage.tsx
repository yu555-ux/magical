import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User, ChevronDown } from 'lucide-react';
import { useSS } from '../../hooks/SillytavernContext';
import { DEFAULT_WORLD_VARS } from '../../sillytavern/default-world-vars';
import { deepResolveMacros } from '../../sillytavern/prompt-assembler';
import CharacterDetail from './ArchivePage/CharacterDetail';
import { CharacterCard, GROUP_LABELS } from './ArchivePage/constants';

/* ============================================================
   EMPTY STATE
   ============================================================ */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col items-center justify-center gap-4"
    >
      <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
        <User size={28} className="text-white/10" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[13px] font-display text-white/25 tracking-wide">选择角色</p>
        <p className="text-[10px] font-mono text-white/12">从左侧列表中选择一个角色查看详细档案</p>
      </div>
    </motion.div>
  );
}

/* ============================================================
   HEADER BAR — shared by mobile (always visible)
   ============================================================ */
function ListHeader({
  search, onSearch, listOpen, onToggleList, showAll, onToggleShowAll,
}: {
  search: string;
  onSearch: (v: string) => void;
  listOpen: boolean;
  onToggleList: () => void;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  return (
    <div className="px-3 md:px-4 pt-3 md:pt-5 pb-2 md:pb-3 space-y-2 md:space-y-3">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-1 h-5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.4)]" />
        <h2 className="font-display text-base tracking-[0.12em] text-aether-cyan/90">角色档案</h2>
        {/* 移动端折叠按钮 */}
        <button
          onClick={onToggleList}
          className="md:hidden ml-auto p-1.5 text-white/30 hover:text-aether-cyan transition-colors"
        >
          <motion.div animate={{ rotate: listOpen ? 0 : 180 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} />
          </motion.div>
        </button>
        <button
          onClick={onToggleShowAll}
          className={`text-[10px] font-display px-2.5 py-1 rounded border transition-all shrink-0 tracking-wider
            ${showAll
              ? 'bg-aether-cyan/[0.10] border-aether-cyan/35 text-aether-cyan shadow-[0_0_10px_rgba(0,242,255,0.15)]'
              : 'bg-aether-cyan/[0.04] border-aether-cyan/25 text-aether-cyan/60 hover:bg-aether-cyan/[0.08] hover:text-aether-cyan hover:shadow-[0_0_8px_rgba(0,242,255,0.1)]'
            }`}
        >
          {showAll ? '隐藏' : '展示'}
        </button>
      </div>
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          type="search"
          inputMode="search"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="搜索角色…"
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-md pl-8 pr-3 py-1.5
                     text-[11px] font-mono text-white/70 placeholder:text-white/15
                     focus:outline-none focus:border-aether-cyan/30 focus:bg-white/[0.05]
                     transition-colors"
        />
      </div>
    </div>
  );
}

/* ============================================================
   CHARACTER LIST — used by both mobile overlay and desktop sidebar
   ============================================================ */
function CharacterList({
  groups, selected, onSelect,
}: {
  groups: [string, CharacterCard[]][];
  selected: CharacterCard | null;
  onSelect: (c: CharacterCard) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[11px] font-mono text-white/20">暂无角色数据</span>
      </div>
    );
  }
  return (
    <div className="space-y-3 md:space-y-4">
      {groups.map(([groupKey, cards]) => (
        <div key={groupKey}>
          <div className="flex items-center gap-2 mb-1.5 px-2">
            <span className="text-[9px] font-mono text-aether-cyan/40 tracking-[0.1em] uppercase">
              {GROUP_LABELS[groupKey] ?? groupKey}
            </span>
            <span className="text-[9px] font-mono text-white/15">{cards.length}</span>
          </div>
          <div className="space-y-0.5">
            {cards.map((char) => {
              const p = char.profile;
              const isActive = selected?.name === char.name;
              return (
                <button
                  key={char.name}
                  onClick={() => onSelect(char)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors group relative
                    ${isActive
                      ? 'bg-aether-cyan/[0.06] border border-aether-cyan/20'
                      : 'border border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]'
                    }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-aether-cyan rounded-r-full shadow-[0_0_6px_rgba(0,242,255,0.5)]" />
                  )}
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-colors
                    ${isActive ? 'bg-aether-cyan/15' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'}`}>
                    <User size={13} className={isActive ? 'text-aether-cyan/60' : 'text-white/20'} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className={`text-[15px] font-display font-semibold truncate transition-colors
                      ${isActive ? 'text-aether-cyan/90 font-bold' : 'text-white/80 group-hover:text-white/95'}`}>
                      {char.name}
                    </span>
                    {p.梦境NPC && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 bg-purple-400/12 text-purple-300/70 border border-purple-400/20">
                        梦境
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   ARCHIVE PAGE
   ============================================================ */
export default function ArchivePage() {
  const ss = useSS();
  const liveVars = ss.activeChat?.variables;
  const defaults = DEFAULT_WORLD_VARS as any;
  const playerName = ss.settings?.userName ?? '我';
  const characterName = ss.settings?.characterName ?? 'AI';
  const charData: Record<string, any> = useMemo(() => {
    const raw = liveVars?.['主要人物'] ?? defaults.主要人物 ?? {};
    return deepResolveMacros(raw, playerName, characterName);
  }, [liveVars, defaults, playerName, characterName]);

  const [selected, setSelected] = useState<CharacterCard | null>(null);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [listOpen, setListOpen] = useState(true);

  const groups = useMemo(() => {
    const result: Record<string, CharacterCard[]> = {};
    for (const [gender, genderData] of Object.entries(charData)) {
      if (!genderData || typeof genderData !== 'object') continue;
      for (const [group, members] of Object.entries(genderData as Record<string, any>)) {
        if (!members || typeof members !== 'object') continue;
        const groupKey = `${gender}-${group}`;
        const cards: CharacterCard[] = [];
        for (const [name, profile] of Object.entries(members as Record<string, any>)) {
          if (!profile || typeof profile !== 'object') continue;
          cards.push({ name, group: groupKey, category: GROUP_LABELS[groupKey] ?? groupKey, profile });
        }
        if (cards.length > 0) result[groupKey] = cards;
      }
    }
    return result;
  }, [charData]);

  const groupEntries: [string, CharacterCard[]][] = Object.entries(groups);

  const socialCharNames = useMemo(() => {
    const socialData = liveVars?.['主角']?.['社交'] ?? defaults.主角?.社交 ?? {};
    return new Set(Object.keys(socialData));
  }, [charData, liveVars, defaults]);

  const filteredGroups: [string, CharacterCard[]][] = useMemo(() => {
    const q = search.trim().toLowerCase();
    let source = groupEntries;
    if (!showAll && socialCharNames.size > 0) {
      source = groupEntries
        .map(([key, cards]) => [key, cards.filter(c => socialCharNames.has(c.name))] as [string, CharacterCard[]])
        .filter(([, cards]) => cards.length > 0);
    }
    if (!q) return source;
    return source
      .map(([key, cards]) => [
        key,
        cards.filter((c: CharacterCard) => c.name.toLowerCase().includes(q) || c.profile.检索词?.some((k: string) => k.toLowerCase().includes(q))),
      ] as [string, CharacterCard[]])
      .filter(([, cards]) => cards.length > 0);
  }, [groupEntries, search, showAll, socialCharNames]);

  const handleSearch = (v: string) => { setSearch(v); setSelected(null); };
  const toggleList = () => setListOpen(!listOpen);
  const toggleShowAll = () => { setShowAll(!showAll); setSelected(null); };

  return (
    <div className="h-full flex flex-col md:flex-row bg-aether-deep overflow-hidden">

      {/* ================================================================
          MOBILE LAYOUT — fixed header + absolute overlay list + fixed detail
          ================================================================ */}
      {/* Mobile header — always visible, fixed height */}
      <div className="md:hidden shrink-0 border-b border-aether-border/30 bg-aether-dark">
        <ListHeader
          search={search} onSearch={handleSearch}
          listOpen={listOpen} onToggleList={toggleList}
          showAll={showAll} onToggleShowAll={toggleShowAll}
        />
      </div>

      {/* Mobile content area — fixed remaining height, never resizes */}
      <div className="md:hidden flex-1 relative overflow-hidden">
        {/* Character list — absolute overlay when open */}
        <AnimatePresence>
          {listOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 z-20 bg-aether-dark overflow-y-auto custom-scrollbar px-2 pb-3"
            >
              <CharacterList groups={filteredGroups} selected={selected} onSelect={setSelected} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Character detail — always fills the space, scroll area NEVER resizes */}
        <div className="h-full overflow-y-auto custom-scrollbar bg-aether-deep pt-2">
          <AnimatePresence mode="wait">
            {selected ? (
              <CharacterDetail key={selected.name} char={selected} />
            ) : (
              <EmptyState />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ================================================================
          DESKTOP LAYOUT — side-by-side (unchanged)
          ================================================================ */}
      {/* Desktop left panel */}
      <div className="hidden md:flex md:w-64 lg:w-72 shrink-0 border-r border-aether-border/30 flex-col bg-aether-dark">
        <div className="shrink-0">
          <ListHeader
            search={search} onSearch={handleSearch}
            listOpen={true} onToggleList={() => {}}
            showAll={showAll} onToggleShowAll={toggleShowAll}
          />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
          <CharacterList groups={filteredGroups} selected={selected} onSelect={setSelected} />
        </div>
      </div>

      {/* Desktop right panel */}
      <div className="hidden md:block flex-1 overflow-y-auto custom-scrollbar bg-aether-deep pt-2 md:pt-0">
        <AnimatePresence mode="wait">
          {selected ? (
            <CharacterDetail key={selected.name} char={selected} />
          ) : (
            <EmptyState />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
