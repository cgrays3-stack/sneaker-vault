"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SneakerCard from "@/components/sneaker-card";

type Sneaker = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  size: string | null;
  image_url?: string | null;
};

type CollectionClientProps = {
  initialSneakers: Sneaker[];
};

type DeleteResponse = {
  success: boolean;
  error?: string;
};

export default function CollectionClient({
  initialSneakers,
}: CollectionClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteSneaker(sneakerId: string) {
    const confirmed = window.confirm(
      "Delete this sneaker and its photos/wear logs? This cannot be undone."
    );

    if (!confirmed) return;

    setError(null);
    setDeletingId(sneakerId);

    try {
      const response = await fetch(`/api/sneakers/${sneakerId}`, {
        method: "DELETE",
      });

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      if (!isJson) {
        const text = await response.text();
        console.error("Delete sneaker route returned non-JSON:", text);
        throw new Error("Delete route returned HTML instead of JSON");
      }

      const json = (await response.json()) as DeleteResponse;

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to delete sneaker");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to delete sneaker."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialSneakers.map((sneaker) => (
          <SneakerCard
            key={sneaker.id}
            sneaker={sneaker}
            onDelete={handleDeleteSneaker}
            isDeleting={deletingId === sneaker.id || isPending}
          />
        ))}
      </div>
    </div>
  );
}