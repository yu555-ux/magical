import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import ChatPage from './components/Pages/ChatPage';
import PersonaPage from './components/Pages/PersonaPage';
import WarehousePage from './components/Pages/WarehousePage';
import MapPage from './components/Pages/MapPage';
import SocialPage from './components/Pages/SocialPage';
import TavernPage from './components/Pages/TavernPage';
import { PageType, Notification } from './types';
import { Toast, NotificationPanel } from './components/Feedback';
import { Bell } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState<PageType>(PageType.HOME);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  // Welcome toasts
  useEffect(() => {
    addToast('神经连接协议已通过 [AETHER_LINK]', 'success');
    addNotification('系统连接', '与以太网络的神经链接已建立，共振频率稳定。', 'success');
    setTimeout(() => {
      addToast('环境干扰读数正常。请开始探索。', 'info');
      addNotification('环境扫描完成', '当前区域以太波动在安全阈值内，可自由行动。', 'info');
    }, 2000);
  }, []);

  const addToast = useCallback((message: string, type: 'info' | 'warning' | 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNotification = useCallback((title: string, message: string, type: 'info' | 'warning' | 'error' | 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [{ id, title, message, type, timestamp: Date.now(), read: false }, ...prev]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderPage = () => {
    switch (activePage) {
      case PageType.HOME:
        return <ChatPage key="home" addNotification={addNotification} />;
      case PageType.PERSONA:
        return <PersonaPage key="persona" />;
      case PageType.WAREHOUSE:
        return <WarehousePage key="warehouse" />;
      case PageType.MAP:
        return <MapPage key="map" />;
      case PageType.SOCIAL:
        return <SocialPage key="social" />;
      case PageType.TAVERN:
        return <TavernPage key="tavern" />;
      default:
        return <ChatPage key="default" addNotification={addNotification} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-aether-dark font-sans text-white selection:bg-aether-cyan selection:text-aether-dark">
      {/* Background Decorators */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,10,13,0.8)_100%)] opacity-80" />
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
      </div>

      {/* Sidebar Navigation */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 h-full overflow-hidden"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>

        {/* Notification Bell + Panel (draggable) */}
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0.1}
          whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
          className="fixed top-4 right-4 z-[80] clickable"
          id="notification-bell-area"
        >
          <button
            onClick={() => setNotifPanelOpen(!notifPanelOpen)}
            className="relative p-2 glass-panel press-scale hover:border-aether-cyan transition-all"
            id="notification-bell-btn"
          >
            <Bell size={18} className="text-white/60 hover:text-aether-cyan transition-colors" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-aether-cyan text-aether-dark text-[9px] font-bold font-mono flex items-center justify-center rounded-full"
              >
                {unreadCount}
              </motion.span>
            )}
          </button>
          <AnimatePresence>
            {notifPanelOpen && (
              <NotificationPanel
                notifications={notifications}
                onMarkRead={markNotificationRead}
                onClear={clearNotifications}
                onClose={() => setNotifPanelOpen(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>

      </main>

      {/* Toast Notifications Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1000]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Global noise/grain overlay (CSS-based) */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
    </div>
  );
}
