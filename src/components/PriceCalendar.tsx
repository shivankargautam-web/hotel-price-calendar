"use client";

import { addDays, formatDate, formatMonth, monthKey, weekday } from "@/lib/dates";
import { formatINR, formatINRCompact } from "@/lib/money";
import type { BudgetMode, CalendarCell as Cell, CellStatus } from "@/lib/types";

const STATUS_TEXT: Record<CellStatus, string> = {
  within: "Within budget",
  over: "Over budget",
  unconfirmed: "Price unconfirmed — taxes or fees incomplete",
  unavailable: "Unavailable",
  unchecked: "Not checked yet",
  outside_coverage: "Outside provider coverage",
};

const PRICED: CellStatus[] = ["within", "over", "unconfirmed"];

/** Only dates with an actual quote carry a price; anything else must never read as ₹0. */
export function pricedBest(cell: Cell) {
  return cell.best && cell.best.total > 0 && PRICED.includes(cell.status) ? cell.best : undefined;
}

export function cellLabel(cell: Cell, budgetMode: BudgetMode): string {
  const date = formatDate(cell.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const parts = [`Check in ${date}`, STATUS_TEXT[cell.status]];
  const best = pricedBest(cell);
  if (best) {
    parts.push(
      budgetMode === "total" ? `${formatINR(best.total)} total` : `${formatINR(best.nightlyAverage)} per room per night`,
      `${best.hotelName}, ${best.roomName}`,
    );
  }
  if (cell.hotelsTotal > 1) parts.push(`${cell.hotelsChecked} of ${cell.hotelsTotal} hotels checked`);
  return parts.join(". ");
}

export function CalendarCell({
  cell,
  budgetMode,
  selected,
  onSelect,
}: {
  cell: Cell;
  budgetMode: BudgetMode;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const day = Number(cell.date.slice(8));
  let body: React.ReactNode;
  const best = pricedBest(cell);
  if (best) {
    const amount = budgetMode === "total" ? best.total : best.nightlyAverage;
    body = (
      <span className="cell-price">
        {formatINRCompact(amount)}
        {cell.status === "unconfirmed" && <span className="cell-flag" aria-hidden>!</span>}
      </span>
    );
  } else {
    const short: Record<string, string> = { unavailable: "Sold out", unchecked: "—", outside_coverage: "" };
    body = <span className="cell-note">{short[cell.status]}</span>;
  }
  const label = cellLabel(cell, budgetMode);
  return (
    <button
      type="button"
      className={`cal-cell status-${cell.status}${selected ? " is-selected" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      data-status={cell.status}
      data-date={cell.date}
      onClick={() => onSelect(cell.date)}
    >
      <span className="cell-day">{day}</span>
      {body}
      {cell.matches > 1 && <span className="cell-matches" aria-hidden>{cell.matches}</span>}
    </button>
  );
}

export function Legend() {
  const items: [CellStatus, string][] = [
    ["within", "Within budget"],
    ["over", "Over budget"],
    ["unconfirmed", "Taxes/fees incomplete"],
    ["unavailable", "Sold out / closed"],
    ["unchecked", "Not checked yet"],
    ["outside_coverage", "Outside coverage"],
  ];
  return (
    <ul className="legend" aria-label="Calendar legend">
      {items.map(([status, text]) => (
        <li key={status}>
          <span className={`legend-swatch status-${status}`} aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PriceCalendar({
  cells,
  budgetMode,
  selectedDate,
  onSelect,
}: {
  cells: Cell[];
  budgetMode: BudgetMode;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const months = new Map<string, Cell[]>();
  for (const cell of cells) {
    const key = monthKey(cell.date);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(cell);
  }

  return (
    <div className="calendar" role="region" aria-label="Rolling 12-month price calendar">
      {[...months.entries()].map(([month, monthCells]) => {
        const first = monthCells[0].date;
        const firstOfMonth = `${month}-01`;
        const leading = weekday(firstOfMonth);
        const blanksBefore = leading + (Number(first.slice(8)) - 1);
        return (
          <section key={month} className="month" id={`month-${month}`} aria-label={formatMonth(month)}>
            <h3 className="month-title">{formatMonth(month)}</h3>
            <div className="month-grid">
              {WEEKDAYS.map((d) => (
                <span key={d} className="weekday" aria-hidden>
                  {d.slice(0, 2)}
                </span>
              ))}
              {Array.from({ length: blanksBefore }, (_, i) => {
                const date = addDays(firstOfMonth, i - leading);
                return <span key={`b${i}`} className={`cal-blank${i >= leading ? " is-past" : ""}`} aria-hidden>{i >= leading ? Number(date.slice(8)) : ""}</span>;
              })}
              {monthCells.map((cell) => (
                <CalendarCell key={cell.date} cell={cell} budgetMode={budgetMode} selected={cell.date === selectedDate} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
