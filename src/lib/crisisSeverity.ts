export type TimeRange = '24h' | '7d' | 'all';

export function timeRangeMs(range: TimeRange): number {
  if (range === '24h') return 24 * 60 * 60 * 1000;
  if (range === '7d') return 7 * 24 * 60 * 60 * 1000;
  return 365 * 24 * 60 * 60 * 1000;
}

export function severityColors(severity?: string) {
  const s = (severity || 'medium').toLowerCase();
  if (s === 'critical') {
    return { fill: 'rgba(139, 0, 0, 0.35)', stroke: '#B91C1C', pin: '#EF4444', label: 'CRITICAL' };
  }
  if (s === 'high') {
    return { fill: 'rgba(226, 75, 74, 0.32)', stroke: '#E24B4A', pin: '#F97316', label: 'HIGH' };
  }
  if (s === 'low') {
    return { fill: 'rgba(20, 184, 166, 0.22)', stroke: '#14B8A6', pin: '#2DD4BF', label: 'LOW' };
  }
  return { fill: 'rgba(245, 158, 11, 0.28)', stroke: '#F59E0B', pin: '#FBBF24', label: 'MEDIUM' };
}

export function crisisTypeLabel(type?: string): string {
  const t = (type || 'incident').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function minutesSince(ts?: number): string {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 60) return `T+${m} min`;
  return `T+${Math.floor(m / 60)}h`;
}
