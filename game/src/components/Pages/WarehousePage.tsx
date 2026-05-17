import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_ITEMS } from '../../mockData';
import {
  Search, X, ChevronLeft, ChevronRight,
  LayoutGrid, List, SlidersHorizontal
} from 'lucide-react';
import { Modal } from '../Feedback';
import { Item } from '../../types';

type ViewMode = 'grid' | 'list';

interface RarityStyle {
  glow: string;
  text: string;
  border: string;
  bg: string;
  hoverBorder: string;
  accent: string;
  label: string;
}

const RARITY_STYLES: Record<Item['rarity'], RarityStyle> = {
  '传世': {
    glow: 'rarity-glow-legendary',
    text: 'rarity-legendary',
    border: 'border-amber-400/50',
    bg: 'bg-amber-400/10',
    hoverBorder: 'hover:border-amber-400',
    accent: 'bg-amber-400',
    label: '传世',
  },
  '罕见': {
    glow: 'rarity-glow-rare',
    text: 'rarity-rare',
    border: 'border-aether-blue/50',
    bg: 'bg-aether-blue/10',
    hoverBorder: 'hover:border-aether-blue',
    accent: 'bg-aether-blue',
    label: '罕见',
  },
  '普通': {
    glow: 'rarity-glow-common',
    text: 'rarity-common',
    border: 'border-gray-400/30',
    bg: 'bg-gray-400/5',
    hoverBorder: 'hover:border-gray-400',
    accent: 'bg-gray-400',
    label: '普通',
  },
  '劣质': {
    glow: 'rarity-glow-poor',
    text: 'rarity-poor',
    border: 'border-stone-500/30',
    bg: 'bg-stone-500/5',
    hoverBorder: 'hover:border-stone-500',
    accent: 'bg-stone-500',
    label: '劣质',
  },
};

const CATEGORIES: Array<'全部' | Item['category']> = ['全部', '武器', '防具', '消耗品', '特殊'];
const ITEMS_PER_PAGE = 8;

function getRarityQuality(rarity: Item['rarity']): string {
  switch (rarity) {
    case '传世': return 'S+';
    case '罕见': return 'A';
    case '普通': return 'B';
    case '劣质': return 'C';
  }
}

function getScrapStars(rarity: Item['rarity']): string {
  switch (rarity) {
    case '传世': return '三颗星';
    case '罕见': return '两颗星';
    case '普通': return '一颗星';
    case '劣质': return '无星';
  }
}

export default function WarehousePage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build a larger pool of items by replicating MOCK_ITEMS
  const allItems = useMemo<Item[]>(() => {
    const pool: Item[] = [];
    const copies = 4;
    for (let c = 0; c < copies; c++) {
      MOCK_ITEMS.forEach((item) => {
        pool.push({ ...item, id: `${item.id}-${c}` });
      });
    }
    return pool;
  }, []);

  // Apply search + category filter
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      if (query && !item.name.toLowerCase().includes(query) && !item.description.toLowerCase().includes(query)) {
        return false;
      }
      if (categoryFilter !== '全部' && item.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [allItems, searchQuery, categoryFilter]);

  // Pagination math
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredItems.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const selectCategory = (cat: string) => {
    setCategoryFilter(cat);
    setFilterOpen(false);
    setCurrentPage(1);
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-5 overflow-hidden">
      {/* ===== Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
      >
        {/* Title */}
        <div>
          <h2 className="font-display text-lg md:text-xl tracking-[0.2em] text-aether-cyan cyan-glow leading-tight">
            奇物收藏
          </h2>
          <p className="text-[9px] font-mono text-aether-blue/60 tracking-tight mt-0.5">
            共 {filteredItems.length} 件 / 第 {safePage} 页
          </p>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[400px] md:justify-end">
          {/* Search */}
          <motion.div
            animate={{ width: searchFocused ? 240 : 180 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative flex-1 md:flex-initial"
          >
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-aether-blue/40 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
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
                  aria-label="清除搜索"
                >
                  <X size={14} />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((p) => !p)}
              className={`p-2 border transition-all clickable press-scale ${
                categoryFilter !== '全部'
                  ? 'border-aether-cyan/60 bg-aether-cyan/10 text-aether-cyan'
                  : 'border-aether-border/30 text-aether-blue hover:border-aether-cyan/40'
              }`}
              aria-label="筛选分类"
            >
              <SlidersHorizontal size={16} />
            </button>
            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-40 glass-panel overflow-hidden z-20"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => selectCategory(cat)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-display tracking-wider transition-all hover:bg-aether-cyan/10 flex items-center gap-2 ${
                        categoryFilter === cat
                          ? 'text-aether-cyan bg-aether-cyan/5'
                          : 'text-white/60'
                      }`}
                    >
                      <span>{cat}</span>
                      {categoryFilter === cat && (
                        <span className="ml-auto text-aether-cyan text-xs">◆</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View toggle */}
          <div className="flex border border-aether-border/20 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-all clickable ${
                viewMode === 'grid'
                  ? 'bg-aether-cyan/15 text-aether-cyan'
                  : 'text-aether-blue/50 hover:text-aether-cyan/70'
              }`}
              aria-label="网格视图"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-all clickable ${
                viewMode === 'list'
                  ? 'bg-aether-cyan/15 text-aether-cyan'
                  : 'text-aether-blue/50 hover:text-aether-cyan/70'
              }`}
              aria-label="列表视图"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ===== Content Area ===== */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {currentItems.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center text-white/30 gap-4"
          >
            <p className="font-display text-sm tracking-widest text-white/40">
未找到匹配物品
            </p>
            <p className="text-[10px] font-mono text-white/20">
              尝试调整搜索条件或筛选分类
            </p>
            {(searchQuery || categoryFilter !== '全部') && (
              <button
                onClick={() => { setSearchQuery(''); setCategoryFilter('全部'); setCurrentPage(1); }}
                className="text-xs text-aether-cyan/60 hover:text-aether-cyan underline underline-offset-4 clickable transition-colors"
              >
                清除所有筛选条件
              </button>
            )}
          </motion.div>
        ) : viewMode === 'grid' ? (
          /* ===== Grid View ===== */
          <motion.div layout className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {currentItems.map((item, idx) => {
                const s = RARITY_STYLES[item.rarity];
                return (
                  <motion.button
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{
                      delay: idx * 0.03,
                      duration: 0.3,
                      layout: { duration: 0.3 },
                    }}
                    onClick={() => setSelectedItem(item)}
                    className={`aspect-square glass-panel border ${s.border} ${s.hoverBorder} ${s.glow} group relative flex flex-col items-center justify-center gap-1.5 p-4 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden clickable`}
                  >
                    {/* Rarity accent top bar */}
                    <div className={`absolute top-0 left-0 right-0 h-[2px] ${s.accent} ${item.rarity === '传世' || item.rarity === '罕见' ? 'opacity-80' : 'opacity-30'}`} />

                    {/* Item name — enlarged */}
                    <h3 className="text-base md:text-lg font-display font-bold tracking-wide text-white/80 group-hover:text-aether-cyan transition-colors text-center leading-tight line-clamp-2 max-w-full px-1">
                      {item.name}
                    </h3>

                    {/* Category */}
                    <span className="text-[10px] font-mono text-white/40 tracking-wide">
                      {item.category}
                    </span>

                    {/* Quantity */}
                    <span className={`text-sm font-display font-bold ${s.text}`}>
                      x{item.quantity}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ===== List View ===== */
          <motion.div layout className="space-y-2">
            <AnimatePresence mode="popLayout">
              {currentItems.map((item, idx) => {
                const s = RARITY_STYLES[item.rarity];
                return (
                  <motion.button
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{
                      delay: idx * 0.03,
                      duration: 0.25,
                      layout: { duration: 0.25 },
                    }}
                    onClick={() => setSelectedItem(item)}
                    className={`w-full glass-panel border ${s.border} ${s.hoverBorder} ${s.glow} group flex items-center gap-4 p-3 transition-all duration-300 hover:-translate-y-0.5 clickable`}
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-display tracking-wider text-white/80 group-hover:text-aether-cyan transition-colors">
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5 truncate leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 shrink-0">
                      <p className="text-xs text-aether-blue font-display tracking-wide">{item.category}</p>
                      <p className="text-sm text-aether-cyan font-mono">x{item.quantity}</p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={16} className="text-white/20 group-hover:text-aether-cyan transition-colors shrink-0" />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ===== Pagination ===== */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-5 py-2"
        >
          {/* Prev */}
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage <= 1}
            className="p-2 border border-aether-border/30 hover:border-aether-cyan/60 text-aether-blue disabled:opacity-20 disabled:cursor-not-allowed transition-all clickable press-scale"
            aria-label="上一页"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Page indicators */}
          <div className="flex items-center gap-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className="flex flex-col items-center gap-1.5 group clickable"
                aria-label={`第 ${page} 页`}
              >
                {/* Diamond */}
                <div
                  className={`w-[10px] h-[10px] rotate-45 border transition-all duration-300 ${
                    safePage === page
                      ? 'bg-aether-cyan border-aether-cyan shadow-[0_0_12px_rgba(0,242,255,0.8)] scale-110'
                      : 'bg-transparent border-aether-border/30 group-hover:border-aether-cyan/60 group-hover:scale-110'
                  }`}
                />
                {/* Page number */}
                <span
                  className={`text-[9px] font-mono transition-colors ${
                    safePage === page ? 'text-aether-cyan' : 'text-white/30 group-hover:text-aether-cyan/60'
                  }`}
                >
                  {page.toString().padStart(2, '0')}
                </span>
              </button>
            ))}
          </div>

          {/* Next */}
          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="p-2 border border-aether-border/30 hover:border-aether-cyan/60 text-aether-blue disabled:opacity-20 disabled:cursor-not-allowed transition-all clickable press-scale"
            aria-label="下一页"
          >
            <ChevronRight size={18} />
          </button>
        </motion.div>
      )}

      {/* ===== Item Detail Modal ===== */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="详细参数"
      >
        {selectedItem && (
          ((s) => (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Name */}
              <div className="flex items-center gap-5">
                <div className="flex-1 min-w-0">
                  <h3 className={`text-xl font-display font-bold tracking-wide ${s.text} leading-tight`}>
                    {selectedItem.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[9px] text-white/30 font-mono tracking-tight">
                      {selectedItem.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="relative p-4 bg-black/40 border border-white/[0.06]">
                <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/30 to-transparent" />
                <p className="text-sm text-white/60 italic leading-relaxed font-sans">
                  &ldquo;{selectedItem.description}&rdquo;
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="稀有度" value={selectedItem.rarity} className={s.text} />
                <StatBox label="持有数量" value={`${selectedItem.quantity} 单位`} className="text-aether-cyan" />
                <StatBox label="分类归档" value={selectedItem.category} className="text-aether-blue" />
                <StatBox label="质量指数" value={getRarityQuality(selectedItem.rarity)} className="text-aether-cyan/70" />
              </div>

              {/* Placeholder stat slots */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-black/30 border border-white/5">
                  <p className="text-[8px] font-mono text-white/30 tracking-wider uppercase mb-2">
                    以太亲和
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-aether-blue to-aether-cyan"
                        style={{
                          width: selectedItem.rarity === '传世' ? '92%' : selectedItem.rarity === '罕见' ? '72%' : selectedItem.rarity === '普通' ? '45%' : '25%',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-aether-cyan/80">
                      {selectedItem.rarity === '传世' ? '92' : selectedItem.rarity === '罕见' ? '72' : selectedItem.rarity === '普通' ? '45' : '25'}%
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-black/30 border border-white/5">
                  <p className="text-[8px] font-mono text-white/30 tracking-wider uppercase mb-2">
                    分解价值
                  </p>
                  <p className="text-sm font-mono text-aether-cyan/60 tracking-wider">
                    {getScrapStars(selectedItem.rarity)}
                  </p>
                </div>
              </div>

              {/* Action button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 border border-aether-cyan/60 text-aether-cyan font-display text-sm tracking-[0.3em] uppercase hover:bg-aether-cyan/15 hover:shadow-[0_0_25px_rgba(0,242,255,0.15)] transition-all"
              >
                部署使用
              </motion.button>
            </motion.div>
          ))(RARITY_STYLES[selectedItem.rarity])
        )}
      </Modal>
    </div>
  );
}

/* ===== Small helper component ===== */
function StatBox({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="p-3 bg-black/30 border border-white/5">
      <p className="text-[8px] font-mono text-white/30 tracking-wider uppercase mb-1">{label}</p>
      <p className={`text-sm font-display tracking-wide ${className ?? 'text-white/70'}`}>{value}</p>
    </div>
  );
}
