import "server-only";
import { DemoPriceProvider } from "./demo";
import { HttpAvailabilityProvider } from "./http-template";
import type { PriceProvider } from "./types";

let provider: PriceProvider | undefined;

/** Selects the pricing source from PRICE_PROVIDER ("demo" by default, or "http"). */
export function getPriceProvider(): PriceProvider {
  if (!provider) {
    provider = process.env.PRICE_PROVIDER === "http" ? HttpAvailabilityProvider.fromEnv() : new DemoPriceProvider();
  }
  return provider;
}
