// 결정적 GBM 가격 엔진 — hash32(symbol+'|'+dayIndex) 시드 → mulberry32 PRNG → Box–Muller.
// Math.random/Date.now/인자 없는 new Date() 미사용. 일간 시리즈는 심볼별 모듈 스코프 Map에만
// 캐시하고 localStorage에는 저장하지 않는다.

import type { Instrument, PricePoint } from "@/lib/types";
import { getInstrument } from "@/data/instruments";
import { toDayIndex, todayKst, endOfMonth } from "@/lib/date";

// 문자열 → 32bit 정수 해시 (FNV-1a)
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 — 32bit 시드 기반 결정적 PRNG, [0,1) 균등분포 반환 함수 생성
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller 변환 — 균등분포 rng로 표준정규분포 z 값 하나 생성
function boxMuller(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// dayIndex(기준일 2016-01-01 = 0)를 "YYYY-MM-DD"로 역변환. toDayIndex와 정확히 대칭인 순수 UTC 계산.
function dateFromDayIndex(dayIndex: number): string {
  const ms = Date.UTC(2016, 0, 1) + dayIndex * 86_400_000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 심볼별 일간 시리즈 캐시 — 프로세스 생존 동안 1회만 계산, localStorage 미저장
const dailyCache = new Map<string, PricePoint[]>();

// series를 targetIndex까지 이어서 계산(이미 계산된 구간은 재계산하지 않음)
function ensureSeriesUpTo(symbol: string, instrument: Instrument, targetIndex: number): PricePoint[] {
  let series = dailyCache.get(symbol);
  if (!series) {
    series = [];
    dailyCache.set(symbol, series);
  }
  let prevClose = series.length > 0 ? series[series.length - 1].close : instrument.basePrice;
  for (let i = series.length; i <= targetIndex; i++) {
    let close: number;
    if (i === 0) {
      close = instrument.basePrice;
    } else {
      const rng = mulberry32(hash32(`${symbol}|${i}`));
      const z = boxMuller(rng);
      const r = instrument.annualDrift / 252 + (instrument.annualVol / Math.sqrt(252)) * z;
      close = Math.max(100, Math.floor(prevClose * (1 + r)));
    }
    series.push({ date: dateFromDayIndex(i), close });
    prevClose = close;
  }
  return series;
}

// 종목의 지정 날짜 종가. 마스터에 없는 심볼은 throw 없이 0 반환.
export function getClose(symbol: string, dateStr: string): number {
  const instrument = getInstrument(symbol);
  if (!instrument) return 0;
  const index = toDayIndex(dateStr);
  if (index < 0) return 0;
  const series = ensureSeriesUpTo(symbol, instrument, index);
  return series[index]?.close ?? 0;
}

// 계약(getPriceForInstrumentFn) 명칭 — instrumentId는 Instrument.symbol과 동일한 식별자.
export const getPriceForInstrument: (instrumentId: string, dateStr: string) => number = getClose;

// 기준일(2016-01-01)부터 오늘(KST)까지 일간 시리즈. 심볼당 1회만 계산되며 캐시 히트 시 동일 참조 반환.
export function getDailySeries(symbol: string): PricePoint[] {
  const instrument = getInstrument(symbol);
  if (!instrument) {
    if (!dailyCache.has(symbol)) dailyCache.set(symbol, []);
    return dailyCache.get(symbol)!;
  }
  const endIndex = toDayIndex(todayKst());
  return ensureSeriesUpTo(symbol, instrument, endIndex);
}

// 각 캘린더 월의 마지막 날만 샘플링한 시리즈
export function getMonthlySeries(symbol: string): PricePoint[] {
  return getDailySeries(symbol).filter((pp) => pp.date === endOfMonth(pp.date));
}
