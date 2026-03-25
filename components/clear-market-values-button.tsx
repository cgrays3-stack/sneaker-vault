"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClearMarketValuesButtonProps = {
  sneakerId: string;
};

type ClearResponse = {
  success: boolean;
  error?: string;
};

export function ClearMarketValuesButton({
  sneakerId,
}: ClearMarketValuesButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClear() {
    try {
      setIsLoading(true);
      setMessage(null);

      const res = await fetch(`/api/sneakers/${sneakerId}/clear-market`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await res.json()) as ClearResponse;

      if (!res.ok || !data.success) {
        setMessage(data.error ?? "Failed to clear market values.");
        return;
      }

      setMessage("Market values cleared.");
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClear}
        disabled={isLoading}
        className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Clearing..." : "Clear market values"}
      </button>

      {message ? (
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      ) : null}
    </div>
  );
}