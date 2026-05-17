# AETHER LINK UI Enhancement Design

## Overview
在现有 Death Stranding 风格暗色主题基础上，精细化美化全部5个页面 + 全局系统，添加微交互、动画和通知系统，移除所有 emoji 使用矢量图标。

## Design System
- **Style**: Cyberpunk/HUD + Death Stranding atmospheric, sky-blue primary
- **Primary**: #00f2ff (cyan), #00a8cc (blue)
- **Background**: #000a0d (dark), #00151a (deep)
- **Typography**: Space Grotesk (headings), Inter (body), JetBrains Mono (HUD/data)
- **Icons**: lucide-react (no emoji)
- **Animation**: spring physics, 150-300ms micro-interactions

## Phase 1: Global Systems

### 1.1 Typography & CSS Foundation
- Add JetBrains Mono font import
- Define semantic font tokens
- Optimize font-display
- Update index.html title to Chinese

### 1.2 Sidebar Enhancement
- Active nav item glow breathing animation
- Collapsed state icon tooltips
- System status panel expandable
- Navigation transition polish

### 1.3 Notification Center
- Bell icon with unread badge (top-right)
- Slide-out notification panel
- Toast notifications redesigned (slide-in from right)
- Notification types: info/success/warning/error

### 1.4 Micro-interaction System
- All interactive elements: hover scale + active press feedback
- Spring physics for page transitions
- Staggered list entrance (30-50ms delay)
- Hover glow/light effects on cards

### 1.5 Shared Components
- Skeleton loader (shimmer effect)
- Tooltip component
- Confirm dialog for destructive actions

## Phase 2: Page Enhancements

### 2.1 ChatPage (主页面)
- Typing indicator (bouncing dots)
- Message bubble gradient borders
- Staggered message entrance
- Input focus glow expansion
- Time separators between message groups

### 2.2 PersonaPage (个人面板)
- Stat bars: animated fill + flowing gradient + number counter
- Hex stat grid: hover 3D tilt effect + corner glow dots
- Skill cards: rarity-based glow (S=gold, A=purple, B=blue, C=gray)
- Currency: dedicated card with more slot placeholders
- Section transitions: smooth scroll-snap
- Modal: enriched data presentation

### 2.3 WarehousePage (仓库界面)
- Search: focus expansion + clear button
- Filter: category dropdown
- Item cards: rarity border glow (传世=orange, 罕见=blue, 普通=gray, 劣质=brown)
- Pagination: diamond indicators + page numbers
- Grid/list view toggle
- Modal: stat grid + deploy button animation

### 2.4 MapPage (地图界面)
- CSS fog/particle background layer
- Location markers: multi-ring pulse animation
- Nested indicator for sub-maps
- Point info card: pop-out from marker
- Zoom controls: level indicator
- Coordinate scanline effect

### 2.5 SocialPage (社交界面)
- Edge lines: data-flow particle animation
- Node hover: scale up + glow + tooltip
- Center "我" node: rotating ring decoration
- Relationship color coding (ally=cyan, neutral=blue, enemy=red)
- Background grid/constellation pattern
- Node entrance: spring animation

## Phase 3: Polish & Performance
- Semantic HTML5 elements
- Unique IDs on all interactive elements
- Custom scrollbar consistency
- Cursor strategy (pointer on clickable, default on text)
- prefers-reduced-motion support
- Responsive breakpoint verification

## Files to Modify
- `index.html` - title, lang
- `src/index.css` - fonts, tokens, animations
- `src/App.tsx` - notification center, global state
- `src/components/Sidebar.tsx` - tooltips, animations
- `src/components/Feedback.tsx` - tooltip, confirm dialog
- `src/components/Pages/ChatPage.tsx` - typing indicator, message polish
- `src/components/Pages/PersonaPage.tsx` - stat animations, card effects
- `src/components/Pages/WarehousePage.tsx` - search, filter, rarity effects
- `src/components/Pages/MapPage.tsx` - particles, pulse animations
- `src/components/Pages/SocialPage.tsx` - edge particles, node animations
- `src/types.ts` - new type definitions
- `src/mockData.ts` - enriched mock data
