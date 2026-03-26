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

    const { error } = await supabaseAdmin
      .from("sneakers")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      console.error("Failed to update sneaker:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      return NextResponse.json(
        { success: false, error: "Failed to update sneaker." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH sneaker error:", error);

    return NextResponse.json(
      { success: false, error: "Unexpected error updating sneaker." },
      { status: 500 }
    );
  }
}