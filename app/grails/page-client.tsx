"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Grail } from "@/lib/types";

type Props = {
  initialGrails: Grail[];
};

type RefreshResponse = {
  success?: boolean;
  error?: string;
  pricingWarning?: string | null;
  grail?: Grail;
};

type DeleteResponse = {
  success?: boolean;
  error?: string;
};

type ResolveImageResponse = {
  success?: boolean;
  error?: string;
  grail?: Grail;
};

export default function GrailsClient({ initialGrails }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [grails, setGrails] = useState<Grail[]>(initialGrails);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvingImageId, setResolvingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 🔥 CRITICAL FIX: sync with server data after router.refresh()
  useEffect(() => {
    setGrails(initialGrails);
  }, [initialGrails]);

  const sortedGrails = useMemo(() => {
    return [...grails].sort((a, b) => {
      const priorityA = a.priority ?? -Infinity;
      const priorityB = b.priority ?? -Infinity;

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      const dateA = a.sold_pricing_last_refreshed_at
        ? new Date(a.sold_pricing_last_refreshed_at).getTime()
        : 0;
      const dateB = b.sold_pricing_last_refreshed_at
        ? new Date(b.sold_pricing_last_refreshed_at).getTime()
        : 0;

      return dateB - dateA;
    });
  }, [grails]);

  function formatCurrency(value: number | null) {
    if (value == null) return "—";

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  async function handleRefresh(id: string) {
    try {
      setRefreshingId(id);
      setError(null);

      const response = await fetch(`/api/grails/${id}/refresh-market`, {
        method: "POST",
      });

      const data = (await response.json()) as RefreshResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh.");
      }

      if (data.grail) {
        setGrails((current) =>
          current.map((g) => (g.id === id ? data.grail! : g))
        );
      }

      if (data.pricingWarning) {
        setError(data.pricingWarning);
      }

      // 🔥 ensure full sync with server truth
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      setDeletingId(id);
      setError(null);

      const response = await fetch(`/api/grails/${id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as DeleteResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete grail.");
      }

      // 🔥 DO NOT rely on local state only
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete grail.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResolveImage(id: string) {
    try {
      setResolvingImageId(id);
      setError(null);

      const response = await fetch(`/api/grails/${id}/resolve-image`, {
        method: "POST",
      });

      const data = (await response.json()) as ResolveImageResponse;

      if (!response.ok || !data.success || !data.grail) {
        throw new Error(data.error || "Image search failed.");
      }

      setGrails((current) =>
        current.map((g) => (g.id === id ? data.grail! : g))
      );

      // 🔥 ensure sync
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image search failed.");
    } finally {
      setResolvingImageId(null);
    }
  }

  if (!sortedGrails.length) {
    return <p className="text-sm text-slate-500">No grails yet.</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {sortedGrails.map((grail) => {
        const title =
          grail.common_nickname ||
          grail.official_product_name ||
          grail.nickname;

        const wrongSize = grail.size !== "13";
        const isRefreshing = refreshingId === grail.id;
        const isDeleting = deletingId === grail.id;
        const isResolvingImage = resolvingImageId === grail.id;

        return (
          <div
            key={grail.id}
            className={`flex gap-4 rounded-3xl border p-4 ${
              wrongSize ? "border-red-300 bg-red-50" : "border-slate-200"
            }`}
          >
            <div className="h-24 w-24 overflow-hidden rounded-xl bg-slate-100">
              {grail.image_url ? (
                <img
                  src={grail.image_url}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No image
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold">{title}</h3>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRefresh(grail.id)}
                    disabled={isRefreshing}
                    className="disabled:opacity-50"
                  >
                    {isRefreshing ? "…" : "🔄"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveImage(grail.id)}
                    disabled={isResolvingImage}
                    className="disabled:opacity-50"
                  >
                    {isResolvingImage ? "…" : "🖼"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(grail.id)}
                    disabled={isDeleting || isPending}
                    className="disabled:opacity-50"
                  >
                    {isDeleting ? "…" : "❌"}
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-600">
                {[grail.brand, grail.model, grail.colorway]
                  .filter(Boolean)
                  .join(" • ")}
              </p>

              <p className="mt-2 text-sm">
                Used: {formatCurrency(grail.used_sold_price_mid)}
              </p>
              <p className="text-sm">
                New: {formatCurrency(grail.new_sold_price_mid)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}