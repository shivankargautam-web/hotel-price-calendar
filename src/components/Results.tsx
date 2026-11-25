"use client";

import { useState } from "react";
import { evaluateBudget } from "@/lib/budget";
import { formatDate, formatMonth, formatRelative } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { MAX_RESULTS, RESULTS_PAGE_SIZE } from "@/lib/query";
import type { RankedStay, SearchQuery, SearchResponse } from "@/lib/types";
import { refreshQuote, type RefreshResult } from "./api";

type BookingState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; result: RefreshResult }
  | { kind: "error"; message: string };

function Verdict({ stay }: { stay: RankedStay }) {
  if (stay.verdict === "within") return <span className="badge badge-within">Within budget</span>;
  if (stay.verdict === "unconfirmed") return <span className="badge badge-unconfirmed">Unconfirmed — taxes/fees incomplete</span>;
  const pct = Math.round((stay.overBudgetBy / stay.budgetLimit) * 1000) / 10;
  return (
    <span className="badge badge-over">
      {formatINR(stay.overBudgetBy)} over budget ({pct}%)
    </span>
  );
}

function BookingAction({ stay, query, isDemo }: { stay: RankedStay; query: SearchQuery; isDemo: boolean }) {
  const [state, setState] = useState<BookingState>({ kind: "idle" });

  const check = async () => {
    setState({ kind: "checking" });
    try {
      const result = await refreshQuote({
        hotelId: stay.hotelId,
        roomTypeId: stay.roomTypeId,
        ratePlan: stay.ratePlan,
        checkIn: stay.checkIn,
        nights: stay.nights,
        adults: query.adults,
        children: query.children,
        rooms: query.rooms,
      });
      setState({ kind: "done", result });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Could not refresh the price" });
    }
  };

  if (state.kind === "idle" || state.kind === "checking") {
    return (
      <button type="button" className="button" onClick={check} disabled={state.kind === "checking"}>
        {state.kind === "checking" ? "Checking price…" : "Check price & book"}
      </button>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="booking-status booking-warn" role="status">
        {state.message}.{" "}
        <button type="button" className="link-button" onClick={check}>
          Try again
        </button>
      </div>
    );
  }
  const { result } = state;
  if (!result.refreshed) {
    return (
      <div className="booking-status" role="status">
        This source cannot re-price on demand. Price last checked {formatRelative(stay.checkedAt)}.{" "}
        <a href={stay.source.bookingUrl} target="_blank" rel="noopener noreferrer" className="button button-small">
          Continue to booking ↗
        </a>
      </div>
    );
  }
  if (result.status !== "available") {
    return (
      <div className="booking-status booking-warn" role="status">
        No longer available{"reason" in result && result.reason ? `: ${result.reason}` : ""}.
      </div>
    );
  }
  const fresh = result.offer;
  const changed = fresh.price.total !== stay.price.total;
  const verdict = evaluateBudget(fresh.price.total, fresh.price.taxesComplete, stay.budgetLimit);
  return (
    <div className={`booking-status${changed ? " booking-warn" : " booking-ok"}`} role="status">
      {changed ? (
        <>
          Price changed from {formatINR(stay.price.total)} to <strong>{formatINR(fresh.price.total)}</strong>
          {verdict === "within" ? " — still within budget." : verdict === "over" ? " — now over budget." : " — taxes unconfirmed."}
        </>
      ) : (
        <>
          Price confirmed {formatRelative(fresh.checkedAt)}: <strong>{formatINR(fresh.price.total)}</strong>.
        </>
      )}{" "}
      <a href={fresh.source.bookingUrl} target="_blank" rel="noopener noreferrer" className="button button-small">
        Continue to {isDemo ? "hotel website" : "booking"} ↗
      </a>
      {isDemo && <span className="booking-demo">Demo: sample prices won’t match the hotel’s site.</span>}
    </div>
  );
}

function StayRow({ stay, rank, query, isDemo }: { stay: RankedStay; rank?: number; query: SearchQuery; isDemo: boolean }) {
  const [open, setOpen] = useState(false);
  const p = stay.price;
  return (
    <li className={`stay verdict-${stay.verdict}`} data-testid="stay">
      {rank !== undefined && <span className="stay-rank">{rank}</span>}
      <div className="stay-main">
        <div className="stay-head">
          <h4>{stay.hotelName}</h4>
          <span className="stay-city">{stay.city}</span>
          <Verdict stay={stay} />
        </div>
        <p className="stay-dates">
          <span data-testid="stay-dates">
            {formatDate(stay.checkIn, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} →{" "}
            {formatDate(stay.checkOut, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          <span className="muted">
            {" "}
            · {stay.nights} night{stay.nights > 1 ? "s" : ""}
          </span>
        </p>
        <dl className="stay-facts">
          <div>
            <dt>Room</dt>
            <dd>
              {stay.roomName}
              {stay.ratePlan === "advance" ? " · advance purchase" : ""}
            </dd>
          </div>
          <div>
            <dt>Cancellation</dt>
            <dd className={stay.cancellation.refundable ? "text-good" : undefined}>{stay.cancellation.summary}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{stay.source.name}</dd>
          </div>
          <div>
            <dt>Price checked</dt>
            <dd>
              <time dateTime={stay.checkedAt} title={new Date(stay.checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}>
                {formatRelative(stay.checkedAt)}
              </time>
            </dd>
          </div>
        </dl>
        <button type="button" className="link-button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide price breakdown" : "Price breakdown"}
        </button>
        {open && (
          <div className="breakdown">
            <dl>
              <div>
                <dt>Room charges ({stay.nights} night{stay.nights > 1 ? "s" : ""} × {query.rooms} room{query.rooms > 1 ? "s" : ""})</dt>
                <dd>{formatINR(p.base)}</dd>
              </div>
              <div>
                <dt>Taxes</dt>
                <dd>{p.taxesComplete ? formatINR(p.taxes) : "Not confirmed"}</dd>
              </div>
              <div>
                <dt>Mandatory fees</dt>
                <dd>{formatINR(p.mandatoryFees)}</dd>
              </div>
              <div className="breakdown-total">
                <dt>Total payable</dt>
                <dd>{formatINR(p.total)}</dd>
              </div>
              <div>
                <dt>Your budget for this stay</dt>
                <dd>{formatINR(stay.budgetLimit)}</dd>
              </div>
            </dl>
            <ul>
              {p.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>One quote for the full stay — not a sum of one-night prices.</li>
            </ul>
          </div>
        )}
      </div>
      <div className="stay-price">
        <span className="stay-total" data-testid="stay-total">
          {formatINR(p.total)}
        </span>
        <span className="muted">total{p.taxesComplete ? " incl. taxes & fees" : " — taxes unconfirmed"}</span>
        <span className="stay-nightly">
          {formatINR(stay.nightlyAverage)} <span className="muted">avg / room / night</span>
        </span>
        {isDemo && <span className="demo-chip">Demo price</span>}
        <BookingAction key={`${stay.key}:${stay.price.total}`} stay={stay} query={query} isDemo={isDemo} />
      </div>
    </li>
  );
}

export function Results({
  data,
  onChange,
}: {
  data: SearchResponse;
  onChange: (patch: Partial<SearchQuery>) => void;
}) {
  const { results, query } = data;
  const isDemo = data.provider.isDemo;
  const monthOptions = data.stats.months.map((m) => m.month);

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results-head">
        <div>
          {results.kind === "matches" && (
            <>
              <h2 id="results-title">
                {results.total.toLocaleString("en-IN")} stay{results.total === 1 ? "" : "s"} within budget
              </h2>
              <p className="muted">
                {query.sort === "total" ? "Ranked by total payable price, lowest first" : "Sorted by check-in date"}
                {query.month ? ` · ${formatMonth(query.month)}` : ""}
              </p>
            </>
          )}
          {results.kind === "closest" && (
            <>
              <h2 id="results-title">Nothing fits your budget{query.month ? ` in ${formatMonth(query.month)}` : ""}</h2>
              <p className="muted">Closest options, ranked by how far they are over your {formatINR(data.budget.perStayLimit)} stay budget</p>
            </>
          )}
          {results.kind === "date" && query.date && (
            <>
              <h2 id="results-title">
                Checking in {formatDate(query.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </h2>
              <p className="muted">
                Every tracked stay on this date ({results.total}), cheapest first.{" "}
                <button type="button" className="link-button" onClick={() => onChange({ date: null })}>
                  Back to all dates
                </button>
              </p>
            </>
          )}
        </div>
        {results.kind !== "date" && (
          <div className="results-filters">
            <label>
              <span className="field-label">Month</span>
              <select value={query.month ?? ""} onChange={(e) => onChange({ month: e.target.value || null })}>
                <option value="">All 12 months</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Sort</span>
              <select value={query.sort} onChange={(e) => onChange({ sort: e.target.value as SearchQuery["sort"] })} disabled={results.kind === "closest"}>
                <option value="total">Total price</option>
                <option value="date">Check-in date</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {results.items.length === 0 ? (
        <p className="empty">
          {results.kind === "date" ? "No available, checked stays for this date." : "No available prices match these filters. Try another month or hotel."}
        </p>
      ) : (
        <ol className="stay-list" aria-label="Ranked stays">
          {results.items.map((stay, i) => (
            <StayRow key={stay.key} stay={stay} rank={results.kind === "matches" && query.sort === "total" ? i + 1 : undefined} query={query} isDemo={isDemo} />
          ))}
        </ol>
      )}
      {results.kind !== "closest" && results.total > results.items.length && (
        <button type="button" className="button button-ghost show-more" onClick={() => onChange({ limit: Math.min(query.limit + RESULTS_PAGE_SIZE, MAX_RESULTS) })}>
          Show more ({results.total - results.items.length} remaining)
        </button>
      )}
    </section>
  );
}
