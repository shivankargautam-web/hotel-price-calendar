import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY } from "@/lib/query";
import { addDays } from "@/lib/dates";
import type { PriceBreakdown, SearchQuery } from "@/lib/types";
import { DemoPriceProvider } from "./providers/demo";
import type { PriceProvider, RoomOffer, StayOutcome, StaySearchRequest } from "./providers/types";
import { CALENDAR_DAYS, runSearch } from "./search";

const NOW = new Date("2026-12-01T06:00:00Z");
const TODAY = "2026-12-01";
const HOTEL = "hotel:taj-bengal-kolkata";

function offer(total: number, taxesComplete = true): RoomOffer {
  const price: PriceBreakdown = { currency: "INR", base: total, taxes: 0, mandatoryFees: 0, total, taxesComplete, notes: [] };
  return {
    quoteRef: `q-${total}`,
    roomTypeId: "superior",
    roomName: "Superior Room",
    ratePlan: "flex",
    price,
    cancellation: { refundable: true, summary: "Free cancellation" },
    source: { providerId: "fake", name: "Fake feed", bookingUrl: "https://example.com/book" },
    checkedAt: NOW.toISOString(),
  };
}

/** Quotes a fixed full-stay total per check-in date: day 0 = ₹20,000, day 1 = ₹20,001, ... */
class FakeProvider implements PriceProvider {
  readonly info = {
    id: "fake",
    name: "Fake feed",
    isDemo: false,
    bookingHorizonDays: 365,
    maxNights: 14,
    cacheTtlSeconds: 0,
    requestsPerMinute: 60,
    supportsRefresh: false,
  };
  requests: StaySearchRequest[] = [];

  outcome(index: number): StayOutcome {
    switch (index) {
      case 0:
        return { status: "available", offers: [offer(20_000)] };
      case 1:
        return { status: "available", offers: [offer(20_001)] };
      case 2:
        return { status: "available", offers: [offer(15_000, false)] };
      case 3:
        return { status: "unavailable", reason: "Sold out", checkedAt: NOW.toISOString() };
      case 4:
        return { status: "unchecked" };
      case 5:
        return { status: "outside_coverage" };
      default:
        return { status: "available", offers: [offer(30_000)] };
    }
  }

  async searchStays(request: StaySearchRequest) {
    this.requests.push(request);
    return new Map(request.checkIns.map((d, i) => [d, this.outcome(i)]));
  }

  async refreshQuote(): Promise<StayOutcome> {
    return { status: "unchecked" };
  }
}

const query = (patch: Partial<SearchQuery> = {}): SearchQuery => ({ ...DEFAULT_QUERY, target: HOTEL, ...patch });

describe("runSearch with full-stay quotes", () => {
  it("applies the ₹20,000 boundary for 2 nights at ₹10,000", async () => {
    const res = await runSearch(query(), new FakeProvider(), NOW);
    expect(res.budget.perStayLimit).toBe(20_000);
    expect(res.calendar[0]).toMatchObject({ date: TODAY, status: "within" });
    expect(res.calendar[0].best?.total).toBe(20_000);
    expect(res.calendar[1]).toMatchObject({ status: "over" });
    expect(res.calendar[1].best?.total).toBe(20_001);
    expect(res.stats.datesWithinBudget).toBe(1);
    expect(res.results.kind).toBe("matches");
    expect(res.results.items.map((s) => s.price.total)).toEqual([20_000]);
  });

  it("asks the provider for one quote covering every night of the stay", async () => {
    const provider = new FakeProvider();
    const res = await runSearch(query({ nights: 2 }), provider, NOW);
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]).toMatchObject({ nights: 2, today: TODAY });
    expect(provider.requests[0].checkIns).toHaveLength(CALENDAR_DAYS);
    const stay = res.results.items[0];
    expect(stay.checkOut).toBe(addDays(TODAY, 2));
    expect(stay.price.total).toBe(20_000);
    expect(stay.nightlyAverage).toBe(10_000);
  });

  it("flags incomplete tax quotes and excludes them from matches", async () => {
    const res = await runSearch(query(), new FakeProvider(), NOW);
    expect(res.calendar[2].status).toBe("unconfirmed");
    expect(res.stats.coverage.incompleteQuotes).toBeGreaterThan(0);
    expect(res.results.items.every((s) => s.price.taxesComplete)).toBe(true);
  });

  it("keeps unavailable, unchecked and outside-coverage dates price-free", async () => {
    const res = await runSearch(query(), new FakeProvider(), NOW);
    expect(res.calendar.slice(3, 6).map((c) => c.status)).toEqual(["unavailable", "unchecked", "outside_coverage"]);
    for (const cell of res.calendar.slice(3, 6)) expect(cell.best).toBeUndefined();
    expect(res.stats.coverage).toMatchObject({ datesUnavailable: 1, datesUnchecked: 1, datesOutsideCoverage: 1 });
    expect(res.stats.cheapest?.total).toBe(20_000);
  });

  it("re-quotes and re-evaluates when the number of nights changes", async () => {
    const provider = new FakeProvider();
    const two = await runSearch(query({ nights: 2 }), provider, NOW);
    const three = await runSearch(query({ nights: 3 }), provider, NOW);
    expect(provider.requests.map((r) => r.nights)).toEqual([2, 3]);
    expect(two.budget.perStayLimit).toBe(20_000);
    expect(three.budget.perStayLimit).toBe(30_000);
    expect(three.calendar[1].status).toBe("within");
    expect(three.results.items[0].checkOut).toBe(addDays(TODAY, 3));
  });

  it("supports a total-stay budget and multiple rooms", async () => {
    const total = await runSearch(query({ budgetMode: "total", budget: 20_000 }), new FakeProvider(), NOW);
    expect(total.budget.perStayLimit).toBe(20_000);
    expect(total.stats.datesWithinBudget).toBe(1);
    const rooms = await runSearch(query({ rooms: 2, adults: 2 }), new FakeProvider(), NOW);
    expect(rooms.budget.perStayLimit).toBe(40_000);
  });

  it("shows the closest over-budget options when nothing fits", async () => {
    const res = await runSearch(query({ budget: 5_000 }), new FakeProvider(), NOW);
    expect(res.results.kind).toBe("closest");
    expect(res.results.items[0].price.total).toBe(20_000);
    expect(res.results.items[0].overBudgetBy).toBe(10_000);
    const gaps = res.results.items.map((s) => s.overBudgetBy);
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });
});

describe("runSearch with demo data", () => {
  const demo = new DemoPriceProvider(() => NOW);

  it("covers 12 months and finds Taj stays within ₹10,000 a night", async () => {
    const res = await runSearch({ ...DEFAULT_QUERY }, demo, NOW);
    expect(res.calendar).toHaveLength(CALENDAR_DAYS);
    expect(res.provider.isDemo).toBe(true);
    expect(res.stats.datesWithinBudget).toBeGreaterThan(0);
    for (const s of res.results.items) {
      expect(s.verdict).toBe("within");
      expect(s.price.taxesComplete).toBe(true);
      expect(s.price.total).toBeLessThanOrEqual(20_000);
    }
    const totals = res.results.items.map((s) => s.price.total);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it("never gives a price to dates without an available quote", async () => {
    for (const target of ["brand:taj", "hotel:taj-lake-palace-udaipur", "hotel:taj-chia-kutir-darjeeling"]) {
      const res = await runSearch({ ...DEFAULT_QUERY, target }, demo, NOW);
      for (const cell of res.calendar) {
        if (cell.status === "unavailable" || cell.status === "unchecked" || cell.status === "outside_coverage") {
          expect(cell.best).toBeUndefined();
        } else {
          expect(cell.best!.total).toBeGreaterThan(0);
        }
      }
    }
  });

  it("returns different full-stay results for 2 and 3 nights", async () => {
    const two = await runSearch({ ...DEFAULT_QUERY }, demo, NOW);
    const three = await runSearch({ ...DEFAULT_QUERY, nights: 3 }, demo, NOW);
    expect(three.results.items[0].nights).toBe(3);
    expect(three.results.items[0].checkOut).toBe(addDays(three.results.items[0].checkIn, 3));
    expect(three.calendar.map((c) => c.best?.total)).not.toEqual(two.calendar.map((c) => c.best?.total));
  });
});
