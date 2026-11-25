import { describe, expect, it } from "vitest";
import { convertBudget, evaluateBudget, nightlyAverage, stayBudgetLimit } from "./budget";

describe("budget limits", () => {
  it("turns a per-room-per-night budget into a stay limit", () => {
    expect(stayBudgetLimit({ mode: "perNight", amount: 10_000 }, 2, 1)).toBe(20_000);
    expect(stayBudgetLimit({ mode: "perNight", amount: 10_000 }, 3, 2)).toBe(60_000);
  });

  it("uses a total-stay budget as-is", () => {
    expect(stayBudgetLimit({ mode: "total", amount: 20_000 }, 2, 1)).toBe(20_000);
    expect(stayBudgetLimit({ mode: "total", amount: 20_000 }, 5, 2)).toBe(20_000);
  });

  it("converts between budget modes", () => {
    expect(convertBudget({ mode: "perNight", amount: 10_000 }, "total", 2, 1)).toEqual({ mode: "total", amount: 20_000 });
    expect(convertBudget({ mode: "total", amount: 20_000 }, "perNight", 2, 1)).toEqual({ mode: "perNight", amount: 10_000 });
  });
});

describe("evaluateBudget — 2 nights at ₹10,000 per night", () => {
  const limit = stayBudgetLimit({ mode: "perNight", amount: 10_000 }, 2, 1);

  it("accepts a ₹20,000 full-stay total", () => {
    expect(evaluateBudget(20_000, true, limit)).toBe("within");
  });

  it("rejects a ₹20,001 full-stay total", () => {
    expect(evaluateBudget(20_001, true, limit)).toBe("over");
  });

  it("never confirms a quote with incomplete taxes or fees, however cheap", () => {
    expect(evaluateBudget(12_000, false, limit)).toBe("unconfirmed");
  });

  it("derives the nightly average from the full-stay total", () => {
    expect(nightlyAverage(20_001, 2, 1)).toBe(10_001);
    expect(nightlyAverage(40_000, 2, 2)).toBe(10_000);
  });
});
