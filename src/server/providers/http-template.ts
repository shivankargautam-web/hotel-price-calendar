import { getHotel, type Hotel } from "@/lib/catalogue";
import { addDays, daysBetween } from "@/lib/dates";
import type { Occupancy } from "@/lib/types";
import { TtlCache } from "../cache";
import { RateLimiter } from "../rate-limit";
import type { PriceProvider, ProviderInfo, QuoteRefreshRequest, RoomOffer, StayOutcome, StaySearchRequest } from "./types";

/**
 * Template adapter for an approved hotel availability API (see README, "Connecting live prices").
 *
 * It assumes an endpoint that prices a complete stay in one call:
 *   POST {baseUrl}/v1/stays/quote
 *   { hotelCode, checkIn, checkOut, adults, children, rooms, currency: "INR" }
 * and answers with the `ApiQuoteResponse` shape below. Adapt `buildRequest` and
 * `mapResponse` to your provider's real schema; keep the rest (horizon, quota, cache).
 */

interface ApiOffer {
  id: string;
  roomCode: string;
  roomName: string;
  ratePlanCode: string;
  currency: string;
  totals: { base: number; taxes: number; fees: number; total: number };
  taxesIncluded: boolean;
  feesIncluded: boolean;
  cancellation: { refundable: boolean; freeUntil?: string; text: string };
  bookingUrl: string;
}

interface ApiQuoteResponse {
  status: "available" | "sold_out";
  offers?: ApiOffer[];
  reason?: string;
  retrievedAt?: string;
}

export interface HttpProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  bookingHorizonDays: number;
  maxNights: number;
  requestsPerMinute: number;
  cacheTtlSeconds: number;
  /** Hard cap on outbound quotes per search; the rest show as "not checked yet". */
  maxQuotesPerSearch: number;
  concurrency: number;
  timeoutMs: number;
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export class HttpAvailabilityProvider implements PriceProvider {
  readonly info: ProviderInfo;
  private cache: TtlCache<StayOutcome>;
  private limiter: RateLimiter;

  constructor(private config: HttpProviderConfig) {
    this.info = {
      id: config.id,
      name: config.name,
      isDemo: false,
      bookingHorizonDays: config.bookingHorizonDays,
      maxNights: config.maxNights,
      cacheTtlSeconds: config.cacheTtlSeconds,
      requestsPerMinute: config.requestsPerMinute,
      supportsRefresh: true,
    };
    this.cache = new TtlCache(config.cacheTtlSeconds * 1000);
    this.limiter = new RateLimiter(config.requestsPerMinute);
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): HttpAvailabilityProvider {
    const baseUrl = env.HOTEL_API_BASE_URL;
    const apiKey = env.HOTEL_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error("PRICE_PROVIDER=http requires HOTEL_API_BASE_URL and HOTEL_API_KEY");
    }
    return new HttpAvailabilityProvider({
      id: env.HOTEL_API_PROVIDER_ID ?? "http",
      name: env.HOTEL_API_PROVIDER_NAME ?? "Hotel availability API",
      baseUrl: baseUrl.replace(/\/$/, ""),
      apiKey,
      bookingHorizonDays: intFromEnv(env.HOTEL_API_BOOKING_HORIZON_DAYS, 330),
      maxNights: intFromEnv(env.HOTEL_API_MAX_NIGHTS, 14),
      requestsPerMinute: intFromEnv(env.HOTEL_API_REQUESTS_PER_MINUTE, 60),
      cacheTtlSeconds: intFromEnv(env.HOTEL_API_CACHE_TTL_SECONDS, 900),
      maxQuotesPerSearch: intFromEnv(env.HOTEL_API_MAX_QUOTES_PER_SEARCH, 120),
      concurrency: intFromEnv(env.HOTEL_API_CONCURRENCY, 4),
      timeoutMs: intFromEnv(env.HOTEL_API_TIMEOUT_MS, 8000),
    });
  }

  async searchStays(request: StaySearchRequest): Promise<Map<string, StayOutcome>> {
    const result = new Map<string, StayOutcome>();
    const hotel = getHotel(request.hotelId);
    const hotelCode = hotel?.externalIds?.[this.config.id];
    const pending: string[] = [];

    for (const checkIn of request.checkIns) {
      const checkOut = addDays(checkIn, request.nights);
      if (!hotel || !hotelCode || request.nights > this.info.maxNights || daysBetween(request.today, checkOut) > this.info.bookingHorizonDays) {
        result.set(checkIn, { status: "outside_coverage" });
        continue;
      }
      const cached = this.cache.get(this.cacheKey(hotel.id, checkIn, request.nights, request.occupancy));
      if (cached) result.set(checkIn, cached);
      else pending.push(checkIn);
    }

    // Spend the per-search quota on the nearest dates first; never wait on the limiter here.
    const toFetch: string[] = [];
    for (const checkIn of pending) {
      if (toFetch.length < this.config.maxQuotesPerSearch && this.limiter.tryTake()) toFetch.push(checkIn);
      else result.set(checkIn, { status: "unchecked" });
    }

    let next = 0;
    const worker = async () => {
      while (next < toFetch.length) {
        const checkIn = toFetch[next++];
        const outcome = await this.fetchStay(hotel!, hotelCode!, checkIn, request.nights, request.occupancy);
        result.set(checkIn, outcome);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.config.concurrency, toFetch.length) }, worker));
    return result;
  }

  async refreshQuote(request: QuoteRefreshRequest): Promise<StayOutcome> {
    const hotel = getHotel(request.hotelId);
    const hotelCode = hotel?.externalIds?.[this.config.id];
    if (!hotel || !hotelCode) return { status: "outside_coverage" };
    await this.limiter.take();
    const outcome = await this.fetchStay(hotel, hotelCode, request.checkIn, request.nights, request.occupancy);
    if (outcome.status !== "available") return outcome;
    const offer = outcome.offers.find((o) => o.roomTypeId === request.roomTypeId && o.ratePlan === request.ratePlan);
    return offer
      ? { status: "available", offers: [offer] }
      : { status: "unavailable", reason: "This room and rate are no longer available", checkedAt: new Date().toISOString() };
  }

  private cacheKey(hotelId: string, checkIn: string, nights: number, o: Occupancy) {
    return `${hotelId}:${checkIn}:${nights}:${o.adults}-${o.children}-${o.rooms}`;
  }

  private buildRequest(hotelCode: string, checkIn: string, nights: number, o: Occupancy) {
    return { hotelCode, checkIn, checkOut: addDays(checkIn, nights), adults: o.adults, children: o.children, rooms: o.rooms, currency: "INR" };
  }

  private async fetchStay(hotel: Hotel, hotelCode: string, checkIn: string, nights: number, occupancy: Occupancy): Promise<StayOutcome> {
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/stays/quote`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify(this.buildRequest(hotelCode, checkIn, nights, occupancy)),
        signal: AbortSignal.timeout(this.config.timeoutMs),
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) return { status: "unchecked" };
      if (!res.ok) return { status: "unchecked" };
      const outcome = this.mapResponse(hotel, (await res.json()) as ApiQuoteResponse);
      this.cache.set(this.cacheKey(hotel.id, checkIn, nights, occupancy), outcome);
      return outcome;
    } catch {
      return { status: "unchecked" };
    }
  }

  private mapResponse(hotel: Hotel, body: ApiQuoteResponse): StayOutcome {
    const checkedAt = body.retrievedAt ?? new Date().toISOString();
    if (body.status !== "available" || !body.offers?.length) {
      return { status: "unavailable", reason: body.reason ?? "Sold out for these dates", checkedAt };
    }
    const offers: RoomOffer[] = body.offers
      .filter((o) => o.currency === "INR" && Number.isFinite(o.totals.total) && o.totals.total > 0)
      .map((o) => {
        const room = hotel.roomTypes.find((r) => r.externalIds?.[this.config.id] === o.roomCode);
        const taxesComplete = o.taxesIncluded && o.feesIncluded;
        return {
          quoteRef: o.id,
          roomTypeId: room?.id ?? `ext-${o.roomCode}`,
          roomName: room?.name ?? o.roomName,
          ratePlan: o.ratePlanCode,
          price: {
            currency: "INR",
            base: Math.round(o.totals.base),
            taxes: Math.round(o.totals.taxes),
            mandatoryFees: Math.round(o.totals.fees),
            total: Math.round(o.totals.total),
            taxesComplete,
            notes: taxesComplete ? [] : ["Source did not confirm all taxes and mandatory fees"],
          },
          cancellation: { refundable: o.cancellation.refundable, freeUntil: o.cancellation.freeUntil, summary: o.cancellation.text },
          source: { providerId: this.config.id, name: this.config.name, bookingUrl: o.bookingUrl },
          checkedAt,
        };
      });
    return offers.length ? { status: "available", offers } : { status: "unavailable", reason: "No bookable INR rates returned", checkedAt };
  }
}
