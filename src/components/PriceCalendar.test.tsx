// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarCell as Cell, CellStatus } from "@/lib/types";
import { CalendarCell } from "./PriceCalendar";

const cell = (status: CellStatus, best?: Cell["best"]): Cell => ({
  date: "2027-03-10",
  checkOut: "2027-03-12",
  status,
  best,
  matches: 0,
  hotelsChecked: 1,
  hotelsTotal: 1,
});

const zeroBest = { hotelId: "x", hotelName: "Taj Bengal", roomName: "Superior Room", total: 0, nightlyAverage: 0, taxesComplete: true };

describe("CalendarCell", () => {
  it.each(["unavailable", "unchecked", "outside_coverage"] as const)("never shows a rupee amount for %s dates", (status) => {
    render(<CalendarCell cell={cell(status, zeroBest)} budgetMode="perNight" selected={false} onSelect={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button.textContent).not.toMatch(/₹/);
    expect(button.getAttribute("aria-label")).not.toMatch(/₹/);
    expect(button.dataset.status).toBe(status);
  });

  it("labels sold-out dates as sold out", () => {
    render(<CalendarCell cell={cell("unavailable")} budgetMode="perNight" selected={false} onSelect={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toContain("Sold out");
  });

  it("shows the nightly average or the stay total for priced dates", () => {
    const best = { ...zeroBest, total: 19_800, nightlyAverage: 9_900 };
    const { rerender } = render(<CalendarCell cell={cell("within", best)} budgetMode="perNight" selected={false} onSelect={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toContain("₹9.9k");
    rerender(<CalendarCell cell={cell("within", best)} budgetMode="total" selected={false} onSelect={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toContain("₹19.8k");
  });
});
