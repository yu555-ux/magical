import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Diamond, Skull, Package, Search, X } from 'lucide-react';
import { Modal } from '../Feedback';
import { getDatabase } from '../../sillytavern/database';

type WarehouseItem = { name: string; category: string; data: any };

const ITEM_RANK_STYLES: Record<string, { text: string; border: string; glow: string; bg: string }> = {
  灭世: { text: 'text-red-400',   border: 'border-red-400/50',   glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',   bg: 'bg-red-400/10' },
  绝域: { text: 'text-rose-400',  border: 'border-rose-400/50',  glow: 'shadow-[0_0_14px_rgba(251,113,133,0.4)]', bg: 'bg-rose-400/10' },
  倾国: { text: 'text-pink-400',  border: 'border-pink-400/50',  glow: 'shadow-[0_0_14px_rgba(244,114,182,0.4)]', bg: 'bg-pink-400/10' },
  祸城: { text: 'text-orange-400',border: 'border-orange-400/50',glow: 'shadow-[0_0_13px_rgba(251,146,60,0.4)]', bg: 'bg-orange-400/10' },
  凶煞: { text: 'text-amber-300', border: 'border-amber-400/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',bg: 'bg-amber-400/10' },
  微末: { text: 'text-gray-400',  border: 'border-gray-400/40',  glow: 'shadow-[0_0_8px_rgba(156,163,175,0.2)]',  bg: 'bg-gray-400/10' },
};

export default function WarehousePage() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    const db = getDatabase();
    const refresh = async () => {
      try {
        const chats = await db.chats.toArray();
        const warehouse = chats[chats.length - 1]?.variables?.仓库 ?? {};
        const all: WarehouseItem[] = [];
        for (const cat of ['灵宝', '诡物', '物品']) {
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
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.data?.描述 || '').toLowerCase().includes(q);
  });

  const grouped = { 灵宝: filtered.filter(i => i.category === '灵宝'), 诡物: filtered.filter(i => i.category === '诡物'), 物品: filtered.filter(i => i.category === '物品') };

  const CatIcon = (cat: string) => cat === '灵宝' ? Diamond : cat === '诡物' ? Skull : Package;

  return (
    <main className="h-full overflow-y-auto px-4 md:px-12 py-8 space-y-8 bg-gradient-to-b from-aether-deep/95 via-aether-dark/80 to-aether-dark/60">
      <div className="border-l-4 border-aether-cyan pl-6">
        <span className="font-display text-3xl md:text-4xl font-black tracking-tighter text-white/90">仓库</span>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索物品..."
          className="w-full bg-aether-dark/60 border border-aether-border/30 rounded pl-9 pr-8 py-2.5 text-sm text-white/70 placeholder:text-white/15 focus:outline-none focus:border-aether-cyan/50 font-display tracking-wide"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50">
            <X size={14} />
          </button>
        )}
      </div>

      {(['灵宝', '诡物', '物品'] as const).map(cat => {
        const catItems = grouped[cat];
        if (catItems.length === 0) return null;
        const Icon = CatIcon(cat);
        return (
          <section key={cat} className="space-y-4">
            <div className="flex items-center gap-3">
              <Icon size={16} className={cat === '灵宝' ? 'text-aether-cyan' : cat === '诡物' ? 'text-aether-purple/70' : 'text-white/40'} />
              <h2 className="font-display text-lg tracking-[0.15em] uppercase text-white/60">{cat}</h2>
              <span className="text-[10px] text-white/20 font-mono">{catItems.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {catItems.map(item => {
                const rank = item.data?.等级 || '';
                const irs = ITEM_RANK_STYLES[rank] || null;
                return (
                  <motion.button
                    key={item.name}
                    onClick={() => setSelectedItem({ ...item.data, name: item.name, category: item.category })}
                    whileHover={{ y: -3 }}
                    className="relative p-5 glass-panel text-left group border border-aether-border/30 hover:border-aether-cyan/40 transition-colors overflow-hidden clickable"
                  >
                    {irs && (
                      <div className="absolute top-3 right-3">
                        <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>
                          {rank}
                        </span>
                      </div>
                    )}
                    <h3 className="font-display font-bold text-lg text-white group-hover:text-aether-cyan transition-colors pr-16 truncate">
                      {item.name}
                      <span className="text-[10px] font-mono text-white/25 ml-2">×{item.data?.数量 ?? 1}</span>
                    </h3>
                    <p className="mt-3 text-xs text-white/50 leading-relaxed line-clamp-2">{item.data?.描述 || ''}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-white/10 mb-4" />
          <p className="text-white/20 text-sm font-display tracking-wide">仓库为空</p>
        </div>
      )}

      {/* Item Modal — same as PersonaPage */}
      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.category === '灵宝' ? '灵宝详情' : selectedItem?.category === '诡物' ? '诡物详情' : '物品详情'}>
        {selectedItem && (() => {
          const rank = selectedItem?.等级 || '';
          const irs = ITEM_RANK_STYLES[rank] || null;
          return (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-aether-cyan">{selectedItem.name}</h3>
                <p className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">数量: {selectedItem?.数量 ?? 1}</p>
              </div>
              {irs && <span className={`inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-display border leading-none ${irs.border} ${irs.bg} ${irs.text} ${irs.glow}`}>{rank}</span>}
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
        )})()}
      </Modal>
    </main>
  );
}
