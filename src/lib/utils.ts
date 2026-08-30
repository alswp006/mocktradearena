export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function formatCurrency(n: number, currency = 'KRW'): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(n);
}

// 0.1234 → '12.34%' (decimals 기본 2자리)
export function formatPercent(decimal: number, decimals = 2): string {
  if (!Number.isFinite(decimal)) return '0%';
  return `${(decimal * 100).toFixed(decimals)}%`;
}

// ISO 날짜 문자열 → 'YYYY.MM.DD'
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}
