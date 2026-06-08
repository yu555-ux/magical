/**
 * 缓存监控弹窗 — 概览 + 提示词对比
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Zap, GitCompare } from 'lucide-react';
import AetherModal from '../shared/AetherModal';
import type { CacheUsageRecord } from '../../sillytavern/types';
import { getUsageHistory, clearUsageHistory, getFullPrompt } from '../../sillytavern/cache-monitor';
import { gameBus } from '../../sillytavern/event-bus';

type TabId = 'overview' | 'diff';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CacheMonitorModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('overview');
  const [history, setHistory] = useState<CacheUsageRecord[]>([]);
  const [diffA, setDiffA] = useState<string | null>(null);
  const [diffB, setDiffB] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setHistory(await getUsageHistory(100));
  }, []);

  useEffect(() => {
    if (isOpen) {
      refresh();
      // 打开弹窗时订阅新数据
      return gameBus.on('api_usage', async ({ record }) => {
        setHistory(prev => [record, ...prev].slice(0, 100));
      });
    }
  }, [isOpen, refresh]);

  const handleClear = async () => {
    await clearUsageHistory();
    setHistory([]);
    setDiffA(null);
    setDiffB(null);
  };

  const totalCost = history.reduce((s, r) => s + r.cost, 0);
  const avgHitRate = history.length > 0
    ? Math.round(history.reduce((s, r) => s + r.hitRate, 0) / history.length)
    : 0;

  const avgColor = avgHitRate >= 60 ? 'text-aether-green' : avgHitRate >= 30 ? 'text-aether-gold' : 'text-aether-red';

  return (
    <AetherModal isOpen={isOpen} onClose={onClose} title="缓存监控" maxWidth="820px" zIndex={160}
      icon={<div className="relative shrink-0"><div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" /><div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" /></div>}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tab bar */}
        <div className="shrink-0 flex gap-1 px-4 py-2.5 border-b border-aether-border/20 bg-aether-dark/40">
          {([
            { id: 'overview' as TabId, label: '概览', icon: Zap },
            { id: 'diff' as TabId, label: '提示词对比', icon: GitCompare },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs tracking-wider transition-all font-display whitespace-nowrap ${
                tab === id ? 'bg-aether-cyan text-aether-dark font-semibold' : 'text-white/40 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* Summary bar (overview only) */}
        {tab === 'overview' && (
          <div className="shrink-0 flex items-center justify-between px-5 py-2 bg-aether-dark/60 border-b border-aether-border/10 text-[11px] font-mono">
            <span className="text-white/40">{history.length} 次请求</span>
            <span className={avgColor}>均 {avgHitRate}%</span>
            <span className="text-aether-cyan/70">累计 ¥{totalCost.toFixed(4)}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'overview' ? (
            <OverviewTab history={history} onSelectDiff={(id) => { diffA ? setDiffB(id) : setDiffA(id); }} selectedA={diffA} selectedB={diffB} />
          ) : (
            <DiffTab history={history} diffA={diffA} diffB={diffB} setDiffA={setDiffA} setDiffB={setDiffB} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-aether-border/20 bg-aether-dark/40">
          <button onClick={handleClear}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-aether-red transition-colors">
            <Trash2 size={10} /> 清空历史
          </button>
          <span className="text-[9px] text-white/20 font-mono">仅监控第一API</span>
        </div>
      </div>
    </AetherModal>
  );
}

// ── 概览标签页 ──

function OverviewTab({
  history, onSelectDiff, selectedA, selectedB,
}: {
  history: CacheUsageRecord[];
  onSelectDiff: (id: string) => void;
  selectedA: string | null;
  selectedB: string | null;
}) {
  if (history.length === 0) {
    return <div className="text-center py-16 text-white/25 text-xs font-mono">发送消息后开始采集</div>;
  }

  return (
    <div>
      {history.map((r, i) => (
        <CacheEntry key={r.requestId} record={r} isLatest={i === 0}
          onDiff={() => onSelectDiff(r.requestId)}
          isSelected={selectedA === r.requestId || selectedB === r.requestId}
        />
      ))}
    </div>
  );
}

// ── 提示词对比标签页 ──

function DiffTab({
  history, diffA, diffB, setDiffA, setDiffB,
}: {
  history: CacheUsageRecord[];
  diffA: string | null;
  diffB: string | null;
  setDiffA: (id: string | null) => void;
  setDiffB: (id: string | null) => void;
}) {
  const [diffResult, setDiffResult] = useState<Array<{ role: string; oldContent: string; newContent: string; changed: boolean }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!diffA || !diffB) { setDiffResult([]); return; }

    setLoading(true);
    // 异步加载完整提示词并对比
    setTimeout(() => {
      const msgsA = getFullPrompt(diffA);
      const msgsB = getFullPrompt(diffB);
      if (!msgsA || !msgsB) { setDiffResult([]); setLoading(false); return; }

      const maxLen = Math.max(msgsA.length, msgsB.length);
      const result: Array<{ role: string; oldContent: string; newContent: string; changed: boolean }> = [];
      for (let i = 0; i < maxLen; i++) {
        const a = msgsA[i];
        const b = msgsB[i];
        result.push({
          role: b?.role ?? a?.role ?? '?',
          oldContent: a?.content ?? '(无)',
          newContent: b?.content ?? '(无)',
          changed: a?.content !== b?.content,
        });
      }
      setDiffResult(result);
      setLoading(false);
    }, 0);
  }, [diffA, diffB]);

  const recordA = history.find(r => r.requestId === diffA) ?? null;
  const recordB = history.find(r => r.requestId === diffB) ?? null;

  return (
    <div className="p-4 space-y-4">
      {/* 选择器 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-white/30 font-display tracking-wider mb-1.5">对比 A（旧请求）</label>
          <select value={diffA ?? ''} onChange={e => setDiffA(e.target.value || null)}
            className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60 transition-all">
            <option value="">-- 选择请求 --</option>
            {history.map(r => (
              <option key={r.requestId} value={r.requestId}>
                {new Date(r.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {r.hitRate}% · {r.userInput?.slice(0, 30) ?? ''}
              </option>
            ))}
          </select>
          {recordA && <div className="text-[9px] text-white/20 mt-1 font-mono">中:{recordA.hit} 未:{recordA.miss} · {recordA.totalChars?.toLocaleString()}字</div>}
        </div>
        <div>
          <label className="block text-[10px] text-white/30 font-display tracking-wider mb-1.5">对比 B（新请求）</label>
          <select value={diffB ?? ''} onChange={e => setDiffB(e.target.value || null)}
            className="w-full bg-aether-dark/60 border border-aether-border/30 rounded px-3 py-2 text-xs text-white/70 font-mono focus:outline-none focus:border-aether-cyan/60 transition-all">
            <option value="">-- 选择请求 --</option>
            {history.map(r => (
              <option key={r.requestId} value={r.requestId}>
                {new Date(r.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {r.hitRate}% · {r.userInput?.slice(0, 30) ?? ''}
              </option>
            ))}
          </select>
          {recordB && <div className="text-[9px] text-white/20 mt-1 font-mono">中:{recordB.hit} 未:{recordB.miss} · {recordB.totalChars?.toLocaleString()}字</div>}
        </div>
      </div>

      {/* Diff 结果 */}
      {loading && (
        <div className="text-center py-10 text-white/30 text-xs font-mono">加载中...</div>
      )}

      {!loading && diffA && diffB && diffResult.length === 0 && (
        <div className="text-center py-10 text-white/25 text-xs font-mono">
          未能加载完整提示词数据。完整提示词仅保留最近 100 次请求，可能已被清除。
        </div>
      )}

      {!loading && diffResult.length > 0 && (
        <div className="space-y-1 max-h-[45vh] overflow-y-auto">
          <div className="text-[10px] text-white/25 font-mono mb-2">
            {diffResult.filter(d => d.changed).length} / {diffResult.length} 条消息有差异
          </div>
          {diffResult.map((d, i) => (
            <DiffMessage key={i} index={i} {...d} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Diff 消息行 ──

function DiffMessage({ index, role, oldContent, newContent, changed }: {
  index: number; role: string; oldContent: string; newContent: string; changed: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!changed) {
    return (
      <div className="px-3 py-1.5 text-[10px] text-white/20 font-mono border-l-2 border-transparent">
        #{index} {role} — 内容一致 ({oldContent.length.toLocaleString()} 字)
      </div>
    );
  }

  // 计算差异摘要
  const diffChars = Math.abs(newContent.length - oldContent.length);
  const diffSign = newContent.length > oldContent.length ? '+' : newContent.length < oldContent.length ? '-' : '';

  return (
    <div className="border border-aether-border/15 rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-aether-gold/[0.06] hover:bg-aether-gold/[0.12] transition-colors text-left">
        <span className="text-[11px] font-mono">
          <span className="text-aether-gold/70">#{index}</span>
          <span className="text-white/50 ml-2">{role}</span>
        </span>
        <span className="text-[10px] font-mono text-aether-gold/50">
          差异 {diffSign}{diffChars.toLocaleString()} 字
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-aether-border/10">
              <div className="p-3">
                <div className="text-[9px] text-aether-red/40 font-display tracking-wider mb-1">旧 ({oldContent.length.toLocaleString()} 字)</div>
                <pre className="text-[10px] text-white/50 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-[200px] overflow-y-auto">
                  {oldContent.slice(0, 5000)}{oldContent.length > 5000 ? '\n...(截断)' : ''}
                </pre>
              </div>
              <div className="p-3">
                <div className="text-[9px] text-aether-green/40 font-display tracking-wider mb-1">新 ({newContent.length.toLocaleString()} 字)</div>
                <pre className="text-[10px] text-white/50 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-[200px] overflow-y-auto">
                  {newContent.slice(0, 5000)}{newContent.length > 5000 ? '\n...(截断)' : ''}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 单条缓存记录 ──

function CacheEntry({ record, isLatest, onDiff, isSelected }: {
  record: CacheUsageRecord;
  isLatest: boolean;
  onDiff: () => void;
  isSelected: boolean;
}) {
  const { hit, miss, total, hitRate, cost, timestamp, userInput } = record;
  const timeStr = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const barColor = hitRate >= 60
    ? 'from-aether-green to-aether-cyan'
    : hitRate >= 30
      ? 'from-aether-gold to-aether-green'
      : 'from-aether-red to-aether-gold';

  return (
    <div className={`px-4 py-2.5 border-b border-aether-border/10 hover:bg-white/[0.02] transition-colors ${isLatest ? 'bg-aether-cyan/[0.015]' : ''} ${isSelected ? 'ring-1 ring-aether-cyan/30' : ''}`}>
      {/* Hit rate bar + actions */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(hitRate, 2)}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span className={`text-[11px] font-mono font-bold w-8 text-right ${
          hitRate >= 60 ? 'text-aether-green' : hitRate >= 30 ? 'text-aether-gold' : 'text-aether-red'
        }`}>{hitRate}%</span>
        {/* Diff select button */}
        <button onClick={(e) => { e.stopPropagation(); onDiff(); }}
          className="text-[9px] text-white/20 hover:text-aether-cyan/70 transition-colors font-mono px-1"
          title="选择用于提示词对比">
          <GitCompare size={11} />
        </button>
      </div>

      {/* Token details */}
      <div className="flex items-center justify-between text-[9px] font-mono">
        <span className="text-white/35">
          <span className="text-aether-green/60">中:{hit.toLocaleString()}</span>
          {' '}
          <span className="text-aether-red/50">未:{miss.toLocaleString()}</span>
          {total > 0 && <span className="text-white/20 ml-1">{total.toLocaleString()}</span>}
        </span>
        <span className="flex items-center gap-2">
          {cost > 0 && <span className="text-aether-cyan/50">¥{cost.toFixed(4)}</span>}
          <span className="text-white/20">{timeStr}</span>
        </span>
      </div>

      {/* User input preview */}
      {userInput && (
        <div className="text-[8px] text-white/15 font-mono mt-0.5 truncate">{userInput}</div>
      )}
    </div>
  );
}
