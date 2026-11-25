import { stayBudgetLimit, evaluateBudget, nightlyAverage } from "@/lib/budget";
import { getHotel, resolveTarget, type Hotel } from "@/lib/catalogue";
import { addDays, monthKey, todayInIndia } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type {
  CalendarCell,
  CellBest,
  DatePrice,
  MonthSummary,
  RankedStay,
  SearchQuery,
  SearchResponse,
  StayStatus,
} from "@/lib/types";
import type { PriceProvider, RoomOffer, StayOutcome } from "./providers/types";

/** The calendar always covers 365 check-in dates starting today (IST). */
export const CALENDAR_DAYS = 365;
const CLOSEST_OPTIONS = 10;

interface TrackedStay {
  hotel: Hotel;
  checkIn: string;
  status: StayStatus;
  stay?: RankedStay;
}

/**
 * Picks the offer the calendar tracks for one hotel and date: the requested room
 * type, or the cheapest room. Offers with confirmed taxes and fees win over
 * incomplete ones so an unconfirmed price never hides a confirmed one.
 */
export function pickTrackedOffer(offers: RoomOffer[], roomType: string | null, refundableOnly: boolean): RoomOffer | undefined {
  const eligible = offers.filter(
    (o) => (roomType === null || o.roomTypeId === roomType) && (!refundableOnly || o.cancellation.refundable),
  );
  const byTotal = (a: RoomOffer, b: RoomOffer) => a.price.total - b.price.total;
  return eligible.filter((o) => o.price.taxesComplete).sort(byTotal)[0] ?? eligible.sort(byTotal)[0];
}

function toRankedStay(hotel: Hotel, checkIn: string, query: SearchQuery, offer: RoomOffer, limit: number): RankedStay {
  const verdict = evaluateBudget(offer.price.total, offer.price.taxesComplete, limit);
  return {
    key: `${hotel.id}:${checkIn}:${offer.roomTypeId}:${offer.ratePlan}`,
    hotelId: hotel.id,
    hotelName: hotel.name,
    city: hotel.city,
    checkIn,
    checkOut: addDays(checkIn, query.nights),
    nights: query.nights,
    roomTypeId: offer.roomTypeId,
    roomName: offer.roomName,
    ratePlan: offer.ratePlan,
    nightlyAverage: nightlyAverage(offer.price.total, query.nights, query.rooms),
    price: offer.price,
    verdict,
    budgetLimit: limit,
    overBudgetBy: Math.max(0, offer.price.total - limit),
    cancellation: offer.cancellation,
    source: offer.source,
    checkedAt: offer.checkedAt,
  };
}

function compareStays(sort: SearchQuery["sort"]) {
  return (a: RankedStay, b: RankedStay) => {
    const byTotal = a.price.total - b.price.total;
    const byDate = a.checkIn.localeCompare(b.checkIn);
    const primary = sort === "date" ? byDate || byTotal : byTotal || byDate;
    return primary || a.hotelName.localeCompare(b.hotelName);
  };
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function runSearch(query: SearchQuery, provider: PriceProvider, now: Date = new Date()): Promise<SearchResponse> {
  const target = resolveTarget(query.target);
  if (!target) throw new Error(`Unknown target ${query.target}`);
  const hotels = target.hotelIds.map((id) => getHotel(id)!);
  const today = todayInIndia(now);
  const checkIns = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(today, i));
  const occupancy = { adults: query.adults, children: query.children, rooms: query.rooms };
  const budget = { mode: query.budgetMode, amount: query.budget };
  const limit = stayBudgetLimit(budget, query.nights, query.rooms);

  const outcomes: Map<string, StayOutcome>[] = await Promise.all(
    hotels.map((hotel) => provider.searchStays({ hotelId: hotel.id, checkIns, nights: query.nights, occupancy, today })),
  );

  const byDate = new Map<string, TrackedStay[]>(checkIns.map((d) => [d, []]));
  const allStays: RankedStay[] = [];
  hotels.forEach((hotel, i) => {
    for (const checkIn of checkIns) {
      const outcome = outcomes[i].get(checkIn) ?? { status: "unchecked" as const };
      const tracked: TrackedStay = { hotel, checkIn, status: outcome.status };
      if (outcome.status === "available") {
        const offer = pickTrackedOffer(outcome.offers, query.roomType, query.refundableOnly);
        if (offer) {
          tracked.stay = toRankedStay(hotel, checkIn, query, offer, limit);
          allStays.push(tracked.stay);
        } else {
          tracked.status = "unavailable";
        }
      }
      byDate.get(checkIn)!.push(tracked);
    }
  });

  const cheapestOf = (stays: RankedStay[]) => [...stays].sort(compareStays("total"))[0];
  const toBest = (s: RankedStay): CellBest => ({
    hotelId: s.hotelId,
    hotelName: s.hotelName,
    roomName: s.roomName,
    total: s.price.total,
    nightlyAverage: s.nightlyAverage,
    taxesComplete: s.price.taxesComplete,
  });

  const calendar: CalendarCell[] = checkIns.map((date) => {
    const tracked = byDate.get(date)!;
    const stays = tracked.flatMap((t) => (t.stay ? [t.stay] : []));
    const within = stays.filter((s) => s.verdict === "within");
    const confirmed = stays.filter((s) => s.price.taxesComplete);
    const cell: CalendarCell = {
      date,
      checkOut: addDays(date, query.nights),
      status: "unchecked",
      matches: within.length,
      hotelsChecked: tracked.filter((t) => t.status === "available" || t.status === "unavailable").length,
      hotelsTotal: hotels.length,
    };
    if (within.length) {
      cell.status = "within";
      cell.best = toBest(cheapestOf(within));
    } else if (confirmed.length) {
      cell.status = "over";
      cell.best = toBest(cheapestOf(confirmed));
    } else if (stays.length) {
      cell.status = "unconfirmed";
      cell.best = toBest(cheapestOf(stays));
    } else if (tracked.some((t) => t.status === "unavailable")) {
      cell.status = "unavailable";
    } else if (tracked.some((t) => t.status === "unchecked")) {
      cell.status = "unchecked";
    } else {
      cell.status = "outside_coverage";
    }
    return cell;
  });

  const priced = calendar.filter((c) => (c.status === "within" || c.status === "over") && c.best);
  const toDatePrice = (c: CalendarCell): DatePrice => ({
    date: c.date,
    hotelName: c.best!.hotelName,
    hotelsChecked: c.hotelsChecked,
    total: c.best!.total,
    nightlyAverage: c.best!.nightlyAverage,
  });
  const ascending = [...priced].sort((a, b) => a.best!.total - b.best!.total || a.date.localeCompare(b.date));

  const months: MonthSummary[] = [];
  for (const cell of calendar) {
    const key = monthKey(cell.date);
    let m = months.find((x) => x.month === key);
    if (!m) {
      m = { month: key, datesWithinBudget: 0, datesChecked: 0 };
      months.push(m);
    }
    if (cell.status === "within") m.datesWithinBudget++;
    if (cell.hotelsChecked > 0) m.datesChecked++;
    if ((cell.status === "within" || cell.status === "over") && cell.best && (!m.cheapest || cell.best.total < m.cheapest.total)) {
      m.cheapest = toDatePrice(cell);
    }
  }

  const trackedAll = [...byDate.values()].flat();
  const coverage = {
    datesInRange: calendar.length,
    datesChecked: calendar.filter((c) => c.hotelsChecked > 0).length,
    datesUnavailable: calendar.filter((c) => c.status === "unavailable").length,
    datesUnchecked: calendar.filter((c) => c.status === "unchecked").length,
    datesOutsideCoverage: calendar.filter((c) => c.status === "outside_coverage").length,
    staysTotal: trackedAll.length,
    staysChecked: trackedAll.filter((t) => t.status === "available" || t.status === "unavailable").length,
    staysUnavailable: trackedAll.filter((t) => t.status === "unavailable").length,
    staysUnchecked: trackedAll.filter((t) => t.status === "unchecked").length,
    staysOutsideCoverage: trackedAll.filter((t) => t.status === "outside_coverage").length,
    incompleteQuotes: allStays.filter((s) => !s.price.taxesComplete).length,
  };

  const inMonth = (s: RankedStay) => !query.month || monthKey(s.checkIn) === query.month;
  let results: SearchResponse["results"];
  if (query.date) {
    const onDate = allStays
      .filter((s) => s.checkIn === query.date)
      .sort((a, b) => Number(!a.price.taxesComplete) - Number(!b.price.taxesComplete) || compareStays("total")(a, b));
    results = { kind: "date", items: onDate.slice(0, query.limit), total: onDate.length };
  } else {
    const matches = allStays.filter((s) => s.verdict === "within" && inMonth(s)).sort(compareStays(query.sort));
    if (matches.length) {
      results = { kind: "matches", items: matches.slice(0, query.limit), total: matches.length };
    } else {
      const closest = allStays
        .filter((s) => s.verdict === "over" && inMonth(s))
        .sort((a, b) => a.overBudgetBy - b.overBudgetBy || a.checkIn.localeCompare(b.checkIn));
      results = { kind: "closest", items: closest.slice(0, CLOSEST_OPTIONS), total: closest.length };
    }
  }

  const singleHotel = target.kind === "hotel" ? hotels[0] : undefined;
  const roomName = query.roomType ? singleHotel?.roomTypes.find((r) => r.id === query.roomType)?.name : undefined;
  const trackingLabel =
    (roomName ? `${roomName} only` : "Cheapest available room") + (query.refundableOnly ? ", free-cancellation rates only" : "");

  const description =
    query.budgetMode === "perNight"
      ? `${formatINR(query.budget)} per room per night × ${query.nights} night${query.nights > 1 ? "s" : ""} × ${query.rooms} room${query.rooms > 1 ? "s" : ""} = ${formatINR(limit)} for the stay, including taxes and mandatory fees`
      : `${formatINR(limit)} for the whole stay, including taxes and mandatory fees`;

  return {
    provider: {
      id: provider.info.id,
      name: provider.info.name,
      isDemo: provider.info.isDemo,
      bookingHorizonDays: provider.info.bookingHorizonDays,
      supportsRefresh: provider.info.supportsRefresh,
    },
    query,
    targetLabel: target.label,
    tracking: { mode: roomName ? "roomType" : "cheapest", label: trackingLabel },
    range: { start: checkIns[0], end: checkIns[checkIns.length - 1] },
    budget: { mode: query.budgetMode, amount: query.budget, perStayLimit: limit, description },
    hotels: hotels.map((h) => ({ id: h.id, name: h.name, city: h.city })),
    calendar,
    stats: {
      coverage,
      datesWithinBudget: calendar.filter((c) => c.status === "within").length,
      staysWithinBudget: allStays.filter((s) => s.verdict === "within").length,
      cheapest: ascending[0] ? toDatePrice(ascending[0]) : undefined,
      mostExpensive: ascending.length ? toDatePrice(ascending[ascending.length - 1]) : undefined,
      typicalNightly: median(priced.map((c) => c.best!.nightlyAverage)),
      months,
    },
    results,
    generatedAt: now.toISOString(),
  };
}
