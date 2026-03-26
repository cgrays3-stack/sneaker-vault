import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { searchActiveListings } from "@/lib/ebay";

export const runtime = "nodejs";

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

export async function POST() {
  try {
    const { data: sneakers, error } = await supabaseAdmin
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
      );

    if (error) {
      console.error("Failed to load sneakers for market refresh:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      return NextResponse.json(
        { success: false, error: "Failed to load sneakers." },
        { status: 500 }
      );
    }

    if (!sneakers || sneakers.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      });
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const shoe of sneakers as SneakerRow[]) {
      try {
        if (!hasEnoughDataToSearch(shoe)) {
          skipped += 1;
          continue;
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
          skipped += 1;
          continue;
        }

        const { error: updateError } = await supabaseAdmin
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
          .eq("id", shoe.id);

        if (updateError) {
          console.error(`Failed to update sneaker ${shoe.id}:`, {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
          });

          failed += 1;
          continue;
        }

        updated += 1;
      } catch (error) {
        console.error(`Failed market refresh for sneaker ${shoe.id}:`, error);
        failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      processed: sneakers.length,
      updated,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("Unexpected market refresh error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh market values.",
      },
      { status: 500 }
    );
  }
}