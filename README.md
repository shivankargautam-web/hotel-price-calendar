# Luxury Within Budget

A price calendar that answers one question: *“I want to stay at a Taj hotel in India and can travel any time in the next 12 months. Which dates fit my ₹10,000-per-night budget?”*

Pick one hotel, a city, a brand (all tracked Taj hotels by default) or every tracked hotel. Set the budget, nights, guests and rooms. The app quotes the **whole stay** for each of the next 365 check-in dates. It then marks the dates whose total, including taxes and mandatory fees, is within budget, and ranks the affordable stays by total payable price.

> The first version runs on **synthetic demo prices**. The UI says “Demo prices — sample data” on every page.

## Run it

Requires Node.js 20.9+ (tested on Node 24).

```bash
npm ci
npm run dev        # http://localhost:3000
```

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm test` | Unit and component tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build && npm start` | Production build |

## How prices are matched

- **One quote per stay.** Each calendar cell is a check-in date. Its price comes from a single provider quote for all nights and all rooms. Multi-night prices are never built by adding one-night quotes.
- **Budget.** In per-night mode, the stay limit is `budget × nights × rooms`. In total-stay mode, the budget is the limit. At ₹10,000 a night for 2 nights, a ₹20,000 stay qualifies and a ₹20,001 stay does not (`src/lib/budget.ts`).
- **Incomplete quotes.** Quotes that leave out taxes or mandatory fees are flagged with an amber cell and “Taxes/fees incomplete”. They never count as matches.
- **Calendar states.** Cells are one of: within budget (green), over budget, taxes/fees incomplete, sold out/closed, not checked yet, or outside provider coverage. Only the first three show a price, so a date without a quote can never read as ₹0.
- **Tracking and coverage.** The page says whether it tracks the cheapest available room or one room type (for a single hotel). It also shows how many dates and hotel-dates were checked.
- If nothing fits, the results list the closest options and how far over budget each one is.

## Code map

| Path | What it does |
| --- | --- |
| `src/lib/` | Shared types, budget maths, dates in IST, query parsing, hotel catalogue |
| `src/server/search.ts` | Builds the calendar, summary statistics and ranked results from provider quotes |
| `src/server/providers/types.ts` | `PriceProvider` interface (server-only) |
| `src/server/providers/demo.ts` | Deterministic synthetic prices: seasons, festivals, weekends, GST slabs, resort fees, sold-out dates, closures, minimum stays |
| `src/server/providers/http-template.ts` | Template adapter for a live availability API, with a cache and rate limiter |
| `src/app/api/search` | `GET` search endpoint used by the UI |
| `src/app/api/quotes/refresh` | `POST` endpoint that re-prices one stay before booking |
| `src/components/` | Search box, controls, calendar, summary and results UI |

## Connecting live prices

Pricing stays on the server. The browser only calls `/api/search` and `/api/quotes/refresh`, so API keys never reach the client.

1. **Get approved access.** Use a hotel availability API you are licensed to use, such as a chain or channel-manager API, a bedbank, or an affiliate API. Screen-scraping hotel websites is not supported. Check the provider’s terms for display, caching and deep-linking rights.
2. **Map hotel and room codes.** Add the provider’s codes to `externalIds` in `src/lib/catalogue.ts`, keyed by `HOTEL_API_PROVIDER_ID`. Hotels without a code show as outside coverage.
3. **Adapt the request and response.** `http-template.ts` assumes `POST {base}/v1/stays/quote` with `{ hotelCode, checkIn, checkOut, adults, children, rooms, currency }` and returns full-stay totals. Edit `buildRequest` and `mapResponse` to match the real schema. Set `taxesComplete: false` whenever the provider cannot confirm that taxes and mandatory fees are included.
4. **Configure** in `.env.local` (see `.env.example`):

| Variable | Meaning | Default |
| --- | --- | --- |
| `PRICE_PROVIDER` | `demo` or `http` | `demo` |
| `HOTEL_API_BASE_URL`, `HOTEL_API_KEY` | Endpoint and credential (server-only; never prefix with `NEXT_PUBLIC_`) | — |
| `HOTEL_API_PROVIDER_ID`, `HOTEL_API_PROVIDER_NAME` | Key for `externalIds` and the booking-source label | `http` |
| `HOTEL_API_BOOKING_HORIZON_DAYS` | Furthest checkout date the provider can quote. Later dates show as outside coverage. | 330 |
| `HOTEL_API_MAX_NIGHTS` | Longest stay the provider quotes | 14 |
| `HOTEL_API_REQUESTS_PER_MINUTE` | Your contractual request limit (token bucket) | 60 |
| `HOTEL_API_MAX_QUOTES_PER_SEARCH`, `HOTEL_API_CONCURRENCY` | Per-search quote budget and parallelism. Unfetched dates show as “not checked yet”. | 120, 4 |
| `HOTEL_API_CACHE_TTL_SECONDS` | How long the provider’s terms let you cache a quote. Use `0` if caching is not allowed. | 900 |
| `HOTEL_API_TIMEOUT_MS` | Per-request timeout | 8000 |

5. **Refresh before booking.** “Check price & book” calls `/api/quotes/refresh`, which re-prices that exact stay with the provider (uncached) before showing the booking link. If the price changes or no longer fits the budget, the user sees that first. Providers without re-pricing return `refreshed: false`, and the UI says the price is the last-checked one.

A 365-day calendar for many hotels needs thousands of quotes per stay length. Most providers will need a background job that warms the cache within the allowed TTL. Without one, the coverage counters show users exactly how much was checked.

## Notes

Hotel names are used for illustration with synthetic prices. The app is not affiliated with any hotel group.

Built by Shivankar.
