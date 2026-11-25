import { DEFAULT_TARGET, HOTELS, getHotel, resolveTarget } from "./catalogue";
import { isValidIsoDate } from "./dates";
import type { SearchQuery } from "./types";

export const MAX_NIGHTS = 14;
export const MAX_ROOMS = 4;
export const MAX_ADULTS_PER_ROOM = 3;
export const MAX_CHILDREN_PER_ROOM = 2;
export const MAX_BUDGET = 10_000_000;
/** Enough to list every hotel × check-in date in the rolling year. */
export const MAX_RESULTS = HOTELS.length * 366;
export const RESULTS_PAGE_SIZE = 30;

export const DEFAULT_QUERY: SearchQuery = {
  target: DEFAULT_TARGET,
  nights: 2,
  adults: 2,
  children: 0,
  rooms: 1,
  budgetMode: "perNight",
  budget: 10_000,
  roomType: null,
  refundableOnly: false,
  month: null,
  date: null,
  sort: "total",
  limit: RESULTS_PAGE_SIZE,
};

function int(value: string | null): number | undefined {
  if (value === null || value.trim() === "" || !/^\d+$/.test(value.trim())) return undefined;
  return Number(value);
}

/**
 * Parses and validates search parameters. Invalid values fall back to defaults
 * and are reported in `errors` so the API can reject them.
 */
export function parseQuery(params: URLSearchParams): { query: SearchQuery; errors: string[] } {
  const errors: string[] = [];
  const q: SearchQuery = { ...DEFAULT_QUERY };

  const target = params.get("target");
  if (target !== null) {
    if (resolveTarget(target)) q.target = target;
    else errors.push(`Unknown hotel, brand or city: ${target}`);
  }

  const read = (key: string, min: number, max: number): number | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const n = int(raw);
    if (n === undefined || n < min || n > max) {
      errors.push(`${key} must be a whole number between ${min} and ${max}`);
      return undefined;
    }
    return n;
  };

  q.nights = read("nights", 1, MAX_NIGHTS) ?? q.nights;
  q.rooms = read("rooms", 1, MAX_ROOMS) ?? q.rooms;
  q.adults = read("adults", 1, MAX_ROOMS * MAX_ADULTS_PER_ROOM) ?? q.adults;
  q.children = read("children", 0, MAX_ROOMS * MAX_CHILDREN_PER_ROOM) ?? q.children;
  q.budget = read("budget", 1, MAX_BUDGET) ?? q.budget;
  q.limit = read("limit", 1, MAX_RESULTS) ?? q.limit;

  if (q.adults < q.rooms) errors.push("Each room needs at least one adult");
  if (q.adults > q.rooms * MAX_ADULTS_PER_ROOM) errors.push(`At most ${MAX_ADULTS_PER_ROOM} adults per room`);
  if (q.children > q.rooms * MAX_CHILDREN_PER_ROOM) errors.push(`At most ${MAX_CHILDREN_PER_ROOM} children per room`);

  const mode = params.get("budgetMode");
  if (mode !== null) {
    if (mode === "perNight" || mode === "total") q.budgetMode = mode;
    else errors.push("budgetMode must be perNight or total");
  }

  const roomType = params.get("roomType");
  if (roomType && roomType !== "cheapest") {
    const target = resolveTarget(q.target);
    const hotel = target?.kind === "hotel" ? getHotel(target.hotelIds[0]) : undefined;
    if (hotel?.roomTypes.some((r) => r.id === roomType)) q.roomType = roomType;
    else errors.push("A specific room type can only be tracked for a single hotel that offers it");
  }

  q.refundableOnly = params.get("refundable") === "1" || params.get("refundable") === "true";

  const month = params.get("month");
  if (month) {
    if (/^\d{4}-\d{2}$/.test(month)) q.month = month;
    else errors.push("month must be YYYY-MM");
  }
  const date = params.get("date");
  if (date) {
    if (isValidIsoDate(date)) q.date = date;
    else errors.push("date must be YYYY-MM-DD");
  }

  const sort = params.get("sort");
  if (sort !== null) {
    if (sort === "total" || sort === "date") q.sort = sort;
    else errors.push("sort must be total or date");
  }

  return { query: q, errors };
}

/** Serialises a query. With `compact`, values equal to the defaults are omitted (for shareable URLs). */
export function serializeQuery(query: SearchQuery, compact = false): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | number | boolean | null, def: string | number | boolean | null) => {
    if (value === null || value === false || (compact && value === def)) return;
    params.set(key, value === true ? "1" : String(value));
  };
  put("target", query.target, DEFAULT_QUERY.target);
  put("nights", query.nights, DEFAULT_QUERY.nights);
  put("adults", query.adults, DEFAULT_QUERY.adults);
  put("children", query.children, DEFAULT_QUERY.children);
  put("rooms", query.rooms, DEFAULT_QUERY.rooms);
  put("budgetMode", query.budgetMode, DEFAULT_QUERY.budgetMode);
  put("budget", query.budget, DEFAULT_QUERY.budget);
  put("roomType", query.roomType, null);
  put("refundable", query.refundableOnly, false);
  put("month", query.month, null);
  put("date", query.date, null);
  put("sort", query.sort, DEFAULT_QUERY.sort);
  put("limit", query.limit, DEFAULT_QUERY.limit);
  return params;
}
