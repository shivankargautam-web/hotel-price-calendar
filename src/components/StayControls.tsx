"use client";

import { useState } from "react";
import { convertBudget, stayBudgetLimit } from "@/lib/budget";
import { getHotel, resolveTarget } from "@/lib/catalogue";
import { formatINR } from "@/lib/money";
import { MAX_ADULTS_PER_ROOM, MAX_BUDGET, MAX_CHILDREN_PER_ROOM, MAX_NIGHTS, MAX_ROOMS } from "@/lib/query";
import type { SearchQuery } from "@/lib/types";

interface Props {
  query: SearchQuery;
  onChange: (patch: Partial<SearchQuery>) => void;
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper-label">{label}</span>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export function StayControls({ query, onChange }: Props) {
  const [budgetText, setBudgetText] = useState(String(query.budget));
  const [syncedBudget, setSyncedBudget] = useState(query.budget);
  if (syncedBudget !== query.budget) {
    setSyncedBudget(query.budget);
    setBudgetText(String(query.budget));
  }

  const target = resolveTarget(query.target);
  const hotel = target?.kind === "hotel" ? getHotel(target.hotelIds[0]) : undefined;
  const limit = stayBudgetLimit({ mode: query.budgetMode, amount: query.budget }, query.nights, query.rooms);

  const setBudgetMode = (mode: SearchQuery["budgetMode"]) => {
    const next = convertBudget({ mode: query.budgetMode, amount: query.budget }, mode, query.nights, query.rooms);
    onChange({ budgetMode: next.mode, budget: Math.max(1, next.amount) });
  };

  const setRooms = (rooms: number) => {
    onChange({
      rooms,
      adults: Math.min(Math.max(query.adults, rooms), rooms * MAX_ADULTS_PER_ROOM),
      children: Math.min(query.children, rooms * MAX_CHILDREN_PER_ROOM),
    });
  };

  return (
    <div className="controls">
      <div className="control budget-control">
        <span className="field-label" id="budget-label">
          Budget
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="budget-label">
          <button type="button" role="radio" aria-checked={query.budgetMode === "perNight"} onClick={() => setBudgetMode("perNight")}>
            Per room / night
          </button>
          <button type="button" role="radio" aria-checked={query.budgetMode === "total"} onClick={() => setBudgetMode("total")}>
            Total stay
          </button>
        </div>
        <div className="money-input">
          <span aria-hidden>₹</span>
          <input
            aria-label={query.budgetMode === "perNight" ? "Budget per room per night in rupees" : "Total stay budget in rupees"}
            inputMode="numeric"
            value={budgetText}
            onChange={(e) => {
              const text = e.target.value.replace(/[^\d]/g, "");
              setBudgetText(text);
              const n = Number(text);
              if (text && n >= 1 && n <= MAX_BUDGET) onChange({ budget: n });
            }}
            onBlur={() => setBudgetText(String(query.budget))}
          />
        </div>
        <p className="field-hint">
          {query.budgetMode === "perNight" ? (
            <>
              Stay limit <strong>{formatINR(limit)}</strong> ({query.nights} night{query.nights > 1 ? "s" : ""} × {query.rooms} room
              {query.rooms > 1 ? "s" : ""}), incl. taxes & mandatory fees
            </>
          ) : (
            <>Whole stay, incl. taxes & mandatory fees</>
          )}
        </p>
      </div>

      <div className="control">
        <label className="field-label" htmlFor="nights">
          Nights
        </label>
        <select id="nights" value={query.nights} onChange={(e) => onChange({ nights: Number(e.target.value) })}>
          {Array.from({ length: MAX_NIGHTS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} night{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <p className="field-hint">Each calendar day is a check-in for this stay length</p>
      </div>

      <div className="control guests-control">
        <span className="field-label">Guests & rooms</span>
        <Stepper label="Adults" value={query.adults} min={query.rooms} max={query.rooms * MAX_ADULTS_PER_ROOM} onChange={(adults) => onChange({ adults })} />
        <Stepper label="Children" value={query.children} min={0} max={query.rooms * MAX_CHILDREN_PER_ROOM} onChange={(children) => onChange({ children })} />
        <Stepper label="Rooms" value={query.rooms} min={1} max={MAX_ROOMS} onChange={setRooms} />
      </div>

      <div className="control">
        <label className="field-label" htmlFor="room-type">
          Calendar tracks
        </label>
        <select
          id="room-type"
          value={query.roomType ?? "cheapest"}
          onChange={(e) => onChange({ roomType: e.target.value === "cheapest" ? null : e.target.value })}
        >
          <option value="cheapest">Cheapest available room</option>
          {hotel?.roomTypes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <p className="field-hint">{hotel ? "Pick a room type to track only that room" : "Choose a single hotel to track a specific room type"}</p>
        <label className="checkbox">
          <input type="checkbox" checked={query.refundableOnly} onChange={(e) => onChange({ refundableOnly: e.target.checked })} />
          Free cancellation only
        </label>
      </div>
    </div>
  );
}
