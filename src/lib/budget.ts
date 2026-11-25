import type { BudgetMode, BudgetVerdict } from "./types";

export interface Budget {
  mode: BudgetMode;
  /** Whole rupees, including taxes and mandatory fees. */
  amount: number;
}

/**
 * Maximum payable amount for the whole stay.
 * Per-night budgets apply per room per night: ₹10,000 × 2 nights × 1 room = ₹20,000.
 */
export function stayBudgetLimit(budget: Budget, nights: number, rooms: number): number {
  return budget.mode === "perNight" ? budget.amount * nights * rooms : budget.amount;
}

/**
 * Compares a full-stay quote with the budget. The total must come from a single
 * quote for the entire stay; never pass a sum of separate one-night quotes.
 * Quotes with incomplete taxes or fees can never be a confirmed match.
 */
export function evaluateBudget(total: number, taxesComplete: boolean, limit: number): BudgetVerdict {
  if (!taxesComplete) return "unconfirmed";
  return total <= limit ? "within" : "over";
}

/** Average per room per night, rounded to the nearest rupee. */
export function nightlyAverage(total: number, nights: number, rooms: number): number {
  return Math.round(total / (nights * rooms));
}

export function convertBudget(budget: Budget, to: BudgetMode, nights: number, rooms: number): Budget {
  if (budget.mode === to) return budget;
  if (to === "total") return { mode: to, amount: budget.amount * nights * rooms };
  return { mode: to, amount: Math.round(budget.amount / (nights * rooms)) };
}
