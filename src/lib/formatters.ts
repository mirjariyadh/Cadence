import { format } from 'date-fns';

export function formatTimerClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatHoursMinutes(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatDecimalHours(totalSeconds: number, decimals = 1): string {
  const hours = Math.max(0, totalSeconds) / 3600;
  return `${hours.toFixed(decimals)}h`;
}

export function formatMinutesAsDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatTimeRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return '—';
    }
    return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`;
  } catch {
    return '—';
  }
}

export function formatShortDate(dateKey: string): string {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '—';
  const [y, m, d] = dateKey.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'MMM d');
}

export function formatDayHeading(dateKey: string): string {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const todayKey = toDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);
  const formatted = format(date, 'EEEE, MMM d');
  if (dateKey === todayKey) return `Today · ${formatted}`;
  if (dateKey === yesterdayKey) return `Yesterday · ${formatted}`;
  return formatted;
}
