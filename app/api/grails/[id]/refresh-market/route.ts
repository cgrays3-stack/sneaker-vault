import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getEbayErrorMessage,
  searchSoldListingsForBothConditions,
} from "@/lib/ebay";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type GrailRow = {
  id: string;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  desired_condition: string | null;
};

function hasEnoughDataToSearch(grail: GrailRow): boolean {
  return Boolean(
    grail.sku ||
      grail.official_product_name ||
      grail.common_nickname ||
      (grail.brand && grail.model),
  );
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: grail, error } = await supabaseAdmin
      .from("grails")
      .select(
        `
        id,
        brand,
        model,
        official_product_name,
        common_nickname,
        colorway,
        sku,
        size,
        desired_condition
      `,
      )
      .eq("id", id)
      .single();

    if (error || !grail) {
      return NextResponse.json(
        { ok: false, error: "Grail not found." },
        { status: 404 },
      );
    }

    if (!hasEnoughDataToSearch(grail as GrailRow)) {
      return NextResponse.json(
        { ok: false, error: "Not enough grail data to refresh sold pricing." },
        { status: 400 },
      );
    }

    let pricingWarning: string | null = null;

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

      const { data: updatedGrail, error: updateError } = await supabaseAdmin
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
        .eq("id", id)
        .select("*")
        .single();

      if (updateError || !updatedGrail) {
        return NextResponse.json(
          {
            ok: false,
            error: updateError?.message || "Failed to save grail pricing.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        grail: updatedGrail,
        pricing,
      });
    } catch (error) {
      pricingWarning = getEbayErrorMessage(error);

      return NextResponse.json({
        ok: true,
        updated: false,
        pricingWarning,
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh grail pricing.",
      },
      { status: 500 },
    );
  }
}