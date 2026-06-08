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

  const refresh = useCallback(async () => {
    setHistory(await getUsageHistory(100));
  }, []);

  useEffect(() => {
    if (isOpen) {
      refresh();
      return gameBus.on('api_usage', async ({ record }) => {
        setHistory(prev => [record, ...prev].slice(0, 100));
      });
    }
  }, [isOpen, refresh]);

  const handleClear = async () => {
    await clearUsageHistory();
    setHistory([]);
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
            <OverviewTab history={history} />
          ) : (
            <DiffTab />
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

function OverviewTab({ history }: { history: CacheUsageRecord[] }) {
  if (history.length === 0) {
    return <div className="text-center py-16 text-white/25 text-xs font-mono">发送消息后开始采集</div>;
  }

  return (
    <div>
      {history.map((r, i) => (
        <CacheEntry key={r.requestId} record={r} isLatest={i === 0} />
      ))}
    </div>
  );
}

// ── 提示词对比标签页 ──

function DiffTab() {
  const [history, setHistory] = useState<CacheUsageRecord[]>([]);
  const [diffResult, setDiffResult] = useState<Array<{ role: string; oldContent: string; newContent: string; changed: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [lastIds, setLastIds] = useState<[string, string] | null>(null);

  // 订阅新数据，保持最新 2 条
  useEffect(() => {
    getUsageHistory(2).then(setHistory);
    return gameBus.on('api_usage', async () => {
      setHistory(await getUsageHistory(2));
    });
  }, []);

  // 自动对比最新 2 条
  useEffect(() => {
    if (history.length < 2) return;
    const [latest, prev] = history;
    const pair: [string, string] = [prev.requestId, latest.requestId];

    // 相同则跳过
    if (lastIds && lastIds[0] === pair[0] && lastIds[1] === pair[1]) return;
    setLastIds(pair);

    setLoading(true);
    setTimeout(() => {
      const msgsA = getFullPrompt(pair[0]); // 上次
      const msgsB = getFullPrompt(pair[1]); // 本次
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
  }, [history]);

  if (history.length < 2) {
    return (
      <div className="text-center py-16 text-white/25 text-xs font-mono">
        需要至少 2 次请求才能对比。<br />发送 2 条消息后再查看。
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* 对比摘要 */}
      <div className="flex items-center justify-between text-[10px] font-mono px-3 py-2 bg-aether-dark/40 rounded-lg border border-aether-border/10">
        <span className="text-white/40">
          上次 <span className="text-white/60">{new Date(history[1].timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          {' · '}
          <span className={history[1].hitRate >= 60 ? 'text-aether-green/60' : 'text-aether-gold/60'}>{history[1].hitRate}%</span>
        </span>
        <span className="text-aether-cyan/40">→</span>
        <span className="text-white/40">
          本次 <span className="text-white/60">{new Date(history[0].timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          {' · '}
          <span className={history[0].hitRate >= 60 ? 'text-aether-green/60' : 'text-aether-gold/60'}>{history[0].hitRate}%</span>
        </span>
        <span className="text-white/25">{history[1].totalChars?.toLocaleString()} → {history[0].totalChars?.toLocaleString()} 字</span>
      </div>

      {loading && <div className="text-center py-10 text-white/30 text-xs font-mono">对比中...</div>}

      {!loading && diffResult.length === 0 && lastIds && (
        <div className="text-center py-10 text-white/25 text-xs font-mono">
          完整提示词数据已过期（仅保留最近 100 次）。发送新消息后重试。
        </div>
      )}

      {!loading && diffResult.length > 0 && (
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          <div className="text-[10px] text-white/25 font-mono mb-2 px-1">
            {diffResult.filter(d => d.changed).length} / {diffResult.length} 条消息有变动
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

function CacheEntry({ record, isLatest }: {
  record: CacheUsageRecord;
  isLatest: boolean;
}) {
  const { hit, miss, total, hitRate, cost, timestamp, userInput } = record;
  const timeStr = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const barColor = hitRate >= 60
    ? 'from-aether-green to-aether-cyan'
    : hitRate >= 30
      ? 'from-aether-gold to-aether-green'
      : 'from-aether-red to-aether-gold';

  return (
    <div className={`px-4 py-2.5 border-b border-aether-border/10 hover:bg-white/[0.02] transition-colors ${isLatest ? 'bg-aether-cyan/[0.015]' : ''}`}>
      {/* Hit rate bar */}
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
