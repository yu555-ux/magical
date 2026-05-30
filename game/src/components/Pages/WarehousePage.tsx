import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Search, X } from 'lucide-react';
import { Modal } from '../Feedback';
import { getDatabase } from '../../sillytavern/database';
import { moveItem } from '../../sillytavern/variables';
import { previewRealizeCost, realizeItem, type RealizePreview } from '../../sillytavern/realize-engine';

type CatFilter = '全部' | '灵宝' | '诡物' | '物品';
type ConcreteFilter = '现实奇物' | '梦境奇物';
type WarehouseItem = { name: string; category: string; data: any };

const ITEM_RANK_STYLES: Record<string, { text: string; border: string; glow: string; bg: string; card: string; hoverGlow: string }> = {
  灭世: { text: 'text-red-500',   border: 'border-red-500/60',   glow: 'shadow-[0_0_24px_rgba(239,68,68,0.6)]',    bg: 'bg-red-500/20',   card: 'border-red-500/50 bg-red-500/20 shadow-[0_0_24px_rgba(239,68,68,0.35)]', hoverGlow: 'hover:shadow-[0_0_36px_rgba(239,68,68,0.5)]' },
  绝域: { text: 'text-fuchsia-400',border: 'border-fuchsia-400/50',glow: 'shadow-[0_0_18px_rgba(217,70,219,0.45)]',bg: 'bg-fuchsia-400/18',card: 'border-fuchsia-400/40 bg-fuchsia-400/18 shadow-[0_0_16px_rgba(217,70,219,0.25)]', hoverGlow: 'hover:shadow-[0_0_30px_rgba(217,70,219,0.45)]' },
  倾国: { text: 'text-violet-400',border: 'border-violet-400/50',glow: 'shadow-[0_0_14px_rgba(167,139,250,0.4)]',bg: 'bg-violet-400/16', card: 'border-violet-400/35 bg-violet-400/16 shadow-[0_0_14px_rgba(167,139,250,0.2)]', hoverGlow: 'hover:shadow-[0_0_26px_rgba(167,139,250,0.4)]' },
  祸城: { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_14px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/14', card: 'border-orange-400/35 bg-orange-400/14 shadow-[0_0_12px_rgba(251,146,60,0.22)]', hoverGlow: 'hover:shadow-[0_0_26px_rgba(251,146,60,0.4)]' },
  凶煞: { text: 'text-amber-400', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/12', card: 'border-amber-400/30 bg-amber-400/12 shadow-[0_0_10px_rgba(251,191,36,0.18)]', hoverGlow: 'hover:shadow-[0_0_22px_rgba(251,191,36,0.38)]' },
  微末: { text: 'text-slate-400', border: 'border-slate-400/30', glow: 'shadow-[0_0_6px_rgba(148,163,184,0.15)]',bg: 'bg-slate-400/10', card: 'border-slate-400/20 bg-slate-400/10', hoverGlow: 'hover:shadow-[0_0_14px_rgba(148,163,184,0.2)]' },
};

const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  灵宝: { border: 'border-cyan-400/35 hover:border-cyan-400/55', bg: 'bg-cyan-950/50', text: 'text-cyan-300' },
  诡物: { border: 'border-purple-400/35 hover:border-purple-400/55', bg: 'bg-purple-950/40', text: 'text-purple-300' },
  物品: { border: 'border-white/15 hover:border-white/25', bg: 'bg-white/[0.06]', text: 'text-white/70' },
};

export default function WarehousePage() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<CatFilter>('全部');
  const [concreteFilter, setConcreteFilter] = useState<ConcreteFilter>('现实奇物');
  const [searchFocused, setSearchFocused] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [inDream, setInDream] = useState(false);
  const [realizeTarget, setRealizeTarget] = useState<WarehouseItem | null>(null);
  const [realizePreview, setRealizePreview] = useState<RealizePreview | null>(null);
  const [realizing, setRealizing] = useState(false);
  const [realizeError, setRealizeError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const db = getDatabase();
    const refresh = async () => {
      try {
        const chats = await db.chats.toArray();
        const vars = chats[chats.length - 1]?.variables ?? {};
        const warehouse = vars.仓库 ?? {};
        setInDream(vars?.世界?.梦境定位?.位于梦境 === true);
        const all: WarehouseItem[] = [];
        for (const cat of ['灵宝', '诡物', '物品'] as const) {
          const catItems = warehouse[cat] ?? {};
          for (const [name, data] of Object.entries(catItems as Record<string, any>)) {
            all.push({ name, category: cat, data });
          }
        }
        setItems(all);
      } catch { /* DB not ready */ }
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = items.filter(i => {
    if (categoryFilter !== '全部' && i.category !== categoryFilter) return false;
    if (i.data?.梦境物品 === true && concreteFilter === '现实奇物') return false;
    if (i.data?.梦境物品 !== true && concreteFilter === '梦境奇物') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.data?.描述 || '').toLowerCase().includes(q);
  });

  const totalCount = filtered.length;

  const clearSearch = () => { setSearchQuery(''); searchInputRef.current?.focus(); };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-5 overflow-hidden bg-aether-deep">
      {/* ===== Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
      >
        <div>
          <h2 className="font-display text-lg md:text-xl tracking-[0.2em] text-aether-cyan cyan-glow leading-tight">奇物收藏</h2>
          <p className="text-[9px] font-mono text-aether-blue/60 tracking-tight mt-0.5">共 {totalCount} 件</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[400px] md:justify-end">
          {/* Search */}
          <motion.div
            animate={{ width: searchFocused ? 240 : 180 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative flex-1 md:flex-initial"
          >
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aether-blue/40 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="搜索物品..."
              className="w-full bg-black/50 border border-aether-border/30 py-2 pl-9 pr-8 text-xs text-aether-cyan placeholder-aether-blue/30 font-mono tracking-wider focus:outline-none focus:border-aether-cyan/60 transition-colors"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-aether-blue/40 hover:text-aether-cyan transition-colors clickable"
                >
                  <X size={14} />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Category pills */}
          <div className="flex items-center gap-1">
            {(['全部', '灵宝', '诡物', '物品'] as CatFilter[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-[10px] font-mono tracking-wider border transition-all clickable press-scale ${
                  categoryFilter === cat
                    ? 'border-aether-cyan/50 text-aether-cyan bg-aether-cyan/10 shadow-[0_0_6px_rgba(0,242,255,0.15)]'
                    : 'border-white/10 text-white/30 hover:text-white/50 hover:border-white/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>
      </motion.div>

      {/* ===== 仓库分类 Tab ===== */}
      <div className="flex items-center gap-4">
        {(['现实奇物', '梦境奇物'] as ConcreteFilter[]).map(cf => {
          const active = concreteFilter === cf;
          const isReality = cf === '现实奇物';
          return (
            <button
              key={cf}
              onClick={() => setConcreteFilter(cf)}
              className={`
                px-5 py-2.5 text-[12px] font-display tracking-[0.08em] border transition-all duration-200 clickable
                ${active
                  ? isReality
                    ? 'border-emerald-400/40 bg-emerald-400/8 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.1)]'
                    : 'border-purple-400/40 bg-purple-400/8 text-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.1)]'
                  : 'border-white/[0.06] text-white/20 hover:text-white/45 hover:border-white/[0.14] hover:bg-white/[0.02]'
                }
              `}
            >
              {cf}
            </button>
          );
        })}
      </div>

      {/* ===== Content ===== */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={40} className="text-white/10 mb-4" />
            <p className="text-white/20 text-sm font-display tracking-wide">无匹配物品</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-1">
            {filtered.map(item => {
              const isItem = item.category === '物品';
              const rank = item.data?.等级 || '';
              const irs = ITEM_RANK_STYLES[rank] || null;
              const cs = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['物品'];
              const cardStyle = isItem
                ? `border ${cs.border} ${cs.bg}`
                : irs ? `border ${irs.card}` : `border ${cs.border} ${cs.bg}`;
              const nameColor = isItem ? cs.text : (irs?.text || cs.text);
              const hg = isItem ? 'hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]' : (irs?.hoverGlow || '');
              return (
                <div key={item.name} className="p-[4px]">
                <motion.button
                  onClick={() => setSelectedItem({ ...item.data, name: item.name, category: item.category })}
                  className={`relative p-5 text-left group transition-all duration-200 overflow-hidden clickable w-full ${cardStyle} hover:brightness-110 hover:scale-[1.02] hover:z-10 ${hg}`}
                >
                  <div className="flex items-center gap-2">
                    <h3 className={`font-display font-bold text-lg truncate flex-1 ${nameColor}`}>
                      {item.name}
                      <span className="text-[10px] font-mono text-white/25 ml-2">×{item.data?.数量 ?? 1}</span>
                    </h3>
                    {item.data?.梦境物品 === true && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-display tracking-wider border border-purple-400/25 bg-purple-400/8 text-purple-300/70 shrink-0">梦境</span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-white/45 leading-relaxed line-clamp-2 group-hover:text-white/65 transition-colors">{item.data?.描述 || ''}</p>
                </motion.button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Modal ===== */}
      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.category === '灵宝' ? '灵宝详情' : selectedItem?.category === '诡物' ? '诡物详情' : '物品详情'}>
        {selectedItem && (() => {
          const rank = selectedItem?.等级 || '';
          const irs = ITEM_RANK_STYLES[rank] || null;
          return (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedItem.name}</h3>
                <p className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">
                  数量: {selectedItem?.数量 ?? 1}
                  <span className="ml-3">
                    {selectedItem?.梦境物品 === true
                      ? <span className="text-purple-300/60 border border-purple-400/20 bg-purple-400/6 px-1.5 py-0.5 rounded">梦境奇物</span>
                      : <span className="text-emerald-300/60 border border-emerald-400/20 bg-emerald-400/6 px-1.5 py-0.5 rounded">现实奇物</span>
                    }
                  </span>
                </p>
              </div>
              {irs && (
                <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>
                  {rank}
                </span>
              )}
            </div>
            <div className="space-y-4">
              {selectedItem?.描述 && <div><h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4><p className="text-sm text-white/80 leading-relaxed">{selectedItem.描述}</p></div>}
              {selectedItem?.效果 && Object.keys(selectedItem.效果).length > 0 && (
                <div><h4 className="text-[10px] text-aether-green uppercase tracking-widest mb-3 font-mono">效果</h4><div className="space-y-2">{Object.entries(selectedItem.效果 as Record<string, string>).map(([k,v]) => <div key={k} className="p-3 bg-aether-green/[0.04] border border-aether-green/20"><h5 className="text-[11px] font-display font-bold text-aether-green/70 mb-1">{k}</h5><p className="text-[11px] text-white/60 leading-relaxed">{v}</p></div>)}</div></div>
              )}
              {selectedItem?.规则 && Object.keys(selectedItem.规则).length > 0 && (
                <div><h4 className="text-[10px] text-aether-purple uppercase tracking-widest mb-3 font-mono">规则</h4><div className="space-y-2">{Object.entries(selectedItem.规则 as Record<string, string>).map(([k,v]) => <div key={k} className="p-3 bg-aether-purple/[0.04] border border-aether-purple/20"><h5 className="text-[11px] font-display font-bold text-aether-purple/70 mb-1">{k}</h5><p className="text-[11px] text-white/60 leading-relaxed">{v}</p></div>)}</div></div>
              )}
              {selectedItem?.副作用 && Object.keys(selectedItem.副作用).length > 0 && (
                <div><h4 className="text-[10px] text-aether-red uppercase tracking-widest mb-3 font-mono">副作用</h4><div className="space-y-2">{Object.entries(selectedItem.副作用 as Record<string, string>).map(([k,v]) => <div key={k} className="p-3 bg-aether-red/[0.04] border border-aether-red/20"><h5 className="text-[11px] font-display font-bold text-aether-red/70 mb-1">{k}</h5><p className="text-[11px] text-white/60 leading-relaxed">{v}</p></div>)}</div></div>
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-white/10">
              {(() => {
                const itemIsDream = selectedItem?.梦境物品 === true;
                const planeMatch = (inDream && itemIsDream) || (!inDream && !itemIsDream);
                return (
                  <div className="flex items-center gap-3">
                    {!planeMatch && (
                      <span className="text-[10px] font-display text-red-300/50 tracking-wider">
                        {inDream ? '梦境中无法装备现实奇物' : '现实中无法装备梦境奇物'}
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        setEquipping(true);
                        const ok = await moveItem(selectedItem.name, selectedItem.category, 'equip');
                        setEquipping(false);
                        if (ok) {
                          setSelectedItem(null);
                          // Force immediate refresh
                          const db = getDatabase();
                          const chats = await db.chats.toArray();
                          const warehouse = chats[chats.length - 1]?.variables?.仓库 ?? {};
                          const all: WarehouseItem[] = [];
                          for (const cat of ['灵宝', '诡物', '物品'] as const) {
                            const catItems = warehouse[cat] ?? {};
                            for (const [name, data] of Object.entries(catItems as Record<string, any>)) {
                              all.push({ name, category: cat, data });
                            }
                          }
                          setItems(all);
                        }
                      }}
                      disabled={equipping || !planeMatch}
                      className={`px-4 py-2 text-xs font-display tracking-wider border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${planeMatch ? 'border-aether-green/40 text-aether-green hover:bg-aether-green/10' : 'border-white/[0.06] text-white/15'}`}
                    >
                      {equipping ? '装备中…' : '装备'}
                    </button>
                    {itemIsDream && (
                      <button
                        onClick={() => {
                          const pv = previewRealizeCost(selectedItem, selectedItem.category);
                          setRealizeTarget({ name: selectedItem.name, category: selectedItem.category, data: selectedItem });
                          setRealizePreview(pv);
                          setRealizeError('');
                        }}
                        className="px-4 py-2 text-xs font-display tracking-wider border border-amber-400/30 bg-amber-400/8 text-amber-300 hover:bg-amber-400/14 hover:border-amber-400/50 transition-all flex items-center gap-1"
                      >
                        具现
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )})()}
      </Modal>

      {/* ===== Realize Confirmation Modal ===== */}
      <AnimatePresence>
        {realizeTarget && realizePreview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-aether-dark/90 backdrop-blur-md"
            onClick={() => { setRealizeTarget(null); setRealizePreview(null); setRealizeError(''); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel border-glow w-[360px] shadow-[0_0_40px_rgba(0,242,255,0.06)]"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-aether-cyan/20 bg-aether-cyan/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                  <h3 className="font-display text-sm tracking-[0.12em] text-aether-cyan/90">梦境具现</h3>
                </div>
                <button
                  onClick={() => { setRealizeTarget(null); setRealizePreview(null); setRealizeError(''); }}
                  className="p-1 text-white/25 hover:text-white/60 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-white/70 leading-relaxed">
                  将 {(() => {
                    const rk = realizeTarget.data?.等级;
                    const rs = rk ? ITEM_RANK_STYLES[rk] : null;
                    return <span className={rs?.text || 'text-white'}>{realizeTarget.name}</span>;
                  })()} 具现到现实，需消耗
                </p>
                <div className="text-center py-3">
                  <span className="font-display font-bold text-amber-300 text-2xl tabular-nums">
                    {realizePreview.cost.toLocaleString('zh-CN')}
                  </span>
                  <span className="text-white/40 text-sm ml-1">蝶烬</span>
                </div>

                {realizeError && (
                  <div className="p-3 bg-aether-red/[0.06] border border-aether-red/20 text-[11px] font-mono text-aether-red/70">
                    {realizeError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => { setRealizeTarget(null); setRealizePreview(null); setRealizeError(''); }}
                    className="flex-1 px-4 py-2 text-xs font-display tracking-wider border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/15 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      if (!realizeTarget || !realizePreview) return;
                      setRealizing(true);
                      setRealizeError('');
                      const result = await realizeItem(realizeTarget.name, realizeTarget.category, realizePreview);
                      setRealizing(false);
                      if (result.success) {
                        const db = getDatabase();
                        const chats = await db.chats.toArray();
                        const warehouse = chats[chats.length - 1]?.variables?.仓库 ?? {};
                        const all: WarehouseItem[] = [];
                        for (const cat of ['灵宝', '诡物', '物品'] as const) {
                          const catItems = warehouse[cat] ?? {};
                          for (const [name, data] of Object.entries(catItems as Record<string, any>)) {
                            all.push({ name, category: cat, data });
                          }
                        }
                        setItems(all);
                        setRealizeTarget(null);
                        setRealizePreview(null);
                      } else {
                        setRealizeError(result.error ?? '具现失败');
                      }
                    }}
                    disabled={realizing}
                    className="flex-1 px-4 py-2 text-xs font-display tracking-wider border border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 hover:border-amber-400/60 transition-all disabled:opacity-40"
                  >
                    {realizing ? '具现中…' : '确认'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
