import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { enrichSneakerRecord } from "@/lib/enrich-sneaker";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: sneaker, error } = await supabase
      .from("sneakers")
      .select(`
        *,
        sneaker_photos (
          image_url,
          is_primary,
          photo_type
        )
      `)
      .eq("id", id)
      .single();

    if (error || !sneaker) {
      return NextResponse.json(
        { success: false, error: "Sneaker not found." },
        { status: 404 }
      );
    }

    const result = await enrichSneakerRecord(sneaker);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Enrichment failed." },
        { status: 500 }
      );
    }

    const s: NonNullable<typeof sneaker> = sneaker;
    const updates: Record<string, string | number | boolean | null> = {};

    function maybeSet(
      field: string,
      value: string | number | boolean | null
    ) {
      if (!s[field as keyof typeof s] && value !== null && value !== "") {
        updates[field] = value;
      }
    }

    maybeSet("brand", result.updates.brand ?? null);
    maybeSet("model", result.updates.model ?? null);
    maybeSet("official_product_name", result.updates.official_product_name ?? null);
    maybeSet("common_nickname", result.updates.common_nickname ?? null);
    maybeSet("colorway", result.updates.colorway ?? null);
    maybeSet("sku", result.updates.sku ?? null);
    maybeSet("release_year", result.updates.release_year ?? null);
    maybeSet("release_date", result.updates.release_date ?? null);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        updatedFields: [],
        sneaker: s,
      });
    }

    const { data: updatedSneaker, error: updateError } = await supabase
      .from("sneakers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updatedSneaker) {
      return NextResponse.json(
        { success: false, error: "Failed to save enriched sneaker." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedFields: Object.keys(updates),
      sneaker: updatedSneaker,
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