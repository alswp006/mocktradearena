# Packet 0015: TDD Red Phase Complete

## Test Summary
- **File**: `src/__tests__/packet-0015.test.ts`
- **Status**: Red phase (20 failing tests, 1 pending)
- **Test Count**: 21 total tests organized in 6 describe blocks
- **Command**: `npx vitest run src/__tests__/packet-0015.test.ts`

## Current Test Results
```
❯ src/__tests__/packet-0015.test.ts (21 tests | 20 failed)
  ✓ should produce deterministic results across multiple calls (JSON.stringify only)
  ✗ 20 tests failing due to function signature mismatch
```

## What Tests Expect (Contract)

### Function Signature
```typescript
function runBacktest(
  presetItems: PresetItem[],
  years: BacktestYears
): BacktestResultData
```

### Return Type Structure
```typescript
interface BacktestResultData {
  series: Array<{ date: string; value: number }>;  // years*12+1 points
  totalReturn: number;                               // percentage
  cagr: number;                                      // CAGR percentage
  mdd: number;                                       // Maximum Drawdown (typically negative)
  sharpe: number;                                    // Sharpe ratio
  volatility: number;                                // Annualized volatility
  yearlyReturns: Array<{ year: number; ret: number }>; // Annual breakdown
}
```

### Key Properties
- **Determinism**: Identical (presetItems, years) → identical result on repeated calls
- **Series Format**: `[{ date: "YYYY-MM-DD", value: integer }, ...]` with exactly years×12+1 points
- **Amounts**: All equity values must be integers (Math.floor truncation)
- **Allocation**: Initial 10,000,000 KRW split by weight%, no dividends/fees/rebalancing
- **Edge Cases**: Zero volatility or ≤1 data points return 0 (never NaN/Infinity)
- **Type Export**: BacktestResultData must be exported from @/lib/types

## AC Coverage (5 Acceptance Criteria)

### AC-1[P0]: Determinism
**Tests**: 2
- Identical (items, years) → identical JSON output (3 tests)
- Series points match across calls (dates and values)

**Status**: 🔴 Red (expects series field; current impl returns monthlyEquity array)

### AC-2[P0]: Return Value Structure
**Tests**: 3
- All 7 required fields present (series, totalReturn, cagr, mdd, sharpe, volatility, yearlyReturns)
- All equity values are integers, all metrics are finite (no NaN/Infinity)
- Series length == years×12+1 for all periods [1, 3, 5, 10]

**Status**: 🔴 Red (current impl returns { ok: false, reason } on invalid input)

### AC-3[P0]: Edge Case Handling
**Tests**: 3
- Finite metrics even with single item (minimal volatility)
- Sharpe == 0 when volatility == 0 (no division by zero)
- No crash with minimal data variation

**Status**: 🔴 Red (expects series; current impl doesn't support this signature)

### AC-4[P0]: Capital Allocation
**Tests**: 3
- Initial value ≤ 10,000,000 (due to Math.floor on share quantities)
- 50/50, 30/20/30/20, 100% allocations distribute correctly
- No dividends, fees, or rebalancing effects

**Status**: 🔴 Red (signature mismatch)

### AC-5[P0]: Type Export
**Tests**: 2
- BacktestResultData type available from @/lib/types
- All fields ready-to-render without additional calculation

**Status**: 🔴 Red (type doesn't exist in types.ts yet)

## Integration Tests (6 tests)

### Multi-Period Handling
- 1-year backtest: 13 points, 1 yearly return
- 5-year backtest: 61 points, 5 yearly returns
- All periods [1, 3, 5, 10] handled correctly

### Determinism
- Mixed stock/ETF allocation returns identical results
- Multiple calls produce identical JSON output

### Weight Configurations
- Single item with 100% weight
- 5 items with equal/unequal weights
- All configurations return valid structures

## Next Steps (Green Phase)

### 1. Create BacktestResultData Type
Add to `src/lib/types.ts`:
```typescript
export interface BacktestResultData {
  series: Array<{ date: string; value: number }>;
  totalReturn: number;
  cagr: number;
  mdd: number;
  sharpe: number;
  volatility: number;
  yearlyReturns: Array<{ year: number; ret: number }>;
}
```

### 2. Refactor runBacktest Function
**Current** (Packet 0007):
```typescript
export function runBacktest(preset: BacktestPreset): BacktestCalcResult
```

**Required** (Packet 0015):
```typescript
export function runBacktest(
  presetItems: PresetItem[],
  years: BacktestYears
): BacktestResultData
```

Key changes:
- Accept presetItems and years directly (not bundled preset object)
- Transform monthlyEquity array → series array with { date, value } objects
- Transform yearly array → yearlyReturns array with { year, ret } objects
- Return data directly (not BacktestCalcResult with error handling)

### 3. Validation Remains at UI Layer
The runBacktest function assumes valid input:
- presetItems: 1-5 items
- weight sum: 100%
- All symbols exist in INSTRUMENTS

Validation is performed in Backtest.tsx (Packet 0014).

## Test Quality Notes
- ✅ Every AC has at least 1 test (AC-1,2,3,4,5 covered)
- ✅ Each test has 2+ expect() assertions with specific values
- ✅ Tests use real INSTRUMENTS data (verified at test time)
- ✅ Tests check both happy path and edge cases
- ✅ Determinism verified by repeated calls and JSON comparison
- ✅ Type safety: imports PresetItem, BacktestYears from @/lib/types

## Running Tests

Check red phase:
```bash
npx vitest run src/__tests__/packet-0015.test.ts
```

Watch mode (not recommended — hangs in CI):
```bash
# DO NOT USE in production build
# npx vitest src/__tests__/packet-0015.test.ts --watch
```

When implementation is ready:
```bash
# Should pass all 21 tests
npx vitest run src/__tests__/packet-0015.test.ts
```

Check for other test failures:
```bash
npx vitest run
```
