// TDD red phase — 백테스트 구성 화면 (S5) 종목/비중·실행·프리셋, packet 0014.
//
// src/pages/Backtest.tsx currently exists (equal-weight auto-distribution, no manual weight
// editing, no preset list/재실행/삭제 UI) but does NOT satisfy this packet's contract:
// manual per-item weight TextField, weight-sum validation, Toast on 6th-item overflow, and a
// saved-preset list with re-run/delete. These tests describe the packet-0014 contract and
// WILL fail until the Coder rewrites Backtest.tsx.
//
// Contract this test file imposes on the Coder (component test ids — see below):
//   - each selectable instrument: Chip with data-testid={`instrument-chip-${symbol}`}
//   - each selected instrument's weight input: data-testid={`weight-input-${symbol}`}
//     (numeric TextField, controlled — fireEvent.change sets the exact value)
//   - weight-sum card: data-testid="weight-sum-card" (per SPEC S5 layout contract)
//   - year Chips: data-testid={`year-chip-${years}`} for years in [1,3,5,10]
//   - run button label: "백테스트 실행하기" (SubmitFooter)
//   - saved preset row: data-testid={`preset-row-${id}`} (click → re-run/navigate)
//   - saved preset delete button: data-testid={`preset-delete-${id}`}

import { describe, it, expect } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

mockAll();

import Backtest from "@/pages/Backtest";
import { STORAGE_KEYS } from "@/lib/storage";
import type { BacktestPreset } from "@/lib/types";

// 실제 INSTRUMENTS 앞 6개 종목코드 (src/data/instruments.ts 검증됨)
const SYMBOLS = ["005930", "000660", "207940", "005380", "035420", "035720"];

function readPresets(): BacktestPreset[] {
  const raw = localStorage.getItem(STORAGE_KEYS.presets);
  return raw ? (JSON.parse(raw) as BacktestPreset[]) : [];
}

function seedPresets(presets: BacktestPreset[]) {
  localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets));
}

function makePreset(id: string, createdAt: string): BacktestPreset {
  return {
    id,
    name: `${id}-프리셋`,
    items: [
      { symbol: "005930", weight: 60 },
      { symbol: "069500", weight: 40 },
    ],
    years: 5,
    createdAt,
  };
}

function selectAndSetWeights(entries: Array<[symbol: string, weight: number]>) {
  for (const [symbol, weight] of entries) {
    fireEvent.click(screen.getByTestId(`instrument-chip-${symbol}`));
  }
  for (const [symbol, weight] of entries) {
    fireEvent.change(screen.getByTestId(`weight-input-${symbol}`), {
      target: { value: String(weight) },
    });
  }
}

describe("백테스트 구성 화면 (S5) — 종목/비중·실행·프리셋", () => {
  it("AC-1[P1]: 5개 선택 상태에서 6번째 종목 탭 시 Toast가 뜨고 선택되지 않는다", () => {
    renderWithRouter(React.createElement(Backtest));

    SYMBOLS.slice(0, 5).forEach((symbol) => {
      fireEvent.click(screen.getByTestId(`instrument-chip-${symbol}`));
    });
    SYMBOLS.slice(0, 5).forEach((symbol) => {
      expect(screen.getByTestId(`instrument-chip-${symbol}`).getAttribute("aria-pressed")).toBe(
        "true",
      );
    });

    fireEvent.click(screen.getByTestId(`instrument-chip-${SYMBOLS[5]}`));

    expect(screen.getByText("최대 5개까지 담을 수 있어요")).toBeTruthy();
    expect(
      screen.getByTestId(`instrument-chip-${SYMBOLS[5]}`).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("AC-2[P1]: 비중 합계가 100이 아니면 안내 문구가 보이고 실행 버튼이 disabled다", () => {
    renderWithRouter(React.createElement(Backtest));

    selectAndSetWeights([
      [SYMBOLS[0], 60],
      [SYMBOLS[1], 30],
    ]);

    expect(screen.getByText("비중 합계를 100%로 맞춰주세요 (현재 90%)")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "백테스트 실행하기" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("AC-3[P1]: 기간 Chip은 하나만 선택되며 기본값은 3년이다", () => {
    renderWithRouter(React.createElement(Backtest));

    expect(screen.getByTestId("year-chip-3").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("year-chip-1").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("year-chip-5").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("year-chip-10").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByTestId("year-chip-5"));

    expect(screen.getByTestId("year-chip-5").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("year-chip-3").getAttribute("aria-pressed")).toBe("false");
  });

  it("AC-4[P0]: 비중 100% 구성으로 실행하면 프리셋이 저장되고 결과 화면으로 이동한다", () => {
    renderWithRouter(React.createElement(Backtest));

    selectAndSetWeights([
      [SYMBOLS[0], 60],
      [SYMBOLS[1], 40],
    ]);
    fireEvent.click(screen.getByTestId("year-chip-5"));

    const runButton = screen.getByRole("button", { name: "백테스트 실행하기" }) as HTMLButtonElement;
    expect(runButton.disabled).toBe(false);
    fireEvent.click(runButton);

    const presets = readPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].years).toBe(5);
    expect(presets[0].items).toEqual([
      { symbol: SYMBOLS[0], weight: 60 },
      { symbol: SYMBOLS[1], weight: 40 },
    ]);

    expect(mockNavigate).toHaveBeenCalledWith("/backtest/result", {
      state: { presetId: presets[0].id, years: 5 },
    });
  });

  it("AC-4[P0]: 프리셋이 10개 저장된 상태에서 실행하면 11번째 저장 시 가장 오래된 1건이 삭제된다", () => {
    const existing = Array.from({ length: 10 }, (_, i) =>
      makePreset(`preset-${String(i).padStart(2, "0")}`, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00+09:00`),
    );
    seedPresets(existing);

    renderWithRouter(React.createElement(Backtest));

    selectAndSetWeights([
      [SYMBOLS[0], 100],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "백테스트 실행하기" }));

    const presets = readPresets();
    expect(presets).toHaveLength(10);
    expect(presets.some((p) => p.id === "preset-00")).toBe(false);
    expect(presets.some((p) => p.id === "preset-09")).toBe(true);
    expect(presets[presets.length - 1].items).toEqual([{ symbol: SYMBOLS[0], weight: 100 }]);
  });

  it("AC-5[P1]: 저장 목록 항목 탭 시 해당 프리셋으로 결과 화면 이동한다", () => {
    const preset = makePreset("preset-run-1", "2026-02-01T00:00:00+09:00");
    seedPresets([preset]);

    renderWithRouter(React.createElement(Backtest));

    fireEvent.click(screen.getByTestId(`preset-row-${preset.id}`));

    expect(mockNavigate).toHaveBeenCalledWith("/backtest/result", {
      state: { presetId: preset.id, years: preset.years },
    });
  });

  it("AC-5[P1]: 삭제 탭 시 목록과 저장소에서 제거되며 재마운트 후에도 유지된다", () => {
    const keep = makePreset("preset-keep", "2026-03-01T00:00:00+09:00");
    const remove = makePreset("preset-remove", "2026-03-02T00:00:00+09:00");
    seedPresets([keep, remove]);

    const { unmount } = renderWithRouter(React.createElement(Backtest));

    expect(screen.getByTestId(`preset-row-${remove.id}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId(`preset-delete-${remove.id}`));

    expect(screen.queryByTestId(`preset-row-${remove.id}`)).toBeNull();
    const afterDelete = readPresets();
    expect(afterDelete.some((p) => p.id === remove.id)).toBe(false);
    expect(afterDelete.some((p) => p.id === keep.id)).toBe(true);

    unmount();
    renderWithRouter(React.createElement(Backtest));

    expect(screen.queryByTestId(`preset-row-${remove.id}`)).toBeNull();
    expect(screen.getByTestId(`preset-row-${keep.id}`)).toBeTruthy();
  });
});
