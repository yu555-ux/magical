import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Diamond, Skull, Package, Search, X, LayoutGrid, List } from 'lucide-react';
import { Modal } from '../Feedback';
import { getDatabase } from '../../sillytavern/database';

type ViewMode = 'grid' | 'list';
type CatFilter = '全部' | '灵宝' | '诡物' | '物品';
type WarehouseItem = { name: string; category: string; data: any };

const ITEM_RANK_STYLES: Record<string, { text: string; border: string; glow: string; bg: string; card: string }> = {
  灭世: { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10',   card: 'border-red-400/25 bg-red-400/[0.04]' },
  绝域: { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10',  card: 'border-rose-400/25 bg-rose-400/[0.04]' },
  倾国: { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10',  card: 'border-pink-400/25 bg-pink-400/[0.04]' },
  祸城: { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10',card: 'border-orange-400/25 bg-orange-400/[0.04]' },
  凶煞: { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10', card: 'border-amber-400/25 bg-amber-400/[0.04]' },
  微末: { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10',  card: 'border-gray-400/25 bg-gray-400/[0.04]' },
};

const CATEGORIES: CatFilter[] = ['全部', '灵宝', '诡物', '物品'];

const CatIcon = (cat: string) => cat === '灵宝' ? Diamond : cat === '诡物' ? Skull : Package;

export default function WarehousePage() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [categoryFilter, setCategoryFilter] = useState<CatFilter>('全部');

  useEffect(() => {
    const db = getDatabase();
    const refresh = async () => {
      try {
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
      } catch { /* DB not ready */ }
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = items.filter(i => {
    if (categoryFilter !== '全部' && i.category !== categoryFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.data?.描述 || '').toLowerCase().includes(q);
  });

  const grouped = { 灵宝: filtered.filter(i => i.category === '灵宝'), 诡物: filtered.filter(i => i.category === '诡物'), 物品: filtered.filter(i => i.category === '物品') };

  const totalCount = filtered.length;

  return (
    <main className="h-full overflow-y-auto px-4 md:px-12 py-8 space-y-6 bg-gradient-to-b from-aether-deep/95 via-aether-dark/80 to-aether-dark/60">
      {/* Title */}
      <div className="border-l-4 border-aether-cyan pl-6">
        <span className="font-display text-3xl md:text-4xl font-black tracking-tighter text-white/90">仓库</span>
      </div>

      {/* Toolbar: category filter + search + view toggle */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Category pills */}
        <div className="flex items-center gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-display tracking-wide transition-all ${
                categoryFilter === cat
                  ? 'bg-aether-cyan text-aether-dark font-semibold'
                  : 'text-white/35 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索..."
            className="w-full bg-aether-dark/50 border border-aether-border/20 rounded-full pl-8 pr-7 py-1.5 text-[12px] text-white/60 placeholder:text-white/12 focus:outline-none focus:border-aether-cyan/40 font-display tracking-wide"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50">
              <X size={12} />
            </button>
          )}
        </div>

        <span className="text-[10px] text-white/15 font-mono ml-auto">{totalCount} 件</span>

        {/* View toggle */}
        <div className="flex items-center border border-aether-border/20 rounded overflow-hidden">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-aether-cyan/20 text-aether-cyan' : 'text-white/25 hover:text-white/45'}`}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-aether-cyan/20 text-aether-cyan' : 'text-white/25 hover:text-white/45'}`}>
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {(categoryFilter === '全部' ? ['灵宝', '诡物', '物品'] as const : [categoryFilter]).map(cat => {
        const catItems = categoryFilter === '全部' ? grouped[cat] : filtered;
        const displayItems = categoryFilter === '全部' ? catItems : filtered;
        if (displayItems.length === 0 && categoryFilter !== '全部') return (
          <div key="empty" className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={36} className="text-white/8 mb-3" />
            <p className="text-white/15 text-sm font-display tracking-wide">无匹配物品</p>
          </div>
        );
        if (categoryFilter === '全部' && catItems.length === 0) return null;

        const itemsToRender = categoryFilter === '全部' ? catItems : displayItems;
        const showHeader = categoryFilter === '全部';

        return (
          <section key={cat} className="space-y-4">
            {showHeader && (
              <div className="flex items-center gap-3">
                {(() => { const I = CatIcon(cat); return <I size={15} className={cat === '灵宝' ? 'text-aether-cyan' : cat === '诡物' ? 'text-aether-purple/60' : 'text-white/35'} />; })()}
                <h2 className="font-display text-sm tracking-[0.15em] uppercase text-white/50">{cat}</h2>
                <span className="text-[10px] text-white/15 font-mono">{catItems.length}</span>
              </div>
            )}

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {itemsToRender.map(item => {
                  const rank = item.data?.等级 || '';
                  const irs = ITEM_RANK_STYLES[rank] || null;
                  const isItem = item.category === '物品';
                  return (
                    <motion.button
                      key={item.name}
                      onClick={() => setSelectedItem({ ...item.data, name: item.name, category: item.category })}
                      whileHover={{ y: -3 }}
                      className={`relative p-5 text-left group transition-colors overflow-hidden clickable ${
                        isItem ? 'glass-panel border border-aether-border/20 hover:border-aether-border/40' :
                        irs ? `border ${irs.card} hover:border-current ${irs.glow}` :
                        'glass-panel border border-aether-border/20'
                      }`}
                    >
                      {irs && (
                        <div className="absolute top-3 right-3">
                          <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>
                            {rank}
                          </span>
                        </div>
                      )}
                      <h3 className={`font-display font-bold text-lg group-hover:text-aether-cyan transition-colors pr-16 truncate ${isItem ? 'text-white/70' : irs?.text || 'text-white/70'}`}>
                        {item.name}
                        <span className="text-[10px] font-mono text-white/25 ml-2">×{item.data?.数量 ?? 1}</span>
                      </h3>
                      <p className="mt-3 text-xs text-white/45 leading-relaxed line-clamp-2 group-hover:text-white/65 transition-colors">{item.data?.描述 || ''}</p>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {itemsToRender.map(item => {
                  const rank = item.data?.等级 || '';
                  const irs = ITEM_RANK_STYLES[rank] || null;
                  const isItem = item.category === '物品';
                  return (
                    <motion.button
                      key={item.name}
                      onClick={() => setSelectedItem({ ...item.data, name: item.name, category: item.category })}
                      className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors clickable ${
                        isItem ? 'border border-aether-border/15 bg-aether-dark/20 hover:bg-aether-dark/30' :
                        irs ? `border ${irs.card} hover:brightness-110` :
                        'border border-aether-border/15 bg-aether-dark/20'
                      }`}
                    >
                      {irs ? (
                        <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none shrink-0 ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>
                          {rank}
                        </span>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-display font-bold text-sm truncate ${isItem ? 'text-white/60' : irs?.text || 'text-white/60'}`}>{item.name}</span>
                          <span className="text-[10px] font-mono text-white/20">×{item.data?.数量 ?? 1}</span>
                        </div>
                        <p className="text-[11px] text-white/30 truncate mt-0.5">{item.data?.描述 || ''}</p>
                      </div>
                      <span className="text-[9px] text-white/15 font-mono shrink-0">{item.category}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-white/10 mb-4" />
          <p className="text-white/20 text-sm font-display tracking-wide">仓库为空</p>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.category === '灵宝' ? '灵宝详情' : selectedItem?.category === '诡物' ? '诡物详情' : '物品详情'}>
        {selectedItem && (() => {
          const rank = selectedItem?.等级 || '';
          const irs = ITEM_RANK_STYLES[rank] || null;
          return (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div><h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedItem.name}</h3><p className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">数量: {selectedItem?.数量 ?? 1}</p></div>
              {irs && <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>{rank}</span>}
            </div>
            <div className="space-y-4">
              {selectedItem?.描述 && <div><h4 className="text-[10px] text-aether-blue uppercase tracking-widest mb-2 font-mono">描述</h4><p className="text-sm text-white/80 leading-relaxed">{selectedItem.描述}</p></div>}
              {selectedItem?.效果 && Object.keys(selectedItem.效果).length > 0 && <div><h4 className="text-[10px] text-aether-green uppercase tracking-widest mb-3 font-mono">效果</h4><div className="space-y-2">{Object.entries(selectedItem.效果 as Record<string, string>).map(([k,v]) => <div key={k} className="p-3 bg-aether-green/[0.04] border border-aether-green/20"><h5 className="text-[11px] font-display font-bold text-aether-green/70 mb-1">{k}</h5><p className="text-[11px] text-white/60 leading-relaxed">{v}</p></div>)}</div></div>}
              {selectedItem?.规则 && Object.keys(selectedItem.规则).length > 0 && <div><h4 className="text-[10px] text-aether-purple uppercase tracking-widest mb-3 font-mono">规则</h4><div className="space-y-2">{Object.entries(selectedItem.规则 as Record<string, string>).map(([k,v]) => <div key={k} className="p-3 bg-aether-purple/[0.04] border border-aether-purple/20"><h5 className="text-[11px] font-display font-bold text-aether-purple/70 mb-1">{k}</h5><p className="text-[11px] text-white/60 leading-relaxed">{v}</p></div>)}</div></div>}
              {selectedItem?.副作用 && Object.keys(selectedItem.副作用).length > 0 && <div><h4 className="text-[10px] text-aether-red uppercase tracking-widest mb-3 font-mono">副作用</h4><div className="space-y-2">{Object.entries(selectedItem.副作用 as Record<string, string>).map(([k,v]) => <div key={k} className="p-3 bg-aether-red/[0.04] border border-aether-red/20"><h5 className="text-[11px] font-display font-bold text-aether-red/70 mb-1">{k}</h5><p className="text-[11px] text-white/60 leading-relaxed">{v}</p></div>)}</div></div>}
            </div>
          </div>
        )})()}
      </Modal>
    </main>
  );
}
