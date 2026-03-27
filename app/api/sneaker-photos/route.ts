import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { sneaker_id, photo_type, image_url, is_primary } = body;

    if (!sneaker_id || !photo_type || !image_url) {
      return NextResponse.json(
        { success: false, error: "Missing required photo fields." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("sneaker_photos")
      .insert({
        sneaker_id,
        photo_type,
        image_url,
        is_primary: Boolean(is_primary),
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    revalidatePath("/collection");

    return NextResponse.json({ success: true, photo: data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create photo record",
      },
      { status: 500 }
    );
  }
}