import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================================
// NOTICE: Tests are written BEFORE implementation.
// These tests describe the expected behavior for checkin.ts & tradeEngine.ts
// The implementation will be provided by the Coder.
// ============================================================================

describe("Packet 0005: Bootstrap · Daily Grant · Streak + Trade Engine", () => {
  // Helper: Generate today's date in KST format (YYYY-MM-DD)
  const todayKst = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
    return kst.toISOString().split("T")[0];
  };

  // Helper: Get yesterday's date in KST
  const yesterdayKst = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
    const yesterday = new Date(kst.getTime() - 24 * 3600000);
    return yesterday.toISOString().split("T")[0];
  };

  // Helper: Get a date N days ago in KST
  const nDaysAgoKst = (n: number): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
    const past = new Date(kst.getTime() - n * 24 * 3600000);
    return past.toISOString().split("T")[0];
  };

  // ========================================================================
  // AC-1: bootstrap() creates default account and meta if missing
  // ========================================================================
  describe("AC-1: bootstrap initialization", () => {
    it("should create default account with 1M initial cash when missing", () => {
      // Arrange: Empty storage (simulate first launch)
      const storage = new Map<string, any>();

      // Act: Call bootstrap
      const { account } = bootstrap(storage);

      // Assert: Account should have defaults
      expect(account).toBeDefined();
      expect(account.cash).toBe(1000000);
      expect(account.totalGranted).toBe(1000000);
      expect(account.lastGrantDate).toBe(todayKst());
      expect(account.createdAt).toBeDefined();
    });

    it("should create default meta with disclaimerSeen=false when missing", () => {
      // Arrange: Empty storage
      const storage = new Map<string, any>();

      // Act: Call bootstrap
      const { meta } = bootstrap(storage);

      // Assert: Meta should have defaults
      expect(meta).toBeDefined();
      expect(meta.schemaVersion).toBe(1);
      expect(meta.disclaimerSeen).toBe(false);
      expect(meta.onboardedAt).toBeDefined();
      expect(meta.rewardUnlockedPresetIds).toEqual([]);
    });

    it("should preserve existing account and meta on subsequent calls", () => {
      // Arrange: Storage with existing account
      const storage = new Map<string, any>();
      const firstBootstrap = bootstrap(storage);
      const originalCash = firstBootstrap.account.cash;
      const originalCreatedAt = firstBootstrap.account.createdAt;

      // Act: Bootstrap again (simulate app restart)
      const secondBootstrap = bootstrap(storage);

      // Assert: Same values, not re-initialized
      expect(secondBootstrap.account.cash).toBe(originalCash);
      expect(secondBootstrap.account.createdAt).toBe(originalCreatedAt);
    });
  });

  // ========================================================================
  // AC-2: Same-day grant is denied
  // ========================================================================
  describe("AC-2: same-day grant rejection", () => {
    it("should deny grant when lastGrantDate equals today", () => {
      // Arrange: Account with lastGrantDate = today
      const account = {
        cash: 1000000,
        lastGrantDate: todayKst(),
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(10),
      };
      const streak = { currentStreak: 0, longestStreak: 0 };

      // Act: Attempt daily check-in
      const result = performDailyCheckin(account, streak);

      // Assert: Grant denied, no changes
      expect(result.granted).toBe(false);
      expect(result.grantAmount).toBe(0);
      expect(result.bonusAmount).toBe(0);
      expect(account.cash).toBe(1000000); // unchanged
      expect(account.lastGrantDate).toBe(todayKst()); // unchanged
    });

    it("should return consistent result on repeated same-day calls", () => {
      // Arrange: Account with lastGrantDate = today
      const account = {
        cash: 1000000,
        lastGrantDate: todayKst(),
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(5),
      };
      const streak = { currentStreak: 0, longestStreak: 0 };

      // Act: Call twice
      const result1 = performDailyCheckin(account, streak);
      const result2 = performDailyCheckin(account, streak);

      // Assert: Identical results
      expect(result1).toEqual(result2);
      expect(result1.granted).toBe(false);
    });
  });

  // ========================================================================
  // AC-3: Date handling (backward time, grant eligibility)
  // ========================================================================
  describe("AC-3: date handling and grant eligibility", () => {
    it("should deny grant when lastGrantDate is in the future (clock backward)", () => {
      // Arrange: lastGrantDate is tomorrow (time went backward)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKst = tomorrow.toISOString().split("T")[0];

      const account = {
        cash: 1000000,
        lastGrantDate: tomorrowKst,
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(10),
      };
      const streak = { currentStreak: 0, longestStreak: 0 };

      // Act: Attempt check-in
      const result = performDailyCheckin(account, streak);

      // Assert: Grant denied (string comparison prevents forward grants)
      expect(result.granted).toBe(false);
      expect(account.cash).toBe(1000000); // unchanged
    });

    it("should grant when lastGrantDate is before today", () => {
      // Arrange: Account with lastGrantDate = yesterday
      const account = {
        cash: 1000000,
        lastGrantDate: yesterdayKst(),
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(10),
      };
      const streak = { currentStreak: 0, longestStreak: 0 };

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: Grant approved
      expect(result.granted).toBe(true);
      expect(result.grantAmount).toBe(1000000);
      expect(account.cash).toBe(2000000);
      expect(account.totalGranted).toBe(2000000);
      expect(account.lastGrantDate).toBe(todayKst());
    });
  });

  // ========================================================================
  // AC-4: Streak and bonus calculations
  // ========================================================================
  describe("AC-4: streak tracking and bonus rewards", () => {
    it("should increment streak when grant is on consecutive day (yesterday)", () => {
      // Arrange: Grant eligible (yesterday) with existing streak
      const account = {
        cash: 1000000,
        lastGrantDate: yesterdayKst(),
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(30),
      };
      const streak = { currentStreak: 4, longestStreak: 4 };

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: Streak incremented
      expect(result.streak.currentStreak).toBe(5);
      expect(result.granted).toBe(true);
    });

    it("should reset streak to 1 when gap exists (lastGrantDate older than yesterday)", () => {
      // Arrange: Grant gap of 3 days
      const account = {
        cash: 1000000,
        lastGrantDate: nDaysAgoKst(3),
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(30),
      };
      const streak = { currentStreak: 7, longestStreak: 10 };

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: Streak reset to 1, longest unchanged
      expect(result.streak.currentStreak).toBe(1);
      expect(result.streak.longestStreak).toBe(10);
      expect(result.granted).toBe(true);
    });

    it("should award 500K bonus for 7+ day streak", () => {
      // Arrange: Account with 6-day streak, eligible for grant
      const account = {
        cash: 1000000,
        lastGrantDate: yesterdayKst(),
        totalGranted: 6000000,
        createdAt: nDaysAgoKst(30),
      };
      const streak = { currentStreak: 6, longestStreak: 6 };

      // Act: Perform check-in (7th day)
      const result = performDailyCheckin(account, streak);

      // Assert: 7-day bonus awarded
      expect(result.streak.currentStreak).toBe(7);
      expect(result.bonusAmount).toBe(500000);
      expect(account.cash).toBe(1000000 + 1000000 + 500000); // grant + bonus
    });

    it("should award 300K bonus for 5+ day streak", () => {
      // Arrange: 4-day streak → 5th day
      const account = {
        cash: 1000000,
        lastGrantDate: yesterdayKst(),
        totalGranted: 4000000,
        createdAt: nDaysAgoKst(20),
      };
      const streak = { currentStreak: 4, longestStreak: 4 };

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: 5-day bonus awarded
      expect(result.streak.currentStreak).toBe(5);
      expect(result.bonusAmount).toBe(300000);
      expect(account.cash).toBe(1000000 + 1000000 + 300000);
    });

    it("should award 100K bonus for 3+ day streak", () => {
      // Arrange: 2-day streak → 3rd day
      const account = {
        cash: 500000,
        lastGrantDate: yesterdayKst(),
        totalGranted: 2000000,
        createdAt: nDaysAgoKst(10),
      };
      const streak = { currentStreak: 2, longestStreak: 2 };

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: 3-day bonus awarded
      expect(result.streak.currentStreak).toBe(3);
      expect(result.bonusAmount).toBe(100000);
    });

    it("should award 0 bonus for <3 day streak", () => {
      // Arrange: 1-day streak (or no streak)
      const account = {
        cash: 1000000,
        lastGrantDate: yesterdayKst(),
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(5),
      };
      const streak = { currentStreak: 1, longestStreak: 1 };

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: No bonus
      expect(result.bonusAmount).toBe(0);
      expect(account.cash).toBe(2000000); // only base grant
    });

    it("should update longestStreak when current exceeds it", () => {
      // Arrange: 5-day streak, longest is 5
      const account = {
        cash: 1000000,
        lastGrantDate: yesterdayKst(),
        totalGranted: 5000000,
        createdAt: nDaysAgoKst(30),
      };
      const streak = { currentStreak: 5, longestStreak: 5 };

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: longestStreak = 6
      expect(result.streak.currentStreak).toBe(6);
      expect(result.streak.longestStreak).toBe(6);
    });

    it("should NOT downgrade longestStreak when reset", () => {
      // Arrange: Gap breaks streak, but longest is higher
      const account = {
        cash: 1000000,
        lastGrantDate: nDaysAgoKst(5), // 5-day gap
        totalGranted: 1000000,
        createdAt: nDaysAgoKst(30),
      };
      const streak = { currentStreak: 7, longestStreak: 15 }; // Previously had 15-day

      // Act: Perform check-in
      const result = performDailyCheckin(account, streak);

      // Assert: current = 1, longest preserved
      expect(result.streak.currentStreak).toBe(1);
      expect(result.streak.longestStreak).toBe(15);
    });
  });

  // ========================================================================
  // AC-5: Trade execution validation and processing
  // ========================================================================
  describe("AC-5: trade validation and execution", () => {
    it("should reject trade when insufficient cash (BUY)", () => {
      // Arrange: Try to buy 100 shares @ 50K each = 5M, but only have 1M
      const account = { cash: 1000000, lastGrantDate: todayKst(), totalGranted: 1000000, createdAt: nDaysAgoKst(10) };
      const positions = new Map<string, { quantity: number; avgPrice: number }>();
      const tradeRequest = { type: "BUY" as const, symbol: "AAPL", quantity: 100, price: 50000 };

      // Act: Execute trade
      const result = executeTrade(account, positions, tradeRequest);

      // Assert: Rejected with clear reason
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("INSUFFICIENT_CASH");
      expect(account.cash).toBe(1000000); // unchanged
      expect(positions.has("AAPL")).toBe(false); // no position created
    });

    it("should reject trade when insufficient quantity (SELL)", () => {
      // Arrange: Try to sell 100 shares but only have 50
      const account = { cash: 1000000, lastGrantDate: todayKst(), totalGranted: 1000000, createdAt: nDaysAgoKst(10) };
      const positions = new Map<string, { quantity: number; avgPrice: number }>();
      positions.set("AAPL", { quantity: 50, avgPrice: 40000 });
      const tradeRequest = { type: "SELL" as const, symbol: "AAPL", quantity: 100, price: 50000 };

      // Act: Execute trade
      const result = executeTrade(account, positions, tradeRequest);

      // Assert: Rejected with clear reason
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("INSUFFICIENT_QTY");
      expect(account.cash).toBe(1000000); // unchanged
      expect(positions.get("AAPL")!.quantity).toBe(50); // unchanged
    });

    it("should execute successful BUY and update avgPrice", () => {
      // Arrange: Buy 100 @ 50K with 10M cash
      const account = { cash: 10000000, lastGrantDate: todayKst(), totalGranted: 10000000, createdAt: nDaysAgoKst(10) };
      const positions = new Map<string, { quantity: number; avgPrice: number }>();
      const tradeRequest = { type: "BUY" as const, symbol: "AAPL", quantity: 100, price: 50000 };

      // Act: Execute trade
      const result = executeTrade(account, positions, tradeRequest);

      // Assert: Trade successful
      expect(result.ok).toBe(true);
      expect(result.trade).toBeDefined();
      expect(result.trade!.symbol).toBe("AAPL");
      expect(result.trade!.quantity).toBe(100);
      expect(result.trade!.price).toBe(50000);

      // Cash deducted (including fee)
      const totalCost = 100 * 50000 + result.trade!.fee;
      expect(account.cash).toBe(10000000 - totalCost);

      // Position created/updated
      expect(positions.has("AAPL")).toBe(true);
      expect(positions.get("AAPL")!.quantity).toBe(100);
      expect(positions.get("AAPL")!.avgPrice).toBe(50000);
    });

    it("should execute successful SELL and update avgPrice to integer", () => {
      // Arrange: Sell 50 of 100 @ 60K (avg was 50K)
      const account = { cash: 1000000, lastGrantDate: todayKst(), totalGranted: 1000000, createdAt: nDaysAgoKst(10) };
      const positions = new Map<string, { quantity: number; avgPrice: number }>();
      positions.set("AAPL", { quantity: 100, avgPrice: 50000 });
      const tradeRequest = { type: "SELL" as const, symbol: "AAPL", quantity: 50, price: 60000 };

      // Act: Execute trade
      const result = executeTrade(account, positions, tradeRequest);

      // Assert: Trade successful
      expect(result.ok).toBe(true);
      expect(result.trade!.type).toBe("SELL");
      expect(result.trade!.quantity).toBe(50);

      // Cash increased (proceeds - fee)
      const proceeds = 50 * 60000 - result.trade!.fee;
      expect(account.cash).toBe(1000000 + proceeds);

      // Position reduced
      expect(positions.get("AAPL")!.quantity).toBe(50);
      // avgPrice should be integer floor
      expect(positions.get("AAPL")!.avgPrice).toBe(Math.floor(positions.get("AAPL")!.avgPrice));
    });

    it("should properly add trade to mta:trades list", () => {
      // Arrange
      const account = { cash: 10000000, lastGrantDate: todayKst(), totalGranted: 10000000, createdAt: nDaysAgoKst(10) };
      const positions = new Map<string, { quantity: number; avgPrice: number }>();
      const trades: any[] = [];
      const tradeRequest = { type: "BUY" as const, symbol: "TSLA", quantity: 50, price: 30000 };

      // Act: Execute trade (should append to trades array)
      const result = executeTrade(account, positions, tradeRequest, trades);

      // Assert: Trade recorded in list
      expect(result.ok).toBe(true);
      expect(trades.length).toBe(1);
      expect(trades[0].type).toBe("BUY");
      expect(trades[0].symbol).toBe("TSLA");
      expect(trades[0].timestamp).toBeDefined();
    });

    it("should update avgPrice when averaging down (additional BUY)", () => {
      // Arrange: Already own 100 @ 50K, buy 100 @ 40K
      const account = { cash: 10000000, lastGrantDate: todayKst(), totalGranted: 10000000, createdAt: nDaysAgoKst(10) };
      const positions = new Map<string, { quantity: number; avgPrice: number }>();
      positions.set("AAPL", { quantity: 100, avgPrice: 50000 });
      const tradeRequest = { type: "BUY" as const, symbol: "AAPL", quantity: 100, price: 40000 };

      // Act: Execute trade
      const result = executeTrade(account, positions, tradeRequest);

      // Assert: avgPrice averaged down (should be integer)
      expect(result.ok).toBe(true);
      const newAvg = positions.get("AAPL")!.avgPrice;
      expect(newAvg).toBe(Math.floor(newAvg)); // must be integer
      expect(newAvg).toBeLessThan(50000); // averaged down
      expect(newAvg).toBeGreaterThan(40000); // but not equal to new price
      expect(positions.get("AAPL")!.quantity).toBe(200);
    });
  });
});

// ============================================================================
// PLACEHOLDER SIGNATURES (Coder will implement these)
// ============================================================================

/**
 * Initializes app state on first launch.
 * Creates default account (1M cash) and meta (schema v1) if missing.
 */
function bootstrap(storage: Map<string, any>): { account: any; meta: any } {
  throw new Error("NOT IMPLEMENTED - Coder will implement in src/lib/checkin.ts");
}

/**
 * Performs daily check-in, granting cash and updating streak.
 * Returns { granted, grantAmount, bonusAmount, streak, isNewStreakMilestone }
 */
function performDailyCheckin(account: any, streak: any): any {
  throw new Error("NOT IMPLEMENTED - Coder will implement in src/lib/checkin.ts");
}

/**
 * Executes a trade (BUY/SELL), validating cash and quantity constraints.
 * Updates avgPrice as integer, appends to trades list.
 * Returns { ok: boolean, reason?: string, trade?: any }
 */
function executeTrade(account: any, positions: Map<string, any>, tradeRequest: any, trades?: any[]): any {
  throw new Error("NOT IMPLEMENTED - Coder will implement in src/lib/tradeEngine.ts");
}
