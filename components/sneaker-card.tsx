import Link from "next/link";

type SneakerCardProps = {
  sneaker: {
    id: string;
    nickname: string | null;
    brand: string | null;
    model: string | null;
    colorway?: string | null;
    image_url?: string | null;
  };
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
};

export default function SneakerCard({
  sneaker,
  onDelete,
  isDeleting = false,
}: SneakerCardProps) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      {sneaker.image_url ? (
        <img
          src={sneaker.image_url}
          alt={sneaker.nickname || sneaker.model || "Sneaker"}
          className="mb-3 aspect-square w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="mb-3 aspect-square w-full rounded-2xl bg-neutral-100" />
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-neutral-900">
          {sneaker.nickname || sneaker.model || "Untitled Pair"}
        </h3>

        <p className="text-xs text-neutral-600">
          {[sneaker.brand, sneaker.model].filter(Boolean).join(" ")}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Link
          href={`/sneakers/${sneaker.id}`}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
        >
          View
        </Link>

        <button
          type="button"
          onClick={() => onDelete?.(sneaker.id)}
          disabled={isDeleting}
          className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}