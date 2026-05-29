/**
 * ShopModal — 柳三娘铺子。
 *
 * 铜绿色调，大面积主弹窗 + 右侧固定详情面板。
 * 贴合赶尸人阴冷、古老的店铺氛围。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import AetherModal from '../../shared/AetherModal';
import { getDatabase } from '../../../sillytavern/database';
import {
  getShopItems,
  getPlayerCorpseQi,
  purchaseItem,
  type ShopItem,
} from '../../../sillytavern/shop-engine';

// ========== rank badge ==========

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

// ========== component ==========

export default function ShopModal({ isOpen, onClose, onNotify }: Props) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [corpseQi, setCorpseQi] = useState(0);
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

  const handleBuy = useCallback(async (item: ShopItem) => {
    if (buying) return;
    setBuying(true);
    setMsg(null);
    const r = await purchaseItem(item.名称);
    setMsg({ ok: r.success, text: r.success ? `已购买「${item.名称}」` : (r.error ?? '失败') });
    if (r.success) onNotify?.('购买成功', 'success');
    setTimeout(async () => {
      await refresh();
      setDetail(null);
      setMsg(null);
    }, 500);
    setBuying(false);
  }, [buying, refresh, onNotify]);

  // ---- render ----

  return (
    <AetherModal
      isOpen={isOpen}
      onClose={() => { if (detail) setDetail(null); else onClose(); }}
      title="柳三娘的铺子"
      maxWidth="880px"
    >
      <div className="flex h-[72vh] relative overflow-hidden">
        {/* ══════ left: grid ══════ */}
        <motion.div
          animate={{ width: detail ? 'calc(100% - 340px)' : '100%' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col min-w-0 shrink-0"
        >
          {/* top bar */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/25 font-display tracking-[0.1em] uppercase">
                尸气
              </span>
              <span className="text-teal-300 font-mono text-[16px] tabular-nums">
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

          {/* filter pills */}
          <div className="flex gap-1.5 px-6 py-2.5">
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

          {/* item grid — 3 columns when wide */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-[13px] text-white/12 font-display tracking-wide">暂无商品</span>
              </div>
            ) : (
              <div className="grid gap-2.5"
                style={{ gridTemplateColumns: detail ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(180px,1fr))' }}
              >
                {filtered.map((item, i) => {
                  const rank = RANK[item.等级] ?? RANK.微末;
                  const cat = CAT_TEXT[item.分类] ?? 'text-white/45';
                  const active = detail?.名称 === item.名称;
                  const can = corpseQi >= item.价格;

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
                          ? 'border-teal-500/35 bg-teal-950/30 shadow-[0_0_20px_rgba(20,184,166,0.08)]'
                          : 'border-white/[0.05] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.025]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-display tracking-wider border ${rank}`}>
                          {item.等级}
                        </span>
                        <span className={`text-[9px] font-display tracking-wider ${cat}`}>
                          {item.分类}
                        </span>
                        <span className="text-[9px] text-white/10 ml-auto">
                          ×{item.库存}
                        </span>
                      </div>
                      <h3 className="text-[14px] text-white/75 font-display tracking-[0.04em] mb-1.5">
                        {item.名称}
                      </h3>
                      <p className="text-[11px] text-white/28 leading-relaxed line-clamp-2 mb-3">
                        {item.描述}
                      </p>
                      <span className={`text-[14px] font-mono tabular-nums tracking-tight ${can ? 'text-teal-300/80' : 'text-red-400/35'}`}>
                        {item.价格}
                      </span>
                      <span className="text-[10px] text-white/15 ml-0.5">尸气</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ══════ right: detail panel ══════ */}
        <AnimatePresence>
          {detail && (
            <motion.div
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 bottom-0 w-[340px] shrink-0
                border-l border-teal-500/15
                bg-[#061214] overflow-y-auto
                flex flex-col"
            >
              {/* close */}
              <button
                onClick={() => setDetail(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-white/12 hover:text-white/35 transition-colors cursor-pointer z-10"
              >
                <X size={15} strokeWidth={1.5} />
              </button>

              <div className="flex-1 px-5 py-5">
                {/* rank + category */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-display tracking-wider border ${RANK[detail.等级] ?? RANK.微末}`}>
                    {detail.等级}
                  </span>
                  <span className={`text-[10px] font-display tracking-wider ${CAT_TEXT[detail.分类] ?? 'text-white/45'}`}>
                    {detail.分类}
                  </span>
                </div>

                {/* name */}
                <h2 className="text-[20px] text-white/85 font-display tracking-[0.03em] mb-4">
                  {detail.名称}
                </h2>

                {/* desc */}
                <p className="text-[13px] text-white/45 leading-relaxed mb-5">
                  {detail.描述}
                </p>

                {/* effects */}
                {Object.keys(detail.效果).length > 0 && (
                  <div className="mb-4">
                    <span className="text-[10px] text-white/18 font-display tracking-[0.12em] uppercase">
                      效果
                    </span>
                    <div className="mt-2 space-y-2">
                      {Object.entries(detail.效果).map(([k, v]) => (
                        <div key={k} className="text-[12px]">
                          <span className="text-teal-400/55 font-display">{k}</span>
                          <span className="text-white/30 ml-2">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* rules */}
                {detail.规则 && Object.keys(detail.规则).length > 0 && (
                  <div className="mb-4">
                    <span className="text-[10px] text-purple-300/30 font-display tracking-[0.12em] uppercase">
                      规则
                    </span>
                    <div className="mt-2 space-y-2">
                      {Object.entries(detail.规则).map(([k, v]) => (
                        <div key={k} className="text-[12px]">
                          <span className="text-purple-300/45 font-display">{k}</span>
                          <span className="text-white/25 ml-2">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* side effect */}
                {detail.副作用 && (
                  <div className="mb-4">
                    <span className="text-[10px] text-red-300/30 font-display tracking-[0.12em] uppercase">
                      副作用
                    </span>
                    <p className="mt-1.5 text-[12px] text-red-300/35 leading-relaxed">
                      {detail.副作用}
                    </p>
                  </div>
                )}

                {/* stock */}
                <p className="text-[11px] text-white/12 mb-5">
                  剩余 {detail.库存} 件
                </p>
              </div>

              {/* buy button — fixed at bottom */}
              <div className="shrink-0 px-5 pb-5">
                <button
                  onClick={() => handleBuy(detail)}
                  disabled={corpseQi < detail.价格 || buying}
                  className={`
                    w-full py-3 rounded-xl
                    text-[13px] font-display tracking-[0.06em]
                    transition-all duration-200 cursor-pointer select-none
                    ${corpseQi >= detail.价格 && !buying
                      ? 'bg-teal-500/12 border border-teal-500/25 text-teal-300 hover:bg-teal-500/22 hover:border-teal-400/35 active:scale-[0.98]'
                      : 'bg-white/[0.02] border border-white/[0.05] text-white/12 cursor-not-allowed'
                    }
                  `}
                >
                  {buying
                    ? '交易中...'
                    : corpseQi >= detail.价格
                      ? `购买 · ${detail.价格} 尸气`
                      : `尸气不足（需 ${detail.价格}）`}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AetherModal>
  );
}
