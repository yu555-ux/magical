/**
 * ShopModal — 柳三娘铺子。
 *
 * 铜绿主题 + 毛玻璃质感。详情居中浮层，展开时全面板模糊。
 * 好感度折扣实时计算，不新增变量字段。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { getDatabase } from '../../../sillytavern/database';
import {
  getShopItems,
  getPlayerCorpseQi,
  purchaseItem,
  getLiuSanniangFavorability,
  getDiscountRate,
  getDiscountedPrice,
  type ShopItem,
} from '../../../sillytavern/shop-engine';

// ========== rank ==========

const RANK: Record<string, string> = {
  灭世: 'text-red-400 border-red-500/25 bg-red-500/8',
  绝域: 'text-fuchsia-400 border-fuchsia-400/20 bg-fuchsia-400/6',
  倾国: 'text-violet-400 border-violet-400/20 bg-violet-400/6',
  祸城: 'text-orange-400 border-orange-400/20 bg-orange-400/6',
  凶煞: 'text-amber-400 border-amber-400/15 bg-amber-400/4',
  凝石: 'text-emerald-400 border-emerald-400/15 bg-emerald-400/4',
  聚砂: 'text-sky-400 border-sky-400/15 bg-sky-400/4',
  微末: 'text-slate-400 border-slate-400/12 bg-slate-400/3',
};

const CAT_TEXT: Record<string, string> = {
  灵宝: 'text-cyan-300',
  诡物: 'text-purple-300',
  物品: 'text-white/45',
};

type CatFilter = '全部' | '灵宝' | '诡物' | '物品';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, type: 'success' | 'error') => void;
}

/** 生成折扣标签文案 */
function discountLabel(rate: number): string {
  if (rate >= 1) return '免费';
  if (rate >= 0.8) return '2折';
  if (rate >= 0.6) return '4折';
  if (rate >= 0.4) return '6折';
  if (rate >= 0.2) return '8折';
  if (rate >= 0.1) return '9折';
  return '';
}

// ========== component ==========

export default function ShopModal({ isOpen, onClose, onNotify }: Props) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [corpseQi, setCorpseQi] = useState(0);
  const [favorability, setFavorability] = useState(0);
  const [rejected, setRejected] = useState(false);
  const [discountRate, setDiscountRate] = useState(0);
  const [filter, setFilter] = useState<CatFilter>('全部');
  const [detail, setDetail] = useState<ShopItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const db = getDatabase();
      const chats = await db.chats.toArray();
      const vars = chats[chats.length - 1]?.variables ?? {};
      setItems(getShopItems(vars));
      setCorpseQi(getPlayerCorpseQi(vars));
      const f = getLiuSanniangFavorability(vars);
      setFavorability(f);
      const dr = getDiscountRate(f);
      setRejected(dr.rejected);
      setDiscountRate(dr.rate);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isOpen) { refresh(); setDetail(null); setMsg(null); }
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [isOpen, refresh]);

  const filtered = useMemo(
    () => filter === '全部' ? items : items.filter(i => i.分类 === filter),
    [items, filter],
  );

  const label = discountLabel(discountRate);

  const [qty, setQty] = useState(1);
  useEffect(() => { setQty(1); }, [detail?.名称]);

  const buy = useCallback(async (item: ShopItem, quantity: number) => {
    if (buying) return;
    setBuying(true);
    setMsg(null);
    const r = await purchaseItem(item.名称, quantity);
    setMsg({ ok: r.success, text: r.success ? `已购买「${item.名称}」${quantity > 1 ? `×${quantity}` : ''}` : (r.error ?? '失败') });
    if (r.success) onNotify?.('购买成功', 'success');
    setTimeout(async () => { await refresh(); setDetail(null); setMsg(null); }, 500);
    setBuying(false);
  }, [buying, refresh, onNotify]);

  // ── render ──

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => { if (detail) setDetail(null); else onClose(); }}
            className="absolute inset-0 bg-aether-dark/92 backdrop-blur-xl"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.94, filter: 'blur(4px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="
              relative w-[880px] max-w-[95vw] h-[680px] max-h-[88vh]
              flex flex-col
              rounded-2xl overflow-hidden
            "
            style={{
              background: 'linear-gradient(180deg, rgba(15,40,36,0.82) 0%, rgba(10,26,22,0.88) 100%)',
              backdropFilter: 'blur(24px) saturate(120%)',
              WebkitBackdropFilter: 'blur(24px) saturate(120%)',
              boxShadow: `
                0 0 0 1px rgba(20,184,166,0.12),
                0 0 40px rgba(20,184,166,0.06),
                0 0 80px rgba(20,184,166,0.03),
                0 16px 48px rgba(0,0,0,0.45),
                inset 0 1px 0 rgba(255,255,255,0.04)
              `,
            }}
          >
            {/* Glass edge highlight */}
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-teal-300/15 to-transparent" />

            {/* header */}
            <div className="relative shrink-0 flex items-center justify-between px-6 py-3.5">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400/50 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400/70" />
                </span>
                <h2 className="text-[13px] text-teal-200/75 font-display tracking-[0.14em] uppercase">
                  柳三娘的铺子
                </h2>
                {/* 好感 & 折扣标签 */}
                <span className="text-[10px] text-white/15 font-display tracking-wider">
                  好感 {favorability}
                </span>
                {label && (
                  <span className={`
                    text-[10px] px-1.5 py-0.5 rounded font-display tracking-wider border
                    ${discountRate >= 1
                      ? 'text-amber-300 border-amber-400/25 bg-amber-400/8'
                      : 'text-emerald-300 border-emerald-400/20 bg-emerald-400/6'}
                  `}>
                    {label}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-white/15 hover:text-white/40 transition-colors cursor-pointer"
              >
                <X size={17} strokeWidth={1.5} />
              </button>
            </div>

            {/* separator */}
            <div className="shrink-0 h-px mx-4 bg-gradient-to-r from-transparent via-teal-500/10 to-transparent" />

            {/* body */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* currency + filter */}
              <div className="shrink-0 flex items-center justify-between px-6 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/20 font-display tracking-[0.12em] uppercase">
                    尸气
                  </span>
                  <span className="text-aether-red font-mono text-[16px] tabular-nums tracking-tight">
                    {corpseQi}
                  </span>
                </div>
                {msg && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-[11px] font-display tracking-wide ${msg.ok ? 'text-emerald-400/80' : 'text-red-400/80'}`}
                  >
                    {msg.text}
                  </motion.span>
                )}
              </div>

              <div className="shrink-0 flex gap-1.5 px-6 py-2.5">
                {(['全部', '灵宝', '诡物', '物品'] as CatFilter[]).map(cat => {
                  const on = filter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => { setFilter(cat); setDetail(null); }}
                      className={`
                        px-3 py-1.5 rounded-full text-[11px] font-display tracking-[0.05em]
                        transition-all duration-200 cursor-pointer select-none
                        ${on
                          ? 'bg-teal-950/50 border border-teal-500/30 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.08)]'
                          : 'border border-white/[0.06] text-white/25 hover:text-white/45 hover:bg-white/[0.04] hover:border-white/[0.10]'
                        }
                      `}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* grid */}
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                {rejected ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <span className="text-[13px] text-red-300/40 font-display tracking-wide">
                      柳三娘对你心存芥蒂，不愿与你交易
                    </span>
                    <span className="text-[11px] text-white/10 font-display">
                      好感值 {favorability}（需 ≥ 0）
                    </span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[13px] text-white/10 font-display tracking-wide">暂无商品</span>
                  </div>
                ) : (
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
                    {filtered.map((item, i) => {
                      const rank = RANK[item.等级] ?? RANK.微末;
                      const cat = CAT_TEXT[item.分类] ?? 'text-white/45';
                      const active = detail?.名称 === item.名称;
                      const discounted = getDiscountedPrice(item.价格, favorability);
                      const can = corpseQi >= discounted;
                      const hasDiscount = discounted !== item.价格;

                      return (
                        <motion.button
                          key={item.名称}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.12), duration: 0.22 }}
                          onClick={() => setDetail(active ? null : item)}
                          className={`
                            text-left p-3.5 rounded-xl border
                            transition-all duration-200 cursor-pointer select-none
                            ${active
                              ? 'border-teal-400/30 bg-teal-950/35 shadow-[0_0_20px_rgba(20,184,166,0.12)]'
                              : 'border-white/[0.10] bg-white/[0.025] hover:border-white/[0.18] hover:bg-white/[0.05] hover:shadow-[0_2px_12px_rgba(0,0,0,0.2)]'
                            }
                          `}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-display tracking-wider border ${rank}`}>{item.等级}</span>
                            <span className={`text-[9px] font-display tracking-wider ${cat}`}>{item.分类}</span>
                            <span className="text-[9px] text-white/10 ml-auto">×{item.库存}</span>
                          </div>
                          <h3 className="text-[14px] text-white/80 font-display tracking-[0.04em] mb-1.5">{item.名称}</h3>
                          <p className="text-[11px] text-white/30 leading-relaxed line-clamp-2 mb-3">{item.描述}</p>
                          <div className="flex items-baseline gap-1.5">
                            {hasDiscount ? (
                              <>
                                <span className="text-[12px] text-white/15 line-through font-mono tabular-nums tracking-tight">
                                  {item.价格}
                                </span>
                                <span className={`text-[14px] font-mono tabular-nums tracking-tight ${can ? 'text-teal-300/80' : 'text-red-400/35'}`}>
                                  {discounted}
                                </span>
                              </>
                            ) : (
                              <span className={`text-[14px] font-mono tabular-nums tracking-tight ${can ? 'text-teal-300/80' : 'text-red-400/35'}`}>
                                {item.价格}
                              </span>
                            )}
                            <span className="text-[10px] text-white/15">尸气</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* glass bottom edge */}
            <div className="shrink-0 h-px mx-4 bg-gradient-to-r from-transparent via-teal-500/6 to-transparent" />

            {/* ══════ detail overlay — covers entire panel incl header ══════ */}
            <AnimatePresence>
              {detail && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 z-20 flex items-center justify-center"
                  style={{
                    background: 'rgba(7,20,17,0.75)',
                    backdropFilter: 'blur(16px) saturate(80%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(80%)',
                  }}
                  onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.93, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: 20 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="
                      w-[400px] max-w-[90%] max-h-[70vh] overflow-y-auto
                      rounded-2xl p-5 relative
                    "
                    style={{
                      background: 'linear-gradient(180deg, rgba(18,42,38,0.92) 0%, rgba(14,32,28,0.94) 100%)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      boxShadow: `
                        0 0 0 1px rgba(20,184,166,0.18),
                        0 0 48px rgba(20,184,166,0.12),
                        0 20px 48px rgba(0,0,0,0.5)
                      `,
                    }}
                  >
                    {/* close */}
                    <button
                      onClick={() => setDetail(null)}
                      className="absolute top-3 right-3 p-1.5 rounded-full text-white/15 hover:text-white/40 transition-colors cursor-pointer z-10"
                    >
                      <X size={15} strokeWidth={1.5} />
                    </button>

                    {/* rank + category */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-display tracking-wider border ${RANK[detail.等级] ?? RANK.微末}`}>
                        {detail.等级}
                      </span>
                      <span className={`text-[10px] font-display tracking-wider ${CAT_TEXT[detail.分类] ?? 'text-white/45'}`}>
                        {detail.分类}
                      </span>
                    </div>

                    <h2 className="text-[20px] text-white/85 font-display tracking-[0.03em] mb-4">{detail.名称}</h2>
                    <p className="text-[13px] text-white/50 leading-relaxed mb-5">{detail.描述}</p>

                    {Object.keys(detail.效果).length > 0 && (
                      <div className="mb-4">
                        <span className="text-[10px] text-white/20 font-display tracking-[0.12em] uppercase">效果</span>
                        <div className="mt-2 space-y-2">
                          {Object.entries(detail.效果).map(([k, v]) => (
                            <div key={k} className="text-[12px]">
                              <span className="text-teal-400/60 font-display">{k}</span>
                              <span className="text-white/35 ml-2">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.规则 && Object.keys(detail.规则).length > 0 && (
                      <div className="mb-4">
                        <span className="text-[10px] text-purple-300/35 font-display tracking-[0.12em] uppercase">规则</span>
                        <div className="mt-2 space-y-2">
                          {Object.entries(detail.规则).map(([k, v]) => (
                            <div key={k} className="text-[12px]">
                              <span className="text-purple-300/50 font-display">{k}</span>
                              <span className="text-white/30 ml-2">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.副作用 && (
                      <div className="mb-4">
                        <span className="text-[10px] text-red-300/35 font-display tracking-[0.12em] uppercase">副作用</span>
                        <p className="mt-1.5 text-[12px] text-red-300/40 leading-relaxed">{detail.副作用}</p>
                      </div>
                    )}

                    {/* ══════ stock + quantity ══════ */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] text-white/15">剩余 {detail.库存} 件</span>
                      {detail.库存 > 1 && (
                        <div className="flex items-center gap-0">
                          <button
                            onClick={() => setQty(q => Math.max(1, q - 1))}
                            className="w-7 h-7 rounded-l-lg border border-white/[0.10] bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center justify-center text-[14px] font-mono"
                          >
                            −
                          </button>
                          <span className="w-9 h-7 border-y border-white/[0.10] bg-transparent text-white/70 font-mono text-[13px] flex items-center justify-center tabular-nums">
                            {qty}
                          </span>
                          <button
                            onClick={() => setQty(q => Math.min(detail.库存, q + 1))}
                            className="w-7 h-7 rounded-r-lg border border-white/[0.10] bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center justify-center text-[14px] font-mono"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ══════ price & buy ══════ */}
                    {(() => {
                      const unitPrice = getDiscountedPrice(detail.价格, favorability);
                      const totalPrice = unitPrice * qty;
                      const hasD = unitPrice !== detail.价格;
                      const isFree = unitPrice === 0;
                      const can = corpseQi >= totalPrice;

                      return (
                        <>
                          {/* Price display */}
                          <div className="flex items-baseline gap-2 mb-4">
                            {hasD ? (
                              <>
                                <span className="text-[14px] text-white/15 line-through font-mono tabular-nums tracking-tight">
                                  {detail.价格}{qty > 1 && `×${qty}`}
                                </span>
                                <span className="text-[22px] text-teal-300 font-mono tabular-nums tracking-tight">
                                  {totalPrice}
                                </span>
                              </>
                            ) : (
                              <span className="text-[22px] text-teal-300 font-mono tabular-nums tracking-tight">
                                {totalPrice}
                              </span>
                            )}
                            {!isFree && <span className="text-[12px] text-white/15">尸气</span>}
                            {hasD && (
                              <span className="text-[11px] text-emerald-400/60 font-display tracking-wider">
                                {discountLabel(discountRate)}
                              </span>
                            )}
                            {qty > 1 && (
                              <span className="text-[10px] text-white/20 font-display">
                                ({unitPrice}×{qty})
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => buy(detail, qty)}
                            disabled={!can || buying}
                            className={`
                              w-full py-3 rounded-xl
                              text-[13px] font-display tracking-[0.06em]
                              transition-all duration-200 cursor-pointer select-none
                              ${can && !buying
                                ? 'bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 hover:border-teal-400/40 active:scale-[0.98]'
                                : 'bg-white/[0.03] border border-white/[0.06] text-white/15 cursor-not-allowed'
                              }
                            `}
                          >
                            {buying
                              ? '交易中...'
                              : !can
                                ? `尸气不足（需 ${totalPrice}）`
                                : isFree
                                  ? `接受好意${qty > 1 ? ` ×${qty}` : ''}`
                                  : `购买${qty > 1 ? ` ${qty}件` : ''} · ${totalPrice} 尸气`}
                          </button>
                        </>
                      );
                    })()}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
