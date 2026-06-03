import React from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare,
  User,
  Package,
  Map as MapIcon,
  Share2,
  FileText,
  Settings,
} from 'lucide-react';
import { PageType } from '../types';

interface SidebarProps {
  activePage: PageType;
  setActivePage: (page: PageType) => void;
  onOpenSettings: () => void;
}

const navItems = [
  { type: PageType.HOME, icon: MessageSquare, label: '主页' },
  { type: PageType.PERSONA, icon: User, label: '信息' },
  { type: PageType.WAREHOUSE, icon: Package, label: '仓库' },
  { type: PageType.MAP, icon: MapIcon, label: '地图' },
  { type: PageType.SOCIAL, icon: Share2, label: '社交' },
  { type: PageType.ARCHIVE, icon: FileText, label: '档案' },
];

export default function Sidebar({ activePage, setActivePage, onOpenSettings }: SidebarProps) {
  return (
    <div className="w-full md:w-20 lg:w-24 h-14 md:h-full flex flex-row md:flex-col bg-aether-dark/80 backdrop-blur-xl border-b md:border-b-0 md:border-r border-aether-border relative z-50 shrink-0 pt-[env(safe-area-inset-top,0px)]">
      {/* Navigation */}
      <nav className="flex-1 flex flex-row md:flex-col items-center gap-0.5 md:gap-1 px-1 md:px-2 md:pt-6 overflow-x-auto md:overflow-visible scrollbar-none">
        {navItems.map((item) => {
          const isActive = activePage === item.type;
          return (
            <button
              key={item.type}
              onClick={() => setActivePage(item.type)}
              className={`flex flex-col md:flex-col items-center justify-center gap-0.5 md:gap-1.5 px-2 md:px-0 py-2 md:py-3.5 rounded-sm transition-all relative group overflow-hidden clickable press-scale shrink-0 md:w-full ${
                isActive
                  ? 'text-aether-cyan'
                  : 'text-white/30 hover:text-white/60'
              }`}
              id={`nav-${item.type.toLowerCase()}`}
            >
              {/* Active indicator bar — left edge on desktop, bottom edge on mobile */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 md:left-0 right-0 md:right-auto bottom-0 md:bottom-auto md:top-1 md:bottom-1 h-0.5 md:h-auto md:w-0.5 bg-aether-cyan shadow-[0_0_10px_rgba(0,242,255,0.8)] rounded-t-full md:rounded-t-none md:rounded-r-full"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}

              {/* Active glow bg */}
              {isActive && (
                <motion.div
                  layoutId="activeBg"
                  className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-aether-cyan/10 to-transparent rounded-sm"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}

              {/* Icon */}
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', damping: 15 }}
              >
                <item.icon
                  size={isActive ? 22 : 20}
                  className={`shrink-0 transition-all ${
                    isActive
                      ? 'drop-shadow-[0_0_6px_rgba(0,242,255,0.6)]'
                      : 'group-hover:drop-shadow-[0_0_3px_rgba(0,242,255,0.3)]'
                  }`}
                />
              </motion.div>

              {/* Label — hidden on mobile, visible on desktop */}
              <span className={`hidden md:block font-display text-xs tracking-widest font-medium leading-none ${
                isActive ? 'cyan-glow' : ''
              }`}>
                {item.label}
              </span>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-aether-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm" />
            </button>
          );
        })}
      </nav>

      {/* Divider — hidden on mobile, visible on desktop */}
      <div className="hidden md:block w-8 h-[1px] bg-gradient-to-r from-transparent via-aether-cyan/30 to-transparent mx-auto" />

      {/* Settings button — at the end on both layouts */}
      <div className="pb-0 md:pb-6 px-1 md:px-2 flex-shrink-0">
        <button
          onClick={onOpenSettings}
          className="flex flex-col md:flex-col items-center justify-center gap-0.5 md:gap-1.5 px-2 md:px-0 py-2 md:py-3.5 rounded-sm transition-all relative group overflow-hidden clickable press-scale text-white/30 hover:text-white/60 shrink-0 w-full"
          id="nav-settings"
        >
          <motion.div
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Settings
              size={18}
              className="shrink-0 transition-all group-hover:drop-shadow-[0_0_3px_rgba(0,242,255,0.3)]"
            />
          </motion.div>
          <span className="hidden md:block font-display text-xs tracking-widest font-medium leading-none">
            设置
          </span>
          <div className="absolute inset-0 bg-aether-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm" />
        </button>
      </div>

      {/* Decorative edge line — right edge on desktop, hidden on mobile */}
      <div className="hidden md:block absolute right-0 top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-aether-cyan/20 to-transparent" />
    </div>
  );
}
