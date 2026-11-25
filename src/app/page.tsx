import { Suspense } from "react";
import { DemoBanner, LuxuryWithinBudget } from "@/components/LuxuryWithinBudget";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <DemoBanner />
          <p className="loading">Loading the price calendar…</p>
        </div>
      }
    >
      <LuxuryWithinBudget />
    </Suspense>
  );
}
