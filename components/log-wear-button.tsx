"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LogWearButtonProps = {
  sneakerId: string;
  defaultDate?: string;
};

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function LogWearButton({
  sneakerId,
  defaultDate,
}: LogWearButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [wearDate, setWearDate] = useState(defaultDate ?? getTodayString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    if (!wearDate) {
      setError("Please choose a date.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/wears", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sneakerId,
          wearDate,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to log wear.");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log wear.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Log Wear
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Log Wear</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose the date you wore this pair.
              </p>
            </div>

            <div className="mb-4">
              <label
                htmlFor="wearDate"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Date worn
              </label>
              <input
                id="wearDate"
                type="date"
                value={wearDate}
                onChange={(e) => setWearDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                disabled={saving}
              />
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save wear"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}