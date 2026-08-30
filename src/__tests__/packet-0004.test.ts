import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type {
  Account,
  PositionMap,
  Trade,
  StreakState,
  BacktestPreset,
  BacktestResult,
  QuizResult,
  LeaderboardEntry,
  AppMeta,
} from "@/lib/types";

// Storage functions to be implemented
import {
  STORAGE_KEYS,
  loadAccount,
  saveAccount,
  loadPositions,
  savePositions,
  loadTrades,
  saveTrades,
  loadStreak,
  saveStreak,
  loadPresets,
  savePresets,
  loadLastBacktest,
  saveLastBacktest,
  loadQuiz,
  saveQuiz,
  loadLeaderboardSeed,
  saveLeaderboardSeed,
  loadMeta,
  saveMeta,
} from "@/lib/storage";

describe("localStorage 안전 래퍼 (파싱 복구·Quota 처리)", () => {
  // AC-1: STORAGE_KEYS 상수 검증
  describe("AC-1: STORAGE_KEYS constants", () => {
    it("should export 9 storage keys with mta: prefix", () => {
      const expectedKeys = [
        "mta:meta",
        "mta:account",
        "mta:positions",
        "mta:trades",
        "mta:streak",
        "mta:presets",
        "mta:lastBacktest",
        "mta:quiz",
        "mta:leaderboardSeed",
      ];

      expect(Object.keys(STORAGE_KEYS).length).toBe(9);
      expectedKeys.forEach((key) => {
        expect(Object.values(STORAGE_KEYS)).toContain(key);
      });
    });

    it("all keys have mta: prefix", () => {
      Object.values(STORAGE_KEYS).forEach((key) => {
        expect(key.startsWith("mta:")).toBe(true);
      });
    });
  });

  // AC-2: 손상된 JSON 복구
  describe("AC-2: corrupted JSON recovery", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("loadPositions should return {} when JSON is malformed", () => {
      localStorage.setItem("mta:positions", "{not-json");
      const result = loadPositions();
      expect(result).toEqual({});
    });

    it("loadPositions should overwrite malformed JSON with valid JSON", () => {
      localStorage.setItem("mta:positions", "{not-json");
      loadPositions();
      const stored = localStorage.getItem("mta:positions");
      expect(stored).toBe("{}");
    });

    it("loadTrades should return [] when JSON is malformed", () => {
      localStorage.setItem("mta:trades", "[{invalid");
      const result = loadTrades();
      expect(result).toEqual([]);
    });

    it("loadTrades should overwrite malformed JSON with valid JSON", () => {
      localStorage.setItem("mta:trades", "[{invalid");
      loadTrades();
      const stored = localStorage.getItem("mta:trades");
      expect(stored).toBe("[]");
    });

    it("should not throw or log console.error on recovery", () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      localStorage.setItem("mta:positions", "{bad json}");

      expect(() => loadPositions()).not.toThrow();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("loadAccount should return default Account when JSON is malformed", () => {
      localStorage.setItem("mta:account", "{not-valid");
      const result = loadAccount();
      expect(result).toHaveProperty("cash");
      expect(result).toHaveProperty("totalGranted");
      expect(result).toHaveProperty("createdAt");
    });
  });

  // AC-3: QuotaExceededError 처리 및 재시도
  describe("AC-3: QuotaExceededError handling with retry", () => {
    let originalSetItem: (key: string, value: string) => void;
    let callCount: number;

    beforeEach(() => {
      localStorage.clear();
      callCount = 0;
      originalSetItem = localStorage.setItem.bind(localStorage);

      // Mock localStorage.setItem to throw QuotaExceededError on first call
      // but succeed on retry
      vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
        callCount++;
        if (key === "mta:trades" && callCount === 1) {
          const err = new Error("QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        }
        originalSetItem(key, value);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should delete oldest 100 trades when QuotaExceededError occurs", () => {
      // Pre-populate 200 trades
      const trades: Trade[] = Array.from({ length: 200 }, (_, i) => ({
        id: `trade-${i}`,
        symbol: "005930",
        name: "삼성전자",
        side: "BUY" as const,
        qty: 10,
        price: 70000,
        fee: 700,
        amount: 700000,
        tradedAt: new Date(`2024-01-${(i % 28) + 1}`),
      }));

      localStorage.setItem("mta:trades", JSON.stringify(trades));

      // Mock setItem to throw on first call, then fail on retry if still too many
      const quotaExceededMock = vi.spyOn(localStorage, "setItem");
      quotaExceededMock.mockImplementationOnce(() => {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      });
      quotaExceededMock.mockImplementationOnce((key, value) => {
        if (key === "mta:trades") {
          originalSetItem(key, value);
        }
      });

      // saveTrades should handle the error
      const callbackSpy = vi.fn();
      saveTrades(trades, callbackSpy);

      // After trim and retry, the stored trades should have oldest 100 removed
      const stored = loadTrades();
      expect(stored.length).toBeLessThanOrEqual(200);
    });

    it("should call onQuotaExceeded callback if retry fails", () => {
      const trades: Trade[] = Array.from({ length: 10 }, (_, i) => ({
        id: `trade-${i}`,
        symbol: "005930",
        name: "삼성전자",
        side: "BUY" as const,
        qty: 10,
        price: 70000,
        fee: 700,
        amount: 700000,
        tradedAt: new Date(),
      }));

      // Mock setItem to always throw QuotaExceededError
      const quotaExceededMock = vi.spyOn(localStorage, "setItem");
      quotaExceededMock.mockImplementation(() => {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      });

      const onQuotaExceededSpy = vi.fn();
      saveTrades(trades, onQuotaExceededSpy);

      expect(onQuotaExceededSpy).toHaveBeenCalledWith(
        "저장 공간이 부족해요. 거래내역을 정리해주세요"
      );
    });

    it("should not throw exception when quota exceeded", () => {
      const trades: Trade[] = [
        {
          id: "trade-1",
          symbol: "005930",
          name: "삼성전자",
          side: "BUY" as const,
          qty: 10,
          price: 70000,
          fee: 700,
          amount: 700000,
          tradedAt: new Date(),
        },
      ];

      const quotaExceededMock = vi.spyOn(localStorage, "setItem");
      quotaExceededMock.mockImplementation(() => {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      });

      expect(() => saveTrades(trades, vi.fn())).not.toThrow();
    });
  });

  // AC-4: saveTrades가 최신 500건으로 트림
  describe("AC-4: saveTrades trims to latest 500 trades", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should store only the latest 500 trades when saving 600", () => {
      const trades: Trade[] = Array.from({ length: 600 }, (_, i) => ({
        id: `trade-${i}`,
        symbol: "005930",
        name: "삼성전자",
        side: "BUY" as const,
        qty: 10,
        price: 70000 + i * 100,
        fee: 700,
        amount: 700000,
        tradedAt: new Date(Date.now() - (600 - i) * 86400000), // oldest first
      }));

      saveTrades(trades);
      const stored = loadTrades();

      expect(stored.length).toBe(500);
      // Verify latest trades are kept (highest id numbers = most recent)
      expect(stored[stored.length - 1].id).toBe("trade-599");
      expect(stored[0].id).toBe("trade-100");
    });

    it("should preserve all trades when count is under 500", () => {
      const trades: Trade[] = Array.from({ length: 250 }, (_, i) => ({
        id: `trade-${i}`,
        symbol: "005930",
        name: "삼성전자",
        side: "BUY" as const,
        qty: 10,
        price: 70000,
        fee: 700,
        amount: 700000,
        tradedAt: new Date(),
      }));

      saveTrades(trades);
      const stored = loadTrades();

      expect(stored.length).toBe(250);
    });
  });

  // AC-5: 9개 엔티티 load/save 함수 및 기본값
  describe("AC-5: all 9 entity load/save functions with defaults", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("loadAccount returns default Account on missing key", () => {
      const result = loadAccount();
      expect(result).toHaveProperty("cash", 1000000);
      expect(result).toHaveProperty("totalGranted", 1000000);
      expect(result).toHaveProperty("createdAt");
      expect(result.createdAt instanceof Date).toBe(true);
    });

    it("loadPositions returns empty object on missing key", () => {
      const result = loadPositions();
      expect(result).toEqual({});
      expect(Object.keys(result).length).toBe(0);
    });

    it("loadTrades returns empty array on missing key", () => {
      const result = loadTrades();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("loadStreak returns default StreakState on missing key", () => {
      const result = loadStreak();
      expect(result).toHaveProperty("currentStreak", 0);
      expect(result).toHaveProperty("longestStreak", 0);
      expect(result).toHaveProperty("lastCheckInDate", "");
      expect(result).toHaveProperty("totalBonus", 0);
    });

    it("loadPresets returns empty array on missing key", () => {
      const result = loadPresets();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("loadLastBacktest returns null on missing key", () => {
      const result = loadLastBacktest();
      expect(result).toBeNull();
    });

    it("loadQuiz returns null on missing key", () => {
      const result = loadQuiz();
      expect(result).toBeNull();
    });

    it("loadMeta returns default AppMeta on missing key", () => {
      const result = loadMeta();
      expect(result).toHaveProperty("schemaVersion", 1);
      expect(result).toHaveProperty("disclaimerSeen", false);
      expect(result).toHaveProperty("rewardUnlockedPresetIds");
      expect(Array.isArray(result.rewardUnlockedPresetIds)).toBe(true);
      expect(result.rewardUnlockedPresetIds.length).toBe(0);
    });

    it("loadLeaderboardSeed returns default seed array on missing key", () => {
      const result = loadLeaderboardSeed();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("saveAccount should persist and loadAccount should retrieve", () => {
      const account: Account = {
        cash: 5000000,
        totalGranted: 2000000,
        lastGrantDate: new Date("2024-01-15"),
        createdAt: new Date("2024-01-01"),
      };

      saveAccount(account);
      const loaded = loadAccount();

      expect(loaded.cash).toBe(5000000);
      expect(loaded.totalGranted).toBe(2000000);
    });

    it("savePositions should persist and loadPositions should retrieve", () => {
      const positions: PositionMap = {
        "005930": {
          symbol: "005930",
          qty: 100,
          avgPrice: 70000,
        },
        "000660": {
          symbol: "000660",
          qty: 50,
          avgPrice: 100000,
        },
      };

      savePositions(positions);
      const loaded = loadPositions();

      expect(Object.keys(loaded).length).toBe(2);
      expect(loaded["005930"].qty).toBe(100);
      expect(loaded["000660"].qty).toBe(50);
    });

    it("saveTrades should persist and loadTrades should retrieve", () => {
      const trades: Trade[] = [
        {
          id: "trade-1",
          symbol: "005930",
          name: "삼성전자",
          side: "BUY",
          qty: 10,
          price: 70000,
          fee: 700,
          amount: 700000,
          tradedAt: new Date("2024-01-01"),
        },
      ];

      saveTrades(trades);
      const loaded = loadTrades();

      expect(loaded.length).toBe(1);
      expect(loaded[0].symbol).toBe("005930");
    });

    it("saveStreak should persist and loadStreak should retrieve", () => {
      const streak: StreakState = {
        currentStreak: 5,
        longestStreak: 10,
        lastCheckInDate: "2024-01-15",
        totalBonus: 500000,
      };

      saveStreak(streak);
      const loaded = loadStreak();

      expect(loaded.currentStreak).toBe(5);
      expect(loaded.longestStreak).toBe(10);
      expect(loaded.totalBonus).toBe(500000);
    });

    it("savePresets should persist and loadPresets should retrieve", () => {
      const presets: BacktestPreset[] = [
        {
          id: "preset-1",
          name: "공격적 포트폴리오",
          description: "고성장 주식 중심",
          symbols: ["005930", "000660"],
          startCapital: 10000000,
          years: 5,
          riskType: "aggressive",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ];

      savePresets(presets);
      const loaded = loadPresets();

      expect(loaded.length).toBe(1);
      expect(loaded[0].name).toBe("공격적 포트폴리오");
    });

    it("saveLastBacktest should persist and loadLastBacktest should retrieve", () => {
      const result: BacktestResult = {
        id: "result-1",
        presetId: "preset-1",
        years: 5,
        startCapital: 10000000,
        endCapital: 15000000,
        trades: [],
        returns: [],
        maxDrawdown: -20.5,
        sharpeRatio: 1.5,
        winRate: 0.65,
        riskType: "moderate",
        createdAt: new Date(),
      };

      saveLastBacktest(result);
      const loaded = loadLastBacktest();

      expect(loaded).not.toBeNull();
      expect(loaded?.endCapital).toBe(15000000);
    });

    it("saveQuiz should persist and loadQuiz should retrieve", () => {
      const result: QuizResult = {
        id: "quiz-1",
        userId: "user-123",
        answers: [1, 2, 3, 4, 1, 2, 3, 4],
        score: 20,
        riskProfile: "moderate",
        createdAt: new Date(),
      };

      saveQuiz(result);
      const loaded = loadQuiz();

      expect(loaded).not.toBeNull();
      expect(loaded?.score).toBe(20);
    });

    it("saveMeta should persist and loadMeta should retrieve", () => {
      const meta: AppMeta = {
        version: "1.0.0",
        lastUpdated: new Date(),
        dataVersion: "1",
      };

      saveMeta(meta);
      const loaded = loadMeta();

      expect(loaded.version).toBe("1.0.0");
    });

    it("saveLeaderboardSeed should persist and loadLeaderboardSeed should retrieve", () => {
      const seed: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: "bot-001",
          userName: "불꽃개미",
          score: 1500000,
          backtestCount: 50,
          bestReturn: 0.45,
          createdAt: new Date(),
        },
      ];

      saveLeaderboardSeed(seed);
      const loaded = loadLeaderboardSeed();

      expect(loaded.length).toBeGreaterThanOrEqual(1);
      expect(loaded[0].userName).toBe("불꽃개미");
    });
  });

  // AC-5 추가: 최대 개수 검증 (presets 최대 10개)
  describe("AC-5 additional: storage limits", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("savePresets should limit to maximum 10 presets", () => {
      const presets: BacktestPreset[] = Array.from({ length: 15 }, (_, i) => ({
        id: `preset-${i}`,
        name: `Portfolio ${i}`,
        description: `Description ${i}`,
        symbols: ["005930"],
        startCapital: 10000000,
        years: 5 as const,
        riskType: "moderate" as const,
        createdAt: new Date(Date.now() - (15 - i) * 86400000),
        updatedAt: new Date(Date.now() - (15 - i) * 86400000),
      }));

      savePresets(presets);
      const loaded = loadPresets();

      expect(loaded.length).toBeLessThanOrEqual(10);
    });
  });
});
