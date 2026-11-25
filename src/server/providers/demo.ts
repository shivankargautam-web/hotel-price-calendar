import { getHotel, type Hotel } from "@/lib/catalogue";
import { addDays, daysBetween, formatDate, weekday } from "@/lib/dates";
import type { Occupancy, PriceBreakdown } from "@/lib/types";
import type { PriceProvider, ProviderInfo, QuoteRefreshRequest, RoomOffer, StayOutcome, StaySearchRequest } from "./types";

/**
 * Deterministic synthetic prices for demo mode. Rates follow Indian travel seasons,
 * weekends, festivals, length-of-stay discounts and GST slabs so the UI behaves like
 * it would with live data. None of these prices are real.
 */

type Profile = "city" | "leisure" | "beach" | "hill";

interface DemoSeed {
  /** Pre-tax rate for the entry room on an average night, per room. */
  baseRate: number;
  profile: Profile;
  /** Mandatory resort fee per room per night (GST is added on top). */
  resortFee?: number;
  /** How far ahead this hotel has loaded rates. */
  rateHorizonDays: number;
  freeCancellationDays: number;
  advancePurchase: boolean;
  /** Recurring closure, as MM-DD ranges. */
  closure?: { from: string; to: string; reason: string };
}

const SEEDS: Record<string, DemoSeed> = {
  "taj-mahal-palace-mumbai": { baseRate: 21500, profile: "city", rateHorizonDays: 365, freeCancellationDays: 2, advancePurchase: true },
  "taj-lands-end-mumbai": { baseRate: 11000, profile: "city", rateHorizonDays: 340, freeCancellationDays: 1, advancePurchase: true },
  "taj-palace-new-delhi": { baseRate: 11800, profile: "city", rateHorizonDays: 340, freeCancellationDays: 1, advancePurchase: true },
  "taj-mahal-new-delhi": { baseRate: 13800, profile: "city", rateHorizonDays: 365, freeCancellationDays: 2, advancePurchase: false },
  "taj-west-end-bengaluru": { baseRate: 11800, profile: "city", rateHorizonDays: 330, freeCancellationDays: 1, advancePurchase: true },
  "taj-coromandel-chennai": { baseRate: 10400, profile: "city", rateHorizonDays: 330, freeCancellationDays: 1, advancePurchase: true },
  "taj-falaknuma-palace-hyderabad": { baseRate: 42000, profile: "leisure", rateHorizonDays: 365, freeCancellationDays: 7, advancePurchase: false },
  "taj-lake-palace-udaipur": { baseRate: 46000, profile: "leisure", rateHorizonDays: 365, freeCancellationDays: 7, advancePurchase: false, closure: { from: "07-06", to: "08-09", reason: "Closed for annual maintenance" } },
  "rambagh-palace-jaipur": { baseRate: 38000, profile: "leisure", rateHorizonDays: 365, freeCancellationDays: 7, advancePurchase: false },
  "taj-fort-aguada-goa": { baseRate: 12500, profile: "beach", resortFee: 1200, rateHorizonDays: 330, freeCancellationDays: 3, advancePurchase: true },
  "taj-bengal-kolkata": { baseRate: 9800, profile: "city", rateHorizonDays: 300, freeCancellationDays: 1, advancePurchase: true },
  "taj-malabar-kochi": { baseRate: 9200, profile: "beach", rateHorizonDays: 300, freeCancellationDays: 2, advancePurchase: true },
  "taj-mahal-lucknow": { baseRate: 8800, profile: "city", rateHorizonDays: 300, freeCancellationDays: 1, advancePurchase: true },
  "taj-ganges-varanasi": { baseRate: 8600, profile: "leisure", rateHorizonDays: 300, freeCancellationDays: 2, advancePurchase: true },
  "taj-chia-kutir-darjeeling": { baseRate: 13500, profile: "hill", resortFee: 800, rateHorizonDays: 330, freeCancellationDays: 5, advancePurchase: false },
  "taj-madikeri-coorg": { baseRate: 15000, profile: "hill", resortFee: 1000, rateHorizonDays: 330, freeCancellationDays: 5, advancePurchase: true },
  "oberoi-amarvilas-agra": { baseRate: 39000, profile: "leisure", rateHorizonDays: 365, freeCancellationDays: 3, advancePurchase: false },
  "oberoi-mumbai": { baseRate: 16500, profile: "city", rateHorizonDays: 365, freeCancellationDays: 1, advancePurchase: true },
  "leela-palace-udaipur": { baseRate: 31000, profile: "leisure", rateHorizonDays: 365, freeCancellationDays: 7, advancePurchase: false },
  "leela-palace-new-delhi": { baseRate: 14200, profile: "city", rateHorizonDays: 340, freeCancellationDays: 1, advancePurchase: true },
  "itc-grand-chola-chennai": { baseRate: 9600, profile: "city", rateHorizonDays: 330, freeCancellationDays: 1, advancePurchase: true },
};

/** Price multiplier for each room type, entry room first. */
const ROOM_MULTIPLIERS = [1, 1.3, 1.7, 2.9];

const SEASON: Record<Profile, number[]> = {
  city: [1.1, 1.08, 1.02, 0.92, 0.85, 0.82, 0.82, 0.85, 0.92, 1.02, 1.08, 1.15],
  leisure: [1.25, 1.18, 1.05, 0.88, 0.78, 0.75, 0.78, 0.8, 0.88, 1.05, 1.2, 1.3],
  beach: [1.25, 1.12, 1.0, 0.88, 0.8, 0.7, 0.68, 0.7, 0.78, 0.95, 1.15, 1.4],
  hill: [0.9, 0.88, 1.0, 1.2, 1.3, 1.15, 0.75, 0.75, 0.9, 1.15, 1.1, 1.05],
};

const DIWALI = ["2025-10-20", "2026-11-08", "2027-10-29", "2028-10-17"];
const HOLI = ["2026-03-04", "2027-03-22", "2028-03-11"];

/** GST on hotel accommodation: 5% up to ₹7,500 per room per night, 18% above. */
const GST_THRESHOLD = 7500;
const GST_LOW = 0.05;
const GST_HIGH = 0.18;

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function round50(n: number): number {
  return Math.round(n / 50) * 50;
}

function inMonthDayRange(date: string, from: string, to: string): boolean {
  const md = date.slice(5);
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

interface NightEvent {
  factor: number;
  minNights?: number;
  name?: string;
}

function eventFor(night: string, profile: Profile): NightEvent {
  if (inMonthDayRange(night, "12-22", "01-01")) {
    const md = night.slice(5);
    const minNights = (md === "12-30" || md === "12-31") && (profile === "beach" || profile === "leisure") ? 3 : undefined;
    return { factor: profile === "city" ? 1.3 : 1.6, minNights, name: "Christmas & New Year" };
  }
  if (DIWALI.some((d) => Math.abs(daysBetween(d, night)) <= 2)) return { factor: 1.22, name: "Diwali" };
  if (HOLI.some((d) => Math.abs(daysBetween(d, night)) <= 1)) return { factor: profile === "leisure" ? 1.15 : 1.05, name: "Holi" };
  return { factor: 1 };
}

interface NightCell {
  rate: number;
  soldOut: boolean;
  event: NightEvent;
}

export class DemoPriceProvider implements PriceProvider {
  readonly info: ProviderInfo = {
    id: "demo",
    name: "Demo rate feed (sample data)",
    isDemo: true,
    bookingHorizonDays: 365,
    maxNights: 14,
    cacheTtlSeconds: 0,
    requestsPerMinute: Number.POSITIVE_INFINITY,
    supportsRefresh: true,
  };

  constructor(private clock: () => Date = () => new Date()) {}

  async searchStays(request: StaySearchRequest): Promise<Map<string, StayOutcome>> {
    const result = new Map<string, StayOutcome>();
    const hotel = getHotel(request.hotelId);
    const seed = SEEDS[request.hotelId];
    if (!hotel || !seed) {
      for (const d of request.checkIns) result.set(d, { status: "outside_coverage" });
      return result;
    }
    const nightTable = new Map<string, NightCell[]>();
    const nightsFor = (date: string) => {
      let cells = nightTable.get(date);
      if (!cells) {
        cells = hotel.roomTypes.map((_, i) => this.night(hotel, seed, i, date));
        nightTable.set(date, cells);
      }
      return cells;
    };
    for (const checkIn of request.checkIns) {
      result.set(checkIn, this.quote(hotel, seed, checkIn, request.nights, request.occupancy, request.today, nightsFor));
    }
    return result;
  }

  async refreshQuote(request: QuoteRefreshRequest): Promise<StayOutcome> {
    const hotel = getHotel(request.hotelId);
    const seed = SEEDS[request.hotelId];
    if (!hotel || !seed) return { status: "outside_coverage" };
    const outcome = this.quote(hotel, seed, request.checkIn, request.nights, request.occupancy, request.today, (date) =>
      hotel.roomTypes.map((_, i) => this.night(hotel, seed, i, date)),
    );
    if (outcome.status !== "available") return outcome;
    const offer = outcome.offers.find((o) => o.roomTypeId === request.roomTypeId && o.ratePlan === request.ratePlan);
    if (!offer) return { status: "unavailable", reason: "This room and rate are no longer available", checkedAt: this.clock().toISOString() };
    return { status: "available", offers: [{ ...offer, checkedAt: this.clock().toISOString() }] };
  }

  private night(hotel: Hotel, seed: DemoSeed, roomIndex: number, date: string): NightCell {
    const month = Number(date.slice(5, 7)) - 1;
    const season = SEASON[seed.profile][month];
    const day = weekday(date);
    const weekendNight = day === 5 || day === 6;
    const dow = seed.profile === "city" ? (weekendNight ? 0.88 : day === 0 ? 0.93 : 1) : weekendNight ? 1.12 : 1;
    const event = eventFor(date, seed.profile);
    const noise = 0.93 + hash(hotel.id, date, "noise") * 0.14;
    const rate = seed.baseRate * ROOM_MULTIPLIERS[roomIndex] * season * dow * event.factor * noise;

    let soldOutChance = 0.03 + (season >= 1.15 ? 0.05 : 0) + (event.name ? 0.12 : 0);
    soldOutChance *= roomIndex === 0 ? 1.7 : roomIndex === 1 ? 1 : 0.5;
    const closed = seed.closure && inMonthDayRange(date, seed.closure.from, seed.closure.to);
    return { rate, soldOut: Boolean(closed) || hash(hotel.id, roomIndex, date, "sold") < soldOutChance, event };
  }

  private quote(
    hotel: Hotel,
    seed: DemoSeed,
    checkIn: string,
    nights: number,
    occupancy: Occupancy,
    today: string,
    nightsFor: (date: string) => NightCell[],
  ): StayOutcome {
    const now = this.clock();
    const lead = daysBetween(today, checkIn);
    const checkOut = addDays(checkIn, nights);
    const horizon = Math.min(seed.rateHorizonDays, this.info.bookingHorizonDays);
    if (lead < 0 || daysBetween(today, checkOut) > horizon || nights > this.info.maxNights) {
      return { status: "outside_coverage" };
    }

    const uncheckedChance = lead < 120 ? 0.02 : lead < 240 ? 0.07 : 0.18;
    if (hash(hotel.id, checkIn, nights, "checked") < uncheckedChance) return { status: "unchecked" };

    const hourStart = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
    const maxAgeHours = lead < 45 ? 5 : lead < 150 ? 18 : 40;
    const ageMs = (0.25 + hash(hotel.id, checkIn, nights, "age") * maxAgeHours) * 3_600_000;
    const checkedAt = new Date(Math.floor((hourStart - ageMs) / 60_000) * 60_000).toISOString();

    if (seed.closure && inMonthDayRange(checkIn, seed.closure.from, seed.closure.to)) {
      return { status: "unavailable", reason: seed.closure.reason, checkedAt };
    }

    const stayNights = Array.from({ length: nights }, (_, k) => nightsFor(addDays(checkIn, k)));
    const minNights = Math.max(0, ...stayNights.map((cells) => cells[0].event.minNights ?? 0));
    if (minNights > nights) {
      return { status: "unavailable", reason: `Minimum stay of ${minNights} nights on these dates`, checkedAt };
    }

    const losFactor = nights >= 7 ? 0.85 : nights >= 5 ? 0.9 : nights >= 3 ? 0.95 : 1;
    const singleOccupancy = occupancy.adults === occupancy.rooms;
    const extraAdults = Math.max(0, occupancy.adults - 2 * occupancy.rooms);
    const extraAdultRate = round50(seed.baseRate * 0.22);

    const offers: RoomOffer[] = [];
    hotel.roomTypes.forEach((room, roomIndex) => {
      if (stayNights.some((cells) => cells[roomIndex].soldOut)) return;
      const plans: { id: string; factor: number }[] = [{ id: "flex", factor: 1 }];
      if (seed.advancePurchase && lead >= 14) plans.push({ id: "advance", factor: 0.88 });

      for (const plan of plans) {
        let base = 0;
        let taxes = 0;
        let highSlabNights = 0;
        for (const cells of stayNights) {
          const roomRate = round50(cells[roomIndex].rate * plan.factor * losFactor * (singleOccupancy ? 0.92 : 1));
          const nightBase = roomRate * occupancy.rooms + extraAdults * extraAdultRate;
          const tariffPerRoom = nightBase / occupancy.rooms;
          const gst = tariffPerRoom > GST_THRESHOLD ? GST_HIGH : GST_LOW;
          if (gst === GST_HIGH) highSlabNights++;
          base += nightBase;
          taxes += Math.round(nightBase * gst);
        }
        const notes: string[] = [];
        notes.push(
          highSlabNights === nights
            ? "GST 18% (room tariff above ₹7,500 per night)"
            : highSlabNights === 0
              ? "GST 5% (room tariff up to ₹7,500 per night)"
              : `GST 18% on ${highSlabNights} night(s), 5% on the rest`,
        );
        if (losFactor < 1) notes.push(`Includes ${Math.round((1 - losFactor) * 100)}% length-of-stay discount`);
        let mandatoryFees = 0;
        if (seed.resortFee) {
          mandatoryFees = Math.round(seed.resortFee * occupancy.rooms * nights * (1 + GST_HIGH));
          notes.push(`Mandatory resort fee ₹${seed.resortFee.toLocaleString("en-IN")} + GST per room per night`);
        }
        let taxesComplete = true;
        if (hash(hotel.id, room.id, plan.id, checkIn, nights, "taxgap") < 0.025) {
          taxesComplete = false;
          taxes = 0;
          notes.unshift("Source did not confirm GST — payable total will be higher");
        }
        const price: PriceBreakdown = { currency: "INR", base, taxes, mandatoryFees, total: base + taxes + mandatoryFees, taxesComplete, notes };

        let cancellation: RoomOffer["cancellation"];
        if (plan.id === "advance") {
          cancellation = { refundable: false, summary: "Non-refundable advance purchase" };
        } else {
          const freeUntil = addDays(checkIn, -seed.freeCancellationDays);
          cancellation =
            freeUntil >= today
              ? { refundable: true, freeUntil, summary: `Free cancellation until ${formatDate(freeUntil, { day: "numeric", month: "short", year: "numeric" })} (${seed.freeCancellationDays} day${seed.freeCancellationDays > 1 ? "s" : ""} before check-in)` }
              : { refundable: false, summary: "Inside the cancellation window — non-refundable" };
        }

        offers.push({
          quoteRef: `demo:${hotel.id}:${room.id}:${plan.id}:${checkIn}:${nights}:${occupancy.adults}-${occupancy.children}-${occupancy.rooms}`,
          roomTypeId: room.id,
          roomName: room.name,
          ratePlan: plan.id,
          price,
          cancellation,
          source: { providerId: this.info.id, name: this.info.name, bookingUrl: hotel.website },
          checkedAt,
        });
      }
    });

    if (offers.length === 0) return { status: "unavailable", reason: "Sold out for these dates", checkedAt };
    return { status: "available", offers };
  }
}
