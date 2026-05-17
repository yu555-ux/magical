export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type DisplayItem =
  | { type: 'msg'; msg: ChatMessage; idx: number }
  | { type: 'sep'; label: string; date: Date };

/* ---------- mock replies ---------- */
const BOT_REPLIES: string[] = [
  '正在处理您的指令... 以太波形检测到微弱波动。建议维持现状并等待进一步扫描结果。',
  '神经链接稳定。当前环境读数：温度 22°C，湿度 45%，以太浓度 0.03ppm。',
  '检测到异常信号源，方位 275°，距离约 800 米。建议派遣侦察无人机进行确认。',
  '指令已接收。正在重新分配系统资源以优化能量输出效率。预计耗时：12 秒。',
  '警告：区域以太干扰增强。建议开启能量护盾并寻找掩体。',
  '数据包解析完成。历史记录显示该区域曾发生大规模以太坍缩事件。',
  '远程接入节点已建立，正在同步量子加密通道... 链路稳定性 97%。',
];

export function getRandomReply(): string {
  return BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
}

/* ---------- helpers ---------- */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function formatFullLabel(d: Date): string {
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return formatTime(d);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(d)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function distanceMinutes(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}
