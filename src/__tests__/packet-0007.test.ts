/**
 * Packet 0007: 백테스트 계산 엔진 (시계열·CAGR·MDD·샤프)
 * TDD Red Phase — Tests ONLY (implementation src/lib/backtest.ts not yet exists)
 */

import { describe, it, expect } from "vitest";
import type { BacktestPreset, BacktestResult } from "@/lib/types";
import { runBacktest } from "@/lib/backtest";

// 테스트용 정상 프리셋 (1년, weight 합계 100)
const validPreset1Year: BacktestPreset = {
  id: "preset-1",
  name: "테스트-1년",
  items: [
    { symbol: "005930", weight: 50 }, // 삼성전자
    { symbol: "000660", weight: 50 }, // SK하이닉스
  ],
  years: 1,
  createdAt: new Date().toISOString(),
};

// 테스트용 정상 프리셋 (3년)
const validPreset3Years: BacktestPreset = {
  id: "preset-3",
  name: "테스트-3년",
  items: [
    { symbol: "005930", weight: 60 },
    { symbol: "000660", weight: 40 },
  ],
  years: 3,
  createdAt: new Date().toISOString(),
};

// weight 합계가 100이 아닌 프리셋
const invalidPresetWrongWeight: BacktestPreset = {
  id: "preset-invalid-1",
  name: "잘못된-weight",
  items: [
    { symbol: "005930", weight: 50 },
    { symbol: "000660", weight: 40 }, // 합계 90
  ],
  years: 1,
  createdAt: new Date().toISOString(),
};

// items가 0개인 프리셋
const invalidPresetNoItems: BacktestPreset = {
  id: "preset-invalid-2",
  name: "항목없음",
  items: [],
  years: 1,
  createdAt: new Date().toISOString(),
};

// items가 6개인 프리셋 (5개 초과)
const invalidPresetTooManyItems: BacktestPreset = {
  id: "preset-invalid-3",
  name: "항목많음",
  items: [
    { symbol: "005930", weight: 17 },
    { symbol: "000660", weight: 17 },
    { symbol: "051910", weight: 16 },
    { symbol: "035720", weight: 16 },
    { symbol: "055550", weight: 17 },
    { symbol: "207940", weight: 17 }, // 6개
  ],
  years: 1,
  createdAt: new Date().toISOString(),
};

type BacktestCalcResult = BacktestResult | { ok: false; reason: string };

// 함수 import는 구현 후 활성화 (현재 TDD red phase)
// import { runBacktest } from "@/lib/backtest";

describe("Packet 0007: 백테스트 계산 엔진 (시계열·CAGR·MDD·샤프)", () => {
  // ── AC1: monthlyEquity 길이, initialAmount, finalAmount 검증 ──
  describe("AC-1: 기본 출력 구조 (monthlyEquity 길이, initialAmount, finalAmount)", () => {
    it("should return monthlyEquity with length === years*12+1 for 1-year preset", () => {
      // Arrange
      const preset = validPreset1Year;
      const expectedLength = preset.years * 12 + 1; // 1*12+1 = 13

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result).toHaveProperty("monthlyEquity");
      expect(Array.isArray(result.monthlyEquity)).toBe(true);
      expect(result.monthlyEquity).toHaveLength(expectedLength);
    });

    it("should return monthlyEquity with length === years*12+1 for 3-year preset", () => {
      // Arrange
      const preset = validPreset3Years;
      const expectedLength = preset.years * 12 + 1; // 3*12+1 = 37

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.monthlyEquity).toHaveLength(expectedLength);
    });

    it("should have initialAmount exactly 10000000", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.initialAmount).toBe(10000000);
    });

    it("should have finalAmount as integer", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(Number.isInteger(result.finalAmount)).toBe(true);
      expect(typeof result.finalAmount).toBe("number");
    });

    it("should have monthlyEquity[0] === initialAmount", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.monthlyEquity[0]).toBe(result.initialAmount);
    });

    it("should have monthlyEquity[-1] === finalAmount", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.monthlyEquity[result.monthlyEquity.length - 1]).toBe(
        result.finalAmount,
      );
    });
  });

  // ── AC2: 소수 2자리 반올림, mddPct <= 0 검증 ──
  describe("AC-2: 숫자 필드 반올림 및 부호 검증", () => {
    it("should have totalReturnPct rounded to 2 decimal places", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.totalReturnPct).toBeDefined();
      expect(typeof result.totalReturnPct).toBe("number");
      // 2자리 반올림: Math.round(x * 100) / 100
      const rounded = Math.round(result.totalReturnPct * 100) / 100;
      expect(result.totalReturnPct).toBe(rounded);
    });

    it("should have cagrPct rounded to 2 decimal places", () => {
      // Arrange
      const preset = validPreset3Years;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.cagrPct).toBeDefined();
      const rounded = Math.round(result.cagrPct * 100) / 100;
      expect(result.cagrPct).toBe(rounded);
    });

    it("should have mddPct as negative or zero", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.mddPct).toBeLessThanOrEqual(0);
    });

    it("should have mddPct rounded to 2 decimal places", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      const rounded = Math.round(result.mddPct * 100) / 100;
      expect(result.mddPct).toBe(rounded);
    });

    it("should have sharpe rounded to 2 decimal places", () => {
      // Arrange
      const preset = validPreset3Years;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      const rounded = Math.round(result.sharpe * 100) / 100;
      expect(result.sharpe).toBe(rounded);
    });

    it("should have volatilityPct rounded to 2 decimal places", () => {
      // Arrange
      const preset = validPreset3Years;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      const rounded = Math.round(result.volatilityPct * 100) / 100;
      expect(result.volatilityPct).toBe(rounded);
    });
  });

  // ── AC3: 결정론 (동일 프리셋 3회 호출 시 완전히 동일한 결과) ──
  describe("AC-3: 결정론 (Determinism) — 동일 입력 3회 호출 시 동일 결과", () => {
    it("should return identical result on 3 consecutive calls with same preset", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result1 = runBacktest(preset) as BacktestResult;
      const result2 = runBacktest(preset) as BacktestResult;
      const result3 = runBacktest(preset) as BacktestResult;

      // Assert — 모든 숫자 필드 검증
      expect(result1.monthlyEquity).toEqual(result2.monthlyEquity);
      expect(result2.monthlyEquity).toEqual(result3.monthlyEquity);

      expect(result1.totalReturnPct).toBe(result2.totalReturnPct);
      expect(result2.totalReturnPct).toBe(result3.totalReturnPct);

      expect(result1.cagrPct).toBe(result2.cagrPct);
      expect(result2.cagrPct).toBe(result3.cagrPct);

      expect(result1.mddPct).toBe(result2.mddPct);
      expect(result2.mddPct).toBe(result3.mddPct);

      expect(result1.sharpe).toBe(result2.sharpe);
      expect(result2.sharpe).toBe(result3.sharpe);

      expect(result1.volatilityPct).toBe(result2.volatilityPct);
      expect(result2.volatilityPct).toBe(result3.volatilityPct);

      expect(result1.finalAmount).toBe(result2.finalAmount);
      expect(result2.finalAmount).toBe(result3.finalAmount);
    });
  });

  // ── AC4: yearly 배열 길이 및 구조 검증 ──
  describe("AC-4: yearly 배열 길이 및 {year, returnPct} 구조", () => {
    it("should have yearly array with length === preset.years for 1-year preset", () => {
      // Arrange
      const preset = validPreset1Year;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.yearly).toHaveLength(preset.years);
    });

    it("should have yearly array with length === preset.years for 3-year preset", () => {
      // Arrange
      const preset = validPreset3Years;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      expect(result.yearly).toHaveLength(preset.years);
    });

    it("should have yearly items with {year, returnPct} structure", () => {
      // Arrange
      const preset = validPreset3Years;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      result.yearly.forEach((item, index) => {
        expect(item).toHaveProperty("year");
        expect(item).toHaveProperty("returnPct");
        expect(typeof item.year).toBe("number");
        expect(typeof item.returnPct).toBe("number");
        expect(item.year).toBe(index + 1); // year는 1, 2, 3, ...
      });
    });

    it("should have yearly[].returnPct rounded to 2 decimal places", () => {
      // Arrange
      const preset = validPreset3Years;

      // Act
      const result: BacktestCalcResult = runBacktest(preset);
      if ("ok" in result && !result.ok) throw new Error(result.reason);

      // Assert
      result.yearly.forEach((item) => {
        const rounded = Math.round(item.returnPct * 100) / 100;
        expect(item.returnPct).toBe(rounded);
      });
    });
  });

  // ── AC5: 검증 실패 (weight 합계, items 개수) ──
  describe("AC-5: 검증 실패 — weight 합계 != 100 또는 items 개수 0/6+", () => {
    it("should reject preset with weight sum != 100 and return {ok:false, reason}", () => {
      // Arrange
      const preset = invalidPresetWrongWeight; // weight 합계 90

      // Act
      const result = runBacktest(preset);

      // Assert
      expect("ok" in result).toBe(true);
      expect((result as { ok: false; reason: string }).ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBeDefined();
      expect(
        (result as { ok: false; reason: string }).reason,
      ).toContain("weight");
    });

    it("should reject preset with 0 items and return {ok:false, reason}", () => {
      // Arrange
      const preset = invalidPresetNoItems;

      // Act
      const result = runBacktest(preset);

      // Assert
      expect("ok" in result).toBe(true);
      expect((result as { ok: false; reason: string }).ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBeDefined();
      expect(
        (result as { ok: false; reason: string }).reason,
      ).toContain("item");
    });

    it("should reject preset with 6 items (>5) and return {ok:false, reason}", () => {
      // Arrange
      const preset = invalidPresetTooManyItems;

      // Act
      const result = runBacktest(preset);

      // Assert
      expect("ok" in result).toBe(true);
      expect((result as { ok: false; reason: string }).ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBeDefined();
      expect(
        (result as { ok: false; reason: string }).reason,
      ).toContain("item");
    });

    it("should NOT throw an error on validation failure (graceful rejection)", () => {
      // Arrange
      const preset = invalidPresetWrongWeight;

      // Act & Assert — 함수가 throw하지 않고 {ok:false, reason}을 반환
      expect(() => {
        runBacktest(preset);
      }).not.toThrow();
    });
  });
});

// 구현 파일이 생성되면 아래 코드를 활성화
// function runBacktest(preset: BacktestPreset): BacktestResult | { ok: false; reason: string } {
//   throw new Error("Not yet implemented");
// }
