import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Diamond, Skull, Package, Search, X, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { Modal } from '../Feedback';
import { getDatabase } from '../../sillytavern/database';

type ViewMode = 'grid' | 'list';
type CatFilter = '全部' | '灵宝' | '诡物' | '物品';
type WarehouseItem = { name: string; category: string; data: any };

const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  灵宝: { border: 'border-aether-cyan/30 hover:border-aether-cyan/50', bg: 'bg-aether-cyan/[0.03]', text: 'text-aether-cyan' },
  诡物: { border: 'border-aether-purple/30 hover:border-aether-purple/50', bg: 'bg-aether-purple/[0.03]', text: 'text-aether-purple' },
  物品: { border: 'border-aether-gold/20 hover:border-aether-gold/40', bg: 'bg-aether-gold/[0.02]', text: 'text-aether-gold' },
};

const CatIcon = (cat: string) => cat === '灵宝' ? Diamond : cat === '诡物' ? Skull : Package;

export default function WarehousePage() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [categoryFilter, setCategoryFilter] = useState<CatFilter>('全部');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const totalCount = filtered.length;

  const clearSearch = () => { setSearchQuery(''); searchInputRef.current?.focus(); };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-5 overflow-hidden">
      {/* ===== Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
      >
        <div>
          <h2 className="font-display text-lg md:text-xl tracking-[0.2em] text-aether-cyan cyan-glow leading-tight">仓库</h2>
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

          {/* View toggle */}
          <div className="flex items-center gap-0.5 border border-aether-border/20 p-0.5">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-aether-cyan/20 text-aether-cyan' : 'text-white/25 hover:text-white/45'}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-aether-cyan/20 text-aether-cyan' : 'text-white/25 hover:text-white/45'}`}>
              <List size={14} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ===== Content ===== */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={40} className="text-white/10 mb-4" />
            <p className="text-white/20 text-sm font-display tracking-wide">无匹配物品</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(item => {
              const cs = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['物品'];
              return (
                <motion.button
                  key={item.name}
                  onClick={() => setSelectedItem({ ...item.data, name: item.name, category: item.category })}
                  whileHover={{ y: -3 }}
                  className={`relative p-5 glass-panel text-left group transition-colors overflow-hidden clickable border ${cs.border} ${cs.bg}`}
                >
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-[0.04]">
                    {(() => { const I = CatIcon(item.category); return <I size={64} className="absolute -top-2 -right-2" />; })()}
                  </div>
                  <h3 className={`font-display font-bold text-lg group-hover:text-aether-cyan transition-colors pr-4 truncate ${cs.text}`}>
                    {item.name}
                    <span className="text-[10px] font-mono text-white/25 ml-2">×{item.data?.数量 ?? 1}</span>
                  </h3>
                  <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">{item.data?.描述 || ''}</p>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(item => {
              const cs = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['物品'];
              return (
                <motion.button
                  key={item.name}
                  onClick={() => setSelectedItem({ ...item.data, name: item.name, category: item.category })}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors clickable border ${cs.border} ${cs.bg}`}
                >
                  {(() => { const I = CatIcon(item.category); return <I size={16} className="text-white/15 shrink-0" />; })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-display font-bold text-sm truncate ${cs.text}`}>{item.name}</span>
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
      </div>

      {/* ===== Modal ===== */}
      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.category === '灵宝' ? '灵宝详情' : selectedItem?.category === '诡物' ? '诡物详情' : '物品详情'}>
        {selectedItem && (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedItem.name}</h3>
                <p className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">数量: {selectedItem?.数量 ?? 1}</p>
              </div>
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
          </div>
        )}
      </Modal>
    </div>
  );
}
