export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysUntil(dateStr: string): number {
  const today = new Date(todayStr() + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff;
}

export function isExpired(dateStr: string): boolean {
  return daysUntil(dateStr) < 0;
}

export function isSoon(dateStr: string, threshold = 3): boolean {
  const d = daysUntil(dateStr);
  return d >= 0 && d <= threshold;
}

export function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, "/");
}

export function humanDaysLeft(days: number): string {
  if (days < 0) return "已过期";
  if (days === 0) return "今天过期";
  if (days === 1) return "明天过期";
  return `剩 ${days} 天`;
}
