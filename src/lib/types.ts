export type BudgetMode = "perNight" | "total";
export type SortKey = "total" | "date";

/** Status of a single priced stay (one hotel, one check-in, one stay length). */
export type StayStatus = "available" | "unavailable" | "unchecked" | "outside_coverage";

/** How a stay compares with the budget. Only "within" counts as a confirmed match. */
export type BudgetVerdict = "within" | "over" | "unconfirmed";

/** Calendar cell status, from most to least useful for the traveller. */
export type CellStatus = BudgetVerdict | "unavailable" | "unchecked" | "outside_coverage";

export interface Occupancy {
  adults: number;
  children: number;
  rooms: number;
}

/** Full-stay price for all rooms, in whole rupees. */
export interface PriceBreakdown {
  currency: "INR";
  /** Room charges before taxes, for every night and every room. */
  base: number;
  taxes: number;
  /** Mandatory fees (resort fees etc.) including any tax charged on them. */
  mandatoryFees: number;
  /** Total payable. Only trustworthy when taxesComplete is true. */
  total: number;
  /** False when the source could not confirm all taxes and mandatory fees. */
  taxesComplete: boolean;
  notes: string[];
}

export interface Cancellation {
  refundable: boolean;
  summary: string;
  /** ISO date until which cancellation is free, if refundable. */
  freeUntil?: string;
}

export interface BookingSource {
  providerId: string;
  name: string;
  bookingUrl: string;
}

export interface RankedStay {
  key: string;
  hotelId: string;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomTypeId: string;
  roomName: string;
  ratePlan: string;
  /** Average per room per night, derived from the full-stay total. */
  nightlyAverage: number;
  price: PriceBreakdown;
  verdict: BudgetVerdict;
  budgetLimit: number;
  /** Positive when the stay costs more than the budget. */
  overBudgetBy: number;
  cancellation: Cancellation;
  source: BookingSource;
  checkedAt: string;
}

export interface CellBest {
  hotelId: string;
  hotelName: string;
  roomName: string;
  total: number;
  nightlyAverage: number;
  taxesComplete: boolean;
}

export interface CalendarCell {
  date: string;
  checkOut: string;
  status: CellStatus;
  /** Cheapest tracked stay for this check-in. Never present for unavailable/unchecked/outside dates. */
  best?: CellBest;
  /** Number of hotels with a confirmed in-budget stay on this date. */
  matches: number;
  hotelsChecked: number;
  hotelsTotal: number;
}

export interface DatePrice {
  date: string;
  hotelName: string;
  hotelsChecked: number;
  total: number;
  nightlyAverage: number;
}

export interface MonthSummary {
  month: string; // YYYY-MM
  cheapest?: DatePrice;
  datesWithinBudget: number;
  datesChecked: number;
}

export interface CoverageStats {
  datesInRange: number;
  datesChecked: number;
  datesUnavailable: number;
  datesUnchecked: number;
  datesOutsideCoverage: number;
  staysTotal: number;
  staysChecked: number;
  staysUnavailable: number;
  staysUnchecked: number;
  staysOutsideCoverage: number;
  incompleteQuotes: number;
}

export interface SearchStats {
  coverage: CoverageStats;
  datesWithinBudget: number;
  staysWithinBudget: number;
  cheapest?: DatePrice;
  mostExpensive?: DatePrice;
  typicalNightly?: number;
  months: MonthSummary[];
}

export interface ProviderSummary {
  id: string;
  name: string;
  isDemo: boolean;
  bookingHorizonDays: number;
  supportsRefresh: boolean;
}

export interface SearchQuery {
  target: string;
  nights: number;
  adults: number;
  children: number;
  rooms: number;
  budgetMode: BudgetMode;
  budget: number;
  /** null = track the cheapest available room. */
  roomType: string | null;
  refundableOnly: boolean;
  month: string | null;
  date: string | null;
  sort: SortKey;
  limit: number;
}

export interface SearchResponse {
  provider: ProviderSummary;
  query: SearchQuery;
  targetLabel: string;
  tracking: { mode: "cheapest" | "roomType"; label: string };
  range: { start: string; end: string };
  budget: { mode: BudgetMode; amount: number; perStayLimit: number; description: string };
  hotels: { id: string; name: string; city: string }[];
  calendar: CalendarCell[];
  stats: SearchStats;
  results: {
    kind: "matches" | "closest" | "date";
    items: RankedStay[];
    total: number;
  };
  generatedAt: string;
}
