// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/search/route";
import { LuxuryWithinBudget } from "./LuxuryWithinBudget";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const requested: URLSearchParams[] = [];

beforeEach(() => {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      requested.push(url.searchParams);
      return GET(new NextRequest(url));
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("LuxuryWithinBudget", () => {
  it("loads the default search and labels demo prices", async () => {
    render(<LuxuryWithinBudget />);
    expect(screen.getByText("Demo prices — sample data")).toBeTruthy();
    await screen.findByRole("heading", { name: /All Taj hotels: 2-night stays/ });
    expect(requested[0].get("nights")).toBe("2");
    expect(screen.getByText(/₹20,000 for the stay/)).toBeTruthy();
  });

  it("re-runs the search and refreshes results when nights change", async () => {
    render(<LuxuryWithinBudget />);
    await screen.findByRole("heading", { name: /2-night stays/ });
    const before = requested.length;

    fireEvent.change(screen.getByLabelText("Nights"), { target: { value: "3" } });

    await screen.findByRole("heading", { name: /All Taj hotels: 3-night stays/ });
    expect(requested.length).toBeGreaterThan(before);
    expect(requested.at(-1)!.get("nights")).toBe("3");
    expect(screen.getAllByText(/₹30,000 for the stay/).length).toBeGreaterThan(0);
    const list = screen.getByRole("list", { name: /ranked stays/i });
    for (const item of within(list).getAllByRole("listitem")) expect(item.textContent).toContain("3 nights");
  });

  it("never renders a ₹ amount on unavailable, unchecked or outside-coverage dates", async () => {
    render(<LuxuryWithinBudget />);
    await screen.findByRole("heading", { name: /2-night stays/ });
    const blank = document.querySelectorAll<HTMLElement>(
      '[data-status="unavailable"], [data-status="unchecked"], [data-status="outside_coverage"]',
    );
    expect(blank.length).toBeGreaterThan(0);
    for (const el of blank) {
      expect(el.textContent).not.toMatch(/₹/);
    }
  });
});

describe("search route", () => {
  it("rejects invalid nights", async () => {
    const res = await GET(new NextRequest("http://localhost/api/search?nights=0"));
    expect(res.status).toBe(400);
  });
});
