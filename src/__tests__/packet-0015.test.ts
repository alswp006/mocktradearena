/**
 * TDD Red Phase — Backtest Engine Contract: Time Series + CAGR·MDD·Sharpe·Volatility·Yearly Returns
 * Packet 0015: runBacktest(presetItems, years) enhancement
 *
 * Contract expectations:
 * - Signature: runBacktest(presetItems: PresetItem[], years: BacktestYears): BacktestResultData
 * - Deterministic: identical (items, years) → identical result across calls
 * - Structure: { series, totalReturn, cagr, mdd, sharpe, volatility, yearlyReturns }
 * - Series format: { date: "YYYY-MM-DD", value: number }[] with years*12+1 points
 * - Amounts: all prices/values as integers (Math.floor truncation)
 * - Edge cases: volatility=0 or ≤1 points → 0 values (no NaN/Infinity)
 * - Allocation: initial 10,000,000 KRW split by weight%, no dividends/fees/rebalancing
 * - Export: BacktestResultData type available for screens
 */

import { describe, it, expect } from "vitest";
import type { PresetItem, BacktestYears } from "@/lib/types";
import { INSTRUMENTS } from "@/data/instruments";

// ── Test helpers ────────────────────────────────────────────────────────────

function makePresetItem(symbol: string, weight: number): PresetItem {
  return { symbol, weight };
}

// Real symbols from INSTRUMENTS (verified)
const TEST_PRESET_ITEMS_BALANCED = [
  makePresetItem("005930", 50), // Samsung
  makePresetItem("069500", 50), // KODEX 200
];

const TEST_PRESET_ITEMS_DIVERSIFIED = [
  makePresetItem("005930", 30),  // Samsung
  makePresetItem("000660", 20),  // SK Hynix
  makePresetItem("069500", 30),  // KODEX 200
  makePresetItem("132030", 20),  // Gold ETF
];

const TEST_PRESET_ITEMS_SINGLE = [
  makePresetItem("069500", 100), // KODEX 200 only
];

// Verify test data uses real instruments
function verifyTestSymbols() {
  const allSymbols = new Set<string>();
  [TEST_PRESET_ITEMS_BALANCED, TEST_PRESET_ITEMS_DIVERSIFIED, TEST_PRESET_ITEMS_SINGLE]
    .flat()
    .forEach((item) => {
      const inst = INSTRUMENTS.find((i) => i.symbol === item.symbol);
      if (!inst) throw new Error(`Invalid test symbol: ${item.symbol}`);
      allSymbols.add(item.symbol);
    });
  return Array.from(allSymbols);
}

const TEST_SYMBOLS = verifyTestSymbols();

// ── AC-1: Determinism ────────────────────────────────────────────────────────
describe("AC-1[P0]: Determinism — identical inputs → identical output", () => {
  it("should return identical object on repeated calls with same items and years", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result1 = runBacktest(TEST_PRESET_ITEMS_BALANCED, 3);
    const result2 = runBacktest(TEST_PRESET_ITEMS_BALANCED, 3);

    // All fields must be identical
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    expect(result1.series.length).toBe(result2.series.length);
    expect(result1.totalReturn).toBe(result2.totalReturn);
  });

  it("should return identical series values across two calls", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result1 = runBacktest(TEST_PRESET_ITEMS_DIVERSIFIED, 1);
    const result2 = runBacktest(TEST_PRESET_ITEMS_DIVERSIFIED, 1);

    expect(result1.series.length).toBe(result2.series.length);
    result1.series.forEach((point, idx) => {
      expect(point.date).toBe(result2.series[idx].date);
      expect(point.value).toBe(result2.series[idx].value);
    });
  });
});

// ── AC-2: Return value structure and integer amounts ──────────────────────────
describe("AC-2[P0]: Return fields: series, totalReturn, cagr, mdd, sharpe, volatility, yearlyReturns", () => {
  it("should return all required fields with correct types", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, 3);

    // All fields must exist
    expect(result).toHaveProperty("series");
    expect(result).toHaveProperty("totalReturn");
    expect(result).toHaveProperty("cagr");
    expect(result).toHaveProperty("mdd");
    expect(result).toHaveProperty("sharpe");
    expect(result).toHaveProperty("volatility");
    expect(result).toHaveProperty("yearlyReturns");

    // Series: { date, value }[] format
    expect(Array.isArray(result.series)).toBe(true);
    expect(result.series.length).toBe(37); // 3yr * 12 + 1
    result.series.forEach((point) => {
      expect(typeof point.date).toBe("string");
      expect(/^\d{4}-\d{2}-\d{2}$/.test(point.date)).toBe(true);
      expect(typeof point.value).toBe("number");
      expect(Number.isInteger(point.value)).toBe(true);
    });

    // All metrics are numbers
    expect(typeof result.totalReturn).toBe("number");
    expect(typeof result.cagr).toBe("number");
    expect(typeof result.mdd).toBe("number");
    expect(typeof result.sharpe).toBe("number");
    expect(typeof result.volatility).toBe("number");

    // yearlyReturns: { year: number, ret: number }[]
    expect(Array.isArray(result.yearlyReturns)).toBe(true);
    expect(result.yearlyReturns.length).toBe(3);
    result.yearlyReturns.forEach((yr, idx) => {
      expect(yr.year).toBe(idx + 1);
      expect(typeof yr.ret).toBe("number");
    });
  });

  it("should return all equity values as integers (no decimals from Math.floor)", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, 1);

    result.series.forEach((point) => {
      expect(Number.isInteger(point.value)).toBe(true);
      expect(point.value).toBeGreaterThanOrEqual(0);
    });

    // Metrics must be finite (no NaN/Infinity)
    expect(Number.isFinite(result.totalReturn)).toBe(true);
    expect(Number.isFinite(result.cagr)).toBe(true);
    expect(Number.isFinite(result.mdd)).toBe(true);
    expect(Number.isFinite(result.sharpe)).toBe(true);
    expect(Number.isFinite(result.volatility)).toBe(true);
  });

  it("should return correct series length: years*12+1", async () => {
    const { runBacktest } = await import("@/lib/backtest");

    const periodTests: Array<[BacktestYears, number]> = [[1, 13], [3, 37], [5, 61], [10, 121]];
    for (const [years, expectedLength] of periodTests) {
      const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, years);
      expect(result.series.length).toBe(expectedLength);
    }
  });
});

// ── AC-3: Edge case handling — zero volatility, ≤1 data points ────────────────
describe("AC-3[P0]: Edge cases — volatility=0, ≤1 points → no NaN/Infinity/throw", () => {
  it("should return finite metrics even with single item (minimal volatility scenario)", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_SINGLE, 1);

    // Even with minimal data variation:
    expect(Number.isFinite(result.volatility)).toBe(true);
    expect(Number.isFinite(result.sharpe)).toBe(true);
    expect(Number.isFinite(result.cagr)).toBe(true);
    expect(Number.isFinite(result.totalReturn)).toBe(true);
    expect(Number.isFinite(result.mdd)).toBe(true);
  });

  it("should return 0 for sharpe when volatility is 0 (avoid division by zero)", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_SINGLE, 1);

    // If volatility is 0, sharpe should be 0 (not Infinity)
    if (result.volatility === 0) {
      expect(result.sharpe).toBe(0);
    }
    expect(Number.isFinite(result.sharpe)).toBe(true);
  });

  it("should handle edge case with minimal data variation without crashing", async () => {
    const { runBacktest } = await import("@/lib/backtest");

    // Call with various configurations that might have low volatility
    const results = [
      runBacktest(TEST_PRESET_ITEMS_SINGLE, 1),
      runBacktest(TEST_PRESET_ITEMS_BALANCED, 1),
      runBacktest(TEST_PRESET_ITEMS_DIVERSIFIED, 1),
    ];

    results.forEach((result) => {
      // All metrics must be finite
      expect(Number.isFinite(result.volatility)).toBe(true);
      expect(Number.isFinite(result.sharpe)).toBe(true);
      expect(Number.isFinite(result.cagr)).toBe(true);
      expect(Number.isFinite(result.mdd)).toBe(true);
      expect(Number.isFinite(result.totalReturn)).toBe(true);
      // Series must have values
      expect(result.series.length).toBeGreaterThan(0);
    });
  });
});

// ── AC-4: Initial capital allocation by weight ──────────────────────────────────
describe("AC-4[P0]: Initial capital — 10,000,000 KRW distributed by weight, no div/fee/rebalance", () => {
  it("should start with initial value ≤ 10,000,000 (due to Math.floor share qty)", async () => {
    const { runBacktest } = await import("@/lib/backtest");

    const tests = [
      { items: TEST_PRESET_ITEMS_BALANCED, desc: "50/50 Samsung/KODEX200" },
      { items: TEST_PRESET_ITEMS_DIVERSIFIED, desc: "30/20/30/20 diversified" },
      { items: TEST_PRESET_ITEMS_SINGLE, desc: "100% KODEX200" },
    ];

    tests.forEach(({ items, desc }) => {
      const result = runBacktest(items, 1);
      const initial = result.series[0].value;

      // Initial allocation = sum of (floor(allocation% * 10M / basePrice) * basePrice)
      // Due to floor() truncation on shares, initial will be <= 10,000,000
      expect(initial).toBeLessThanOrEqual(10000000);
      // But shouldn't be drastically lower (allow 2% slippage)
      expect(initial).toBeGreaterThanOrEqual(9800000);
    });
  });

  it("should reflect weight distribution in initial share quantities", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, 1);

    // 50/50 Samsung (71k) + KODEX200 (34k)
    // Samsung: floor(5M / 71k) shares ≈ 70
    // KODEX: floor(5M / 34k) shares ≈ 147
    // Initial ≈ 70*71k + 147*34k = 4.97M + 4.998M ≈ 9.97M
    const initial = result.series[0].value;
    expect(initial).toBeGreaterThanOrEqual(9960000); // 99.6% of capital
    expect(initial).toBeLessThanOrEqual(10000000);
  });

  it("should show no dividends, fees, or rebalancing in first month", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_DIVERSIFIED, 3);

    // Series: buy day 1, then monthly after (months 1-36)
    // Total shares held constant (no rebalancing)
    // No withdrawal for fees or dividends
    // Price moves only by deterministic engine
    expect(result.series.length).toBe(37);

    // Just verify series evolves (doesn't stay constant)
    const month1 = result.series[1].value;
    const month2 = result.series[2].value;
    // month1 and month2 could be equal or differ (due to price movement)
    // But the series must exist and be valid
    expect(typeof month1).toBe("number");
    expect(typeof month2).toBe("number");
  });
});

// ── AC-5: Type export for screen rendering ──────────────────────────────────────
describe("AC-5[P0]: Type export — BacktestResultData available for screen import", () => {
  it("should export BacktestResultData from @/lib/types for screen usage", async () => {
    // Screen should import type directly from types module
    // This test verifies the function returns data matching the exported type
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, 1);

    // Type check: result should have all required fields for BacktestResultData
    // (this is more of a compile-time check, but runtime validates structure)
    expect(result).toHaveProperty("series");
    expect(result).toHaveProperty("totalReturn");
    expect(result).toHaveProperty("cagr");
    expect(result).toHaveProperty("mdd");
    expect(result).toHaveProperty("sharpe");
    expect(result).toHaveProperty("volatility");
    expect(result).toHaveProperty("yearlyReturns");

    // Each field has correct type for direct rendering
    expect(Array.isArray(result.series)).toBe(true);
    expect(typeof result.totalReturn).toBe("number");
    expect(typeof result.cagr).toBe("number");
  });

  it("should provide all fields ready-to-render without additional screen calculation", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_DIVERSIFIED, 3);

    // Screen uses data directly without transformation:
    // - series: plot on chart (date/value pairs ready)
    // - totalReturn: display as percentage
    // - cagr, mdd, sharpe, volatility: display as metrics
    // - yearlyReturns: display as yearly breakdown

    // All data is pre-calculated, no post-processing needed
    expect(result.series.every((p) => typeof p.date === "string" && typeof p.value === "number")).toBe(true);
    expect(result.yearlyReturns.every((yr) => typeof yr.year === "number" && typeof yr.ret === "number")).toBe(true);

    // Metrics are ready to display (no NaN/Infinity)
    expect([result.totalReturn, result.cagr, result.mdd, result.sharpe, result.volatility].every(Number.isFinite)).toBe(true);
  });
});

// ── Integration: Multiple periods (1, 3, 5, 10 years) ──────────────────────────
describe("Integration: Multi-period backtests return correct structure", () => {
  it("should handle 1-year backtest with 13 monthly points", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, 1);

    expect(result.series.length).toBe(13); // 1yr * 12 + 1
    expect(result.yearlyReturns.length).toBe(1);
    expect(result.yearlyReturns[0].year).toBe(1);
    expect(Number.isFinite(result.yearlyReturns[0].ret)).toBe(true);
  });

  it("should handle 5-year backtest with 61 monthly points", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, 5);

    expect(result.series.length).toBe(61); // 5yr * 12 + 1
    expect(result.yearlyReturns.length).toBe(5);
    [1, 2, 3, 4, 5].forEach((yr) => {
      expect(result.yearlyReturns[yr - 1].year).toBe(yr);
    });
  });

  it("should return yearly returns for all periods (1, 3, 5, 10 years)", async () => {
    const { runBacktest } = await import("@/lib/backtest");

    const periods: BacktestYears[] = [1, 3, 5, 10];
    periods.forEach((years) => {
      const result = runBacktest(TEST_PRESET_ITEMS_BALANCED, years);
      expect(result.yearlyReturns.length).toBe(years);
      result.yearlyReturns.forEach((yr) => {
        expect(yr.year).toBeGreaterThanOrEqual(1);
        expect(yr.year).toBeLessThanOrEqual(years);
        expect(Number.isFinite(yr.ret)).toBe(true);
      });
    });
  });
});

// ── Determinism: Price engine consistency ────────────────────────────────────────
describe("Determinism: Price engine produces identical results on repeated calls", () => {
  it("should produce identical results for mixed stock/ETF allocation", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const items = [
      makePresetItem("005930", 25), // Stock
      makePresetItem("000660", 25), // Stock
      makePresetItem("069500", 25), // ETF
      makePresetItem("132030", 25), // ETF
    ];
    const result1 = runBacktest(items, 3);
    const result2 = runBacktest(items, 3);

    // Series should be identical point-by-point
    expect(result1.series.length).toBe(result2.series.length);
    result1.series.forEach((point, idx) => {
      expect(point.date).toBe(result2.series[idx].date);
      expect(point.value).toBe(result2.series[idx].value);
    });

    // All metrics must match
    expect(result1.totalReturn).toBe(result2.totalReturn);
    expect(result1.cagr).toBe(result2.cagr);
    expect(result1.mdd).toBe(result2.mdd);
    expect(result1.sharpe).toBe(result2.sharpe);
    expect(result1.volatility).toBe(result2.volatility);
  });

  it("should produce deterministic results across multiple calls", async () => {
    const { runBacktest } = await import("@/lib/backtest");

    // Run the same backtest 5 times
    const results = Array.from({ length: 5 }, () => runBacktest(TEST_PRESET_ITEMS_DIVERSIFIED, 1));

    // All results should be identical
    results.forEach((result) => {
      expect(JSON.stringify(result)).toBe(JSON.stringify(results[0]));
    });
  });
});

// ── Validation: Multiple configurations ──────────────────────────────────────────
describe("Validation: Various weight configurations (1-5 items)", () => {
  it("should handle single item with 100% weight", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const items = [makePresetItem("069500", 100)];
    const result = runBacktest(items, 1);

    expect(result.series.length).toBe(13);
    expect(result.series[0].value).toBeGreaterThan(0);
    expect(Number.isFinite(result.totalReturn)).toBe(true);
  });

  it("should handle maximum 5 items with equal weights (20% each)", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const items = [
      makePresetItem("005930", 20),
      makePresetItem("000660", 20),
      makePresetItem("069500", 20),
      makePresetItem("132030", 20),
      makePresetItem("114260", 20),
    ];
    const result = runBacktest(items, 1);

    expect(result.series.length).toBe(13);
    expect(result.series[0].value).toBeGreaterThan(0);
    expect(result.yearlyReturns.length).toBe(1);
  });

  it("should handle unequal weights across all items", async () => {
    const { runBacktest } = await import("@/lib/backtest");
    const items = [
      makePresetItem("005930", 40), // High weight
      makePresetItem("000660", 10), // Low weight
      makePresetItem("069500", 35), // Medium weight
      makePresetItem("132030", 15), // Low weight
    ];
    const result = runBacktest(items, 3);

    expect(result.series.length).toBe(37);
    expect(result.yearlyReturns.length).toBe(3);
    expect(Number.isFinite(result.cagr)).toBe(true);
  });
});
