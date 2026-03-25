"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SneakerOption = {
  id: string;
  nickname: string;
};

type WearEntryFormProps = {
  sneakers: SneakerOption[];
};

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function WearEntryForm({ sneakers }: WearEntryFormProps) {
  const router = useRouter();
  const [sneakerId, setSneakerId] = useState("");
  const [wearDate, setWearDate] = useState(getTodayString());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedSneakers = useMemo(() => {
    return [...sneakers].sort((a, b) => a.nickname.localeCompare(b.nickname));
  }, [sneakers]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!sneakerId) {
      setError("Please choose a shoe.");
      return;
    }

    if (!wearDate) {
      setError("Please choose a wear date.");
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
          notes: notes.trim() ? notes.trim() : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to log wear.");
      }

      setMessage("Wear logged.");
      setSneakerId("");
      setWearDate(getTodayString());
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log wear.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Log Wear</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a shoe and date to add to the wear log.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="sneakerId"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Shoe
          </label>
          <select
            id="sneakerId"
            value={sneakerId}
            onChange={(e) => setSneakerId(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
            disabled={saving}
          >
            <option value="">Select a shoe</option>
            {sortedSneakers.map((sneaker) => (
              <option key={sneaker.id} value={sneaker.id}>
                {sneaker.nickname}
              </option>
            ))}
          </select>
        </div>

        <div>
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

        <div>
          <label
            htmlFor="notes"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Notes <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Optional notes"
            disabled={saving}
          />
        </div>

        {message ? (
          <div className="rounded-2xl bg-green-50 px-3 py-2 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add to wear log"}
        </button>
      </form>
    </section>
  );
}