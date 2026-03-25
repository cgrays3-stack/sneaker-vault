"use client";

import { useEffect, useState } from "react";

type MarketEstimateResponse = {
  success: boolean;
  source: "ebay-browse-active";
  searchQuery: string | null;
  compCount: number;
  confidence: "low" | "medium" | "high";
  prices: {
    low: number | null;
    median: number | null;
    high: number | null;
  };
  sampleListings: Array<{
    itemId: string;
    title: string;
    price: number;
    currency: string;
    condition: string | null;
    itemWebUrl: string | null;
    imageUrl: string | null;
  }>;
  emptyReason?: string;
  error?: string;
};

type MarketInsightsProps = {
  sneakerId: string;
};

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function confidenceBadgeClasses(confidence: "low" | "medium" | "high"): string {
  switch (confidence) {
    case "high":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "medium":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
  }
}

export function MarketInsights({ sneakerId }: MarketInsightsProps) {
  const [data, setData] = useState<MarketEstimateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadMarket(forceRefresh = false) {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch(
        `/api/sneakers/${sneakerId}/market${forceRefresh ? `?t=${Date.now()}` : ""}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const json = (await response.json()) as MarketEstimateResponse;
      setData(json);
    } catch {
      setData({
        success: false,
        source: "ebay-browse-active",
        searchQuery: null,
        compCount: 0,
        confidence: "low",
        prices: { low: null, median: null, high: null },
        sampleListings: [],
        error: "Unable to load market estimate.",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadMarket();
  }, [sneakerId]);

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Market estimate</h2>
            <p className="text-sm text-zinc-500">Scanning active eBay listings…</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="rounded-2xl bg-zinc-50 p-4">
              <div className="mb-2 h-3 w-12 animate-pulse rounded bg-zinc-200" />
              <div className="h-7 w-16 animate-pulse rounded bg-zinc-200" />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {[0, 1].map((key) => (
            <div key={key} className="flex gap-3 rounded-2xl border border-zinc-100 p-3">
              <div className="h-16 w-16 animate-pulse rounded-xl bg-zinc-100" />
              <div className="min-w-0 flex-1">
                <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!data || !data.success) {
    return (
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-zinc-900">Market estimate</h2>
          <p className="text-sm text-zinc-500">Active listing pricing from eBay</p>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-700">{data?.error ?? "Unable to load market estimate."}</p>
        </div>
      </section>
    );
  }

  const isEmpty = data.compCount === 0;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Market estimate</h2>
          <p className="text-sm text-zinc-500">Active eBay listing prices, not sold comps</p>
        </div>

        <button
          type="button"
          onClick={() => void loadMarket(true)}
          disabled={isRefreshing}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${confidenceBadgeClasses(
            data.confidence,
          )}`}
        >
          {data.confidence} confidence
        </span>

        <span className="text-xs text-zinc-500">{data.compCount} comps</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-zinc-50 p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Low</div>
          <div className="text-xl font-semibold text-zinc-900">{formatPrice(data.prices.low)}</div>
        </div>

        <div className="rounded-2xl bg-zinc-50 p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Mid</div>
          <div className="text-xl font-semibold text-zinc-900">{formatPrice(data.prices.median)}</div>
        </div>

        <div className="rounded-2xl bg-zinc-50 p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">High</div>
          <div className="text-xl font-semibold text-zinc-900">{formatPrice(data.prices.high)}</div>
        </div>
      </div>

      {isEmpty ? (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm text-zinc-700">{data.emptyReason ?? "No relevant listings found."}</p>
          {data.searchQuery ? (
            <p className="mt-1 break-words text-xs text-zinc-500">Search used: {data.searchQuery}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-xs text-zinc-500">
              Search used: <span className="break-words">{data.searchQuery}</span>
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {data.sampleListings.map((listing) => (
              <a
                key={listing.itemId}
                href={listing.itemWebUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex gap-3 rounded-2xl border border-zinc-100 p-3 transition hover:bg-zinc-50"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                  {listing.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.imageUrl}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-zinc-900">{listing.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span className="font-semibold text-zinc-900">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: listing.currency || "USD",
                        maximumFractionDigits: 0,
                      }).format(listing.price)}
                    </span>
                    {listing.condition ? <span>{listing.condition}</span> : null}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}