import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enrichSneakerRecord } from "@/lib/enrich-sneaker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Sneaker id is required." },
        { status: 400 }
      );
    }

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

    const { data: updatedSneaker, error: updateError } = await supabase
      .from("sneakers")
      .update(result.updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to save enriched sneaker." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedFields: result.updatedFields,
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