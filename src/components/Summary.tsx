"use client";

import { formatDate, formatMonth } from "@/lib/dates";
import { formatINR, formatINRCompact } from "@/lib/money";
import type { DatePrice, SearchResponse } from "@/lib/types";

function DateStat({ title, value, budgetMode, multiHotel }: { title: string; value?: DatePrice; budgetMode: "perNight" | "total"; multiHotel: boolean }) {
  return (
    <div className="stat">
      <span className="stat-title">{title}</span>
      {value ? (
        <>
          <span className="stat-value">{formatINR(budgetMode === "total" ? value.total : value.nightlyAverage)}</span>
          <span className="stat-sub">
            {budgetMode === "total" ? "total" : "per room / night"} · check in {formatDate(value.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          <span className="stat-sub">
            {value.hotelName}
            {multiHotel ? ` · ${value.hotelsChecked} hotel${value.hotelsChecked === 1 ? "" : "s"} checked that day` : ""}
          </span>
        </>
      ) : (
        <span className="stat-sub">No confirmed prices among the dates checked</span>
      )}
    </div>
  );
}

export function Summary({ data, onMonth, activeMonth }: { data: SearchResponse; onMonth: (month: string | null) => void; activeMonth: string | null }) {
  const { stats, budget, query } = data;
  const c = stats.coverage;
  const multiHotel = data.hotels.length > 1;
  const pct = Math.round((c.datesChecked / c.datesInRange) * 100);
  const stayPct = Math.round((c.staysChecked / c.staysTotal) * 100);
  const nightlyLimit = Math.round(budget.perStayLimit / (query.nights * query.rooms));
  const metric = (p: DatePrice) => (budget.mode === "total" ? p.total : p.nightlyAverage);
  const monthMax = Math.max(1, ...stats.months.map((m) => (m.cheapest ? metric(m.cheapest) : 0)));
  const limitForBars = budget.mode === "total" ? budget.perStayLimit : nightlyLimit;
  const scaleMax = Math.max(monthMax, limitForBars) * 1.08;

  return (
    <section className="summary" aria-label="Summary">
      <div className="answer">
        {stats.datesWithinBudget > 0 ? (
          <h2>
            <span className="answer-number">{stats.datesWithinBudget}</span> check-in date{stats.datesWithinBudget === 1 ? "" : "s"} fit your budget
          </h2>
        ) : (
          <h2>No checked dates fit your budget yet</h2>
        )}
        <p className="answer-sub">
          {stats.staysWithinBudget} confirmed stay{stats.staysWithinBudget === 1 ? "" : "s"} across {data.targetLabel.replace(/^All /, "all ")} ·{" "}
          {query.nights} night{query.nights > 1 ? "s" : ""}, {query.adults} adult{query.adults > 1 ? "s" : ""}
          {query.children ? `, ${query.children} child${query.children > 1 ? "ren" : ""}` : ""}, {query.rooms} room{query.rooms > 1 ? "s" : ""}
        </p>
        {stats.typicalNightly !== undefined && stats.cheapest && stats.mostExpensive && (
          <p className="answer-typical">
            Typically <strong>{formatINR(stats.typicalNightly)}</strong> per room per night for the cheapest tracked option, from {formatINR(stats.cheapest.nightlyAverage)} to{" "}
            {formatINR(stats.mostExpensive.nightlyAverage)}.
          </p>
        )}
        <p className="tracking">
          <span className="pill">Tracking: {data.tracking.label}</span>
          <span className="pill pill-quiet">Budget: {budget.description}</span>
        </p>
      </div>

      <div className="stats">
        <div className={`stat${stats.staysWithinBudget > 0 ? " stat-highlight" : ""}`}>
          <span className="stat-title">Stays within budget</span>
          <span className="stat-value">{stats.staysWithinBudget}</span>
          <span className="stat-sub">
            on {stats.datesWithinBudget} of {c.datesChecked} dates checked
          </span>
        </div>
        <DateStat title="Cheapest available date" value={stats.cheapest} budgetMode={budget.mode} multiHotel={multiHotel} />
        <DateStat title="Most expensive available date" value={stats.mostExpensive} budgetMode={budget.mode} multiHotel={multiHotel} />
        <div className="stat">
          <span className="stat-title">Coverage</span>
          <span className="stat-value">
            {c.datesChecked}
            <small> / {c.datesInRange} dates checked</small>
          </span>
          <div className="coverage-bar" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="stat-sub">
            {multiHotel
              ? `${c.staysChecked.toLocaleString("en-IN")} of ${c.staysTotal.toLocaleString("en-IN")} hotel-dates checked (${stayPct}%) · ${c.staysUnavailable.toLocaleString("en-IN")} sold out · ${c.staysUnchecked.toLocaleString("en-IN")} not checked · ${c.staysOutsideCoverage.toLocaleString("en-IN")} outside coverage`
              : `${c.datesUnavailable} sold out · ${c.datesUnchecked} not checked · ${c.datesOutsideCoverage} outside coverage`}
          </span>
          {c.incompleteQuotes > 0 && (
            <span className="stat-sub stat-warn">
              {c.incompleteQuotes} quote{c.incompleteQuotes === 1 ? "" : "s"} with incomplete taxes/fees excluded from matches
            </span>
          )}
        </div>
      </div>

      <div className="months" aria-label="Cheapest date in each month">
        <div className="months-head">
          <h3>Cheapest date each month</h3>
          {activeMonth && (
            <button type="button" className="link-button" onClick={() => onMonth(null)}>
              Show all months
            </button>
          )}
        </div>
        <ol className="month-bars">
          {stats.months.map((m) => {
            const value = m.cheapest ? metric(m.cheapest) : undefined;
            const within = value !== undefined && value <= limitForBars;
            return (
              <li key={m.month}>
                <button
                  type="button"
                  className={`month-bar${activeMonth === m.month ? " is-active" : ""}`}
                  aria-pressed={activeMonth === m.month}
                  aria-label={`${formatMonth(m.month)}: ${
                    m.cheapest ? `cheapest ${formatINR(value!)} on ${formatDate(m.cheapest.date)}` : "no confirmed prices"
                  }, ${m.datesWithinBudget} dates within budget`}
                  onClick={() => {
                    onMonth(activeMonth === m.month ? null : m.month);
                    document.getElementById(`month-${m.month}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }}
                >
                  <span className="bar-track">
                    <span className="bar-limit" style={{ bottom: `${(limitForBars / scaleMax) * 100}%` }} />
                    {value !== undefined && <span className={`bar-fill${within ? " is-within" : ""}`} style={{ height: `${(value / scaleMax) * 100}%` }} />}
                  </span>
                  <span className="bar-price">{value !== undefined ? formatINRCompact(value) : "—"}</span>
                  <span className="bar-date">{m.cheapest ? formatDate(m.cheapest.date, { day: "numeric", month: "short" }) : "n/a"}</span>
                  <span className="bar-month">{formatMonth(m.month, "short")}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="field-hint">Dashed line = your budget. Click a month to filter the ranked stays.</p>
      </div>
    </section>
  );
}
