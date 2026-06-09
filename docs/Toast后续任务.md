# Toast 系统后续任务

## 已完成 ✅

### 任务 1+2: 顶端中央 Toast 组件 + 删除底部胶囊
- [x] 新建 `TopCenterToast.tsx` — 全局 `showTopCenter()` 函数
- [x] 挂载到 App.tsx (`z-[1100]`)
- [x] `SystemSettingsModal` 删除本地 toast → 改用 `showTopCenter`
- [x] `LorebookTab` 删除本地 toast → 改用 `showTopCenter`
- [x] `PromptManagerRoot` 删除本地 toast → 改用 `showTopCenter`
- [x] `PromptBlockPool` 删除 `onToast` prop → 直接 `showTopCenter`

### 任务 3: Toast 内容分离
- [x] ChatPage: 格式错误/发送失败/购买成功/原文应用 → `showTopCenter`
- [x] SaveManagerModal: 存档/读档 → `showTopCenter`
- [x] useSillytavern: 内部 `showToast` → `showTopCenter`，删除本地 render
- [x] WarehousePage: realizeSuccess → `showTopCenter`，删除本地 render

### Phase 2+3: 铃铛重构
- [x] Tab 改名：「终端/日志」→「变量/剧情」
- [x] 铃铛规则统一：所有类型均走 toast+铃铛

### Phase 1: 好感度 → 变量驱动
- [x] `sendGameMessage` 返回 `varChanges`
- [x] ChatPage 从 `varChanges` 检测好感值变化
- [x] `useGameEventMonitor` 停止生成 toast

---

## 当前架构

```
右上角 Toast (Feedback.tsx, z-[1000])
  └─ addNotification() → addToast()
      ├─ 变量更新: "第二API已更新 N 项变量"
      └─ 好感度: "{角色} 好感度 +N (old → new)"

顶端中央 Toast (TopCenterToast, z-[1100])
  └─ showTopCenter()
      ├─ AI格式错误 / 发送失败(含404)
      ├─ 柳三娘购买 / 原文编辑
      ├─ 存档/读档
      ├─ 第二API错误 / 变量重新生成
      ├─ 梦境具现成功
      ├─ 配置保存 / 世界书导入导出 / 预设导入导出
      └─ API连接测试 / 模型获取

铃铛「变量」tab
  └─ addNotification → pushStatus (source: '游戏')

铃铛「剧情」tab
  └─ useGameEventMonitor → pushStatus (channel: 'story')
```

---

## 待做（低优先级）

| 任务 | 说明 |
|------|------|
| 任务 4: 剧情 Tab 内容 | useGameEventMonitor 已有好感变化/阶段突破。后续可接入更多剧情事件 |
| 任务 5: 变量 Tab 增强 | 结构化 diff 摘要、历史记录等 |
| 清理未使用 import | 部分文件删了 toast 后 useCallback/AnimatePresence 可能不再需要 |
