import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type SneakerRow = {
  id: string;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
};

function buildMissingFieldUpdates(shoe: SneakerRow) {
  const updates: Record<string, string> = {};

  const sourceText = [
    shoe.official_product_name,
    shoe.common_nickname,
    shoe.model,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!shoe.brand) {
    if (sourceText.includes("nike") || sourceText.includes("jordan")) {
      updates.brand = "Nike";
    } else if (sourceText.includes("adidas")) {
      updates.brand = "Adidas";
    } else if (sourceText.includes("new balance")) {
      updates.brand = "New Balance";
    }
  }

  if (!shoe.model) {
    if (sourceText.includes("jordan 1 mid")) {
      updates.model = "Air Jordan 1 Mid";
    } else if (sourceText.includes("dunk low")) {
      updates.model = "Nike Dunk Low";
    } else if (sourceText.includes("dunk high")) {
      updates.model = "Nike Dunk High";
    }
  }

  return updates;
}

export async function POST() {
  try {
    const { data: sneakers, error } = await supabase
      .from("sneakers")
      .select("id, brand, model, official_product_name, common_nickname, colorway, sku");

    if (error) {
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
      });
    }

    let updated = 0;

    for (const shoe of sneakers as SneakerRow[]) {
      const updates = buildMissingFieldUpdates(shoe);

      if (Object.keys(updates).length === 0) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("sneakers")
        .update(updates)
        .eq("id", shoe.id);

      if (!updateError) {
        updated += 1;
      }
    }

    return NextResponse.json({
      success: true,
      processed: sneakers.length,
      updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}