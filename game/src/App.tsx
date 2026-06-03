import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import ChatPage from './components/Pages/ChatPage';
import PersonaPage from './components/Pages/PersonaPage';
import WarehousePage from './components/Pages/WarehousePage';
import MapPage from './components/Pages/MapPage';
import SocialPage from './components/Pages/SocialPage';
import ArchivePage from './components/Pages/ArchivePage';
import SystemSettingsModal from './components/SystemSettingsModal';
import EntryOverlay from './components/EntryOverlay';
import StatusBell, { pushStatus } from './components/StatusBell';
import { PageType } from './types';
import { Toast } from './components/Feedback';
import { SillytavernProvider } from './hooks/SillytavernContext';
import { useKeyboardAware } from './hooks/useKeyboardAware';
import { useGameEventMonitor, type ToastOptions } from './hooks/useGameEventMonitor';

type ToastItem = { id: string; message: string; type: 'info' | 'warning' | 'error' | 'success'; channel?: 'terminal' | 'log' };

export default function App() {
  const [activePage, setActivePage] = useState<PageType>(PageType.HOME);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showSystemSettings, setShowSystemSettings] = useState(false);
  const [entryDone, setEntryDone] = useState(false);

  const { isKeyboardOpen, keyboardHeight } = useKeyboardAware();

  // Broadcast keyboard state to CSS & DOM for all components to react
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    if (isKeyboardOpen) {
      document.body.classList.add('keyboard-open');
    } else {
      document.body.classList.remove('keyboard-open');
    }
  }, [isKeyboardOpen, keyboardHeight]);

  // ── Mobile browser chrome (address bar) workaround ──
  // dvh is supported in iOS Safari 15.4+ / Chrome 108+, but many
  // Android WebViews and in-app browsers still only understand vh.
  // We set --app-height to the real visible height so CSS can use it.
  useEffect(() => {
    const root = document.documentElement;
    const setAppHeight = () => {
      // visualViewport gives the true visible height excluding browser chrome
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty('--app-height', `${h}px`);
    };
    setAppHeight();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', setAppHeight);
      vv.addEventListener('scroll', setAppHeight);
    }
    window.addEventListener('resize', setAppHeight);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', setAppHeight);
        vv.removeEventListener('scroll', setAppHeight);
      }
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);

  const addToast = useCallback((message: string, type: 'info' | 'warning' | 'success' | 'error', channel?: 'terminal' | 'log') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, channel }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNotification = useCallback((title: string, message: string, type: 'info' | 'warning' | 'error' | 'success', onClick?: () => void) => {
    // 仅系统事件走铃铛，单次错误/警告走 Toast 即可
    if (type === 'error' || type === 'warning') {
      addToast(message, type);
    } else {
      pushStatus({ title, message, type: type === 'success' ? 'ok' : type, source: '游戏', onClick });
    }
  }, [addToast]);

  // ── Game event monitor: affection changes → bell + toast ──
  useGameEventMonitor((opts: ToastOptions) => {
    addToast(opts.message, opts.type, opts.channel);
  });

  const renderPage = () => {
    switch (activePage) {
      case PageType.HOME:   return <ChatPage addNotification={addNotification} />;
      case PageType.PERSONA: return <PersonaPage />;
      case PageType.WAREHOUSE: return <WarehousePage />;
      case PageType.MAP:     return <MapPage />;
      case PageType.SOCIAL:  return <SocialPage />;
      case PageType.ARCHIVE: return <ArchivePage />;
      default:               return <ChatPage addNotification={addNotification} />;
    }
  };

  return (
    <SillytavernProvider>
    <div className="flex flex-col md:flex-row app-height w-screen overflow-hidden bg-aether-dark font-sans text-white selection:bg-aether-cyan selection:text-aether-dark">
      {!entryDone && <EntryOverlay onComplete={() => setEntryDone(true)} />}

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,10,13,0.8)_100%)] opacity-80" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(0,242,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,242,255,0.15) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)' }} />
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/20 to-transparent" />
      </div>

      <Sidebar activePage={activePage} setActivePage={setActivePage} onOpenSettings={() => setShowSystemSettings(true)} />

      <main className="flex-1 relative z-10 overflow-hidden md:overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={activePage}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 h-full overflow-y-auto md:overflow-hidden">
            {renderPage()}
          </motion.div>
        </AnimatePresence>

        {/* System Status Bell (draggable) */}
        <StatusBell />
      </main>

      {/* Toast Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1000]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast key={toast.id} message={toast.message} type={toast.type} channel={toast.channel} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>

      <SystemSettingsModal isOpen={showSystemSettings} onClose={() => setShowSystemSettings(false)} />

      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-[0.03]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
    </div>
    </SillytavernProvider>
  );
}
