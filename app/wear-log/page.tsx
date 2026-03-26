import { AppHeader } from "../../components/app-header";
import { BottomNav } from "../../components/bottom-nav";
import DeleteWearLogButton from "../../components/delete-wear-log-button";
import WearEntryForm from "../../components/wear-entry-form";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

type WearLogRow = {
  id: string;
  sneaker_id: string;
  wear_date: string;
  notes: string | null;
  sneakers: {
    nickname: string;
    sneaker_photos?: {
      image_url: string;
      is_primary: boolean;
      photo_type: string;
    }[];
  } | null;
};

type SneakerOption = {
  id: string;
  nickname: string;
};

async function getWearLogs(): Promise<WearLogRow[]> {
  const { data, error } = await supabase
    .from("wear_logs")
    .select(`
      id,
      sneaker_id,
      wear_date,
      notes,
      sneakers (
        nickname,
        sneaker_photos (
          image_url,
          is_primary,
          photo_type
        )
      )
    `)
    .order("wear_date", { ascending: false });

  if (error || !data) {
    console.error("Error loading wear logs:", error);
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    sneaker_id: row.sneaker_id,
    wear_date: row.wear_date,
    notes: row.notes,
    sneakers: Array.isArray(row.sneakers)
      ? row.sneakers[0] ?? null
      : row.sneakers ?? null,
  }));
}

async function getSneakerOptions(): Promise<SneakerOption[]> {
  const { data, error } = await supabase
    .from("sneakers")
    .select("id, nickname")
    .order("nickname", { ascending: true });

  if (error) {
    console.error("Error loading sneakers for wear form:", error);
    return [];
  }

  return (data ?? []) as SneakerOption[];
}

function formatWearDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

export default async function WearLogPage() {
  const [wearLogs, sneakers] = await Promise.all([
    getWearLogs(),
    getSneakerOptions(),
  ]);

  return (
    <>
      <AppHeader />

      <div className="space-y-4">
        <WearEntryForm sneakers={sneakers} />

        <section className="rounded-3xl bg-white p-5 shadow-sm text-neutral-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Wear Log</h2>
            <p className="text-sm text-slate-500">{wearLogs.length} entries</p>
          </div>

          {wearLogs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-slate-500">
              No wear logs yet.
            </div>
          ) : (
            <div className="space-y-3">
              {wearLogs.map((log) => {
                const hero =
                  log.sneakers?.sneaker_photos?.find(
                    (p) => p.is_primary === true || p.photo_type === "hero"
                  ) ?? null;

                return (
                  <div key={log.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-xs text-slate-500">
                        {hero?.image_url ? (
                          <img
                            src={hero.image_url}
                            alt={log.sneakers?.nickname ?? "shoe"}
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          "shoe"
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">
                          {log.sneakers?.nickname ?? "Unknown Pair"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatWearDate(log.wear_date)}
                        </p>

                        {log.notes ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {log.notes}
                          </p>
                        ) : null}
                      </div>

                      <DeleteWearLogButton wearLogId={log.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </>
  );
}