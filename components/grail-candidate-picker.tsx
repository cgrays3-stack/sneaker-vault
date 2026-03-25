"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ExistingGrail = {
  id: string;
  sku: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  nickname: string;
};

type GrailSearchCandidate = {
  itemId: string;
  title: string;
  itemWebUrl: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  inferred: {
    brand: string | null;
    model: string | null;
    colorway: string | null;
    sku: string | null;
    officialProductName: string | null;
    commonNickname: string | null;
  };
};

type SearchResponse = {
  ok: boolean;
  query: string;
  count?: number;
  candidates: GrailSearchCandidate[];
  error?: string;
};

type CreateResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  grail?: {
    id: string;
  };
};

type Props = {
  existingGrails: ExistingGrail[];
};

function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return null;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `$${price}`;
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function GrailCandidatePicker({ existingGrails }: Props) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState<GrailSearchCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingId, setIsAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasResults = results.length > 0;
  const canSearch = query.trim().length > 1;

  const existingSkuSet = useMemo(() => {
    return new Set(
      existingGrails
        .map((grail) => normalizeText(grail.sku))
        .filter(Boolean)
    );
  }, [existingGrails]);

  const existingNameSet = useMemo(() => {
    return new Set(
      existingGrails
        .flatMap((grail) => [
          normalizeText(grail.official_product_name),
          normalizeText(grail.common_nickname),
          normalizeText(grail.nickname),
        ])
        .filter(Boolean)
    );
  }, [existingGrails]);

  const emptyStateText = useMemo(() => {
    if (!searchedQuery) {
      return "Search by nickname, SKU, model, or anything you know about the shoe.";
    }

    if (!hasResults) {
      return `No matches found for "${searchedQuery}". Try a SKU, nickname, or a broader search.`;
    }

    return null;
  }, [searchedQuery, hasResults]);

  async function handleSearch(event?: React.FormEvent) {
    event?.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      setIsSearching(true);
      setError(null);
      setSearchedQuery(trimmed);

      const response = await fetch(
        `/api/grails/search?q=${encodeURIComponent(trimmed)}`,
        { method: "GET" }
      );

      const data = (await response.json()) as SearchResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Search failed.");
      }

      setResults(data.candidates ?? []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAddCandidate(candidate: GrailSearchCandidate) {
  try {
    setIsAddingId(candidate.itemId);
    setError(null);

    const response = await fetch("/api/grails/create-from-candidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchText: searchedQuery || query.trim(),
        candidate,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      if (data.code === "DUPLICATE_GRAIL") {
        setError("Already in your grail list.");
        return;
      }

      throw new Error(data.error || "Failed to add grail.");
    }

    setQuery("");
    setSearchedQuery("");
    setResults([]);

    if (data.pricingWarning) {
      setError(`Grail added, but pricing failed: ${data.pricingWarning}`);
    }

    router.refresh();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to add grail.");
  } finally {
    setIsAddingId(null);
  }
}

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Add Grail</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Search with whatever you know. Pick the right shoe, then the app will
          save a richer grail record and pull sold comps.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by nickname, SKU, model, or brand"
          className="min-w-0 flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 transition focus:border-neutral-400"
        />
        <button
          type="submit"
          disabled={!canSearch || isSearching}
          className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {emptyStateText ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">
          {emptyStateText}
        </div>
      ) : null}

      {hasResults ? (
        <div className="mt-5 grid gap-3">
          {results.map((candidate) => {
            const displayTitle =
              candidate.inferred.officialProductName || candidate.title;

            const candidateSku = normalizeText(candidate.inferred.sku);
            const candidateName = normalizeText(displayTitle);
            const candidateNickname = normalizeText(
              candidate.inferred.commonNickname
            );

            const isDuplicate =
              (!!candidateSku && existingSkuSet.has(candidateSku)) ||
              (!!candidateName && existingNameSet.has(candidateName)) ||
              (!!candidateNickname && existingNameSet.has(candidateNickname));

            return (
              <div
                key={candidate.itemId}
                className={`flex flex-col gap-4 rounded-3xl border p-4 sm:flex-row ${
                  isDuplicate
                    ? "border-red-300 bg-red-50"
                    : "border-neutral-200"
                }`}
              >
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                  {candidate.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.imageUrl}
                      alt={candidate.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-base font-semibold text-neutral-900">
                        {displayTitle}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
                        {candidate.inferred.brand ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-1">
                            {candidate.inferred.brand}
                          </span>
                        ) : null}

                        {candidate.inferred.model ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-1">
                            {candidate.inferred.model}
                          </span>
                        ) : null}

                        {candidate.inferred.commonNickname ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-1">
                            {candidate.inferred.commonNickname}
                          </span>
                        ) : null}

                        {candidate.inferred.sku ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-1">
                            SKU {candidate.inferred.sku}
                          </span>
                        ) : null}

                        {candidate.condition ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-1">
                            {candidate.condition}
                          </span>
                        ) : null}

                        {isDuplicate ? (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                            Already added
                          </span>
                        ) : null}
                      </div>

                      {candidate.inferred.colorway ? (
                        <p className="mt-2 text-sm text-neutral-600">
                          Colorway: {candidate.inferred.colorway}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      <div className="text-right text-sm font-semibold text-neutral-900">
                        {formatPrice(candidate.price, candidate.currency) ||
                          "No price"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddCandidate(candidate)}
                      disabled={isAddingId === candidate.itemId || isDuplicate}
                      className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDuplicate
                        ? "Already added"
                        : isAddingId === candidate.itemId
                        ? "Adding..."
                        : "Add this grail"}
                    </button>

                    {candidate.itemWebUrl ? (
                      <a
                        href={candidate.itemWebUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm text-neutral-700"
                      >
                        View source
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}