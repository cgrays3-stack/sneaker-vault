import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getEbayErrorMessage,
  searchSoldListingsForBothConditions,
} from "@/lib/ebay";

export const runtime = "nodejs";

type CreateGrailBody = {
  nickname?: string | null;
  brand?: string | null;
  model?: string | null;
  official_product_name?: string | null;
  common_nickname?: string | null;
  colorway?: string | null;
  sku?: string | null;
  size?: string | null;
  desired_condition?: string | null;
  target_price?: number | null;
  max_price?: number | null;
  priority?: number | null;
  notes?: string | null;
};

const ALLOWED_CONDITIONS = new Set([
  "Used",
  "Pre-owned",
  "VNDS",
  "Deadstock",
  "New",
  "New with Box",
]);

function cleanNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

function cleanRequiredString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCondition(value: unknown): string | null {
  const cleaned = cleanNullableString(value);
  if (!cleaned) return null;
  return ALLOWED_CONDITIONS.has(cleaned) ? cleaned : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hasEnoughDataToSearch(input: {
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  sku: string | null;
}): boolean {
  return Boolean(
    input.sku ||
      input.official_product_name ||
      input.common_nickname ||
      (input.brand && input.model)
  );
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("grails")
    .select("*")
    .order("priority", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load grails." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, grails: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateGrailBody;

    const nickname = cleanRequiredString(body.nickname);
    if (!nickname) {
      return NextResponse.json(
        { success: false, error: "Nickname is required." },
        { status: 400 }
      );
    }

    const insertPayload = {
      nickname,
      brand: cleanNullableString(body.brand),
      model: cleanNullableString(body.model),
      official_product_name: cleanNullableString(body.official_product_name),
      common_nickname: cleanNullableString(body.common_nickname),
      colorway: cleanNullableString(body.colorway),
      sku: cleanNullableString(body.sku),
      size: cleanNullableString(body.size),
      desired_condition: normalizeCondition(body.desired_condition),
      target_price: toNullableNumber(body.target_price),
      max_price: toNullableNumber(body.max_price),
      priority: toNullableNumber(body.priority),
      notes: cleanNullableString(body.notes),
      status: "active",
    };

    const { data: grail, error } = await supabaseAdmin
      .from("grails")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !grail) {
      console.error("Failed to create grail:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create grail." },
        { status: 500 }
      );
    }

    let updatedGrail = grail;
    let pricingWarning: string | null = null;

    if (
      hasEnoughDataToSearch({
        brand: grail.brand ?? null,
        model: grail.model ?? null,
        official_product_name: grail.official_product_name ?? null,
        common_nickname: grail.common_nickname ?? null,
        sku: grail.sku ?? null,
      })
    ) {
      try {
        const pricing = await searchSoldListingsForBothConditions({
          brand: grail.brand ?? null,
          model: grail.model ?? null,
          colorway: grail.colorway ?? null,
          sku: grail.sku ?? null,
          size: grail.size ?? null,
          condition: grail.desired_condition ?? null,
          officialProductName: grail.official_product_name ?? null,
          commonNickname: grail.common_nickname ?? null,
        });

        const { data: pricedGrail, error: updateError } = await supabaseAdmin
          .from("grails")
          .update({
            used_sold_price_low: pricing.used.prices.low,
            used_sold_price_mid: pricing.used.prices.median,
            used_sold_price_high: pricing.used.prices.high,
            new_sold_price_low: pricing.new.prices.low,
            new_sold_price_mid: pricing.new.prices.median,
            new_sold_price_high: pricing.new.prices.high,
            used_sold_comp_count: pricing.used.compCount,
            new_sold_comp_count: pricing.new.compCount,
            used_sold_confidence: pricing.used.confidence,
            new_sold_confidence: pricing.new.confidence,
            sold_pricing_source: "ebay-sold-completed",
            sold_pricing_last_refreshed_at: new Date().toISOString(),
            sold_pricing_notes: {
              used: {
                searchQuery: pricing.used.searchQuery,
                emptyReason: pricing.used.emptyReason ?? null,
                debug: pricing.used.debug ?? null,
                sampleListings: pricing.used.sampleListings ?? [],
              },
              new: {
                searchQuery: pricing.new.searchQuery,
                emptyReason: pricing.new.emptyReason ?? null,
                debug: pricing.new.debug ?? null,
                sampleListings: pricing.new.sampleListings ?? [],
              },
            },
          })
          .eq("id", grail.id)
          .select("*")
          .single();

        if (!updateError && pricedGrail) {
          updatedGrail = pricedGrail;
        } else {
          pricingWarning =
            updateError?.message || "Pricing failed after grail creation.";
        }
      } catch (error) {
        pricingWarning = getEbayErrorMessage(error);
      }
    }

    revalidatePath("/grails");

    return NextResponse.json({
      success: true,
      grail: updatedGrail,
      pricingWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create grail.",
      },
      { status: 500 }
    );
  }
}