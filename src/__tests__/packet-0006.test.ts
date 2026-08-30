// TDD red phase — 앱 전역 상태 Provider (AppStateContext), packet 0006.
// AppStateContext는 TDS/react-router를 쓰지 않는 순수 Context+훅이라 TDS/router mock 불필요.

import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react";
import {
  AppStateProvider,
  useAppState,
  type AppStateValue,
} from "@/store/AppStateContext";
import { getClose } from "@/lib/priceEngine";
import { todayKst } from "@/lib/date";

const DAILY_GRANT = 1_000_000;
const DEFAULT_CASH = 1_000_000; // defaultAccount()의 초기 지급액 — createdAt=오늘이라 최초 마운트엔 추가 지급 없음

function buyFee(qty: number, price: number): number {
  return Math.floor(qty * price * 0.00015);
}
function sellFee(qty: number, price: number): number {
  return Math.floor(qty * price * 0.00015) + Math.floor(qty * price * 0.0018);
}

// 계좌를 "어제 마지막 지급"으로 시드 — 오늘 진입 시 1일치 지급이 실제로 발생하는 상태를 만든다.
function seedYesterdayGrant(cash: number) {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  localStorage.setItem(
    "mta:account",
    JSON.stringify({ cash, lastGrantDate: yesterday, totalGranted: cash, createdAt: yesterday }),
  );
  localStorage.setItem(
    "mta:streak",
    JSON.stringify({ currentStreak: 0, longestStreak: 0, lastCheckInDate: "", totalBonus: 0 }),
  );
}

let captured: AppStateValue | null = null;
function Capture() {
  captured = useAppState();
  return null;
}

afterEach(() => {
  captured = null;
});

describe("앱 전역 상태 Provider (AppStateContext)", () => {
  it("AC-1[P0]: exports AppStateProvider/useAppState and exposes the full state shape", () => {
    render(
      React.createElement(AppStateProvider, null, React.createElement(Capture)),
    );

    expect(captured).not.toBeNull();
    const keys = Object.keys(captured as object);
    for (const key of [
      "account",
      "positions",
      "trades",
      "streak",
      "meta",
      "checkInResult",
      "refresh",
      "buy",
      "sell",
      "setDisclaimerSeen",
      "unlockReport",
    ]) {
      expect(keys).toContain(key);
    }
    // defaultAccount()는 createdAt=오늘로 만들어져 최초 마운트에선 추가 지급이 없다.
    expect(captured!.account.cash).toBe(DEFAULT_CASH);
    expect(captured!.checkInResult?.granted).toBe(false);
  });

  it("AC-2[P0]: StrictMode 이중 마운트에서도 일일 지급이 1회만 반영된다", () => {
    seedYesterdayGrant(5_000_000);

    render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(AppStateProvider, null, React.createElement(Capture)),
      ),
    );

    // StrictMode가 effect를 mount→cleanup→mount로 두 번 돌려도 ref 가드로 지급은 1회만.
    expect(captured!.account.cash).toBe(5_000_000 + DAILY_GRANT);
    expect(captured!.streak.currentStreak).toBe(1);
    expect(captured!.checkInResult?.granted).toBe(true);
  });

  it("AC-2[P0]: 새로고침(리마운트) 2회를 거쳐도 cash는 1일치만 증가한다", () => {
    seedYesterdayGrant(5_000_000);
    const expectedCash = 5_000_000 + DAILY_GRANT;

    const r1 = render(
      React.createElement(AppStateProvider, null, React.createElement(Capture)),
    );
    expect(captured!.account.cash).toBe(expectedCash);
    expect(captured!.checkInResult?.granted).toBe(true);
    r1.unmount();

    // 새로고침 1회째: 같은 날 재진입 — 날짜 가드가 재지급을 막는다.
    const r2 = render(
      React.createElement(AppStateProvider, null, React.createElement(Capture)),
    );
    expect(captured!.account.cash).toBe(expectedCash);
    expect(captured!.checkInResult?.granted).toBe(false);
    r2.unmount();

    // 새로고침 2회째: 여전히 1일치만 반영돼야 한다.
    const r3 = render(
      React.createElement(AppStateProvider, null, React.createElement(Capture)),
    );
    expect(captured!.account.cash).toBe(expectedCash);
    r3.unmount();
  });

  it("AC-3[P0]: Provider 밖에서 useAppState 호출 시 명확한 메시지로 throw한다", () => {
    function Lonely() {
      useAppState();
      return null;
    }
    expect(() => render(React.createElement(Lonely))).toThrow(/AppStateProvider/);
  });

  it("AC-4[P0]: buy 호출 후 상태가 즉시 갱신되고 localStorage에도 반영되며 새로고침 후 복원된다", () => {
    const r1 = render(
      React.createElement(AppStateProvider, null, React.createElement(Capture)),
    );
    const cashBefore = captured!.account.cash;
    expect(cashBefore).toBe(DEFAULT_CASH);

    const symbol = "069500"; // KODEX 200 — 기본가 34,000원대 저가 ETF
    const price = getClose(symbol, todayKst());
    const fee = buyFee(1, price);

    act(() => {
      const outcome = captured!.buy(symbol, 1);
      expect(outcome.ok).toBe(true);
    });

    const expectedCash = cashBefore - price - fee;
    expect(captured!.account.cash).toBe(expectedCash);
    expect(captured!.positions[symbol].qty).toBe(1);
    expect(captured!.trades.length).toBe(1);
    expect(captured!.trades[0].side).toBe("BUY");

    const storedAccount = JSON.parse(localStorage.getItem("mta:account")!);
    const storedPositions = JSON.parse(localStorage.getItem("mta:positions")!);
    expect(storedAccount.cash).toBe(expectedCash);
    expect(storedPositions[symbol].qty).toBe(1);
    r1.unmount();

    // 새로고침 후 복원 — 같은 날이라 재지급 없이 매수 반영분만 유지돼야 한다.
    render(React.createElement(AppStateProvider, null, React.createElement(Capture)));
    expect(captured!.account.cash).toBe(expectedCash);
    expect(captured!.positions[symbol].qty).toBe(1);
  });

  it("AC-4[P0]: sell 호출 후 보유수량이 줄고 현금이 늘며 localStorage에 반영된다", () => {
    render(React.createElement(AppStateProvider, null, React.createElement(Capture)));
    const symbol = "069500";
    const price = getClose(symbol, todayKst());

    act(() => {
      captured!.buy(symbol, 2);
    });
    const cashAfterBuy = captured!.account.cash;

    act(() => {
      const outcome = captured!.sell(symbol, 1);
      expect(outcome.ok).toBe(true);
    });

    const fee = sellFee(1, price);
    expect(captured!.account.cash).toBe(cashAfterBuy + price - fee);
    expect(captured!.positions[symbol].qty).toBe(1);
    expect(captured!.trades[captured!.trades.length - 1].side).toBe("SELL");

    const storedPositions = JSON.parse(localStorage.getItem("mta:positions")!);
    expect(storedPositions[symbol].qty).toBe(1);
  });

  it("AC-5[P1]: setDisclaimerSeen이 meta.disclaimerSeen을 true로 저장한다", () => {
    render(React.createElement(AppStateProvider, null, React.createElement(Capture)));
    expect(captured!.meta.disclaimerSeen).toBe(false);

    act(() => {
      captured!.setDisclaimerSeen();
    });

    expect(captured!.meta.disclaimerSeen).toBe(true);
    const storedMeta = JSON.parse(localStorage.getItem("mta:meta")!);
    expect(storedMeta.disclaimerSeen).toBe(true);
  });

  it("AC-5[P1]: unlockReport는 rewardUnlockedPresetIds에 중복 없이 최대 20개까지만 담는다", () => {
    render(React.createElement(AppStateProvider, null, React.createElement(Capture)));

    act(() => {
      captured!.unlockReport("preset-1");
      captured!.unlockReport("preset-1"); // 중복 — 추가되면 안 됨
    });
    expect(captured!.meta.rewardUnlockedPresetIds).toEqual(["preset-1"]);

    act(() => {
      for (let i = 2; i <= 25; i++) {
        captured!.unlockReport(`preset-${i}`);
      }
    });

    expect(captured!.meta.rewardUnlockedPresetIds.length).toBe(20);
    expect(captured!.meta.rewardUnlockedPresetIds[19]).toBe("preset-25");
    expect(captured!.meta.rewardUnlockedPresetIds).not.toContain("preset-1");

    const storedMeta = JSON.parse(localStorage.getItem("mta:meta")!);
    expect(storedMeta.rewardUnlockedPresetIds.length).toBe(20);
  });
});
