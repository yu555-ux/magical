export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type DisplayItem =
  | { type: 'msg'; msg: ChatMessage; idx: number }
  | { type: 'sep'; label: string; date: Date };

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
