import { serializeQuery } from "@/lib/query";
import type { SearchQuery, SearchResponse } from "@/lib/types";
import type { RoomOffer } from "@/server/providers/types";

export async function fetchSearch(query: SearchQuery, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`/api/search?${serializeQuery(query).toString()}`, { signal, cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Search failed (${res.status})`);
  return body as SearchResponse;
}

export type RefreshResult =
  | { refreshed: false }
  | { refreshed: true; status: "available"; offer: RoomOffer }
  | { refreshed: true; status: "unavailable" | "unchecked" | "outside_coverage"; reason?: string };

export async function refreshQuote(input: {
  hotelId: string;
  roomTypeId: string;
  ratePlan: string;
  checkIn: string;
  nights: number;
  adults: number;
  children: number;
  rooms: number;
}): Promise<RefreshResult> {
  const res = await fetch("/api/quotes/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Could not refresh the price");
  return body as RefreshResult;
}
