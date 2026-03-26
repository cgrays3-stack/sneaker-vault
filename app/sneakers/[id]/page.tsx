import { AppHeader } from "../../../components/app-header";
import { BottomNav } from "../../../components/bottom-nav";
import { DetailBlock } from "../../../components/detail-block";
import { EnrichShoeButton } from "../../../components/enrich-shoe-button";
import { InfoRow } from "../../../components/info-row";
import { MarketInsights } from "../../../components/market-insights";
import { supabase } from "../../../lib/supabase";
import { ClearMarketValuesButton } from "../../../components/clear-market-values-button";
import SneakerEditForm from "../../../components/sneaker-edit-form";
import LogWearButton from "../../../components/log-wear-button";

type Sneaker = {
  id: string;
  nickname: string;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  condition: string | null;
  box_condition: string | null;
  purchase_source: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  estimated_value_low: number | null;
  estimated_value_mid: number | null;
  estimated_value_high: number | null;
  notes: string | null;
};

type SneakerPhoto = {
  image_url: string;
  is_primary: boolean;
  photo_type: string;
};

async function getSneakerById(id: string) {
  const { data, error } = await supabase
    .from("sneakers")
    .select(
      `
      *,
      sneaker_photos (
        image_url,
        is_primary,
        photo_type
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error loading sneaker:", error);
    return null;
  }

  return data as Sneaker & { sneaker_photos?: SneakerPhoto[] };
}

// 🔹 NEW: get last worn
async function getLastWorn(sneakerId: string) {
  const { data, error } = await supabase
    .from("wear_logs")
    .select("wear_date")
    .eq("sneaker_id", sneakerId)
    .order("wear_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error loading last worn:", error);
    return null;
  }

  return data?.wear_date ?? null;
}

// 🔹 OPTIONAL: total wear count
async function getWearCount(sneakerId: string) {
  const { count, error } = await supabase
    .from("wear_logs")
    .select("*", { count: "exact", head: true })
    .eq("sneaker_id", sneakerId);

  if (error) {
    console.error("Error loading wear count:", error);
    return 0;
  }

  return count ?? 0;
}

// 🔹 NEW: date formatter
function formatDateOnly(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

function money(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function SneakerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [shoe, lastWorn, wearCount] = await Promise.all([
    getSneakerById(id),
    getLastWorn(id),
    getWearCount(id),
  ]);

  if (!shoe) {
    return (
      <>
        <AppHeader />
        <section className="rounded-3xl bg-white p-5 shadow-sm text-neutral-900">
          Sneaker not found.
        </section>
        <BottomNav />
      </>
    );
  }

  const hero =
    shoe.sneaker_photos?.find(
      (p) => p.is_primary === true || p.photo_type === "hero"
    ) ?? null;

  return (
    <>
      <AppHeader />

      <section className="rounded-3xl bg-white p-5 shadow-sm text-neutral-900">
        <div className="flex h-72 items-center justify-center overflow-hidden rounded-3xl bg-slate-50 text-slate-500">
          {hero?.image_url ? (
            <img
              src={hero.image_url}
              alt={shoe.nickname}
              className="h-full w-full object-contain p-4"
            />
          ) : (
            "hero photo"
          )}
        </div>

        <div className="mt-4">
          <h2 className="text-2xl font-semibold">{shoe.nickname}</h2>

          <p className="text-slate-500">
            {shoe.official_product_name ?? shoe.model ?? "—"}
          </p>

          {/* 🔹 NEW: wear info */}
          <p className="mt-1 text-sm text-slate-500">
            Last worn: {lastWorn ? formatDateOnly(lastWorn) : "Never logged"}
          </p>

          <p className="text-sm text-slate-400">
            Total wears: {wearCount}
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <LogWearButton sneakerId={id} />
            <EnrichShoeButton sneakerId={id} />
            <ClearMarketValuesButton sneakerId={id} />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <DetailBlock title="Edit Identity">
            <SneakerEditForm
              sneaker={{
                id: shoe.id,
                nickname: shoe.nickname,
                brand: shoe.brand,
                model: shoe.model,
                official_product_name: shoe.official_product_name,
                common_nickname: shoe.common_nickname,
                colorway: shoe.colorway,
                sku: shoe.sku,
                size: shoe.size,
                condition: shoe.condition,
                box_condition: shoe.box_condition,
              }}
            />
          </DetailBlock>

          <DetailBlock title="Ownership">
            <InfoRow
              label="Purchase source"
              value={shoe.purchase_source ?? "—"}
            />
            <InfoRow
              label="Purchase date"
              value={shoe.purchase_date ?? "—"}
            />
            <InfoRow
              label="Purchase price"
              value={money(shoe.purchase_price)}
            />
          </DetailBlock>

          <DetailBlock title="Stored market value">
            <InfoRow label="Low" value={money(shoe.estimated_value_low)} />
            <InfoRow label="Mid" value={money(shoe.estimated_value_mid)} />
            <InfoRow label="High" value={money(shoe.estimated_value_high)} />
          </DetailBlock>

          <DetailBlock title="Notes">
            <div className="text-sm text-slate-700">
              {shoe.notes ?? "—"}
            </div>
          </DetailBlock>
        </div>
      </section>

      <MarketInsights sneakerId={id} />

      <BottomNav />
    </>
  );
}