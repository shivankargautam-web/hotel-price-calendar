import type { BookingSource, Cancellation, Occupancy, PriceBreakdown } from "@/lib/types";

export interface ProviderInfo {
  id: string;
  name: string;
  /** True for synthetic data. The UI shows a "Demo prices" banner when set. */
  isDemo: boolean;
  /** How far ahead (in days from today, IST) the provider can quote a checkout date. */
  bookingHorizonDays: number;
  maxNights: number;
  /** How long a quote may be cached, as permitted by the provider's terms. */
  cacheTtlSeconds: number;
  /** Outbound request budget the provider allows. */
  requestsPerMinute: number;
  /** Whether a single quote can be re-priced on demand before booking. */
  supportsRefresh: boolean;
}

/** A bookable room and rate for the whole stay, priced by the provider in one quote. */
export interface RoomOffer {
  quoteRef: string;
  roomTypeId: string;
  roomName: string;
  ratePlan: string;
  price: PriceBreakdown;
  cancellation: Cancellation;
  source: BookingSource;
  checkedAt: string;
}

export type StayOutcome =
  | { status: "available"; offers: RoomOffer[] }
  | { status: "unavailable"; reason: string; checkedAt: string }
  | { status: "unchecked" }
  | { status: "outside_coverage" };

export interface StaySearchRequest {
  hotelId: string;
  /** Check-in dates (YYYY-MM-DD) to quote. Every quote covers `nights` consecutive nights. */
  checkIns: string[];
  nights: number;
  occupancy: Occupancy;
  /** Today's date in India, used for coverage and lead-time rules. */
  today: string;
}

export interface QuoteRefreshRequest {
  hotelId: string;
  checkIn: string;
  nights: number;
  occupancy: Occupancy;
  roomTypeId: string;
  ratePlan: string;
  today: string;
}

/**
 * Server-side pricing source. Implementations must return a single quote for the
 * full stay (all nights, all rooms, including taxes and mandatory fees), never a
 * sum of separate one-night quotes.
 */
export interface PriceProvider {
  readonly info: ProviderInfo;
  /** Returns one outcome per requested check-in date. */
  searchStays(request: StaySearchRequest): Promise<Map<string, StayOutcome>>;
  /** Re-prices one offer immediately before booking. */
  refreshQuote(request: QuoteRefreshRequest): Promise<StayOutcome>;
}
