"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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

function extractStoragePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/sneaker-photos/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

export default function CollectionClient({
  initialSneakers,
}: CollectionClientProps) {
  const router = useRouter();
  const [sneakers, setSneakers] = useState(initialSneakers);
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
      const { data: photoRows, error: photosReadError } = await supabase
        .from("sneaker_photos")
        .select("id, image_url")
        .eq("sneaker_id", sneakerId);

      if (photosReadError) {
        throw photosReadError;
      }

      const storagePaths =
        photoRows
          ?.map((row) => extractStoragePathFromPublicUrl(row.image_url))
          .filter((value): value is string => Boolean(value)) ?? [];

      if (storagePaths.length > 0) {
        const { error: storageDeleteError } = await supabase.storage
          .from("sneaker-photos")
          .remove(storagePaths);

        if (storageDeleteError) {
          console.warn("Storage delete warning:", storageDeleteError);
        }
      }

      const { error: photoDeleteError } = await supabase
        .from("sneaker_photos")
        .delete()
        .eq("sneaker_id", sneakerId);

      if (photoDeleteError) {
        throw photoDeleteError;
      }

      const { error: wearLogDeleteError } = await supabase
        .from("wear_logs")
        .delete()
        .eq("sneaker_id", sneakerId);

      if (wearLogDeleteError) {
        throw wearLogDeleteError;
      }

      const { error: sneakerDeleteError } = await supabase
        .from("sneakers")
        .delete()
        .eq("id", sneakerId);

      if (sneakerDeleteError) {
        throw sneakerDeleteError;
      }

      setSneakers((prev) => prev.filter((sneaker) => sneaker.id !== sneakerId));
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete sneaker.");
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
        {sneakers.map((sneaker) => (
          <SneakerCard
            key={sneaker.id}
            sneaker={sneaker}
            onDelete={handleDeleteSneaker}
            isDeleting={deletingId === sneaker.id}
          />
        ))}
      </div>
    </div>
  );
}