/**
 * ShopModal — 柳三娘商店弹窗。
 *
 * 使用 AetherModal 包裹。从 DB 读取最新变量，
 * 展示商品网格、详情面板、购买流程。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coins,
  Diamond,
  Skull,
  Package,
  ShoppingCart,
  AlertTriangle,
  Check,
  Sparkles,
  X,
} from 'lucide-react';
import AetherModal from '../../shared/AetherModal';
import { getDatabase } from '../../../sillytavern/database';
import {
  getShopItems,
  getPlayerCorpseQi,
  purchaseItem,
  type ShopItem,
} from '../../../sillytavern/shop-engine';

// ========== rank & category styling (mirrors WarehousePage) ==========

const RANK_STYLES: Record<string, { text: string; border: string; bg: string; glow: string }> = {
  灭世: {
    text: 'text-red-400',
    border: 'border-red-500/50',
    bg: 'bg-red-500/15',
    glow: 'shadow-[0_0_18px_rgba(239,68,68,0.4)]',
  },
  绝域: {
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-400/40',
    bg: 'bg-fuchsia-400/15',
    glow: 'shadow-[0_0_14px_rgba(217,70,219,0.35)]',
  },
  倾国: {
    text: 'text-violet-400',
    border: 'border-violet-400/35',
    bg: 'bg-violet-400/12',
    glow: 'shadow-[0_0_12px_rgba(167,139,250,0.3)]',
  },
  祸城: {
    text: 'text-orange-400',
    border: 'border-orange-400/35',
    bg: 'bg-orange-400/12',
    glow: 'shadow-[0_0_10px_rgba(251,146,60,0.25)]',
  },
  凶煞: {
    text: 'text-amber-400',
    border: 'border-amber-400/30',
    bg: 'bg-amber-400/10',
    glow: 'shadow-[0_0_8px_rgba(251,191,36,0.2)]',
  },
  凝石: {
    text: 'text-emerald-400',
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-400/10',
    glow: 'shadow-[0_0_8px_rgba(52,211,153,0.2)]',
  },
  聚砂: {
    text: 'text-sky-400',
    border: 'border-sky-400/30',
    bg: 'bg-sky-400/10',
    glow: 'shadow-[0_0_6px_rgba(56,189,248,0.15)]',
  },
  微末: {
    text: 'text-slate-400',
    border: 'border-slate-400/25',
    bg: 'bg-slate-400/8',
    glow: '',
  },
};

const CAT_STYLES: Record<string, { icon: typeof Diamond; label: string; border: string; text: string; accent: string; bg: string }> = {
  灵宝: { icon: Diamond, label: '灵宝', border: 'border-cyan-400/40', text: 'text-cyan-300', accent: 'bg-cyan-400', bg: 'bg-cyan-950/40' },
  诡物: { icon: Skull, label: '诡物', border: 'border-purple-400/40', text: 'text-purple-300', accent: 'bg-purple-400', bg: 'bg-purple-950/30' },
  物品: { icon: Package, label: '物品', border: 'border-white/20', text: 'text-white/60', accent: 'bg-white/40', bg: 'bg-white/[0.06]' },
};

type CatFilter = '全部' | '灵宝' | '诡物' | '物品';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, type: 'success' | 'error') => void;
}

// ========== component ==========

export default function ShopModal({ isOpen, onClose, onNotify }: Props) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [corpseQi, setCorpseQi] = useState(0);
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [catFilter, setCatFilter] = useState<CatFilter>('全部');
  const [purchasing, setPurchasing] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  // Load data from DB whenever modal opens
  const refresh = useCallback(async () => {
    try {
      const db = getDatabase();
      const chats = await db.chats.toArray();
      const chat = chats[chats.length - 1];
      const vars = chat?.variables ?? {};
      setItems(getShopItems(vars));
      setCorpseQi(getPlayerCorpseQi(vars));
    } catch {
      setItems([]);
      setCorpseQi(0);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refresh();
      setSelected(null);
      setFeedback(null);
    }
  }, [isOpen, refresh]);

  // Poll for changes while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [isOpen, refresh]);

  // Filter items
  const filtered = useMemo(
    () => (catFilter === '全部' ? items : items.filter((i) => i.分类 === catFilter)),
    [items, catFilter],
  );

  // Handle purchase
  const handleBuy = useCallback(
    async (item: ShopItem) => {
      if (purchasing) return;
      setPurchasing(true);
      setFeedback(null);

      const result = await purchaseItem(item.名称);

      if (result.success) {
        setFeedback({ msg: `已购买「${item.名称}」`, ok: true });
        onNotify?.('购买成功', 'success');
        // Refresh after brief delay so user sees feedback
        setTimeout(() => {
          refresh();
          setSelected(null);
          setFeedback(null);
        }, 600);
      } else {
        setFeedback({ msg: result.error ?? '购买失败', ok: false });
        onNotify?.(result.error ?? '购买失败', 'error');
      }

      setPurchasing(false);
    },
    [purchasing, refresh, onNotify],
  );

  const canAfford = (item: ShopItem) => corpseQi >= item.价格;

  return (
    <AetherModal
      isOpen={isOpen}
      onClose={onClose}
      title="柳三娘的铺子"
      maxWidth="720px"
      icon={<Sparkles size={18} className="text-amber-400" />}
    >
      <div className="flex flex-col h-full max-h-[78vh]">
        {/* ── Top bar: currency ── */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-amber-300/60 font-display tracking-[0.12em] uppercase">
              持有尸气
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Coins size={14} className="text-amber-400" strokeWidth={1.5} />
              <span className="text-amber-300 font-mono text-[14px] tabular-nums">
                {corpseQi}
              </span>
            </div>
          </div>

          {feedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-display ${
                feedback.ok
                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                  : 'bg-red-500/10 border border-red-500/25 text-red-300'
              }`}
            >
              {feedback.ok ? <Check size={13} /> : <AlertTriangle size={13} />}
              {feedback.msg}
            </motion.div>
          )}
        </div>

        {/* ── Category filter ── */}
        <div className="flex items-center gap-2 px-6 py-3">
          {(['全部', '灵宝', '诡物', '物品'] as CatFilter[]).map((cat) => {
            const active = catFilter === cat;
            const info = CAT_STYLES[cat];
            return (
              <button
                key={cat}
                onClick={() => {
                  setCatFilter(cat);
                  setSelected(null);
                }}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-display tracking-[0.06em]
                  border transition-all duration-200 cursor-pointer select-none
                  ${active
                    ? cat === '全部'
                      ? 'bg-white/10 border-white/25 text-white/80'
                      : `${info.bg} ${info.border} ${info.text}`
                    : 'border-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
                  }
                `}
              >
                {cat !== '全部' && <info.icon size={12} strokeWidth={1.5} />}
                {cat === '全部' ? '全部' : info.label}
              </button>
            );
          })}
        </div>

        {/* ── Item grid ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package size={28} className="text-white/10" strokeWidth={1} />
              <span className="text-[13px] text-white/20 font-display tracking-wide">
                {catFilter === '全部' ? '铺子里暂无商品' : `此分类暂无商品`}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((item, i) => {
                  const rank = RANK_STYLES[item.等级] ?? RANK_STYLES.微末;
                  const cat = CAT_STYLES[item.分类];
                  const isSelected = selected?.名称 === item.名称;
                  const affordable = canAfford(item);

                  return (
                    <motion.button
                      key={item.名称}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(i * 0.04, 0.2), duration: 0.25 }}
                      onClick={() => setSelected(isSelected ? null : item)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        relative text-left p-3.5 rounded-lg border transition-all duration-200 cursor-pointer select-none
                        ${isSelected
                          ? `${rank.border} ${rank.glow} ring-1 ring-amber-500/30`
                          : `border-white/[0.07] hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.04]`
                        }
                      `}
                    >
                      {/* Rank badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-display tracking-wider ${rank.text} ${rank.bg} border ${rank.border}`}
                        >
                          {item.等级}
                        </span>
                        <span className={`text-[10px] font-display tracking-wider ${cat.text}`}>
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-white/15 ml-auto">
                          库存 {item.库存}
                        </span>
                      </div>

                      {/* Name */}
                      <h3 className="text-[14px] text-white/80 font-display tracking-[0.06em] mb-1">
                        {item.名称}
                      </h3>

                      {/* Brief desc */}
                      <p className="text-[11px] text-white/35 leading-relaxed line-clamp-2 mb-2.5">
                        {item.描述}
                      </p>

                      {/* Price */}
                      <div className="flex items-center gap-1">
                        <Coins size={11} className={affordable ? 'text-amber-400/60' : 'text-red-400/40'} />
                        <span
                          className={`text-[12px] font-mono tabular-nums ${
                            affordable ? 'text-amber-300/80' : 'text-red-400/50 line-through'
                          }`}
                        >
                          {item.价格}
                        </span>
                        <span className="text-[10px] text-white/20 ml-0.5">尸气</span>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <motion.div
                          layoutId="shop-selected-dot"
                          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-amber-500/15"
            >
              <div className="px-6 py-4 bg-amber-950/10">
                <div className="flex items-start gap-4">
                  {/* Item icon placeholder */}
                  <div
                    className={`shrink-0 w-12 h-12 rounded-lg border flex items-center justify-center ${
                      (CAT_STYLES[selected.分类]?.border ?? 'border-white/15')
                    } bg-white/[0.03]`}
                  >
                    {(() => {
                      const CatIcon = CAT_STYLES[selected.分类]?.icon ?? Package;
                      return <CatIcon size={22} className={CAT_STYLES[selected.分类]?.text ?? 'text-white/40'} strokeWidth={1.5} />;
                    })()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[15px] text-white/85 font-display tracking-[0.06em]">
                        {selected.名称}
                      </h3>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-display tracking-wider ${
                          (RANK_STYLES[selected.等级] ?? RANK_STYLES.微末).text
                        } ${(RANK_STYLES[selected.等级] ?? RANK_STYLES.微末).bg} border ${
                          (RANK_STYLES[selected.等级] ?? RANK_STYLES.微末).border
                        }`}
                      >
                        {selected.等级}
                      </span>
                    </div>

                    <p className="text-[12px] text-white/55 leading-relaxed mb-3">
                      {selected.描述}
                    </p>

                    {/* Effects */}
                    {Object.keys(selected.效果).length > 0 && (
                      <div className="mb-2.5">
                        <span className="text-[10px] text-white/25 font-display tracking-[0.1em] uppercase">
                          效果
                        </span>
                        <div className="mt-1.5 space-y-1">
                          {Object.entries(selected.效果).map(([k, v]) => (
                            <div
                              key={k}
                              className="flex items-start gap-2 text-[12px]"
                            >
                              <span className="text-amber-400/60 font-display shrink-0">
                                {k}
                              </span>
                              <span className="text-white/40">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rules (诡物 only) */}
                    {selected.规则 && Object.keys(selected.规则).length > 0 && (
                      <div className="mb-2.5">
                        <span className="text-[10px] text-purple-300/40 font-display tracking-[0.1em] uppercase">
                          规则
                        </span>
                        <div className="mt-1.5 space-y-1">
                          {Object.entries(selected.规则).map(([k, v]) => (
                            <div key={k} className="flex items-start gap-2 text-[12px]">
                              <span className="text-purple-300/60 font-display shrink-0">
                                {k}
                              </span>
                              <span className="text-white/35">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Side effect (诡物 only) */}
                    {selected.副作用 && (
                      <div className="mb-2.5">
                        <span className="text-[10px] text-red-300/40 font-display tracking-[0.1em] uppercase">
                          副作用
                        </span>
                        <p className="mt-1 text-[12px] text-red-300/45 leading-relaxed">
                          {selected.副作用}
                        </p>
                      </div>
                    )}

                    {/* Stock */}
                    <p className="text-[11px] text-white/20 mb-3">
                      剩余库存：{selected.库存} 件
                    </p>

                    {/* Purchase button */}
                    <button
                      onClick={() => handleBuy(selected)}
                      disabled={!canAfford(selected) || purchasing}
                      className={`
                        flex items-center gap-2 px-5 py-2 rounded-lg
                        text-[13px] font-display tracking-[0.06em]
                        transition-all duration-200
                        cursor-pointer select-none
                        ${
                          canAfford(selected) && !purchasing
                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/50 active:scale-[0.97]'
                            : 'bg-white/[0.03] border border-white/[0.08] text-white/20 cursor-not-allowed'
                        }
                      `}
                    >
                      {purchasing ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          >
                            <Sparkles size={14} className="text-amber-400/50" />
                          </motion.div>
                          购买中...
                        </>
                      ) : canAfford(selected) ? (
                        <>
                          <ShoppingCart size={14} />
                          购买 · {selected.价格} 尸气
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={14} className="text-red-400/40" />
                          尸气不足（需 {selected.价格}）
                        </>
                      )}
                    </button>
                  </div>

                  {/* Close detail */}
                  <button
                    onClick={() => setSelected(null)}
                    className="shrink-0 p-1 rounded text-white/15 hover:text-white/40 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AetherModal>
  );
}
