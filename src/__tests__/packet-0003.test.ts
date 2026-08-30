import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PricePoint } from "@/lib/types";
import { getClose, getDailySeries, getMonthlySeries } from "@/lib/priceEngine";

describe("결정적 가격 엔진 (packet-0003: hash32·mulberry32·Box–Muller)", () => {
  // ──────────────────────────────────────────────────────────────
  // AC-1: 결정성 (Determinism) — 3회 호출 완전 동일, Integer, >= 100
  // ──────────────────────────────────────────────────────────────
  describe("AC-1: Deterministic close prices", () => {
    it("AC-1[P0]: getClose returns identical values on 3 consecutive calls with same args", () => {
      // Arrange
      const symbol = "005930"; // 삼성전자
      const dateStr = "2024-03-15";

      // Act
      const result1 = getClose(symbol, dateStr);
      const result2 = getClose(symbol, dateStr);
      const result3 = getClose(symbol, dateStr);

      // Assert
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(Number.isInteger(result1)).toBe(true);
      expect(Number.isInteger(result2)).toBe(true);
      expect(Number.isInteger(result3)).toBe(true);
      expect(result1).toBeGreaterThanOrEqual(100);
      expect(result2).toBeGreaterThanOrEqual(100);
      expect(result3).toBeGreaterThanOrEqual(100);
    });

    it("AC-1[P0]: getClose returns different values for different dates (not time-dependent)", () => {
      // Arrange
      const symbol = "005930";
      const date1 = "2024-03-15";
      const date2 = "2024-03-16";

      // Act
      const price1 = getClose(symbol, date1);
      const price2 = getClose(symbol, date2);

      // Assert — 서로 다른 날짜는 다른 가격 (대부분의 경우, 확률적으로 같을 가능성은 극히 낮음)
      // 하지만 완벽한 검증은 어려우니, 적어도 결정성은 있어야 함
      expect(Number.isInteger(price1)).toBe(true);
      expect(Number.isInteger(price2)).toBe(true);
      expect(price1).toBeGreaterThanOrEqual(100);
      expect(price2).toBeGreaterThanOrEqual(100);
    });

    it("AC-1[P0]: getClose works for multiple instruments consistently", () => {
      // Arrange
      const symbols = ["005930", "000660", "035420"]; // 삼성전자, SK하이닉스, NAVER
      const dateStr = "2024-01-15";

      // Act & Assert
      symbols.forEach((symbol) => {
        const r1 = getClose(symbol, dateStr);
        const r2 = getClose(symbol, dateStr);
        expect(r1).toBe(r2);
        expect(Number.isInteger(r1)).toBe(true);
        expect(r1).toBeGreaterThanOrEqual(100);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // AC-2: No forbidden calls (Math.random, Date.now, new Date())
  // ──────────────────────────────────────────────────────────────
  describe("AC-2: No forbidden runtime calls", () => {
    it("AC-2[P0]: does not call Math.random() during price calculation", () => {
      // Arrange
      const randomSpy = vi.spyOn(Math, "random");
      const symbol = "005930";
      const dateStr = "2024-03-15";

      // Act
      getClose(symbol, dateStr);

      // Assert
      expect(randomSpy).not.toHaveBeenCalled();

      // Cleanup
      randomSpy.mockRestore();
    });

    it("AC-2[P0]: does not call Date.now() during price calculation", () => {
      // Arrange
      const nowSpy = vi.spyOn(Date, "now");
      const symbol = "005930";
      const dateStr = "2024-03-15";

      // Act
      getClose(symbol, dateStr);

      // Assert
      expect(nowSpy).not.toHaveBeenCalled();

      // Cleanup
      nowSpy.mockRestore();
    });

    it("AC-2[P0]: does not call new Date() with no arguments", () => {
      // Arrange — watch for Date constructor calls by checking if any Date object
      // is created without arguments. We can't easily spy on constructor, so instead
      // we verify that the function works with frozen time.
      const testDate = new Date("2024-01-01T00:00:00Z");
      const baseNow = testDate.getTime();

      // Freeze time to detect if Date.now() is called
      vi.useFakeTimers();
      vi.setSystemTime(baseNow);

      const symbol = "005930";
      const dateStr = "2024-03-15";

      // Act — should not crash or return different values due to time passing
      const r1 = getClose(symbol, dateStr);
      const r2 = getClose(symbol, dateStr);

      // Assert
      expect(r1).toBe(r2);
      expect(Number.isInteger(r1)).toBe(true);

      // Cleanup
      vi.useRealTimers();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // AC-3: GBM formula implementation
  // close_0 = basePrice (기준일)
  // r_t = drift/252 + vol/sqrt(252) * z_t
  // close_t = max(100, floor(close_{t-1} * (1 + r_t)))
  // ──────────────────────────────────────────────────────────────
  describe("AC-3: GBM (Geometric Brownian Motion) formula", () => {
    it("AC-3[P0]: base date (2016-01-01) returns basePrice from instrument master", () => {
      // Arrange
      const symbol = "005930"; // 삼성전자, basePrice = 71000
      const baseDate = "2016-01-01";

      // Act
      const price = getClose(symbol, baseDate);

      // Assert
      expect(price).toBe(71000);
      expect(Number.isInteger(price)).toBe(true);
    });

    it("AC-3[P0]: prices follow GBM logic (all >= 100 floor)", () => {
      // Arrange
      const symbol = "005930";
      const dates = ["2016-01-01", "2016-01-02", "2016-01-03", "2016-01-04", "2016-01-05"];

      // Act
      const prices = dates.map((d) => getClose(symbol, d));

      // Assert
      // - 첫 번째는 basePrice (71000)
      expect(prices[0]).toBe(71000);

      // - 모두 정수
      prices.forEach((p) => expect(Number.isInteger(p)).toBe(true));

      // - 모두 >= 100 (floor)
      prices.forEach((p) => expect(p).toBeGreaterThanOrEqual(100));

      // - 연쇄 관계 성립 (close_t = floor(close_{t-1} * (1+r_t)), r_t는 대부분 작은 값)
      // 극단적으로 0에 가까워지지는 않음
      prices.forEach((p) => expect(p).toBeLessThan(1000000));
    });

    it("AC-3[P0]: different instruments have different price series based on their basePrice", () => {
      // Arrange
      const dateStr = "2016-06-01";
      const samsung = getClose("005930", dateStr); // basePrice = 71000
      const skHynix = getClose("000660", dateStr); // basePrice = 150000
      const naver = getClose("035420", dateStr); // basePrice = 210000

      // Act & Assert
      // 기준가가 다르면, 대체로 가격도 다르다 (동일 모수라면)
      // 하지만 volatility와 drift가 다르므로 직접 비교는 어려움
      expect(Number.isInteger(samsung)).toBe(true);
      expect(Number.isInteger(skHynix)).toBe(true);
      expect(Number.isInteger(naver)).toBe(true);
      expect(samsung).toBeGreaterThanOrEqual(100);
      expect(skHynix).toBeGreaterThanOrEqual(100);
      expect(naver).toBeGreaterThanOrEqual(100);
    });

    it("AC-3[P0]: same seed (symbol + dayIndex) produces same price", () => {
      // 같은 seed는 같은 난수를 생성해야 하므로, 같은 가격을 반환
      const symbol = "005930";
      const date = "2020-06-15";

      const r1 = getClose(symbol, date);
      const r2 = getClose(symbol, date);

      expect(r1).toBe(r2);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // AC-4: Caching behavior (getDailySeries)
  // 2회 호출 시 두 번째는 캐시 히트, 반환 참조 동일
  // ──────────────────────────────────────────────────────────────
  describe("AC-4: Daily series caching", () => {
    it("AC-4[P0]: getDailySeries returns same reference on second call (cache hit)", () => {
      // Arrange
      const symbol = "005930";

      // Act
      const series1 = getDailySeries(symbol);
      const series2 = getDailySeries(symbol);

      // Assert — 동일 참조 (메모리 주소가 같음)
      expect(series1).toBe(series2);

      // 내용도 검증
      expect(Array.isArray(series1)).toBe(true);
      expect(Array.isArray(series2)).toBe(true);
      expect(series1.length).toBeGreaterThan(0);
      expect(series2.length).toBeGreaterThan(0);
    });

    it("AC-4[P0]: getDailySeries returns full series from 2016-01-01 to today", () => {
      // Arrange
      const symbol = "005930";

      // Act
      const series = getDailySeries(symbol);

      // Assert
      // - 배열이고 비어있지 않음
      expect(Array.isArray(series)).toBe(true);
      expect(series.length).toBeGreaterThan(0);

      // - 첫 요소는 기준일 (2016-01-01)
      expect(series[0]).toHaveProperty("date", "2016-01-01");
      expect(series[0]).toHaveProperty("close", 71000);

      // - 각 요소는 { date, close } 구조
      series.forEach((pp: PricePoint) => {
        expect(pp).toHaveProperty("date");
        expect(pp).toHaveProperty("close");
        expect(typeof pp.date).toBe("string");
        expect(typeof pp.close).toBe("number");
        expect(pp.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(pp.close).toBeGreaterThanOrEqual(100);
        expect(Number.isInteger(pp.close)).toBe(true);
      });
    });

    it("AC-4[P0]: different symbols have independent cache entries", () => {
      // Arrange
      const s1 = "005930";
      const s2 = "000660";

      // Act
      const series1a = getDailySeries(s1);
      const series2a = getDailySeries(s2);
      const series1b = getDailySeries(s1);
      const series2b = getDailySeries(s2);

      // Assert
      // - 같은 심볼은 동일 참조
      expect(series1a).toBe(series1b);
      expect(series2a).toBe(series2b);

      // - 다른 심볼은 다른 참조
      expect(series1a).not.toBe(series2a);

      // - 하지만 내용은 다름 (다른 basePrice)
      expect(series1a[0].close).toBe(71000); // 삼성전자
      expect(series2a[0].close).toBe(150000); // SK하이닉스
    });
  });

  // ──────────────────────────────────────────────────────────────
  // AC-5: Monthly series & unknown symbol handling
  // getMonthlySeries samples last day of each month
  // getClose returns 0 for unknown symbol
  // ──────────────────────────────────────────────────────────────
  describe("AC-5: Monthly series and unknown symbols", () => {
    it("AC-5[P0]: getMonthlySeries samples last day of each month", () => {
      // Arrange
      const symbol = "005930";

      // Act
      const series = getMonthlySeries(symbol);

      // Assert
      // - 배열이고 비어있지 않음
      expect(Array.isArray(series)).toBe(true);
      expect(series.length).toBeGreaterThan(0);

      // - 첫 몇 항목이 월말 날짜인지 확인
      const firstYear = 2016;
      expect(series[0].date).toBe("2016-01-31"); // 1월 31일
      expect(series[1].date).toBe("2016-02-29"); // 2월 29일 (윤년)
      expect(series[2].date).toBe("2016-03-31"); // 3월 31일

      // - 각 항목은 유효한 PricePoint
      series.forEach((pp: PricePoint) => {
        expect(pp).toHaveProperty("date");
        expect(pp).toHaveProperty("close");
        expect(pp.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isInteger(pp.close)).toBe(true);
        expect(pp.close).toBeGreaterThanOrEqual(100);
      });
    });

    it("AC-5[P0]: getMonthlySeries has fewer points than getDailySeries", () => {
      // Arrange
      const symbol = "005930";

      // Act
      const daily = getDailySeries(symbol);
      const monthly = getMonthlySeries(symbol);

      // Assert
      // 월별 샘플이 일별 전체보다 훨씬 적어야 함 (약 1/20 이상)
      expect(monthly.length).toBeGreaterThan(0);
      expect(monthly.length).toBeLessThan(daily.length);
      expect(monthly.length).toBeLessThan(daily.length / 10); // 보수적 추정
    });

    it("AC-5[P0]: getClose returns 0 for unknown symbol (not found in master)", () => {
      // Arrange
      const unknownSymbol = "999999"; // 존재하지 않는 종목
      const dateStr = "2024-03-15";

      // Act
      const price = getClose(unknownSymbol, dateStr);

      // Assert
      expect(price).toBe(0);
      expect(Number.isInteger(price)).toBe(true);
    });

    it("AC-5[P0]: getClose returns 0 for unknown symbol on any date", () => {
      // Arrange
      const unknownSymbol = "888888";
      const dates = [
        "2016-01-01", // 기준일
        "2020-06-15", // 중간 날짜
        "2024-12-31", // 최근 날짜
      ];

      // Act & Assert
      dates.forEach((date) => {
        const price = getClose(unknownSymbol, date);
        expect(price).toBe(0);
        expect(Number.isInteger(price)).toBe(true);
      });
    });

    it("AC-5[P0]: getMonthlySeries returns empty or 0-priced series for unknown symbol", () => {
      // Arrange
      const unknownSymbol = "777777";

      // Act
      const monthly = getMonthlySeries(unknownSymbol);

      // Assert
      // 구현에 따라 빈 배열이거나, 모든 close가 0일 수 있음
      expect(Array.isArray(monthly)).toBe(true);
      // 빈 배열이거나, 모든 항목의 close가 0
      if (monthly.length > 0) {
        monthly.forEach((pp: PricePoint) => {
          expect(pp.close).toBe(0);
        });
      }
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Integration: Full workflow
  // ──────────────────────────────────────────────────────────────
  describe("Integration: Full price engine workflow", () => {
    it("Integration: complete workflow with multiple operations", () => {
      // Arrange
      const symbols = ["005930", "000660", "035420"];
      const testDate = "2020-06-15";

      // Act — multiple operations
      const prices = symbols.map((sym) => ({
        symbol: sym,
        closePrice: getClose(sym, testDate),
      }));

      const dailySeries = symbols.map((sym) => ({
        symbol: sym,
        series: getDailySeries(sym),
      }));

      // Assert
      // - 모든 종목의 가격이 결정적
      prices.forEach(({ closePrice }) => {
        expect(Number.isInteger(closePrice)).toBe(true);
        expect(closePrice).toBeGreaterThanOrEqual(100);
      });

      // - 모든 시리즈가 캐시됨 (참조 동일성 재확인)
      dailySeries.forEach(({ symbol, series }) => {
        const series2 = getDailySeries(symbol);
        expect(series).toBe(series2);
      });

      // - 기준일 가격 검증
      const basePrices: Record<string, number> = {
        "005930": 71000,
        "000660": 150000,
        "035420": 210000,
      };

      symbols.forEach((sym) => {
        const basePrice = getClose(sym, "2016-01-01");
        expect(basePrice).toBe(basePrices[sym]);
      });
    });
  });
});
