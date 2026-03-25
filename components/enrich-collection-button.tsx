"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EnrichAllResponse = {
  success: boolean;
  processed?: number;
  updated?: number;
  error?: string;
};

export default function EnrichCollectionButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEnrichCollection() {
    try {
      setIsLoading(true);
      setMessage(null);

      const res = await fetch("/api/sneakers/enrich-all", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await res.json()) as EnrichAllResponse;

      if (!res.ok || !data.success) {
        setMessage(data.error ?? "Failed to enrich collection.");
        return;
      }

      const processed = data.processed ?? 0;
      const updated = data.updated ?? 0;

      setMessage(`Enriched ${updated} of ${processed} shoes.`);
      router.refresh();
    } catch {
      setMessage("Something went wrong while enriching the collection.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleEnrichCollection}
        disabled={isLoading}
        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Enriching collection..." : "Enrich collection"}
      </button>

      {message ? (
        <p className="mt-2 text-sm text-neutral-600">{message}</p>
      ) : null}
    </div>
  );
}