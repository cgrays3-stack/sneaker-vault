"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RefreshMarketResponse = {
  success: boolean;
  processed?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  error?: string;
};

export default function RefreshMarketButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRefreshMarket() {
    try {
      setIsLoading(true);
      setMessage(null);

      const res = await fetch("/api/sneakers/refresh-market", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await res.json()) as RefreshMarketResponse;

      if (!res.ok || !data.success) {
        setMessage(data.error ?? "Failed to refresh market values.");
        return;
      }

      setMessage(
        `Updated ${data.updated ?? 0} shoes. Skipped ${data.skipped ?? 0}. Failed ${data.failed ?? 0}.`
      );

      router.refresh();
    } catch {
      setMessage("Something went wrong while refreshing market values.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleRefreshMarket}
        disabled={isLoading}
        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Refreshing market..." : "Refresh all market values"}
      </button>

      {message ? (
        <p className="mt-2 text-sm text-neutral-600">{message}</p>
      ) : null}
    </div>
  );
}