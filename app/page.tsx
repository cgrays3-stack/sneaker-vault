import { AppHeader } from "../components/app-header";
import { BottomNav } from "../components/bottom-nav";
import { StatCard } from "../components/stat-card";
import { supabase } from "../lib/supabase";

type SneakerDashboardRow = {
  id: string;
  estimated_value_low: number | null;
  estimated_value_mid: number | null;
  estimated_value_high: number | null;
  condition: string | null;
  // Optional on purpose so the page does not depend on it existing
  wear_count?: number | null;
};

function getBestSneakerValue(row: Pick<
  SneakerDashboardRow,
  "estimated_value_low" | "estimated_value_mid" | "estimated_value_high"
>): number {
  const low = row.estimated_value_low;
  const mid = row.estimated_value_mid;
  const high = row.estimated_value_high;

  if (typeof mid === "number") return mid;
  if (typeof low === "number" && typeof high === "number") return (low + high) / 2;
  if (typeof low === "number") return low;
  if (typeof high === "number") return high;

  return 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function isDeadstock(condition: string | null): boolean {
  if (!condition) return false;

  const normalized = condition.trim().toLowerCase();

  return [
    "deadstock",
    "ds",
    "new",
    "brand new",
    "new with box",
    "new in box",
    "vnnds", // optional depending on how you classify
  ].includes(normalized);
}

export default async function HomePage() {
  // Only select columns you are confident exist on the sneakers table
  const { data: sneakers, error, count } = await supabase
    .from("sneakers")
    .select(
      "id, estimated_value_low, estimated_value_mid, estimated_value_high, condition",
      { count: "exact" }
    );

  if (error) {
    console.error("Failed to load dashboard data:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return (
      <>
        <AppHeader />

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Dashboard</h2>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load dashboard data.
          </div>
        </section>

        <BottomNav />
      </>
    );
  }

  const rows: SneakerDashboardRow[] = sneakers ?? [];

  const totalPairs = count ?? rows.length;

  const totalValue = rows.reduce((sum, row) => {
    return sum + getBestSneakerValue(row);
  }, 0);

  const deadstock = rows.reduce((sum, row) => {
    return sum + (isDeadstock(row.condition) ? 1 : 0);
  }, 0);

  // Safe fallback:
  // If sneakers rows do not include wear_count, this remains 0 instead of crashing.
  const wearsLogged = rows.reduce((sum, row) => {
    return sum + (typeof row.wear_count === "number" ? row.wear_count : 0);
  }, 0);

  return (
    <>
      <AppHeader />

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Dashboard</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Pairs" value={String(totalPairs)} />
          <StatCard label="Total Value" value={formatCurrency(totalValue)} />
          <StatCard label="Wears Logged" value={String(wearsLogged)} />
          <StatCard label="Deadstock" value={String(deadstock)} />
        </div>
      </section>

      <BottomNav />
    </>
  );
}