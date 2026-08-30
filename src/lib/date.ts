// KST 기준 순수 날짜 유틸 — "YYYY-MM-DD" 문자열만 다룬다. localStorage/네트워크 접근 없음.

const BASE_DATE = "2016-01-01";

function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-based; Date.UTC(year, month, 0) = 다음 달 0일 = 이번 달 마지막 날
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 오늘 날짜를 KST(Asia/Seoul) 기준 "YYYY-MM-DD"로 반환
export function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// 기준일(2016-01-01)로부터 경과한 일수. 기준일은 0.
export function toDayIndex(dateStr: string): number {
  const { year, month, day } = parseYmd(dateStr);
  const base = parseYmd(BASE_DATE);
  const target = Date.UTC(year, month - 1, day);
  const origin = Date.UTC(base.year, base.month - 1, base.day);
  return Math.round((target - origin) / 86_400_000);
}

// years만큼 연도를 가감 (윤년 2/29는 대상 연도에 없으면 2/28로 클램프)
export function addYears(dateStr: string, years: number): string {
  const { year, month, day } = parseYmd(dateStr);
  const newYear = year + years;
  const clampedDay = Math.min(day, daysInMonth(newYear, month));
  return formatYmd(newYear, month, clampedDay);
}

// 해당 날짜가 속한 달의 마지막 날
export function endOfMonth(dateStr: string): string {
  const { year, month } = parseYmd(dateStr);
  return formatYmd(year, month, daysInMonth(year, month));
}

function getKSTParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: hour === "24" ? "00" : hour,
    minute: get("minute"),
    second: get("second"),
  };
}

// 현재 KST 시각을 ISO 8601 문자열(+09:00 오프셋)로 반환
export function getKSTDate(): string {
  const { year, month, day, hour, minute, second } = getKSTParts(new Date());
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

// Date를 KST 기준 "YYYY-MM-DD HH:mm"으로 포맷 (거래내역 등 시각 표시용)
export function formatKstDateTime(date: Date): string {
  const { year, month, day, hour, minute } = getKSTParts(date);
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// KST 날짜/시각 문자열("YYYY-MM-DD" 또는 ISO 8601)을 Date로 파싱
export function parseKSTDate(dateStr: string): Date {
  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
  const hasOffset = /([+-]\d{2}:\d{2}|Z)$/.test(normalized);
  return new Date(hasOffset ? normalized : `${normalized}+09:00`);
}

// KST 날짜/시각에 days일 더한 ISO 문자열 반환 (입력이 날짜만이면 날짜만, 시각 포함이면 시각까지 반환)
export function addDaysKST(dateStr: string, days: number): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const shifted = new Date(parseKSTDate(dateStr).getTime() + days * 86_400_000);
  const { year, month, day, hour, minute, second } = getKSTParts(shifted);
  return isDateOnly
    ? `${year}-${month}-${day}`
    : `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}
