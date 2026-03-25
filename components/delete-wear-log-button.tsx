"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  wearLogId: string;
};

type DeleteResponse = {
  success: boolean;
  error?: string;
  id?: string;
};

export default function DeleteWearLogButton({ wearLogId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("Delete this wear log?");
    if (!confirmed) return;

    console.log("Deleting wear log id:", wearLogId);

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/wear-logs/${wearLogId}`, {
        method: "DELETE",
      });

      console.log("Delete response status:", response.status);
      console.log(
        "Delete response content-type:",
        response.headers.get("content-type")
      );

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      if (!isJson) {
        const text = await response.text();
        console.error("Delete wear log route returned non-JSON:", text);
        throw new Error("Delete route returned HTML instead of JSON");
      }

      const json = (await response.json()) as DeleteResponse;
      console.log("Delete response json:", json);

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to delete wear log");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to delete wear log"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting || isPending}
      className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}