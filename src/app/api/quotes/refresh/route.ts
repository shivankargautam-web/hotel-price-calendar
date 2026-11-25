import { getHotel } from "@/lib/catalogue";
import { isValidIsoDate, todayInIndia } from "@/lib/dates";
import { MAX_ADULTS_PER_ROOM, MAX_CHILDREN_PER_ROOM, MAX_ROOMS } from "@/lib/query";
import { getPriceProvider } from "@/server/providers";

interface RefreshBody {
  hotelId?: unknown;
  roomTypeId?: unknown;
  ratePlan?: unknown;
  checkIn?: unknown;
  nights?: unknown;
  adults?: unknown;
  children?: unknown;
  rooms?: unknown;
}

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Re-prices one stay right before the traveller is sent to the booking site. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RefreshBody;
  const provider = getPriceProvider();
  const { hotelId, roomTypeId, ratePlan, checkIn, nights, adults, children, rooms } = body;
  if (
    typeof hotelId !== "string" ||
    !getHotel(hotelId) ||
    typeof roomTypeId !== "string" ||
    typeof ratePlan !== "string" ||
    typeof checkIn !== "string" ||
    !isValidIsoDate(checkIn) ||
    !isInt(nights, 1, provider.info.maxNights) ||
    !isInt(rooms, 1, MAX_ROOMS) ||
    !isInt(adults, rooms, rooms * MAX_ADULTS_PER_ROOM) ||
    !isInt(children, 0, rooms * MAX_CHILDREN_PER_ROOM)
  ) {
    return Response.json({ error: "Invalid quote request" }, { status: 400 });
  }
  if (!provider.info.supportsRefresh) {
    return Response.json({ refreshed: false }, { headers: { "cache-control": "no-store" } });
  }
  const outcome = await provider.refreshQuote({
    hotelId,
    roomTypeId,
    ratePlan,
    checkIn,
    nights,
    occupancy: { adults, children, rooms },
    today: todayInIndia(),
  });
  if (outcome.status === "available") {
    return Response.json({ refreshed: true, status: "available", offer: outcome.offers[0] }, { headers: { "cache-control": "no-store" } });
  }
  return Response.json(
    { refreshed: true, status: outcome.status, reason: outcome.status === "unavailable" ? outcome.reason : undefined },
    { headers: { "cache-control": "no-store" } },
  );
}
