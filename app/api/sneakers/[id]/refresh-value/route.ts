import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { searchActiveListings } from "@/lib/ebay";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SneakerRow = {
  id: string;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  condition: string | null;
};

function hasEnoughDataToSearch(shoe: SneakerRow): boolean {
  return Boolean(
    shoe.sku ||
      shoe.official_product_name ||
      shoe.common_nickname ||
      (shoe.brand && shoe.model)
  );
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: shoe, error } = await supabase
      .from("sneakers")
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
        condition
      `
      )
      .eq("id", id)
      .single();

    if (error || !shoe) {
      return NextResponse.json(
        { success: false, error: "Sneaker not found." },
        { status: 404 }
      );
    }

    if (!hasEnoughDataToSearch(shoe as SneakerRow)) {
      return NextResponse.json(
        { success: false, error: "Not enough sneaker data to refresh market value." },
        { status: 400 }
      );
    }

    const estimate = await searchActiveListings({
      brand: shoe.brand,
      model: shoe.model,
      colorway: shoe.colorway,
      sku: shoe.sku,
      size: shoe.size,
      condition: shoe.condition,
      officialProductName: shoe.official_product_name,
      commonNickname: shoe.common_nickname,
    });

    if (
      estimate.compCount === 0 ||
      (estimate.prices.low === null &&
        estimate.prices.median === null &&
        estimate.prices.high === null)
    ) {
      return NextResponse.json({
        success: true,
        updated: false,
        reason: "No usable market comps found.",
      });
    }

    const { error: updateError } = await supabase
      .from("sneakers")
      .update({
        estimated_value_low: estimate.prices.low,
        estimated_value_mid: estimate.prices.median,
        estimated_value_high: estimate.prices.high,
        market_value_confidence: estimate.confidence,
        market_value_comp_count: estimate.compCount,
        market_value_condition_basis: estimate.marketBasis,
        market_value_last_updated: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update sneaker market value:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });

      return NextResponse.json(
        { success: false, error: "Failed to save market value." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: true,
      estimate,
    });
  } catch (error) {
    console.error("Unexpected single refresh error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh market value.",
      },
      { status: 500 }
    );
  }
}