"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_QUERY, parseQuery, serializeQuery } from "@/lib/query";
import type { SearchQuery, SearchResponse } from "@/lib/types";
import { fetchSearch } from "./api";
import { Legend, PriceCalendar } from "./PriceCalendar";
import { Results } from "./Results";
import { SearchBox } from "./SearchBox";
import { StayControls } from "./StayControls";
import { Summary } from "./Summary";

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <strong>Demo prices — sample data</strong>
      <span>Every rate below is synthetic. Connect an approved hotel availability API to see live prices.</span>
    </div>
  );
}

export function LuxuryWithinBudget() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState<SearchQuery>(() => parseQuery(new URLSearchParams(searchParams.toString())).query);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetchSearch(query, controller.signal)
        .then((response) => {
          setData(response);
          setError(null);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : "Search failed");
          setLoading(false);
        });
      const qs = serializeQuery(query, true).toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const update = (patch: Partial<SearchQuery>) => {
    setQuery((q) => {
      const next = { ...q, ...patch };
      if (patch.target !== undefined && patch.target !== q.target) {
        next.roomType = null;
        next.date = null;
      }
      if (patch.limit === undefined) next.limit = DEFAULT_QUERY.limit;
      return next;
    });
  };

  const showDemo = data ? data.provider.isDemo : true;
  const fresh = data && !loading;

  return (
    <div className="page">
      {showDemo && <DemoBanner />}
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ◆
          </span>
          <span className="brand-name">Luxury Within Budget</span>
        </div>
        <p className="masthead-tag">Price calendar for India’s grand hotels</p>
      </header>

      <main>
        <section className="hero">
          <h1>
            Which dates fit my <em>budget</em>?
          </h1>
          <p className="hero-sub">
            Pick a Taj property, a city or every tracked hotel. We quote the full stay for each possible check-in over the next 12 months and show which dates come in at or under your budget — taxes and mandatory fees included.
          </p>
          <div className="search-panel">
            <SearchBox value={query.target} onChange={(target) => update({ target })} />
            <StayControls query={query} onChange={update} />
          </div>
        </section>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!data && !error && <p className="loading">Checking 365 check-in dates…</p>}

        {data && (
          <div className={`results-area${fresh ? "" : " is-loading"}`} aria-busy={!fresh}>
            {loading && (
              <div className="refreshing" role="status">
                Updating prices…
              </div>
            )}
            <Summary data={data} activeMonth={query.month} onMonth={(month) => update({ month, date: null })} />

            <section className="calendar-section" aria-labelledby="calendar-title">
              <div className="calendar-head">
                <div>
                  <h2 id="calendar-title">
                    {data.targetLabel}: {data.query.nights}-night stays
                  </h2>
                  <p className="muted">
                    Each day is a check-in date. Prices show the {data.budget.mode === "total" ? "total for the stay" : "average per room per night"} from one full-stay quote ·{" "}
                    {data.tracking.label} · {data.stats.coverage.datesChecked} of {data.stats.coverage.datesInRange} dates checked
                  </p>
                </div>
                <Legend />
              </div>
              <PriceCalendar
                cells={data.calendar}
                budgetMode={data.budget.mode}
                selectedDate={query.date}
                onSelect={(date) => update({ date: query.date === date ? null : date })}
              />
            </section>

            <Results data={data} onChange={update} />
          </div>
        )}
      </main>

      <footer className="footer">
        <div>
          <h3>How prices are checked</h3>
          <ul>
            <li>Every price is one quote for the whole stay and all rooms — never a sum of one-night prices.</li>
            <li>A stay fits when its total, including taxes and mandatory fees, is at or below your budget × nights × rooms (or your total-stay budget).</li>
            <li>Quotes with incomplete taxes or fees are flagged and never counted as matches.</li>
            <li>Unavailable, unchecked and out-of-coverage dates never show a price.</li>
          </ul>
        </div>
        <div>
          <h3>Source</h3>
          <p>
            {data ? data.provider.name : "Demo rate feed (sample data)"}
            {data ? ` · books up to ${data.provider.bookingHorizonDays} days ahead` : ""}
          </p>
          <p className="muted">Luxury Within Budget · by Shivankar. Hotel names are used for illustration; not affiliated with any hotel group.</p>
        </div>
      </footer>
    </div>
  );
}
