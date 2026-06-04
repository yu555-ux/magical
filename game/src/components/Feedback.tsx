import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, AlertTriangle, CheckCircle, Bell } from 'lucide-react';
import { Notification } from '../types';

/* ====== Modal ====== */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg glass-panel overflow-hidden border-glow"
          >
            <div className="flex items-center justify-between p-4 border-b border-aether-cyan/15 bg-aether-cyan/[0.02]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-2.5 h-2.5 bg-aether-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                  <div className="absolute inset-0 w-2.5 h-2.5 bg-aether-cyan rounded-full animate-ping opacity-20" />
                </div>
                <h3 className="font-display font-bold text-sm tracking-widest text-aether-cyan uppercase">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-aether-cyan transition-colors p-1 clickable press-scale"
                id="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 max-h-[calc(100vh-6rem-env(safe-area-inset-top,0px))] md:max-h-[70vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ====== Toast ====== */
interface ToastProps {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  onClose: () => void;
  onClick?: () => void;
  channel?: 'variable' | 'story';
}

export function Toast({ message, type, onClose, onClick, channel = 'variable' }: ToastProps) {
  const colors: Record<string, string> = {
    info:    'border-aether-blue/50 bg-aether-blue/10 text-aether-blue',
    warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
    error:   'border-red-500/50 bg-red-500/10 text-red-500',
    success: 'border-green-500/50 bg-green-500/10 text-green-400',
  };

  const icons: Record<string, React.ReactNode> = {
    info: <Info size={16} />,
    warning: <AlertTriangle size={16} />,
    error: <X size={16} />,
    success: <CheckCircle size={16} />,
  };

  const isStory = channel === 'story';

  return (
    <motion.div
      layout
      initial={{ x: 120, opacity: 0, height: 0 }}
      animate={{ x: 0, opacity: 1, height: 'auto' }}
      exit={{ x: 120, opacity: 0, height: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`pointer-events-auto p-4 border flex items-center gap-4 min-w-[320px] max-w-[420px] ${
        isStory
          ? 'glass-panel border-aether-cyan/30 text-aether-cyan/90 shadow-[0_0_20px_rgba(0,242,255,0.08)]'
          : `glass-panel ${colors[type]}`
      } ${onClick ? 'cursor-pointer hover:brightness-110 clickable' : ''}`}
      onClick={onClick}
      id={`toast-${type}`}
    >
      {/* Tech scanline for terminal toast */}
      {!isStory && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,242,255,0.3) 2px, rgba(0,242,255,0.3) 3px)' }} />
      )}

      {type !== 'error' && <span className="shrink-0">{icons[type]}</span>}
      <div className={`flex-1 text-sm tracking-wider ${isStory ? 'font-display' : 'font-mono'}`}>
        {type !== 'error' && (
          <span className={`font-bold mr-2 uppercase text-[10px] opacity-70 ${isStory ? 'font-display' : 'font-mono'}`}>
            [{type}]
          </span>
        )}
        {message}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="hover:opacity-70 transition-opacity p-1 clickable relative z-10 pointer-events-auto">
        <X size={14} />
      </button>
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 5, ease: 'linear' }}
        onAnimationComplete={onClose}
        className={`absolute bottom-0 left-0 h-0.5 ${isStory ? 'bg-aether-cyan/30' : 'bg-current opacity-30'}`}
      />
    </motion.div>
  );
}

/* ====== Tooltip ====== */
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, position = 'right' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const positions: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrows: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-aether-dark',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-aether-dark',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-aether-dark',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-aether-dark',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => {
        clearTimeout(timeoutRef.current);
        setShow(true);
      }}
      onMouseLeave={() => {
        timeoutRef.current = setTimeout(() => setShow(false), 150);
      }}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-[200] ${positions[position]} pointer-events-none`}
          >
            <div className="bg-aether-dark border border-aether-cyan/40 px-3 py-1.5 text-[11px] font-display text-aether-cyan tracking-wider whitespace-nowrap shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ====== ConfirmDialog ====== */
interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message, confirmLabel = '确认', destructive = false }: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-aether-dark/90 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md glass-panel border-glow p-6"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-2 rounded-full ${destructive ? 'bg-red-500/20 text-red-400' : 'bg-aether-cyan/20 text-aether-cyan'}`}>
                {destructive ? <AlertTriangle size={24} /> : <Bell size={24} />}
              </div>
              <div>
                <h3 className="font-display font-bold text-lg tracking-wide text-white">{title}</h3>
                <p className="text-sm text-white/60 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-6 py-2.5 border border-aether-border/50 text-white/60 hover:text-white hover:border-white/30 transition-all text-sm font-display tracking-wider uppercase clickable press-scale"
                id="confirm-cancel-btn"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className={`px-6 py-2.5 font-display text-sm tracking-wider uppercase clickable press-scale transition-all ${
                  destructive
                    ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                    : 'bg-aether-cyan/20 border border-aether-cyan/50 text-aether-cyan hover:bg-aether-cyan/30'
                }`}
                id="confirm-ok-btn"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ====== Skeleton ====== */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton-shimmer rounded-sm ${className}`} />;
}

/* ====== NotificationPanel ====== */
interface NotificationPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function NotificationPanel({ notifications, onMarkRead, onClear, onClose }: NotificationPanelProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-4 top-16 w-80 max-h-[60vh] glass-panel border-glow overflow-hidden z-[90]"
      id="notification-panel"
    >
      <div className="p-4 border-b border-aether-border/30 flex items-center justify-between bg-aether-cyan/5">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-aether-cyan" />
          <h3 className="font-display text-sm tracking-widest text-aether-cyan uppercase">通知中心</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 bg-aether-cyan text-aether-dark text-[10px] font-bold font-mono">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button onClick={onClear} className="text-[10px] text-white/40 hover:text-white/70 transition-colors uppercase tracking-wider clickable">清空</button>
          )}
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors clickable">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto max-h-[50vh]">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell size={32} className="mx-auto mb-3 text-white/10" />
            <p className="text-xs text-white/30 font-display tracking-wider">暂无通知</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => onMarkRead(n.id)}
              className={`w-full text-left p-4 border-b border-aether-border/10 transition-all clickable hover:bg-aether-cyan/5 ${
                !n.read ? 'bg-aether-cyan/[0.03]' : ''
              }`}
              id={`notification-${n.id}`}
            >
              <div className="flex items-start gap-3">
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-aether-cyan mt-1.5 shrink-0 animate-pulse" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-display font-medium text-white/90 tracking-wide">{n.title}</p>
                  <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed truncate">{n.message}</p>
                  <p className="text-[9px] text-white/20 mt-1 font-mono">{new Date(n.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}
