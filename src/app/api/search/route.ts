import type { NextRequest } from "next/server";
import { parseQuery } from "@/lib/query";
import { getPriceProvider } from "@/server/providers";
import { runSearch } from "@/server/search";

export async function GET(request: NextRequest) {
  const { query, errors } = parseQuery(request.nextUrl.searchParams);
  if (errors.length) {
    return Response.json({ error: errors.join("; ") }, { status: 400 });
  }
  const provider = getPriceProvider();
  if (query.nights > provider.info.maxNights) {
    return Response.json({ error: `This provider quotes stays of up to ${provider.info.maxNights} nights` }, { status: 400 });
  }
  const response = await runSearch(query, provider);
  return Response.json(response, { headers: { "cache-control": "no-store" } });
}
