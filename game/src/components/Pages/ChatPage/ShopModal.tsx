/**
 * ShopModal — 柳三娘商店弹窗。
 *
 * 铜绿（teal）色调，贴合赶尸人的阴冷身份。
 * 双层结构：商品网格 → 点击 → 详情子弹窗。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, X } from 'lucide-react';
import AetherModal from '../../shared/AetherModal';
import { getDatabase } from '../../../sillytavern/database';
import {
  getShopItems,
  getPlayerCorpseQi,
  purchaseItem,
  type ShopItem,
} from '../../../sillytavern/shop-engine';

// ========== rank styling ==========

const RANK: Record<string, string> = {
  灭世: 'text-red-400 border-red-500/30 bg-red-500/10',
  绝域: 'text-fuchsia-400 border-fuchsia-400/25 bg-fuchsia-400/8',
  倾国: 'text-violet-400 border-violet-400/25 bg-violet-400/8',
  祸城: 'text-orange-400 border-orange-400/25 bg-orange-400/8',
  凶煞: 'text-amber-400 border-amber-400/20 bg-amber-400/6',
  凝石: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/6',
  聚砂: 'text-sky-400 border-sky-400/20 bg-sky-400/6',
  微末: 'text-slate-400 border-slate-400/15 bg-slate-400/4',
};

const CAT_COLOR: Record<string, string> = {
  灵宝: 'text-cyan-300',
  诡物: 'text-purple-300',
  物品: 'text-white/50',
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
  const [catFilter, setCatFilter] = useState<CatFilter>('全部');
  const [detail, setDetail] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── data ──

  const refresh = useCallback(async () => {
    try {
      const db = getDatabase();
      const chats = await db.chats.toArray();
      const vars = chats[chats.length - 1]?.variables ?? {};
      setItems(getShopItems(vars));
      setCorpseQi(getPlayerCorpseQi(vars));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refresh();
      setDetail(null);
      setFeedback(null);
    }
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [isOpen, refresh]);

  const filtered = useMemo(
    () => (catFilter === '全部' ? items : items.filter((i) => i.分类 === catFilter)),
    [items, catFilter],
  );

  // ── purchase ──

  const handleBuy = useCallback(
    async (item: ShopItem) => {
      if (purchasing) return;
      setPurchasing(true);
      setFeedback(null);
      const r = await purchaseItem(item.名称);
      if (r.success) {
        setFeedback({ ok: true, msg: `已购买「${item.名称}」` });
        onNotify?.('购买成功', 'success');
        setTimeout(() => {
          refresh();
          setDetail(null);
          setFeedback(null);
        }, 500);
      } else {
        setFeedback({ ok: false, msg: r.error ?? '购买失败' });
      }
      setPurchasing(false);
    },
    [purchasing, refresh, onNotify],
  );

  // ── render ──

  return (
    <AetherModal
      isOpen={isOpen}
      onClose={() => {
        if (detail) setDetail(null);
        else onClose();
      }}
      title="柳三娘的铺子"
      maxWidth="640px"
    >
      <div className="flex flex-col h-full max-h-[76vh]">
        {/* ── currency bar ── */}
        <div className="flex items-center justify-between px-6 pt-4 pb-1">
          <div className="flex items-center gap-2 text-[12px] text-white/30 font-display tracking-[0.1em]">
            <Coins size={13} className="text-teal-400/60" strokeWidth={1.5} />
            <span>尸气</span>
            <span className="text-teal-300 font-mono text-[14px] tabular-nums ml-0.5">
              {corpseQi}
            </span>
          </div>
          {feedback && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-[11px] font-display tracking-wide ${
                feedback.ok ? 'text-emerald-400/80' : 'text-red-400/80'
              }`}
            >
              {feedback.msg}
            </motion.span>
          )}
        </div>

        {/* ── category pills ── */}
        <div className="flex gap-1.5 px-6 py-3">
          {(['全部', '灵宝', '诡物', '物品'] as CatFilter[]).map((cat) => {
            const active = catFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setCatFilter(cat);
                  setDetail(null);
                }}
                className={`
                  px-3 py-1.5 rounded-full text-[11px] font-display tracking-[0.05em]
                  transition-all duration-200 cursor-pointer select-none
                  ${
                    active
                      ? 'bg-teal-950/40 border border-teal-500/25 text-teal-300'
                      : 'border border-transparent text-white/25 hover:text-white/45 hover:bg-white/[0.03]'
                  }
                `}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* ── item grid ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-3">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-[13px] text-white/15 font-display tracking-wide">
                暂无商品
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filtered.map((item, i) => {
                const rankCls = RANK[item.等级] ?? RANK.微末;
                const catCls = CAT_COLOR[item.分类] ?? 'text-white/50';
                const active = detail?.名称 === item.名称;
                const canBuy = corpseQi >= item.价格;

                return (
                  <motion.button
                    key={item.名称}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.15), duration: 0.25 }}
                    onClick={() => setDetail(active ? null : item)}
                    className={`
                      relative text-left p-3 rounded-lg border
                      transition-all duration-200 cursor-pointer select-none
                      ${
                        active
                          ? 'border-teal-500/40 bg-teal-950/25 shadow-[0_0_16px_rgba(20,184,166,0.1)]'
                          : 'border-white/[0.06] bg-white/[0.015] hover:border-white/12 hover:bg-white/[0.03]'
                      }
                    `}
                  >
                    {/* top row: rank + category + stock */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-display tracking-wider border ${rankCls}`}>
                        {item.等级}
                      </span>
                      <span className={`text-[9px] font-display tracking-wider ${catCls}`}>
                        {item.分类}
                      </span>
                      <span className="text-[9px] text-white/12 ml-auto">
                        ×{item.库存}
                      </span>
                    </div>

                    {/* name */}
                    <h3 className="text-[13px] text-white/75 font-display tracking-[0.05em] mb-1">
                      {item.名称}
                    </h3>

                    {/* brief desc */}
                    <p className="text-[11px] text-white/30 leading-relaxed line-clamp-2 mb-2.5">
                      {item.描述}
                    </p>

                    {/* price */}
                    <div className="flex items-baseline gap-0.5">
                      <span
                        className={`text-[13px] font-mono tabular-nums tracking-tight ${
                          canBuy ? 'text-teal-300/80' : 'text-red-400/40'
                        }`}
                      >
                        {item.价格}
                      </span>
                      <span className="text-[10px] text-white/20">尸气</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── detail overlay ── */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-10 flex items-end sm:items-center justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDetail(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="
                w-full max-w-[380px] max-h-[70vh] overflow-y-auto
                mx-4 p-5
                bg-[#0a1418] border border-teal-500/20
                rounded-2xl
                shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(20,184,166,0.08)]
              "
            >
              {/* close */}
              <button
                onClick={() => setDetail(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-white/15 hover:text-white/40 transition-colors cursor-pointer"
              >
                <X size={15} strokeWidth={1.5} />
              </button>

              {/* category + rank */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-display tracking-wider border ${RANK[detail.等级] ?? RANK.微末}`}
                >
                  {detail.等级}
                </span>
                <span className={`text-[10px] font-display tracking-wider ${CAT_COLOR[detail.分类] ?? 'text-white/50'}`}>
                  {detail.分类}
                </span>
              </div>

              {/* name */}
              <h2 className="text-[18px] text-white/85 font-display tracking-[0.04em] mb-3">
                {detail.名称}
              </h2>

              {/* description */}
              <p className="text-[13px] text-white/50 leading-relaxed mb-4">
                {detail.描述}
              </p>

              {/* effects */}
              {Object.keys(detail.效果).length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] text-white/20 font-display tracking-[0.12em] uppercase">
                    效果
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(detail.效果).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2 text-[12px]">
                        <span className="text-teal-400/60 font-display shrink-0">{k}</span>
                        <span className="text-white/35">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* rules (诡物) */}
              {detail.规则 && Object.keys(detail.规则).length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] text-purple-300/35 font-display tracking-[0.12em] uppercase">
                    规则
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(detail.规则).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2 text-[12px]">
                        <span className="text-purple-300/50 font-display shrink-0">{k}</span>
                        <span className="text-white/30">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* side effect */}
              {detail.副作用 && (
                <div className="mb-3">
                  <span className="text-[10px] text-red-300/35 font-display tracking-[0.12em] uppercase">
                    副作用
                  </span>
                  <p className="mt-1.5 text-[12px] text-red-300/40 leading-relaxed">
                    {detail.副作用}
                  </p>
                </div>
              )}

              {/* stock */}
              <p className="text-[11px] text-white/15 mb-4">
                剩余 {detail.库存} 件
              </p>

              {/* buy button */}
              <button
                onClick={() => handleBuy(detail)}
                disabled={corpseQi < detail.价格 || purchasing}
                className={`
                  w-full py-2.5 rounded-xl
                  text-[13px] font-display tracking-[0.06em]
                  transition-all duration-200 cursor-pointer select-none
                  ${
                    corpseQi >= detail.价格 && !purchasing
                      ? 'bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 hover:border-teal-400/40 active:scale-[0.98]'
                      : 'bg-white/[0.03] border border-white/[0.06] text-white/15 cursor-not-allowed'
                  }
                `}
              >
                {purchasing
                  ? '交易中...'
                  : corpseQi >= detail.价格
                    ? `购买 · ${detail.价格} 尸气`
                    : `尸气不足（需 ${detail.价格}）`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AetherModal>
  );
}
