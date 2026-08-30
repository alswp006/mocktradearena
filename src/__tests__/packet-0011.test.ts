// TDD red phase — 주문 화면 (S3) 매수/매도·미리보기·체결, packet 0011.
//
// src/pages/Trade.tsx already exists as a routing-scaffold placeholder from packet 0019
// (라우팅 배선), but it was never driven by this packet's ACs — e.g. it shows
// "종목 정보를 찾지 못했어요" instead of the spec copy "종목을 찾을 수 없어요", validates
// qty/cash only inside handleSubmit (not reactively as the field changes), and uses
// ButtonStack(매수/매도 + 마켓으로 돌아가기) instead of a single SubmitFooter. These tests
// describe the packet-0011 contract and WILL fail until the Coder rewrites Trade.tsx.
//
// Contract this test file requires from Trade.tsx (beyond existing Card/EmptyState testIds):
//   - data-testid="trade-qty-input" on the quantity TextField's <input>
//   - data-testid="trade-submit-button" on the primary 체결 CTA
//   - validation (잔액 부족 / 보유수량 초과) is reactive — it reflects the CURRENT qty field
//     value immediately (no submit click required first), matching ui-design.md's inline-error
//     rule and AC-2's "실시간 갱신" requirement.
//
// Strategy: use the REAL AppStateProvider (src/store/AppStateContext) — buy()/sell() already
// implement the fee/avgPrice math (packet 0005) — and seed localStorage via src/lib/storage.ts
// for precise control over cash/positions per AC.

import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockRouter();

import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { AppStateProvider } from "@/store/AppStateContext";
import Trade from "@/pages/Trade";
import { saveAccount, savePositions, loadPositions, loadTrades } from "@/lib/storage";
import { todayKst, parseKSTDate } from "@/lib/date";
import { getClose } from "@/lib/priceEngine";
import { getInstrument } from "@/data/instruments";
import { formatNumber } from "@/lib/utils";
import type { Account, PositionMap } from "@/lib/types";

const BUY_FEE_RATE = 0.00015;
const SELL_TAX_RATE = 0.0018;

function buyFee(amount: number): number {
  return Math.floor(amount * BUY_FEE_RATE);
}

function sellFee(amount: number): number {
  return Math.floor(amount * BUY_FEE_RATE) + Math.floor(amount * SELL_TAX_RATE);
}

function seedAccount(overrides: Partial<Account> = {}) {
  saveAccount({
    cash: 5_000_000,
    lastGrantDate: parseKSTDate(todayKst()),
    totalGranted: 1_000_000,
    createdAt: parseKSTDate(todayKst()),
    ...overrides,
  });
}

function seedPositions(positions: PositionMap = {}) {
  savePositions(positions);
}

function renderTrade(symbol: string) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/trade/${symbol}`] },
      React.createElement(
        AppStateProvider,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/trade/:symbol", element: React.createElement(Trade) }),
        ),
      ),
    ),
  );
}

describe("주문 화면 (S3) — 매수/매도·미리보기·체결", () => {
  // ── AC-1: 알 수 없는 종목 ──
  it("AC-1: 마스터에 없는 symbol이면 '종목을 찾을 수 없어요' 안내와 '마켓으로 돌아가기' 버튼만 렌더하고 크래시하지 않는다", () => {
    seedAccount();
    seedPositions({});

    renderTrade("000000");

    expect(screen.getByText("종목을 찾을 수 없어요").textContent).toBe("종목을 찾을 수 없어요");
    expect(screen.queryByTestId("trade-qty-input")).toBeNull();
    expect(screen.queryByTestId("order-preview-card")).toBeNull();

    const backButton = screen.getByRole("button", { name: "마켓으로 돌아가기" });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith("/market");
  });

  // ── AC-2: 수량 입력 시 실시간 미리보기 갱신 ──
  describe("AC-2: 수량 입력 시 예상 체결금액·수수료·거래 후 잔액이 실시간 갱신된다", () => {
    it("수량이 비어있으면(0주) 예상 체결금액·수수료가 0원이고 체결 버튼이 disabled다", () => {
      seedAccount({ cash: 5_000_000 });
      seedPositions({});

      renderTrade("005930");

      const preview = screen.getByTestId("order-preview-card");
      expect(preview.textContent).toContain("0원");
      const submitButton = screen.getByTestId("trade-submit-button") as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });

    it("수량 10 → 20으로 바꾸면 체결금액·수수료·주문 후 잔액이 각각 재계산되어 표시된다", () => {
      const cash = 5_000_000;
      seedAccount({ cash });
      seedPositions({});

      renderTrade("005930");
      const price = getClose("005930", todayKst());
      const qtyInput = screen.getByTestId("trade-qty-input");
      const preview = screen.getByTestId("order-preview-card");

      fireEvent.change(qtyInput, { target: { value: "10" } });
      const amount10 = 10 * price;
      const fee10 = buyFee(amount10);
      expect(preview.textContent).toContain(formatNumber(amount10));
      expect(preview.textContent).toContain(formatNumber(fee10));
      expect(preview.textContent).toContain(formatNumber(cash - amount10 - fee10));

      fireEvent.change(qtyInput, { target: { value: "20" } });
      const amount20 = 20 * price;
      const fee20 = buyFee(amount20);
      expect(preview.textContent).toContain(formatNumber(amount20));
      expect(preview.textContent).toContain(formatNumber(fee20));
      expect(preview.textContent).toContain(formatNumber(cash - amount20 - fee20));
    });
  });

  // ── AC-3: 매수 시 현금 부족 차단 ──
  describe("AC-3: 매수 필요 금액이 보유 현금을 초과하면 TextField 에러 + 체결 버튼 disabled", () => {
    it("현금이 충분하면 에러가 없고 체결 버튼이 활성 상태다", () => {
      seedAccount({ cash: 5_000_000 });
      seedPositions({});

      renderTrade("005930");
      fireEvent.change(screen.getByTestId("trade-qty-input"), { target: { value: "10" } });

      expect(screen.queryByRole("alert")).toBeNull();
      const submitButton = screen.getByTestId("trade-submit-button") as HTMLButtonElement;
      expect(submitButton.disabled).toBe(false);
    });

    it("현금이 부족하면 '잔액이 부족해요' 에러가 뜨고 체결 버튼이 disabled다", () => {
      seedAccount({ cash: 1_000 });
      seedPositions({});

      renderTrade("005930");
      fireEvent.change(screen.getByTestId("trade-qty-input"), { target: { value: "1" } });

      const error = screen.getByRole("alert");
      expect(error.textContent).toBe("잔액이 부족해요");
      const submitButton = screen.getByTestId("trade-submit-button") as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });
  });

  // ── AC-4: 매도 보유수량 초과 차단 + 미보유 종목 매도 비활성 ──
  describe("AC-4: 매도 수량 초과 차단 및 미보유 종목 매도 비활성", () => {
    it("보유 3주인데 5주 매도 입력 시 '보유 수량은 3주예요' 에러가 뜨고 체결 버튼이 disabled다", () => {
      seedAccount({ cash: 5_000_000 });
      seedPositions({ "005930": { symbol: "005930", qty: 3, avgPrice: 60000 } });

      renderTrade("005930");
      fireEvent.click(screen.getByRole("tab", { name: "매도" }));
      fireEvent.change(screen.getByTestId("trade-qty-input"), { target: { value: "5" } });

      const error = screen.getByRole("alert");
      expect(error.textContent).toBe("보유 수량은 3주예요");
      const submitButton = screen.getByTestId("trade-submit-button") as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });

    it("미보유 종목(069500)에서 매도 탭 선택 시 수량 입력이 disabled고 '보유 중인 수량이 없어요' 안내가 보인다", () => {
      seedAccount({ cash: 5_000_000 });
      seedPositions({});

      renderTrade("069500");
      fireEvent.click(screen.getByRole("tab", { name: "매도" }));

      expect(screen.getByText("보유 중인 수량이 없어요").textContent).toBe("보유 중인 수량이 없어요");
      const qtyInput = screen.getByTestId("trade-qty-input") as HTMLInputElement;
      expect(qtyInput.disabled).toBe(true);
    });
  });

  // ── AC-5: 체결 성공 → Toast + haptic + navigate + 영속화 ──
  describe("AC-5: 체결 성공 시 Toast+haptic 후 포트폴리오로 이동하고 거래내역·보유종목에 반영된다", () => {
    it("매수 체결 성공 시 Toast·success 햅틱·navigate가 발생하고 positions/trades에 저장된다", () => {
      seedAccount({ cash: 5_000_000 });
      seedPositions({});

      renderTrade("005930");
      const price = getClose("005930", todayKst());
      fireEvent.change(screen.getByTestId("trade-qty-input"), { target: { value: "10" } });
      fireEvent.click(screen.getByTestId("trade-submit-button"));

      const name = getInstrument("005930")!.name;
      expect(screen.getByText(`${name} 10주 매수 체결`).textContent).toBe(`${name} 10주 매수 체결`);
      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
      expect(mockNavigate).toHaveBeenCalledWith("/portfolio", {
        state: { justTradedSymbol: "005930" },
      });

      const positions = loadPositions();
      expect(positions["005930"]).toEqual({ symbol: "005930", qty: 10, avgPrice: price });

      const trades = loadTrades();
      const last = trades[trades.length - 1];
      expect(last.side).toBe("BUY");
      expect(last.qty).toBe(10);
      expect(last.symbol).toBe("005930");
    });

    it("매도 체결 성공 시 잔량이 줄고(전량 매도는 포지션 삭제) 거래내역에 SELL 1건이 추가된다", () => {
      seedAccount({ cash: 0 });
      seedPositions({ "005930": { symbol: "005930", qty: 10, avgPrice: 60000 } });

      renderTrade("005930");
      const price = getClose("005930", todayKst());
      fireEvent.click(screen.getByRole("tab", { name: "매도" }));
      fireEvent.change(screen.getByTestId("trade-qty-input"), { target: { value: "10" } });
      fireEvent.click(screen.getByTestId("trade-submit-button"));

      expect(mockNavigate).toHaveBeenCalledWith("/portfolio", {
        state: { justTradedSymbol: "005930" },
      });

      const amount = 10 * price;
      const fee = sellFee(amount);
      const account = JSON.parse(localStorage.getItem("mta:account") as string);
      expect(account.cash).toBe(amount - fee);

      const positions = loadPositions();
      expect(positions["005930"]).toBeUndefined();

      const trades = loadTrades();
      const last = trades[trades.length - 1];
      expect(last.side).toBe("SELL");
      expect(last.qty).toBe(10);
    });
  });
});
