import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateBody = {
  nickname?: string | null;
  brand?: string | null;
  model?: string | null;
  official_product_name?: string | null;
  common_nickname?: string | null;
  colorway?: string | null;
  sku?: string | null;
  size?: string | null;
  condition?: string | null;
  box_condition?: string | null;
};

const ALLOWED_CONDITIONS = new Set([
  "Used",
  "Pre-owned",
  "VNDS",
  "Deadstock",
  "New",
  "New with Box",
]);

const ALLOWED_BOX_CONDITIONS = new Set([
  "No Box",
  "Poor",
  "Fair",
  "Good",
  "Very Good",
  "Excellent",
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

function normalizeBoxCondition(value: unknown): string | null {
  const cleaned = cleanNullableString(value);
  if (!cleaned) return null;
  return ALLOWED_BOX_CONDITIONS.has(cleaned) ? cleaned : null;
}

function extractStoragePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/sneaker-photos/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateBody;

    const nickname = cleanRequiredString(body.nickname);

    if (!nickname) {
      return NextResponse.json(
        { success: false, error: "Nickname is required." },
        { status: 400 }
      );
    }

    const updatePayload = {
      nickname,
      brand: cleanNullableString(body.brand),
      model: cleanNullableString(body.model),
      official_product_name: cleanNullableString(body.official_product_name),
      common_nickname: cleanNullableString(body.common_nickname),
      colorway: cleanNullableString(body.colorway),
      sku: cleanNullableString(body.sku),
      size: cleanNullableString(body.size),
      condition: normalizeCondition(body.condition),
      box_condition: normalizeBoxCondition(body.box_condition),
    };

    const { data, error } = await supabaseAdmin
      .from("sneakers")
      .update(updatePayload)
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Failed to update sneaker:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: "Sneaker not found.", id },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, sneaker: data[0] });
  } catch (error) {
    console.error("PATCH sneaker error:", error);

    return NextResponse.json(
      { success: false, error: "Unexpected error updating sneaker." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    console.log("DELETE sneaker id received:", id);

    const { data: photoRows, error: photosReadError } = await supabaseAdmin
      .from("sneaker_photos")
      .select("id, image_url")
      .eq("sneaker_id", id);

    if (photosReadError) {
      console.error("Failed to load sneaker photos for delete:", photosReadError);
      return NextResponse.json(
        { success: false, error: photosReadError.message },
        { status: 500 }
      );
    }

    const storagePaths =
      photoRows
        ?.map((row) => extractStoragePathFromPublicUrl(row.image_url))
        .filter((value): value is string => Boolean(value)) ?? [];

    if (storagePaths.length > 0) {
      const { error: storageDeleteError } = await supabaseAdmin.storage
        .from("sneaker-photos")
        .remove(storagePaths);

      if (storageDeleteError) {
        console.warn("Storage delete warning:", storageDeleteError);
      }
    }

    const { error: photoDeleteError } = await supabaseAdmin
      .from("sneaker_photos")
      .delete()
      .eq("sneaker_id", id);

    if (photoDeleteError) {
      console.error("Failed to delete sneaker photos rows:", photoDeleteError);
      return NextResponse.json(
        { success: false, error: photoDeleteError.message },
        { status: 500 }
      );
    }

    const { error: wearLogDeleteError } = await supabaseAdmin
      .from("wear_logs")
      .delete()
      .eq("sneaker_id", id);

    if (wearLogDeleteError) {
      console.error("Failed to delete wear logs:", wearLogDeleteError);
      return NextResponse.json(
        { success: false, error: wearLogDeleteError.message },
        { status: 500 }
      );
    }

    const { data: deletedSneaker, error: sneakerDeleteError } =
      await supabaseAdmin
        .from("sneakers")
        .delete()
        .eq("id", id)
        .select("id");

    if (sneakerDeleteError) {
      console.error("Failed to delete sneaker:", sneakerDeleteError);
      return NextResponse.json(
        { success: false, error: sneakerDeleteError.message },
        { status: 500 }
      );
    }

    if (!deletedSneaker || deletedSneaker.length === 0) {
      return NextResponse.json(
        { success: false, error: "Sneaker not found.", id },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedSneaker: deletedSneaker[0],
    });
  } catch (error) {
    console.error("DELETE sneaker error:", error);

    return NextResponse.json(
      { success: false, error: "Unexpected error deleting sneaker." },
      { status: 500 }
    );
  }
}