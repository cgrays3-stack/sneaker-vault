"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EnrichResponse = {
  success: boolean;
  updatedFields?: string[];
  imageUsed?: string | null;
  photoTypeUsed?: string | null;
  parsed?: {
    brand?: string | null;
    model?: string | null;
    official_product_name?: string | null;
    common_nickname?: string | null;
    colorway?: string | null;
    sku?: string | null;
    size?: string | null;
  };
  error?: string;
};

type EnrichShoeButtonProps = {
  sneakerId: string;
};

export function EnrichShoeButton({ sneakerId }: EnrichShoeButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEnrich() {
    try {
      setIsLoading(true);
      setMessage(null);

      const res = await fetch(`/api/sneakers/${sneakerId}/enrich`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await res.json()) as EnrichResponse;

      if (!res.ok || !data.success) {
        setMessage(data.error ?? "Failed to enrich shoe.");
        return;
      }

      if (data.updatedFields && data.updatedFields.length > 0) {
        setMessage(
          `Updated: ${data.updatedFields.join(", ")} (used ${data.photoTypeUsed ?? "unknown photo type"})`
        );
      } else {
        const parsedSummary = [
          data.parsed?.brand,
          data.parsed?.model,
          data.parsed?.sku,
          data.parsed?.size,
        ]
          .filter(Boolean)
          .join(" | ");

        setMessage(
          `No fields updated. Used ${data.photoTypeUsed ?? "unknown"} photo.` +
            (parsedSummary ? ` Parsed: ${parsedSummary}` : " Parsed nothing useful.")
        );
      }

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
        onClick={handleEnrich}
        disabled={isLoading}
        className="rounded-full bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isLoading ? "Enriching..." : "Enrich shoe"}
      </button>

      {message ? <p className="mt-2 text-sm text-gray-600">{message}</p> : null}
    </div>
  );
}