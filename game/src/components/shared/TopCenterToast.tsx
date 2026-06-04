import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let globalShow: ((message: string, type: ToastItem['type']) => void) | null = null;

/** 从任意位置调用，弹出顶端中央 toast */
export function showTopCenter(message: string, type: ToastItem['type'] = 'info') {
  globalShow?.(message, type);
}

const TYPE_STYLE: Record<ToastItem['type'], { icon: any; bg: string; border: string; text: string }> = {
  success: { icon: CheckCircle, bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-300' },
  error:   { icon: X,            bg: 'bg-red-500/10',      border: 'border-red-400/30',      text: 'text-red-400' },
  info:    { icon: Info,         bg: 'bg-aether-cyan/10',  border: 'border-aether-cyan/30',  text: 'text-aether-cyan' },
  warning: { icon: AlertTriangle,bg: 'bg-yellow-500/10',   border: 'border-yellow-400/30',   text: 'text-yellow-400' },
};

export default function TopCenterToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastItem['type']) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => { globalShow = show; return () => { globalShow = null; }; }, [show]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1100] pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map(t => {
          const s = TYPE_STYLE[t.type];
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-lg ${s.bg} ${s.border} border shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-sm`}
            >
              <Icon size={14} className={`shrink-0 ${s.text}`} />
              <span className={`text-xs font-display tracking-wide ${s.text}`}>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
