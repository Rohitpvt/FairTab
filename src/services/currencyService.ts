/**
 * Real-time Exchange Rate Service with caching and reliable fallback rates.
 * Uses the free open exchange-rate API (https://open.er-api.com/v6/latest/USD)
 * with localStorage caching (1-hour TTL) for fast, offline-friendly lookups.
 */

export interface ExchangeRatesData {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

const CACHE_KEY = "fairtab:fx_rates_cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Fallback rates if user is totally offline on their very first request
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 86.85,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 154.2,
  CAD: 1.38,
  AUD: 1.53,
  SGD: 1.35,
};

let inMemoryRates: ExchangeRatesData = {
  base: "USD",
  rates: FALLBACK_RATES,
  timestamp: Date.now(),
};

// Try loading from localStorage immediately
try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as ExchangeRatesData;
    if (parsed && parsed.rates) {
      inMemoryRates = parsed;
    }
  }
} catch {
  // ignore storage errors
}

export const fetchLiveExchangeRates = async (): Promise<ExchangeRatesData> => {
  // Check if current cache is fresh
  if (Date.now() - inMemoryRates.timestamp < CACHE_TTL_MS && Object.keys(inMemoryRates.rates).length > 5) {
    return inMemoryRates;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (data && data.rates) {
      const freshData: ExchangeRatesData = {
        base: "USD",
        rates: { ...FALLBACK_RATES, ...data.rates },
        timestamp: Date.now(),
      };
      inMemoryRates = freshData;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      } catch {
        // ignore
      }
      return freshData;
    }
  } catch (error) {
    console.warn("Failed to fetch live FX rates, using cached/fallback rates:", error);
  }

  return inMemoryRates;
};

export const convertCurrencyAmount = (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = inMemoryRates.rates
): number => {
  if (fromCurrency === toCurrency || amount <= 0) return amount;

  const fromRate = rates[fromCurrency.toUpperCase()] || 1.0;
  const toRate = rates[toCurrency.toUpperCase()] || 1.0;

  // Convert from currency -> USD -> to currency
  const amountInUsd = amount / fromRate;
  const converted = amountInUsd * toRate;

  return Number(converted.toFixed(2));
};
